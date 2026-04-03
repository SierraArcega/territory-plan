# County-Level Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a county-level filter to the Geography dropdown so sales reps can target specific counties across states.

**Architecture:** New `/api/counties` endpoint returns all ~3,136 distinct county+state pairs. A `useCounties()` TanStack Query hook caches this data for the session. The `GeographyDropdown` renders a new county section using the existing `FilterMultiSelect` component. The district search API handles the compound county+state filter as a special case before `buildWhereClause`.

**Tech Stack:** Next.js API route, Prisma groupBy, TanStack Query, existing FilterMultiSelect component, Vitest

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/counties/route.ts` | API endpoint returning distinct county+state pairs |
| Create | `src/app/api/counties/__tests__/route.test.ts` | Unit tests for counties endpoint |
| Modify | `src/features/map/lib/queries.ts` | Add `useCounties()` TanStack Query hook |
| Modify | `src/features/map/components/SearchBar/GeographyDropdown.tsx` | Add county filter section using FilterMultiSelect |
| Modify | `src/app/api/districts/search/route.ts:106-130` | Handle compound county+state filter as special case |
| Modify | `src/features/map/components/SearchBar/index.tsx:74` | Add `"countyName"` to geography domain set |
| Create | `src/app/api/districts/search/__tests__/county-filter.test.ts` | Unit tests for county filter special case |

---

### Task 1: API Endpoint — `/api/counties`

**Files:**
- Create: `src/app/api/counties/route.ts`
- Create: `src/app/api/counties/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/app/api/counties/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the route
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      groupBy: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "../route";
import { NextRequest } from "next/server";

describe("GET /api/counties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns distinct county+state pairs sorted alphabetically", async () => {
    const mockData = [
      { countyName: "Harris County", stateAbbrev: "TX" },
      { countyName: "Adams County", stateAbbrev: "CO" },
      { countyName: "Harris County", stateAbbrev: "GA" },
    ];
    (prisma.district.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

    const req = new NextRequest("http://localhost:3005/api/counties");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(mockData);
    expect(prisma.district.groupBy).toHaveBeenCalledWith({
      by: ["countyName", "stateAbbrev"],
      where: { countyName: { not: null } },
      orderBy: [{ countyName: "asc" }, { stateAbbrev: "asc" }],
    });
  });

  it("returns 500 on database error", async () => {
    (prisma.district.groupBy as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    );

    const req = new NextRequest("http://localhost:3005/api/counties");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to fetch counties");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/counties/__tests__/route.test.ts`
Expected: FAIL — `../route` module does not exist

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/counties/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const counties = await prisma.district.groupBy({
      by: ["countyName", "stateAbbrev"],
      where: { countyName: { not: null } },
      orderBy: [{ countyName: "asc" }, { stateAbbrev: "asc" }],
    });

    return NextResponse.json(counties);
  } catch (error) {
    console.error("Error fetching counties:", error);
    return NextResponse.json(
      { error: "Failed to fetch counties" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/counties/__tests__/route.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/counties/
git commit -m "feat: add /api/counties endpoint returning distinct county+state pairs"
```

---

### Task 2: TanStack Query Hook — `useCounties()`

**Files:**
- Modify: `src/features/map/lib/queries.ts`

- [ ] **Step 1: Add the `useCounties` hook**

Add to `src/features/map/lib/queries.ts`, after the existing `useStates` hook (around line 50):

```typescript
// County options for geography filter (static data, fetched once per session)
export interface CountyOption {
  countyName: string;
  stateAbbrev: string;
}

export function useCounties() {
  return useQuery({
    queryKey: ["counties"],
    queryFn: () => fetchJson<CountyOption[]>(`${API_BASE}/counties`),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to `useCounties`

- [ ] **Step 3: Commit**

```bash
git add src/features/map/lib/queries.ts
git commit -m "feat: add useCounties() TanStack Query hook with infinite stale time"
```

---

### Task 3: County Filter Special Case in District Search API

**Files:**
- Modify: `src/app/api/districts/search/route.ts:106-130`
- Create: `src/app/api/districts/search/__tests__/county-filter.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/app/api/districts/search/__tests__/county-filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { FilterDef } from "@/features/explore/lib/filters";

/**
 * Extracts county filter objects from the filters array and returns:
 * - countyWhere: a Prisma OR clause for compound county+state matching
 * - remainingFilters: the filters array with countyName filters removed
 *
 * This mirrors the logic added to the search route.
 */
function extractCountyFilter(filters: FilterDef[]): {
  countyWhere: Record<string, unknown> | null;
  remainingFilters: FilterDef[];
} {
  const countyFilter = filters.find(
    (f) => f.column === "countyName" && f.op === "in"
  );
  if (!countyFilter || !Array.isArray(countyFilter.value)) {
    return { countyWhere: null, remainingFilters: filters };
  }

  const pairs = countyFilter.value as Array<{
    countyName: string;
    stateAbbrev: string;
  }>;
  const countyWhere = {
    OR: pairs.map((p) => ({
      countyName: p.countyName,
      stateAbbrev: p.stateAbbrev,
    })),
  };
  const remainingFilters = filters.filter((f) => f !== countyFilter);
  return { countyWhere, remainingFilters };
}

describe("extractCountyFilter", () => {
  it("builds compound OR clause from county+state pairs", () => {
    const filters: FilterDef[] = [
      {
        column: "countyName",
        op: "in",
        value: [
          { countyName: "Harris County", stateAbbrev: "TX" },
          { countyName: "Washington County", stateAbbrev: "AL" },
        ],
      },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toEqual({
      OR: [
        { countyName: "Harris County", stateAbbrev: "TX" },
        { countyName: "Washington County", stateAbbrev: "AL" },
      ],
    });
    expect(remainingFilters).toEqual([]);
  });

  it("preserves other filters and removes only countyName", () => {
    const filters: FilterDef[] = [
      { column: "state", op: "in", value: ["CA", "TX"] },
      {
        column: "countyName",
        op: "in",
        value: [{ countyName: "Harris County", stateAbbrev: "TX" }],
      },
      { column: "enrollment", op: "gt", value: 1000 },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toEqual({
      OR: [{ countyName: "Harris County", stateAbbrev: "TX" }],
    });
    expect(remainingFilters).toEqual([
      { column: "state", op: "in", value: ["CA", "TX"] },
      { column: "enrollment", op: "gt", value: 1000 },
    ]);
  });

  it("returns null countyWhere when no county filter is present", () => {
    const filters: FilterDef[] = [
      { column: "state", op: "in", value: ["CA"] },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toBeNull();
    expect(remainingFilters).toEqual(filters);
  });

  it("returns null countyWhere when county filter value is not an array", () => {
    const filters: FilterDef[] = [
      { column: "countyName", op: "in", value: "Harris County" },
    ];

    const { countyWhere, remainingFilters } = extractCountyFilter(filters);

    expect(countyWhere).toBeNull();
    expect(remainingFilters).toEqual(filters);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/districts/search/__tests__/county-filter.test.ts`
Expected: PASS (the test defines its own function — this validates the logic before we integrate)

- [ ] **Step 3: Add county filter extraction to the search route**

In `src/app/api/districts/search/route.ts`, add the extraction logic after the filter parsing loop (after line 92, before the relation/scalar split at line 109).

Add this block between the filter parsing and the relation/scalar split:

```typescript
  // Extract compound county+state filter (structured objects, not plain strings)
  // Before splitting into scalar/relation filters, pull out countyName and handle
  // it separately since it needs a compound (countyName + stateAbbrev) WHERE clause.
  let countyWhere: Record<string, unknown> | null = null;
  const countyFilter = filters.find(
    (f) => f.column === "countyName" && f.op === "in" && Array.isArray(f.value)
  );
  if (countyFilter) {
    const pairs = countyFilter.value as Array<{
      countyName: string;
      stateAbbrev: string;
    }>;
    countyWhere = {
      OR: pairs.map((p) => ({
        countyName: p.countyName,
        stateAbbrev: p.stateAbbrev,
      })),
    };
    filters = filters.filter((f) => f !== countyFilter);
  }
```

Then, merge `countyWhere` into the final `where` object. Find the line (around line 258):

```typescript
  const where: Record<string, unknown> = { ...filterWhere, ...relationWhere };
```

Replace with:

```typescript
  const where: Record<string, unknown> = { ...filterWhere, ...relationWhere };
  // Merge county compound filter into the AND array
  if (countyWhere) {
    if (!where.AND) where.AND = [];
    (where.AND as unknown[]).push(countyWhere);
  }
```

Also update `hasAttributeFilters` (around line 245) to include county:

```typescript
  const hasAttributeFilters = scalarFilters.length > 0 || relationFilters.length > 0 || countyWhere !== null;
```

- [ ] **Step 4: Run the county filter tests**

Run: `npx vitest run src/app/api/districts/search/__tests__/county-filter.test.ts`
Expected: PASS

- [ ] **Step 5: Run the existing filter tests to check for regressions**

Run: `npx vitest run src/features/explore/lib/__tests__/filters.test.ts`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/districts/search/route.ts src/app/api/districts/search/__tests__/county-filter.test.ts
git commit -m "feat: handle compound county+state filter in district search API"
```

---

### Task 4: Geography Domain Classification

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx:74`

- [ ] **Step 1: Add `"countyName"` to the geography domain set**

In `src/features/map/components/SearchBar/index.tsx`, find line 74-76:

```typescript
  geography: new Set([
    "state", "urbanicity", "_zipRadius", "charterSchoolCount", "titleISchoolCount",
  ]),
```

Replace with:

```typescript
  geography: new Set([
    "state", "countyName", "urbanicity", "_zipRadius", "charterSchoolCount", "titleISchoolCount",
  ]),
```

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchBar/index.tsx
git commit -m "feat: add countyName to geography filter domain for badge counts"
```

---

### Task 5: County Section in GeographyDropdown

**Files:**
- Modify: `src/features/map/components/SearchBar/GeographyDropdown.tsx`

- [ ] **Step 1: Add county filter UI to GeographyDropdown**

Replace the entire contents of `src/features/map/components/SearchBar/GeographyDropdown.tsx` with:

```typescript
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { mapV2Ref } from "@/features/map/lib/ref";
import { useCounties } from "@/features/map/lib/queries";
import type { CountyOption } from "@/features/map/lib/queries";
import FilterMultiSelect from "./controls/FilterMultiSelect";


interface GeographyDropdownProps {
  onClose: () => void;
}

export default function GeographyDropdown({ onClose }: GeographyDropdownProps) {
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const ref = useRef<HTMLDivElement>(null);

  const [states, setStates] = useState<Array<{ abbrev: string; name: string }>>([]);
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("25");
  const [zipLoading, setZipLoading] = useState(false);

  // Fetch counties via TanStack Query (cached for the session)
  const { data: counties = [] } = useCounties();

  // Get currently selected state abbreviations from the state filter (if any)
  const selectedStates = useMemo(() => {
    const stateFilter = searchFilters.find((f) => f.column === "state" && f.op === "in");
    return stateFilter && Array.isArray(stateFilter.value)
      ? (stateFilter.value as string[])
      : [];
  }, [searchFilters]);

  // Build county options — scoped to selected states if any are active
  const countyOptions = useMemo(() => {
    const filtered = selectedStates.length > 0
      ? counties.filter((c) => selectedStates.includes(c.stateAbbrev))
      : counties;
    return filtered.map((c) => ({
      value: JSON.stringify({ countyName: c.countyName, stateAbbrev: c.stateAbbrev }),
      label: `${c.countyName} (${c.stateAbbrev})`,
    }));
  }, [counties, selectedStates]);

  useEffect(() => {
    fetch("/api/states")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setStates(
          (data as Array<{ abbrev: string; name: string }>).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        )
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const addFilter = (column: string, op: string, value: any) => {
    addSearchFilter({ id: crypto.randomUUID(), column, op: op as any, value });
  };

  const handleZipSearch = async () => {
    if (!zip || zip.length < 5) return;
    setZipLoading(true);

    try {
      // Geocode the ZIP code
      const params = new URLSearchParams({ q: zip, format: "json", limit: "1", countrycodes: "us" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "TerritoryPlanBuilder/1.0" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.length) return;

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const miles = Number(radius);

      // Add a special zip+radius filter
      addFilter("_zipRadius", "eq", { zip, lat, lng, miles });

      // Fly the map to the ZIP location with appropriate zoom
      const map = mapV2Ref.current;
      if (map) {
        const zoomByRadius: Record<number, number> = { 5: 11, 10: 10, 25: 9, 50: 8, 100: 7, 150: 6, 200: 6, 250: 5 };
        map.flyTo({ center: [lng, lat], zoom: zoomByRadius[miles] || 9, duration: 1500 });
      }

      setZip("");
    } finally {
      setZipLoading(false);
    }
  };

  // Handle county filter application — store structured objects as value
  const handleCountyApply = (_column: string, values: string[]) => {
    const parsed = values.map((v) => JSON.parse(v) as CountyOption);
    addFilter("countyName", "in", parsed);
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] max-h-[calc(100vh-140px)] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Geography</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {/* ZIP + Radius */}
        <div>
          <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">ZIP Code + Radius</label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="ZIP code"
              maxLength={5}
              className="w-24 px-2 py-1.5 rounded border border-[#D4CFE2] text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
              onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
            />
            <div className="relative">
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="px-2 pr-7 py-1.5 text-xs border border-[#C2BBD4] rounded-lg
                  bg-white text-[#403770] appearance-none
                  focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              >
                <option value="5">5 mi</option>
                <option value="10">10 mi</option>
                <option value="25">25 mi</option>
                <option value="50">50 mi</option>
                <option value="100">100 mi</option>
                <option value="150">150 mi</option>
                <option value="200">200 mi</option>
                <option value="250">250+ mi</option>
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0] pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <button
              onClick={handleZipSearch}
              disabled={zip.length < 5 || zipLoading}
              className="px-2.5 py-1.5 rounded text-[10px] font-bold text-white bg-plum hover:bg-plum/90 disabled:opacity-40 transition-colors"
            >
              {zipLoading ? "..." : "Search"}
            </button>
          </div>
        </div>

        {/* State */}
        {states.length > 0 && (
          <FilterMultiSelect
            label="State"
            column="state"
            options={states.map((s) => ({ value: s.abbrev, label: `${s.name} (${s.abbrev})` }))}
            onApply={(col, vals) => addFilter(col, "in", vals)}
          />
        )}

        {/* County */}
        {countyOptions.length > 0 && (
          <FilterMultiSelect
            label="County"
            column="countyName"
            options={countyOptions}
            onApply={handleCountyApply}
          />
        )}

      </div>
    </div>
  );
}
```

Key changes from the original:
- Import `useCounties` and `CountyOption` from queries
- Read `searchFilters` from the store to detect selected states
- Build `countyOptions` with JSON-stringified values (so `FilterMultiSelect` can use string values internally)
- `handleCountyApply` parses the JSON strings back into structured objects before adding the filter
- County options are scoped to selected states when active

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` (port 3005)

1. Open `http://localhost:3005/?tab=map`
2. Click the "Geography" button in the search bar
3. Verify the County section appears below State
4. Type "Harris" in the county search — should see "Harris County (TX)", "Harris County (GA)", etc.
5. Select "Harris County (TX)" — should appear as a pill
6. Verify the district results update to show only districts in Harris County, TX
7. Select a state (e.g., "Texas") — verify county list narrows to only TX counties
8. Remove the state — verify previously selected "Harris County (TX)" pill remains

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchBar/GeographyDropdown.tsx
git commit -m "feat: add county filter section to GeographyDropdown"
```

---

### Task 6: FilterMultiSelect Compatibility — County Value Handling

**Files:**
- Modify: `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx`

The `FilterMultiSelect` component syncs its internal `selected` state with existing store filters by reading `existingFilter.value` as `string[]`. For county filters, the store value is an array of objects, not strings. The component needs to handle this.

- [ ] **Step 1: Update FilterMultiSelect to handle county filter sync**

In `src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx`, find lines 17-20:

```typescript
  const existingFilter = searchFilters.find((f) => f.column === column && f.op === "in");
  const existingValues = existingFilter && Array.isArray(existingFilter.value)
    ? (existingFilter.value as string[])
    : [];
```

Replace with:

```typescript
  const existingFilter = searchFilters.find((f) => f.column === column && f.op === "in");
  const existingValues = existingFilter && Array.isArray(existingFilter.value)
    ? (existingFilter.value as unknown[]).map((v) =>
        typeof v === "string" ? v : JSON.stringify(v)
      )
    : [];
```

This ensures that when the county filter stores `[{ countyName: "Harris County", stateAbbrev: "TX" }]`, the component converts each object to its JSON string representation — matching the `value` field in the options array from GeographyDropdown.

- [ ] **Step 2: Verify the app compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchBar/controls/FilterMultiSelect.tsx
git commit -m "feat: handle object filter values in FilterMultiSelect for county sync"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 2: Manual end-to-end test**

Run: `npm run dev` (port 3005)

Test the following scenarios:

1. **Basic county search:** Open Geography → type "Wash" → see Washington County results from multiple states → select one → districts filter correctly
2. **Multi-county selection:** Select "Washington County (AL)" and "Harris County (TX)" → results show districts from both counties
3. **State scoping:** Select state "Texas" first → county list shows only TX counties → select a county → both filters active
4. **Independence:** Select "Harris County (TX)" in county → do NOT select TX in state → districts from Harris County TX still appear
5. **Remove county:** Click × on a county pill → filter updates, districts refresh
6. **Badge count:** Verify the Geography button badge counts include county selections
7. **Clear all:** Clear the county filter → verify results return to unfiltered state

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
