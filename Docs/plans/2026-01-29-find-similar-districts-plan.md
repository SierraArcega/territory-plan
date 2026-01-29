# Find Similar Districts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a feature that helps reps find districts in the same state with similar characteristics, then add them to territory plans.

**Architecture:** New collapsible UI component in SidePanel that queries a new API endpoint. The API calculates similarity based on user-selected metrics (up to 3) and returns the top 10 closest matches. Results are displayed as cards and highlighted on the map via store state.

**Tech Stack:** Next.js API routes, Prisma, React components, Zustand store, Vitest for testing

---

## Task 1: Add Similar Districts State to Store

**Files:**
- Modify: `src/lib/store.ts`

**Step 1: Add state and actions to store**

Add these new state fields and actions to the MapState interface and store:

```typescript
// Add to MapState interface (around line 54):
  // Similar districts for "Find Similar" feature
  similarDistrictLeaids: string[];

// Add to MapActions interface (around line 74):
  // Similar districts actions
  setSimilarDistrictLeaids: (leaids: string[]) => void;
  clearSimilarDistricts: () => void;
```

Add initial state and action implementations:

```typescript
// Add to initial state (around line 119):
  similarDistrictLeaids: [],

// Add to actions (around line 175):
  setSimilarDistrictLeaids: (leaids) => set({ similarDistrictLeaids: leaids }),
  clearSimilarDistricts: () => set({ similarDistrictLeaids: [] }),
```

**Step 2: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: add similarDistrictLeaids state to map store

- Added similarDistrictLeaids array for tracking similar district results
- Added setSimilarDistrictLeaids and clearSimilarDistricts actions"
```

---

## Task 2: Create Similar Districts API Endpoint

**Files:**
- Create: `src/app/api/districts/similar/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Metric key to database field mapping
type MetricKey =
  | "enrollment"
  | "locale"
  | "medianIncome"
  | "expenditurePerPupil"
  | "avgSalary"
  | "ellPercent"
  | "swdPercent"
  | "pocRate";

type ToleranceLevel = "tight" | "medium" | "loose";

// Tolerance percentages for each level
const TOLERANCE_MAP: Record<ToleranceLevel, number> = {
  tight: 0.15,   // ±15%
  medium: 0.30,  // ±30%
  loose: 0.50,   // ±50%
};

// Locale tolerance (categorical, ±N values)
const LOCALE_TOLERANCE: Record<ToleranceLevel, number> = {
  tight: 1,
  medium: 1,
  loose: 2,
};

interface SimilarDistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  distanceScore: number;
  metrics: Record<string, { value: number | string | null; sourceValue: number | string | null }>;
  territoryPlanIds: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const leaid = searchParams.get("leaid");
    const metricsParam = searchParams.get("metrics");
    const tolerance = (searchParams.get("tolerance") || "medium") as ToleranceLevel;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 25);

    // Validate required params
    if (!leaid) {
      return NextResponse.json({ error: "leaid is required" }, { status: 400 });
    }
    if (!metricsParam) {
      return NextResponse.json({ error: "metrics is required" }, { status: 400 });
    }

    const metrics = metricsParam.split(",") as MetricKey[];
    if (metrics.length === 0 || metrics.length > 3) {
      return NextResponse.json(
        { error: "Must select 1-3 metrics" },
        { status: 400 }
      );
    }

    // Fetch source district with all needed data
    const sourceDistrict = await prisma.district.findUnique({
      where: { leaid },
      include: {
        educationData: true,
        enrollmentDemographics: true,
        territoryPlans: { select: { planId: true } },
      },
    });

    if (!sourceDistrict) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    // Calculate source metric values
    const sourceMetrics = calculateMetrics(sourceDistrict);

    // Check if all requested metrics have values
    for (const metric of metrics) {
      if (sourceMetrics[metric] === null) {
        return NextResponse.json(
          { error: `Source district is missing data for metric: ${metric}` },
          { status: 400 }
        );
      }
    }

    // Get tolerance value
    const tolerancePercent = TOLERANCE_MAP[tolerance];
    const localeTolerance = LOCALE_TOLERANCE[tolerance];

    // Find similar districts in the same state
    const candidates = await prisma.district.findMany({
      where: {
        stateAbbrev: sourceDistrict.stateAbbrev,
        leaid: { not: leaid }, // Exclude source district
      },
      include: {
        educationData: true,
        enrollmentDemographics: true,
        territoryPlans: { select: { planId: true } },
      },
    });

    // Filter and score candidates
    const results: SimilarDistrictResult[] = [];

    for (const candidate of candidates) {
      const candidateMetrics = calculateMetrics(candidate);
      let totalDistance = 0;
      let allMetricsMatch = true;
      const metricDetails: Record<string, { value: number | string | null; sourceValue: number | string | null }> = {};

      for (const metric of metrics) {
        const sourceValue = sourceMetrics[metric];
        const candidateValue = candidateMetrics[metric];

        // Skip if candidate is missing this metric
        if (candidateValue === null) {
          allMetricsMatch = false;
          break;
        }

        // Handle locale (categorical) differently
        if (metric === "locale") {
          const diff = Math.abs((sourceValue as number) - (candidateValue as number));
          if (diff > localeTolerance) {
            allMetricsMatch = false;
            break;
          }
          // Normalize locale distance to 0-1 range
          totalDistance += diff / 12; // 12 is max locale difference
          metricDetails[metric] = {
            value: candidateValue,
            sourceValue: sourceValue,
          };
        } else {
          // Numeric metric - check percentage difference
          const percentDiff = Math.abs((candidateValue as number) - (sourceValue as number)) / (sourceValue as number);
          if (percentDiff > tolerancePercent) {
            allMetricsMatch = false;
            break;
          }
          totalDistance += percentDiff;
          metricDetails[metric] = {
            value: candidateValue,
            sourceValue: sourceValue,
          };
        }
      }

      if (allMetricsMatch) {
        results.push({
          leaid: candidate.leaid,
          name: candidate.name,
          stateAbbrev: candidate.stateAbbrev || "",
          distanceScore: totalDistance / metrics.length, // Average distance
          metrics: metricDetails,
          territoryPlanIds: candidate.territoryPlans.map((tp) => tp.planId),
        });
      }
    }

    // Sort by distance (closest first) and limit
    results.sort((a, b) => a.distanceScore - b.distanceScore);
    const topResults = results.slice(0, limit);

    return NextResponse.json({
      results: topResults,
      sourceMetrics: Object.fromEntries(
        metrics.map((m) => [m, sourceMetrics[m]])
      ),
      total: results.length,
    });
  } catch (error) {
    console.error("Error finding similar districts:", error);
    return NextResponse.json(
      { error: "Failed to find similar districts" },
      { status: 500 }
    );
  }
}

// Helper to calculate all metrics for a district
function calculateMetrics(district: {
  enrollment: number | null;
  urbanCentricLocale: number | null;
  ellStudents: number | null;
  specEdStudents: number | null;
  educationData: {
    medianHouseholdIncome: unknown;
    expenditurePerPupil: unknown;
    salariesTotal: unknown;
    staffTotalFte: unknown;
  } | null;
  enrollmentDemographics: {
    totalEnrollment: number | null;
    enrollmentWhite: number | null;
  } | null;
}): Record<MetricKey, number | null> {
  const ed = district.educationData;
  const dem = district.enrollmentDemographics;

  // Calculate average salary (total salaries / total FTE)
  let avgSalary: number | null = null;
  if (ed?.salariesTotal && ed?.staffTotalFte) {
    const salaries = Number(ed.salariesTotal);
    const fte = Number(ed.staffTotalFte);
    if (fte > 0) {
      avgSalary = salaries / fte;
    }
  }

  // Calculate ELL percentage
  let ellPercent: number | null = null;
  if (district.ellStudents !== null && district.enrollment && district.enrollment > 0) {
    ellPercent = (district.ellStudents / district.enrollment) * 100;
  }

  // Calculate SWD percentage (Special Ed)
  let swdPercent: number | null = null;
  if (district.specEdStudents !== null && district.enrollment && district.enrollment > 0) {
    swdPercent = (district.specEdStudents / district.enrollment) * 100;
  }

  // Calculate POC rate (non-white / total)
  let pocRate: number | null = null;
  if (dem?.totalEnrollment && dem.totalEnrollment > 0 && dem.enrollmentWhite !== null) {
    const nonWhite = dem.totalEnrollment - dem.enrollmentWhite;
    pocRate = (nonWhite / dem.totalEnrollment) * 100;
  }

  return {
    enrollment: district.enrollment,
    locale: district.urbanCentricLocale,
    medianIncome: ed?.medianHouseholdIncome ? Number(ed.medianHouseholdIncome) : null,
    expenditurePerPupil: ed?.expenditurePerPupil ? Number(ed.expenditurePerPupil) : null,
    avgSalary,
    ellPercent,
    swdPercent,
    pocRate,
  };
}
```

**Step 2: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/districts/similar/route.ts
git commit -m "feat: add similar districts API endpoint

- GET /api/districts/similar finds districts with similar metrics
- Supports 8 metrics: enrollment, locale, medianIncome, expenditurePerPupil, avgSalary, ellPercent, swdPercent, pocRate
- Three tolerance levels: tight (±15%), medium (±30%), loose (±50%)
- Returns top 10 results sorted by similarity score"
```

---

## Task 3: Write API Tests

**Files:**
- Create: `src/app/api/districts/similar/__tests__/route.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

// Helper to create mock district
const createMockDistrict = (overrides: Partial<{
  leaid: string;
  name: string;
  stateAbbrev: string;
  enrollment: number;
  urbanCentricLocale: number;
  ellStudents: number;
  specEdStudents: number;
  educationData: object | null;
  enrollmentDemographics: object | null;
  territoryPlans: { planId: string }[];
}> = {}) => ({
  leaid: "1234567",
  name: "Test District",
  stateAbbrev: "CA",
  enrollment: 1000,
  urbanCentricLocale: 3,
  ellStudents: 100,
  specEdStudents: 150,
  educationData: {
    medianHouseholdIncome: 75000,
    expenditurePerPupil: 12000,
    salariesTotal: 5000000,
    staffTotalFte: 100,
  },
  enrollmentDemographics: {
    totalEnrollment: 1000,
    enrollmentWhite: 400,
  },
  territoryPlans: [],
  ...overrides,
});

describe("GET /api/districts/similar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when leaid is missing", async () => {
    const request = new NextRequest("http://localhost/api/districts/similar?metrics=enrollment");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("leaid");
  });

  it("returns 400 when metrics is missing", async () => {
    const request = new NextRequest("http://localhost/api/districts/similar?leaid=1234567");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("metrics");
  });

  it("returns 400 when more than 3 metrics requested", async () => {
    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1234567&metrics=enrollment,locale,medianIncome,avgSalary"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("1-3 metrics");
  });

  it("returns 404 when source district not found", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=invalid&metrics=enrollment"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns similar districts sorted by distance", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    const similarDistrict = createMockDistrict({ leaid: "2222222", name: "Similar District", enrollment: 1100 });
    const lessSimilarDistrict = createMockDistrict({ leaid: "3333333", name: "Less Similar", enrollment: 1200 });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([similarDistrict, lessSimilarDistrict] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=medium"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(2);
    // Closer match (1100 vs 1000 = 10% diff) should be first
    expect(data.results[0].leaid).toBe("2222222");
    // Further match (1200 vs 1000 = 20% diff) should be second
    expect(data.results[1].leaid).toBe("3333333");
  });

  it("excludes districts outside tolerance range", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111", enrollment: 1000 });
    const withinTolerance = createMockDistrict({ leaid: "2222222", enrollment: 1100 }); // 10% diff
    const outsideTolerance = createMockDistrict({ leaid: "3333333", enrollment: 2000 }); // 100% diff

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([withinTolerance, outsideTolerance] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=tight"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].leaid).toBe("2222222");
  });

  it("returns 400 when source district missing metric data", async () => {
    const sourceDistrict = createMockDistrict({
      leaid: "1111111",
      educationData: null, // Missing education data
    });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=medianIncome"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("missing data");
  });

  it("includes territory plan IDs in results", async () => {
    const sourceDistrict = createMockDistrict({ leaid: "1111111" });
    const similarDistrict = createMockDistrict({
      leaid: "2222222",
      territoryPlans: [{ planId: "plan-1" }, { planId: "plan-2" }],
    });

    mockPrisma.district.findUnique.mockResolvedValue(sourceDistrict as never);
    mockPrisma.district.findMany.mockResolvedValue([similarDistrict] as never);

    const request = new NextRequest(
      "http://localhost/api/districts/similar?leaid=1111111&metrics=enrollment&tolerance=loose"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].territoryPlanIds).toEqual(["plan-1", "plan-2"]);
  });
});
```

**Step 2: Run tests**

Run: `cd territory-plan && npx vitest run src/app/api/districts/similar/__tests__/route.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/districts/similar/__tests__/route.test.ts
git commit -m "test: add tests for similar districts API

- Tests parameter validation (leaid, metrics, tolerance)
- Tests 404 when district not found
- Tests similarity sorting and tolerance filtering
- Tests metric data requirement
- Tests territory plan IDs in results"
```

---

## Task 4: Add API Hook to api.ts

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add types and hook**

Add at the end of the types section (around line 153):

```typescript
// Similar districts types
export type SimilarMetricKey =
  | "enrollment"
  | "locale"
  | "medianIncome"
  | "expenditurePerPupil"
  | "avgSalary"
  | "ellPercent"
  | "swdPercent"
  | "pocRate";

export type SimilarityTolerance = "tight" | "medium" | "loose";

export interface SimilarDistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  distanceScore: number;
  metrics: Record<string, { value: number | string | null; sourceValue: number | string | null }>;
  territoryPlanIds: string[];
}

export interface SimilarDistrictsResponse {
  results: SimilarDistrictResult[];
  sourceMetrics: Record<string, number | null>;
  total: number;
}
```

Add the hook at the end of the file (after useTerritoryPlans hooks):

```typescript
// Similar districts
export function useSimilarDistricts(params: {
  leaid: string | null;
  metrics: SimilarMetricKey[];
  tolerance: SimilarityTolerance;
  enabled?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.leaid) searchParams.set("leaid", params.leaid);
  if (params.metrics.length > 0) searchParams.set("metrics", params.metrics.join(","));
  searchParams.set("tolerance", params.tolerance);

  return useQuery({
    queryKey: ["similarDistricts", params],
    queryFn: () =>
      fetchJson<SimilarDistrictsResponse>(
        `${API_BASE}/districts/similar?${searchParams}`
      ),
    enabled: params.enabled !== false && !!params.leaid && params.metrics.length > 0,
  });
}
```

**Step 2: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add useSimilarDistricts hook

- Added SimilarMetricKey, SimilarityTolerance, SimilarDistrictResult types
- Added useSimilarDistricts hook for querying similar districts API"
```

---

## Task 5: Create FindSimilarDistricts Component

**Files:**
- Create: `src/components/panel/FindSimilarDistricts.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  useSimilarDistricts,
  useTerritoryPlans,
  useAddDistrictsToPlan,
  type SimilarMetricKey,
  type SimilarityTolerance,
  type SimilarDistrictResult,
  type District,
  type DistrictEducationData,
  type DistrictEnrollmentDemographics,
} from "@/lib/api";
import { useMapStore } from "@/lib/store";

// Available metrics for comparison
const METRICS: { key: SimilarMetricKey; label: string; shortLabel: string }[] = [
  { key: "enrollment", label: "Enrollment", shortLabel: "Enroll" },
  { key: "locale", label: "Locale", shortLabel: "Locale" },
  { key: "medianIncome", label: "Median Income", shortLabel: "Income" },
  { key: "expenditurePerPupil", label: "Expenditure/Pupil", shortLabel: "$/Pupil" },
  { key: "avgSalary", label: "Avg Salary", shortLabel: "Salary" },
  { key: "ellPercent", label: "ELL %", shortLabel: "ELL" },
  { key: "swdPercent", label: "SWD %", shortLabel: "SWD" },
  { key: "pocRate", label: "POC Rate", shortLabel: "POC" },
];

// Tolerance presets
const TOLERANCES: { value: SimilarityTolerance; label: string }[] = [
  { value: "tight", label: "Very Similar" },
  { value: "medium", label: "Somewhat Similar" },
  { value: "loose", label: "Broadly Similar" },
];

interface FindSimilarDistrictsProps {
  district: District;
  educationData: DistrictEducationData | null;
  enrollmentDemographics: DistrictEnrollmentDemographics | null;
}

// Format metric value for display
function formatMetricValue(key: SimilarMetricKey, value: number | string | null): string {
  if (value === null) return "N/A";

  switch (key) {
    case "locale":
      // Urban-centric locale codes
      const localeLabels: Record<number, string> = {
        11: "City-Large", 12: "City-Mid", 13: "City-Small",
        21: "Suburb-Large", 22: "Suburb-Mid", 23: "Suburb-Small",
        31: "Town-Fringe", 32: "Town-Distant", 33: "Town-Remote",
        41: "Rural-Fringe", 42: "Rural-Distant", 43: "Rural-Remote",
      };
      return localeLabels[value as number] || String(value);
    case "medianIncome":
    case "avgSalary":
    case "expenditurePerPupil":
      return "$" + Math.round(value as number).toLocaleString();
    case "ellPercent":
    case "swdPercent":
    case "pocRate":
      return (value as number).toFixed(1) + "%";
    case "enrollment":
      return Math.round(value as number).toLocaleString();
    default:
      return String(value);
  }
}

// Check if a metric has data for this district
function hasMetricData(
  key: SimilarMetricKey,
  district: District,
  educationData: DistrictEducationData | null,
  enrollmentDemographics: DistrictEnrollmentDemographics | null
): boolean {
  switch (key) {
    case "enrollment":
      return district.enrollment !== null;
    case "locale":
      return district.urbanCentricLocale !== null;
    case "medianIncome":
      return educationData?.medianHouseholdIncome !== null;
    case "expenditurePerPupil":
      return educationData?.expenditurePerPupil !== null;
    case "avgSalary":
      return educationData?.salariesTotal !== null && educationData?.staffTotalFte !== null;
    case "ellPercent":
      return district.ellStudents !== null && district.enrollment !== null;
    case "swdPercent":
      return district.specEdStudents !== null && district.enrollment !== null;
    case "pocRate":
      return enrollmentDemographics?.totalEnrollment !== null &&
             enrollmentDemographics?.enrollmentWhite !== null;
    default:
      return false;
  }
}

export default function FindSimilarDistricts({
  district,
  educationData,
  enrollmentDemographics,
}: FindSimilarDistrictsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<SimilarMetricKey[]>([]);
  const [tolerance, setTolerance] = useState<SimilarityTolerance>("medium");
  const [hasSearched, setHasSearched] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState<string | null>(null); // leaid or "all"

  const { setSelectedLeaid, setSimilarDistrictLeaids, clearSimilarDistricts } = useMapStore();
  const { data: plans } = useTerritoryPlans();
  const addDistrictsToPlan = useAddDistrictsToPlan();

  // Query similar districts (only when hasSearched is true)
  const {
    data: similarData,
    isLoading,
    error,
  } = useSimilarDistricts({
    leaid: district.leaid,
    metrics: selectedMetrics,
    tolerance,
    enabled: hasSearched && selectedMetrics.length > 0,
  });

  // Update map highlighting when results change
  useEffect(() => {
    if (similarData?.results) {
      setSimilarDistrictLeaids(similarData.results.map((r) => r.leaid));
    }
  }, [similarData, setSimilarDistrictLeaids]);

  // Clear results when district changes or component unmounts
  useEffect(() => {
    return () => {
      clearSimilarDistricts();
    };
  }, [district.leaid, clearSimilarDistricts]);

  // Reset state when district changes
  useEffect(() => {
    setSelectedMetrics([]);
    setHasSearched(false);
    setShowPlanSelector(null);
  }, [district.leaid]);

  const handleMetricToggle = (key: SimilarMetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((m) => m !== key);
      }
      if (prev.length >= 3) {
        return prev; // Max 3 metrics
      }
      return [...prev, key];
    });
    setHasSearched(false); // Reset search when metrics change
  };

  const handleSearch = () => {
    if (selectedMetrics.length > 0) {
      setHasSearched(true);
    }
  };

  const handleClearResults = () => {
    setHasSearched(false);
    clearSimilarDistricts();
  };

  const handleSelectDistrict = (leaid: string) => {
    setSelectedLeaid(leaid);
    clearSimilarDistricts();
    setHasSearched(false);
  };

  const handleAddToPlan = async (planId: string, leaids: string[]) => {
    try {
      await addDistrictsToPlan.mutateAsync({ planId, leaids });
      setShowPlanSelector(null);
    } catch (error) {
      console.error("Failed to add districts to plan:", error);
    }
  };

  const results = similarData?.results || [];

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Find Similar Districts</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Metric Chips */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Select up to 3 metrics to compare:</p>
            <div className="flex flex-wrap gap-2">
              {METRICS.map((metric) => {
                const isSelected = selectedMetrics.includes(metric.key);
                const isDisabled =
                  !hasMetricData(metric.key, district, educationData, enrollmentDemographics) ||
                  (!isSelected && selectedMetrics.length >= 3);

                return (
                  <button
                    key={metric.key}
                    onClick={() => !isDisabled && handleMetricToggle(metric.key)}
                    disabled={isDisabled}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      isSelected
                        ? "bg-[#403770] text-white"
                        : isDisabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    title={isDisabled && !isSelected ? "No data available" : metric.label}
                  >
                    {metric.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tolerance Selection */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Similarity level:</p>
            <div className="flex gap-2">
              {TOLERANCES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setTolerance(t.value);
                    setHasSearched(false);
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    tolerance === t.value
                      ? "bg-[#6EA3BE] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={selectedMetrics.length === 0 || isLoading}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>

          {/* Error State */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error.message || "Failed to find similar districts"}
            </div>
          )}

          {/* Results */}
          {hasSearched && !isLoading && !error && (
            <div className="space-y-3">
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {results.length} similar district{results.length !== 1 ? "s" : ""} found
                </p>
                <div className="flex gap-2">
                  {results.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowPlanSelector(showPlanSelector === "all" ? null : "all")}
                        className="text-xs text-[#403770] hover:underline"
                      >
                        Add All to Plan
                      </button>
                      {showPlanSelector === "all" && (
                        <PlanSelectorDropdown
                          plans={plans || []}
                          onSelect={(planId) => handleAddToPlan(planId, results.map((r) => r.leaid))}
                          onClose={() => setShowPlanSelector(null)}
                          isPending={addDistrictsToPlan.isPending}
                        />
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleClearResults}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Result Cards */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {results.map((result) => (
                  <ResultCard
                    key={result.leaid}
                    result={result}
                    selectedMetrics={selectedMetrics}
                    onSelect={() => handleSelectDistrict(result.leaid)}
                    onAddToPlan={() => setShowPlanSelector(result.leaid)}
                    showPlanSelector={showPlanSelector === result.leaid}
                    plans={plans || []}
                    onPlanSelect={(planId) => handleAddToPlan(planId, [result.leaid])}
                    onClosePlanSelector={() => setShowPlanSelector(null)}
                    isPending={addDistrictsToPlan.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Result Card Component
function ResultCard({
  result,
  selectedMetrics,
  onSelect,
  onAddToPlan,
  showPlanSelector,
  plans,
  onPlanSelect,
  onClosePlanSelector,
  isPending,
}: {
  result: SimilarDistrictResult;
  selectedMetrics: SimilarMetricKey[];
  onSelect: () => void;
  onAddToPlan: () => void;
  showPlanSelector: boolean;
  plans: { id: string; name: string; color: string }[];
  onPlanSelect: (planId: string) => void;
  onClosePlanSelector: () => void;
  isPending: boolean;
}) {
  const isInPlan = result.territoryPlanIds.length > 0;

  return (
    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onSelect}
          className="flex-1 text-left"
        >
          <p className="text-sm font-medium text-[#403770]">{result.name}</p>
          <p className="text-xs text-gray-500">{result.stateAbbrev}</p>
        </button>

        <div className="flex items-center gap-1">
          {isInPlan && (
            <span className="w-2 h-2 rounded-full bg-[#8AA891]" title="Already in a plan" />
          )}
          <div className="relative">
            <button
              onClick={onAddToPlan}
              className="p-1 text-gray-400 hover:text-[#403770] transition-colors"
              title="Add to plan"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {showPlanSelector && (
              <PlanSelectorDropdown
                plans={plans}
                onSelect={onPlanSelect}
                onClose={onClosePlanSelector}
                isPending={isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Metric Values */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {selectedMetrics.map((key) => {
          const metricData = result.metrics[key];
          if (!metricData) return null;

          const label = METRICS.find((m) => m.key === key)?.shortLabel || key;

          return (
            <span key={key} className="text-xs text-gray-600">
              <span className="text-gray-400">{label}:</span>{" "}
              {formatMetricValue(key, metricData.value)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Plan Selector Dropdown
function PlanSelectorDropdown({
  plans,
  onSelect,
  onClose,
  isPending,
}: {
  plans: { id: string; name: string; color: string }[];
  onSelect: (planId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
        {plans.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No plans yet</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => onSelect(plan.id)}
                disabled={isPending}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="truncate">{plan.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/panel/FindSimilarDistricts.tsx
git commit -m "feat: add FindSimilarDistricts component

- Collapsible section with metric chip selection (max 3)
- Three similarity tolerance presets
- Result cards with metric values display
- Add to plan functionality (individual and bulk)
- Map highlighting integration via store"
```

---

## Task 6: Add Component to SidePanel

**Files:**
- Modify: `src/components/panel/SidePanel.tsx`

**Step 1: Import and add the component**

Add import at top:

```typescript
import FindSimilarDistricts from "./FindSimilarDistricts";
```

Add component after DistrictInfo (around line 83-84):

```typescript
          <DistrictInfo district={data.district} />

          {/* Find Similar Districts */}
          <FindSimilarDistricts
            district={data.district}
            educationData={data.educationData}
            enrollmentDemographics={data.enrollmentDemographics}
          />
```

**Step 2: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/panel/SidePanel.tsx
git commit -m "feat: add FindSimilarDistricts to SidePanel

- Added FindSimilarDistricts component below DistrictInfo section"
```

---

## Task 7: Add Map Highlighting for Similar Districts

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

**Step 1: Add similarDistrictLeaids to store destructuring**

Update the destructuring (around line 162-177) to include similarDistrictLeaids:

```typescript
  const {
    selectedLeaid,
    setSelectedLeaid,
    setHoveredLeaid,
    setStateFilter,
    filters,
    showTooltip,
    hideTooltip,
    updateTooltipPosition,
    addClickRipple,
    touchPreviewLeaid,
    setTouchPreviewLeaid,
    multiSelectMode,
    selectedLeaids,
    toggleDistrictSelection,
    similarDistrictLeaids,
  } = useMapStore();
```

**Step 2: Add similar districts layer after district-selected layer**

Add these layers after the "district-selected" layer definition (around line 366):

```typescript
      // Similar districts fill layer
      map.current.addLayer({
        id: "district-similar-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": "#F37167", // Coral
          "fill-opacity": 0.5,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });

      // Similar districts outline layer
      map.current.addLayer({
        id: "district-similar-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#F37167", // Coral
          "line-width": 3,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });
```

**Step 3: Add useEffect to update similar districts filter**

Add after the multiselect filter update (around line 427):

```typescript
  // Update similar districts filter
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const filter: maplibregl.FilterSpecification =
      similarDistrictLeaids.length > 0
        ? ["in", ["get", "leaid"], ["literal", similarDistrictLeaids]]
        : ["in", ["get", "leaid"], ["literal", [""]]];

    if (map.current.getLayer("district-similar-fill")) {
      map.current.setFilter("district-similar-fill", filter);
    }
    if (map.current.getLayer("district-similar-outline")) {
      map.current.setFilter("district-similar-outline", filter);
    }
  }, [similarDistrictLeaids]);
```

**Step 4: Run TypeScript check**

Run: `cd territory-plan && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: add map highlighting for similar districts

- Added district-similar-fill and district-similar-outline layers
- Coral color (#F37167) with 50% opacity fill and 3px outline
- Filter updates when similarDistrictLeaids changes in store"
```

---

## Task 8: Manual Testing

**Step 1: Start the dev server**

Run: `cd territory-plan && npm run dev`

**Step 2: Test the feature**

1. Click a state to zoom in
2. Click a district to open the SidePanel
3. Expand "Find Similar Districts" section
4. Select 1-3 metric chips (some may be disabled if data is missing)
5. Select a similarity level
6. Click "Search"
7. Verify:
   - Results appear as cards
   - Similar districts are highlighted on the map (coral outline)
   - Clicking a result card navigates to that district
   - "Add to Plan" works for individual districts
   - "Add All to Plan" works for bulk adding
   - "Clear" removes highlights and results
   - Selecting a new district clears previous results

**Step 3: Run all tests**

Run: `cd territory-plan && npm test`
Expected: All tests pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Find Similar Districts feature

- Added similar districts API endpoint with 8 metrics
- Added FindSimilarDistricts UI component with chip selection
- Added map highlighting for similar districts
- Added Add to Plan functionality (individual and bulk)
- All tests passing"
```

---

## Summary

This plan implements the "Find Similar Districts" feature in 8 tasks:

1. **Store state** - Add similarDistrictLeaids to Zustand store
2. **API endpoint** - Create /api/districts/similar with similarity calculation
3. **API tests** - Test validation, filtering, and sorting
4. **API hook** - Add useSimilarDistricts to api.ts
5. **UI component** - Create FindSimilarDistricts with metrics, tolerance, results
6. **SidePanel integration** - Add component to panel
7. **Map highlighting** - Add layers and filters for similar districts
8. **Manual testing** - Verify end-to-end functionality
