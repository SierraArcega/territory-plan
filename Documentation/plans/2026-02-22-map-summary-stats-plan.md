# Map Summary Stats Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show aggregate financial metrics (count, enrollment, revenue, pipeline, bookings) for visible/filtered districts in a bottom status bar on the map.

**Architecture:** Dedicated `GET /api/districts/summary` endpoint using raw SQL against `district_map_features` JOIN `districts`. Client-side `useMapSummary` hook (react-query) fetches on major filter changes, derives sub-filter totals client-side from cached `byCategory` breakdown. `MapSummaryBar` component renders in `MapV2Shell`.

**Tech Stack:** Next.js API route + `pg` pool (raw SQL), `@tanstack/react-query`, Zustand selectors, Tailwind CSS

---

### Task 1: Move `formatCurrency` to shared utility

The compact currency formatter (`$1.2M`, `$450K`) currently lives in `src/features/goals/components/ProgressCard.tsx`. Move it to a shared location so both goals and map features can use it.

**Files:**
- Create: `src/features/shared/lib/format.ts`
- Modify: `src/features/goals/components/ProgressCard.tsx` (remove export, import from shared)

**Step 1: Create the shared format utility**

Create `src/features/shared/lib/format.ts`:

```typescript
/**
 * Format a number as currency with optional compact mode.
 * compact: $1.2M, $450K  |  standard: $1,234,567
 */
export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "-";
  if (compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Format a number with commas. e.g. 4832100 → "4,832,100"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US");
}
```

**Step 2: Update ProgressCard.tsx to import from shared**

In `src/features/goals/components/ProgressCard.tsx`, replace the local `formatCurrency` function definition with:

```typescript
import { formatCurrency } from "@/features/shared/lib/format";
```

Remove lines 3-12 (the local `formatCurrency` function definition and its comment).

**Step 3: Verify no other files import formatCurrency from ProgressCard**

Run: `grep -r "from.*ProgressCard" src/ --include="*.ts" --include="*.tsx" | grep formatCurrency`

If any files import `formatCurrency` from ProgressCard, update their imports to point to `@/features/shared/lib/format`.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass.

**Step 5: Commit**

```bash
git add src/features/shared/lib/format.ts src/features/goals/components/ProgressCard.tsx
git commit -m "refactor: move formatCurrency to shared utility"
```

---

### Task 2: Create the summary API endpoint

**Files:**
- Create: `src/app/api/districts/summary/route.ts`

**Context:**
- The `district_map_features` materialized view has category columns but no financial data
- The `districts` table has all financial fields (mapped as snake_case in Postgres)
- FY25 has: `fy25_sessions_revenue`, `fy25_net_invoicing`, `fy25_closed_won_net_booking` (no pipeline fields)
- FY26 has: `fy26_sessions_revenue`, `fy26_net_invoicing`, `fy26_closed_won_net_booking`, `fy26_open_pipeline`, `fy26_open_pipeline_weighted`
- The `plan_ids` column in `district_map_features` is a comma-separated string (e.g., `"plan-1,plan-2"`)
- Follow the tile route pattern: import `pool` from `@/lib/db`, use `pool.connect()` with try/finally release

**Step 1: Create the route file**

Create `src/app/api/districts/summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fyParam = searchParams.get("fy") || "fy26";
    const fy = fyParam === "fy25" ? "fy25" : "fy26";
    const states = searchParams.get("states"); // comma-separated
    const owner = searchParams.get("owner");
    const planId = searchParams.get("planId");
    const accountTypes = searchParams.get("accountTypes"); // comma-separated
    const vendors = searchParams.get("vendors"); // comma-separated vendor IDs

    // Build dynamic WHERE clauses
    const conditions: string[] = [];
    const params: (string | string[])[] = [];
    let paramIdx = 1;

    // State filter
    if (states) {
      const stateList = states.split(",").filter(Boolean);
      if (stateList.length > 0) {
        conditions.push(`dmf.state_abbrev = ANY($${paramIdx})`);
        params.push(stateList);
        paramIdx++;
      }
    }

    // Owner filter
    if (owner) {
      conditions.push(`dmf.sales_executive = $${paramIdx}`);
      params.push(owner);
      paramIdx++;
    }

    // Plan filter (plan_ids is comma-separated text)
    if (planId) {
      conditions.push(`dmf.plan_ids LIKE '%' || $${paramIdx} || '%'`);
      params.push(planId);
      paramIdx++;
    }

    // Account type filter
    if (accountTypes) {
      const typeList = accountTypes.split(",").filter(Boolean);
      if (typeList.length > 0) {
        conditions.push(`dmf.account_type = ANY($${paramIdx})`);
        params.push(typeList);
        paramIdx++;
      }
    }

    // Vendor visibility filter: district must have a non-null category for at least one active vendor
    const vendorList = vendors ? vendors.split(",").filter(Boolean) : [];
    if (vendorList.length > 0) {
      const vendorConditions = vendorList.map((v) => {
        const col = `${fy}_${v}_category`;
        return `dmf.${col} IS NOT NULL`;
      });
      conditions.push(`(${vendorConditions.join(" OR ")})`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Select FY-appropriate financial columns
    const revenueCol = `${fy}_sessions_revenue`;
    const invoicingCol = `${fy}_net_invoicing`;
    const bookingsCol = `${fy}_closed_won_net_booking`;
    // Pipeline only exists for fy26+
    const hasPipeline = fy === "fy26";
    const pipelineCol = hasPipeline ? "fy26_open_pipeline" : null;
    const weightedPipelineCol = hasPipeline ? "fy26_open_pipeline_weighted" : null;

    // Category column for grouping (fullmind only — competitors don't have Fullmind financials)
    const fullmindCatCol = `${fy}_fullmind_category`;

    const query = `
      SELECT
        dmf.${fullmindCatCol} AS category,
        COUNT(*)::int AS count,
        COALESCE(SUM(d.enrollment), 0)::bigint AS total_enrollment,
        COALESCE(SUM(d.${revenueCol}), 0)::float AS sessions_revenue,
        COALESCE(SUM(d.${invoicingCol}), 0)::float AS net_invoicing,
        COALESCE(SUM(d.${bookingsCol}), 0)::float AS closed_won_bookings
        ${hasPipeline ? `,
        COALESCE(SUM(d.${pipelineCol}), 0)::float AS open_pipeline,
        COALESCE(SUM(d.${weightedPipelineCol}), 0)::float AS weighted_pipeline
        ` : ""}
      FROM district_map_features dmf
      JOIN districts d ON dmf.leaid = d.leaid
      ${whereClause}
      GROUP BY dmf.${fullmindCatCol}
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, params);

      // Aggregate totals and build byCategory breakdown
      let count = 0;
      let totalEnrollment = 0;
      let sessionsRevenue = 0;
      let netInvoicing = 0;
      let closedWonBookings = 0;
      let openPipeline = 0;
      let weightedPipeline = 0;
      const byCategory: Record<string, {
        count: number;
        totalEnrollment: number;
        sessionsRevenue: number;
        netInvoicing: number;
        closedWonBookings: number;
        openPipeline: number;
        weightedPipeline: number;
      }> = {};

      for (const row of result.rows) {
        const cat = row.category || "uncategorized";
        const entry = {
          count: row.count,
          totalEnrollment: Number(row.total_enrollment),
          sessionsRevenue: row.sessions_revenue,
          netInvoicing: row.net_invoicing,
          closedWonBookings: row.closed_won_bookings,
          openPipeline: hasPipeline ? row.open_pipeline : 0,
          weightedPipeline: hasPipeline ? row.weighted_pipeline : 0,
        };
        byCategory[cat] = entry;
        count += entry.count;
        totalEnrollment += entry.totalEnrollment;
        sessionsRevenue += entry.sessionsRevenue;
        netInvoicing += entry.netInvoicing;
        closedWonBookings += entry.closedWonBookings;
        openPipeline += entry.openPipeline;
        weightedPipeline += entry.weightedPipeline;
      }

      return NextResponse.json({
        count,
        totalEnrollment,
        sessionsRevenue,
        netInvoicing,
        closedWonBookings,
        openPipeline,
        weightedPipeline,
        byCategory,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching district summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch district summary" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the endpoint works**

Run the dev server: `npm run dev`

Test manually:
- `curl http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind`
- `curl http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind&states=CA,TX`

Expected: JSON response with count, financial totals, and byCategory breakdown.

**Step 3: Commit**

```bash
git add src/app/api/districts/summary/route.ts
git commit -m "feat: add /api/districts/summary endpoint for map stats"
```

---

### Task 3: Write the API route test

**Files:**
- Create: `src/app/api/districts/summary/__tests__/route.test.ts`

**Step 1: Write the test**

Create `src/app/api/districts/summary/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the pool
const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() => Promise.resolve({ query: mockQuery, release: mockRelease })),
  },
}));

import { GET } from "../route";

describe("GET /api/districts/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated totals grouped by category", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          category: "multi_year",
          count: 50,
          total_enrollment: 200000,
          sessions_revenue: 5000000,
          net_invoicing: 3000000,
          closed_won_bookings: 2000000,
          open_pipeline: 1000000,
          weighted_pipeline: 500000,
        },
        {
          category: "target",
          count: 100,
          total_enrollment: 400000,
          sessions_revenue: 0,
          net_invoicing: 0,
          closed_won_bookings: 0,
          open_pipeline: 0,
          weighted_pipeline: 0,
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(150);
    expect(body.totalEnrollment).toBe(600000);
    expect(body.sessionsRevenue).toBe(5000000);
    expect(body.byCategory.multi_year.count).toBe(50);
    expect(body.byCategory.target.count).toBe(100);
  });

  it("passes state filter to SQL query", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind&states=CA,TX"
    );
    await GET(req);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("state_abbrev = ANY");
    expect(params).toContainEqual(["CA", "TX"]);
  });

  it("defaults to fy26 when no fy param", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("fy26_fullmind_category");
    expect(sql).toContain("fy26_sessions_revenue");
  });

  it("omits pipeline columns for fy25", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy25&vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("fy25_sessions_revenue");
    expect(sql).not.toContain("open_pipeline");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValue(new Error("DB connection failed"));

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch district summary");
  });
});
```

**Step 2: Run test**

Run: `npx vitest run src/app/api/districts/summary/__tests__/route.test.ts`
Expected: All 4 tests pass.

**Step 3: Commit**

```bash
git add src/app/api/districts/summary/__tests__/route.test.ts
git commit -m "test: add tests for districts summary API endpoint"
```

---

### Task 4: Create the `useMapSummary` hook

**Files:**
- Create: `src/features/map/lib/useMapSummary.ts`

**Context:**
- Follow the react-query pattern from `src/features/map/lib/queries.ts`
- Use `fetchJson` from `@/features/shared/lib/api-client`
- Watch Zustand store selectors for filter state
- Derive `visibleTotals` client-side from `byCategory` based on engagement filters

**Step 1: Create the hook**

Create `src/features/map/lib/useMapSummary.ts`:

```typescript
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";

/** Shape of each category row and the overall totals */
export interface SummaryTotals {
  count: number;
  totalEnrollment: number;
  sessionsRevenue: number;
  netInvoicing: number;
  closedWonBookings: number;
  openPipeline: number;
  weightedPipeline: number;
}

interface SummaryResponse extends SummaryTotals {
  byCategory: Record<string, SummaryTotals>;
}

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  sessionsRevenue: 0,
  netInvoicing: 0,
  closedWonBookings: 0,
  openPipeline: 0,
  weightedPipeline: 0,
};

/**
 * Maps UI engagement filter values to the raw Fullmind category values
 * stored in the materialized view.
 * The UI shows "pipeline" but the DB has "new_pipeline", "renewal_pipeline", "expansion_pipeline".
 */
const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  pipeline: ["new_pipeline", "renewal_pipeline", "expansion_pipeline"],
  first_year: ["new"],
  multi_year: ["multi_year"],
  lapsed: ["lapsed"],
};

function sumCategories(
  byCategory: Record<string, SummaryTotals>,
  allowedCategories: Set<string>
): SummaryTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const [cat, data] of Object.entries(byCategory)) {
    if (allowedCategories.has(cat)) {
      totals.count += data.count;
      totals.totalEnrollment += data.totalEnrollment;
      totals.sessionsRevenue += data.sessionsRevenue;
      totals.netInvoicing += data.netInvoicing;
      totals.closedWonBookings += data.closedWonBookings;
      totals.openPipeline += data.openPipeline;
      totals.weightedPipeline += data.weightedPipeline;
    }
  }
  return totals;
}

export function useMapSummary() {
  // Major filters (trigger API re-fetch)
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  // Sub-filters (client-side re-computation only)
  const fullmindEngagement = useMapV2Store((s) => s.fullmindEngagement);

  // Build query params
  const vendorsCsv = [...activeVendors].sort().join(",");
  const statesCsv = [...filterStates].sort().join(",");
  const accountTypesCsv = [...filterAccountTypes].sort().join(",");

  const enabled = activeVendors.size > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "districtSummary",
      selectedFiscalYear,
      statesCsv,
      filterOwner,
      filterPlanId,
      accountTypesCsv,
      vendorsCsv,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("fy", selectedFiscalYear);
      if (statesCsv) params.set("states", statesCsv);
      if (filterOwner) params.set("owner", filterOwner);
      if (filterPlanId) params.set("planId", filterPlanId);
      if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
      if (vendorsCsv) params.set("vendors", vendorsCsv);
      return fetchJson<SummaryResponse>(
        `${API_BASE}/districts/summary?${params.toString()}`
      );
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Derive visible totals from byCategory, applying engagement sub-filters client-side
  const totals = useMemo<SummaryTotals>(() => {
    if (!data) return EMPTY_TOTALS;

    // If no engagement filter is active, use the raw totals (all categories)
    if (fullmindEngagement.length === 0) {
      return {
        count: data.count,
        totalEnrollment: data.totalEnrollment,
        sessionsRevenue: data.sessionsRevenue,
        netInvoicing: data.netInvoicing,
        closedWonBookings: data.closedWonBookings,
        openPipeline: data.openPipeline,
        weightedPipeline: data.weightedPipeline,
      };
    }

    // Map engagement filter values to raw category names
    const allowedCategories = new Set<string>();
    for (const eng of fullmindEngagement) {
      const cats = ENGAGEMENT_TO_CATEGORIES[eng];
      if (cats) cats.forEach((c) => allowedCategories.add(c));
    }

    return sumCategories(data.byCategory, allowedCategories);
  }, [data, fullmindEngagement]);

  return { totals, isLoading: isLoading && enabled, error, enabled };
}
```

**Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/features/map/lib/useMapSummary.ts
git commit -m "feat: add useMapSummary hook with client-side sub-filtering"
```

---

### Task 5: Write the hook test

**Files:**
- Create: `src/features/map/lib/__tests__/useMapSummary.test.ts`

**Step 1: Write the test**

Create `src/features/map/lib/__tests__/useMapSummary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { SummaryTotals } from "../useMapSummary";

// Test the pure aggregation logic without React hooks
// Extract the engagement mapping and sum logic for unit testing

const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  pipeline: ["new_pipeline", "renewal_pipeline", "expansion_pipeline"],
  first_year: ["new"],
  multi_year: ["multi_year"],
  lapsed: ["lapsed"],
};

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  sessionsRevenue: 0,
  netInvoicing: 0,
  closedWonBookings: 0,
  openPipeline: 0,
  weightedPipeline: 0,
};

function sumCategories(
  byCategory: Record<string, SummaryTotals>,
  allowedCategories: Set<string>
): SummaryTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const [cat, data] of Object.entries(byCategory)) {
    if (allowedCategories.has(cat)) {
      totals.count += data.count;
      totals.totalEnrollment += data.totalEnrollment;
      totals.sessionsRevenue += data.sessionsRevenue;
      totals.netInvoicing += data.netInvoicing;
      totals.closedWonBookings += data.closedWonBookings;
      totals.openPipeline += data.openPipeline;
      totals.weightedPipeline += data.weightedPipeline;
    }
  }
  return totals;
}

const mockByCategory: Record<string, SummaryTotals> = {
  target: { count: 100, totalEnrollment: 400000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 0, weightedPipeline: 0 },
  new_pipeline: { count: 50, totalEnrollment: 200000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 3000000, weightedPipeline: 1500000 },
  renewal_pipeline: { count: 30, totalEnrollment: 120000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 1500000, weightedPipeline: 750000 },
  expansion_pipeline: { count: 20, totalEnrollment: 80000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 700000, weightedPipeline: 350000 },
  new: { count: 40, totalEnrollment: 160000, sessionsRevenue: 2000000, netInvoicing: 1500000, closedWonBookings: 1000000, openPipeline: 0, weightedPipeline: 0 },
  multi_year: { count: 60, totalEnrollment: 240000, sessionsRevenue: 5000000, netInvoicing: 3500000, closedWonBookings: 2500000, openPipeline: 0, weightedPipeline: 0 },
  lapsed: { count: 25, totalEnrollment: 100000, sessionsRevenue: 0, netInvoicing: 0, closedWonBookings: 0, openPipeline: 0, weightedPipeline: 0 },
};

describe("useMapSummary aggregation logic", () => {
  it("engagement 'pipeline' maps to new_pipeline + renewal_pipeline + expansion_pipeline", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(50 + 30 + 20); // 100
    expect(result.openPipeline).toBe(3000000 + 1500000 + 700000); // 5200000
  });

  it("engagement 'multi_year' maps to multi_year category", () => {
    const allowed = new Set(ENGAGEMENT_TO_CATEGORIES["multi_year"]);
    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(60);
    expect(result.sessionsRevenue).toBe(5000000);
  });

  it("multiple engagement filters combine additively", () => {
    const allowed = new Set<string>();
    for (const c of ENGAGEMENT_TO_CATEGORIES["target"]) allowed.add(c);
    for (const c of ENGAGEMENT_TO_CATEGORIES["pipeline"]) allowed.add(c);

    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(100 + 50 + 30 + 20); // 200
  });

  it("empty allowed set returns zero totals", () => {
    const result = sumCategories(mockByCategory, new Set());
    expect(result.count).toBe(0);
    expect(result.sessionsRevenue).toBe(0);
  });

  it("engagement 'first_year' maps to 'new' category", () => {
    const allowed = new Set(ENGAGEMENT_TO_CATEGORIES["first_year"]);
    const result = sumCategories(mockByCategory, allowed);
    expect(result.count).toBe(40);
    expect(result.netInvoicing).toBe(1500000);
  });
});
```

**Step 2: Run test**

Run: `npx vitest run src/features/map/lib/__tests__/useMapSummary.test.ts`
Expected: All 5 tests pass.

**Step 3: Commit**

```bash
git add src/features/map/lib/__tests__/useMapSummary.test.ts
git commit -m "test: add aggregation logic tests for useMapSummary"
```

---

### Task 6: Create the `MapSummaryBar` component

**Files:**
- Create: `src/features/map/components/MapSummaryBar.tsx`

**Context:**
- Match existing UI style: `bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60`
- Position: absolute bottom-6 left-6 (LayerBubble is bottom-6 right-6)
- Use `formatCurrency` from shared lib with `compact=true`
- Use `formatNumber` from shared lib for count and enrollment
- Show skeleton during loading
- Hide when no vendors active

**Step 1: Create the component**

Create `src/features/map/components/MapSummaryBar.tsx`:

```tsx
"use client";

import { useMapSummary } from "@/features/map/lib/useMapSummary";
import { formatCurrency, formatNumber } from "@/features/shared/lib/format";

function Skeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-3.5 w-14 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-700 tabular-nums leading-tight mt-0.5">
        {value}
      </span>
    </div>
  );
}

export default function MapSummaryBar() {
  const { totals, isLoading, enabled } = useMapSummary();

  if (!enabled) return null;

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : (
          <div className="flex items-center gap-4 px-4 py-2.5 overflow-x-auto">
            <Stat label="Districts" value={formatNumber(totals.count)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Enrollment" value={formatNumber(totals.totalEnrollment)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Revenue" value={formatCurrency(totals.sessionsRevenue, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Invoiced" value={formatCurrency(totals.netInvoicing, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Bookings" value={formatCurrency(totals.closedWonBookings, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Pipeline" value={formatCurrency(totals.openPipeline, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Wtd Pipeline" value={formatCurrency(totals.weightedPipeline, true)} />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/features/map/components/MapSummaryBar.tsx
git commit -m "feat: add MapSummaryBar component with loading skeleton"
```

---

### Task 7: Wire MapSummaryBar into MapV2Shell

**Files:**
- Modify: `src/features/map/components/MapV2Shell.tsx`

**Step 1: Add import and render the component**

In `src/features/map/components/MapV2Shell.tsx`:

Add import at the top (after the existing imports):
```typescript
import MapSummaryBar from "./MapSummaryBar";
```

Add the component inside the return JSX, just before the `<LayerBubble />` line:
```tsx
      {/* Summary stats bar */}
      <MapSummaryBar />

      {/* Layer control bubble */}
      <LayerBubble />
```

**Step 2: Verify in the browser**

Run: `npm run dev`

1. Open the map at `localhost:3000`
2. Open the LayerBubble, toggle Fullmind on
3. Verify the summary bar appears at bottom-left with metrics
4. Toggle engagement filters — verify numbers update client-side (no network call)
5. Change state filter — verify a new API call fires and numbers update
6. Toggle all vendors off — verify the bar disappears

**Step 3: Commit**

```bash
git add src/features/map/components/MapV2Shell.tsx
git commit -m "feat: wire MapSummaryBar into MapV2Shell layout"
```

---

### Task 8: Run full test suite and verify

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including the new ones from Tasks 3 and 5.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Final commit if any fixes needed**

If any adjustments were needed, commit them:
```bash
git add -A
git commit -m "fix: address test/type issues from summary stats integration"
```
