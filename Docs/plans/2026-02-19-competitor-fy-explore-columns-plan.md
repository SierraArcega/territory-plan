# Competitor FY Explore Columns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose per-competitor, per-FY spend data as filterable and visible columns in the Explore districts table.

**Architecture:** Hybrid approach — 3 competitors are hardcoded constants, fiscal years are data-driven from a lightweight metadata endpoint. Dynamic column definitions are generated client-side from `COMPETITORS x fetchedFYs`. The explore API joins `competitor_spend` data into district rows and supports number-based filtering on competitor columns.

**Tech Stack:** Next.js API routes, Prisma, React Query (SWR-style hooks), existing ExploreFilters/Table/ColumnPicker/SortDropdown components.

---

### Task 1: Metadata API Endpoint

**Files:**
- Create: `src/app/api/explore/competitor-meta/route.ts`

**Step 1: Create the endpoint**

```ts
// src/app/api/explore/competitor-meta/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.competitorSpend.findMany({
    select: { fiscalYear: true },
    distinct: ["fiscalYear"],
    orderBy: { fiscalYear: "asc" },
  });

  const fiscalYears = rows.map((r) => r.fiscalYear.toLowerCase());

  return NextResponse.json({ fiscalYears });
}
```

**Step 2: Verify endpoint works**

Run: `curl http://localhost:3000/api/explore/competitor-meta`
Expected: `{"fiscalYears":["fy24","fy25","fy26"]}` (or whatever FYs exist)

**Step 3: Commit**

```
feat: add competitor-meta endpoint for available FYs
```

---

### Task 2: Column Generator + Client Hook

**Files:**
- Modify: `src/components/map-v2/explore/columns/districtColumns.ts` (after line 943)
- Modify: `src/lib/api.ts` (add hook near other data hooks)

**Step 1: Add COMPETITORS constant and generator to districtColumns.ts**

Append after the closing `];` of `districtColumns` (line 943):

```ts
// ---- Competitor spend (dynamic columns) ----

export const COMPETITORS = [
  { name: "Proximity Learning", slug: "proximity_learning", color: "#6EA3BE" },
  { name: "Elevate K12", slug: "elevate_k12", color: "#E07A5F" },
  { name: "Tutored By Teachers", slug: "tutored_by_teachers", color: "#7C3AED" },
] as const;

/**
 * Generate competitor spend columns for a set of fiscal years.
 * Returns columns in FY-descending order (newest first), grouped under "Competitor Spend".
 */
export function getCompetitorColumns(fiscalYears: string[]): ColumnDef[] {
  // Sort FYs descending so newest appears first
  const sortedFYs = [...fiscalYears].sort().reverse();
  const cols: ColumnDef[] = [];

  for (const fy of sortedFYs) {
    const fyLabel = fy.toUpperCase(); // "fy26" -> "FY26"
    for (const comp of COMPETITORS) {
      cols.push({
        key: `comp_${comp.slug}_${fy}`,
        label: `${comp.name} ${fyLabel} ($)`,
        group: "Competitor Spend",
        isDefault: false,
        filterType: "number",
      });
    }
  }

  return cols;
}

/**
 * Parse a competitor column key like "comp_proximity_learning_fy26"
 * into { competitor: "Proximity Learning", fiscalYear: "fy26" } or null.
 */
export function parseCompetitorColumnKey(key: string): { competitor: string; fiscalYear: string } | null {
  if (!key.startsWith("comp_")) return null;
  for (const comp of COMPETITORS) {
    const prefix = `comp_${comp.slug}_`;
    if (key.startsWith(prefix)) {
      const fy = key.slice(prefix.length);
      return { competitor: comp.name, fiscalYear: fy };
    }
  }
  return null;
}
```

**Step 2: Add useCompetitorFYs hook to api.ts**

Add near the other data hooks (around line 477 where `useTags` is):

```ts
// ---- Competitor metadata ----

export function useCompetitorFYs() {
  return useQuery({
    queryKey: ["competitorFYs"],
    queryFn: () => fetchJson<{ fiscalYears: string[] }>(`${API_BASE}/explore/competitor-meta`),
    staleTime: 60 * 60 * 1000, // 1 hour - FYs rarely change
    select: (data) => data.fiscalYears,
  });
}
```

**Step 3: Commit**

```
feat: add competitor column generator and useCompetitorFYs hook
```

---

### Task 3: Explore API — Competitor Data Fetching & Filtering

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

This task adds three capabilities to the districts handler:
1. Recognize competitor column keys in the `columns` and `filters` params
2. Include `competitorSpend` in the Prisma select when competitor columns are requested
3. Pivot competitor spend rows into flat keys on each district row
4. Handle competitor-column filters in `buildRelationWhere`

**Step 1: Import parseCompetitorColumnKey at top of file**

Add to imports (line 8-13 area):

```ts
import { parseCompetitorColumnKey, COMPETITORS } from "@/components/map-v2/explore/columns/districtColumns";
```

**Step 2: Add competitor spend to RELATION_SELECTS**

After the existing `RELATION_SELECTS` object (line 110-126), there's no need to add a static entry — competitor spend will be handled conditionally. Instead, update `buildDistrictSelect` to detect competitor columns.

In `buildDistrictSelect` (line 131-163), add competitor spend detection after the existing column loop:

```ts
function buildDistrictSelect(columns: string[] | null): Record<string, unknown> {
  if (!columns) {
    return buildFullDistrictSelect();
  }

  const select: Record<string, unknown> = {};

  for (const f of ALWAYS_SELECT) {
    select[f] = true;
  }

  let needsCompetitorSpend = false;

  for (const col of columns) {
    const prismaField = CLIENT_TO_PRISMA[col];
    if (prismaField && !(prismaField in select)) {
      select[prismaField] = true;
    }
    const relSelect = RELATION_SELECTS[col];
    if (relSelect) {
      Object.assign(select, relSelect);
    }
    // Check if this is a competitor column
    if (parseCompetitorColumnKey(col)) {
      needsCompetitorSpend = true;
    }
  }

  // Include competitor spend relation if any comp_ columns are visible
  if (needsCompetitorSpend) {
    select.competitorSpend = {
      select: { competitor: true, fiscalYear: true, totalSpend: true },
    };
  }

  select.enrollment = true;
  select.fy26OpenPipeline = true;
  select.fy26ClosedWonNetBooking = true;

  return select;
}
```

Also update `buildFullDistrictSelect` to always include competitor spend:

```ts
function buildFullDistrictSelect(): Record<string, unknown> {
  const select: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const prismaField of Object.values(DISTRICT_FIELD_MAP)) {
    if (!seen.has(prismaField)) {
      select[prismaField] = true;
      seen.add(prismaField);
    }
  }
  for (const relSelect of Object.values(RELATION_SELECTS)) {
    Object.assign(select, relSelect);
  }
  // Always include competitor spend
  select.competitorSpend = {
    select: { competitor: true, fiscalYear: true, totalSpend: true },
  };
  return select;
}
```

**Step 3: Handle competitor filters in buildRelationWhere**

Update `buildRelationWhere` (line 188-220) to handle `comp_*` filters. Add after the existing `planNames` block:

```ts
    // Competitor spend filters (comp_{slug}_{fy})
    const compParsed = parseCompetitorColumnKey(f.column);
    if (compParsed) {
      // Build competitorSpend relation filter
      const compFilter: Record<string, unknown> = {
        competitor: compParsed.competitor,
        fiscalYear: compParsed.fiscalYear,
      };

      switch (f.op) {
        case "eq":
          compFilter.totalSpend = f.value;
          break;
        case "neq":
          compFilter.totalSpend = { not: f.value };
          break;
        case "gt":
          compFilter.totalSpend = { gt: f.value };
          break;
        case "lt":
          compFilter.totalSpend = { lt: f.value };
          break;
        case "between": {
          const [min, max] = f.value as [number, number];
          compFilter.totalSpend = { gte: min, lte: max };
          break;
        }
        case "is_empty":
          // No record for this competitor+FY = empty
          // Will be handled as "none" below
          break;
        case "is_not_empty":
          // Has a record for this competitor+FY
          break;
      }

      if (f.op === "is_empty") {
        // Merge into existing AND if multiple comp filters
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          competitorSpend: { none: { competitor: compParsed.competitor, fiscalYear: compParsed.fiscalYear } },
        });
      } else {
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          competitorSpend: { some: compFilter },
        });
      }
    }
```

**Step 4: Update RELATION_COLUMNS set to include comp_ prefix**

In `handleDistricts` (line 226), update the relation columns check to also catch competitor columns:

```ts
  const RELATION_COLUMNS = new Set(["tags", "planNames"]);
  const scalarFilters = filters.filter((f) => !RELATION_COLUMNS.has(f.column) && !f.column.startsWith("comp_"));
  const relationFilters = filters.filter((f) => RELATION_COLUMNS.has(f.column) || f.column.startsWith("comp_"));
```

**Step 5: Pivot competitor spend into flat keys in row mapping**

In the data mapping section (line 267-289), add competitor spend pivoting after the existing relation mapping:

```ts
    // Competitor spend → flat keys (e.g., comp_proximity_learning_fy26: 45000)
    if (d.competitorSpend) {
      for (const cs of d.competitorSpend as { competitor: string; fiscalYear: string; totalSpend: unknown }[]) {
        const comp = COMPETITORS.find((c) => c.name === cs.competitor);
        if (comp) {
          const key = `comp_${comp.slug}_${cs.fiscalYear.toLowerCase()}`;
          row[key] = cs.totalSpend != null ? Number(cs.totalSpend) : null;
        }
      }
    }
```

**Step 6: Verify the API returns competitor data**

Run: `curl "http://localhost:3000/api/explore/districts?columns=name,state,comp_proximity_learning_fy26&pageSize=5"`
Expected: Rows include `comp_proximity_learning_fy26` field with number values or undefined.

**Step 7: Commit**

```
feat: handle competitor spend in explore districts API
```

---

### Task 4: UI Integration — Merge Dynamic Columns

**Files:**
- Modify: `src/components/map-v2/explore/ExploreFilters.tsx`
- Modify: `src/components/map-v2/explore/ExploreColumnPicker.tsx`
- Modify: `src/components/map-v2/explore/ExploreSortDropdown.tsx`
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

All four components have a static `COLUMNS_BY_ENTITY` or `ALL_COLUMN_DEFS` built from the static `districtColumns` array. Each needs to merge in the dynamic competitor columns.

**Step 1: Update ExploreFilters.tsx**

Add imports at top:

```ts
import { getCompetitorColumns } from "./columns/districtColumns";
import { useCompetitorFYs } from "@/lib/api";
```

Inside the `ExploreFilters` component function (around line 498), add the hook and computed columns:

```ts
  const { data: competitorFYs } = useCompetitorFYs();

  const columns = useMemo(() => {
    const base = COLUMNS_BY_ENTITY[entity];
    if (entity !== "districts" || !competitorFYs?.length) return base;
    return [...base, ...getCompetitorColumns(competitorFYs)];
  }, [entity, competitorFYs]);
```

Add `useMemo` to the imports from React (line 3).

Replace the existing `const columns = COLUMNS_BY_ENTITY[entity];` on line 520 with usage of the memoized `columns` variable (it's already defined above, so just remove line 520).

Also update `getColumnLabel` (line 98) and the `handleChipClick` (line 591) references to `COLUMNS_BY_ENTITY[entity]` — these need to use the merged columns. The simplest approach: move `getColumnLabel` and `formatFilterPill` inside the component as closures, or pass columns as a parameter. Since they're used outside the component too, make them accept a columns array:

Update `getColumnLabel`:
```ts
function getColumnLabel(columns: ColumnDef[], columnKey: string): string {
  const col = columns.find((c) => c.key === columnKey);
  return col?.label ?? columnKey;
}
```

Update `formatFilterPill` signature:
```ts
function formatFilterPill(columns: ColumnDef[], filter: ExploreFilter): string {
  const label = getColumnLabel(columns, filter.column);
```

Update call sites inside the component to pass `columns`:
- `formatFilterPill(columns, filter)` (around line 694)
- `handleChipClick` — change `COLUMNS_BY_ENTITY[entity].find(...)` to `columns.find(...)` (line 591)

**Step 2: Update ExploreColumnPicker.tsx**

Add imports:

```ts
import { getCompetitorColumns } from "./columns/districtColumns";
import { useCompetitorFYs } from "@/lib/api";
```

Inside the component function, add:

```ts
  const { data: competitorFYs } = useCompetitorFYs();

  const allColumns = useMemo(() => {
    const base = COLUMN_DEFS_BY_ENTITY[entity];
    if (entity !== "districts" || !competitorFYs?.length) return base;
    return [...base, ...getCompetitorColumns(competitorFYs)];
  }, [entity, competitorFYs]);
```

Replace all internal references to `COLUMN_DEFS_BY_ENTITY[entity]` with `allColumns`.

**Step 3: Update ExploreSortDropdown.tsx**

Same pattern — add imports, add hook + useMemo, replace `COLUMNS_BY_ENTITY[entity]` with the merged result.

**Step 4: Update ExploreTable.tsx**

This is slightly different because `ALL_COLUMN_DEFS`, `LABEL_MAP`, and `CURRENCY_KEYS` are module-level constants. They need to become dynamic.

Add imports:

```ts
import { getCompetitorColumns } from "./columns/districtColumns";
import { useCompetitorFYs } from "@/lib/api";
```

Inside the `ExploreTable` component, compute dynamic label/currency maps:

```ts
  const { data: competitorFYs } = useCompetitorFYs();

  const { labelMap, currencyKeys } = useMemo(() => {
    const competitorCols = competitorFYs?.length ? getCompetitorColumns(competitorFYs) : [];
    const allCols = [...ALL_COLUMN_DEFS, ...competitorCols];

    const lm: Record<string, string> = {};
    const ck = new Set<string>();
    for (const col of allCols) {
      lm[col.key] = col.label;
      if (col.label.includes("($)")) ck.add(col.key);
    }
    return { labelMap: lm, currencyKeys: ck };
  }, [competitorFYs]);
```

Update `columnLabel` to use `labelMap` instead of `LABEL_MAP` (make it a closure or pass map). The cleanest approach: make `columnLabel` use a `labelMap` param, or inline it as a closure inside the component.

Update all references to `CURRENCY_KEYS` inside the component to use `currencyKeys`.

**Step 5: Verify end-to-end**

1. Open the Explore page → Districts tab
2. Click "+ Add Filter" → scroll to "Competitor Spend" group
3. Select a competitor FY column → operator (e.g., "greater than") → value
4. Verify filter applies and districts are filtered
5. Open Column Picker → enable a competitor column → verify it appears in the table with $ formatting

**Step 6: Commit**

```
feat: integrate competitor FY columns into Explore UI
```

---

### Summary of Changes

| # | Task | Files | Description |
|---|------|-------|-------------|
| 1 | Metadata endpoint | 1 new | `GET /api/explore/competitor-meta` returns available FYs |
| 2 | Column generator + hook | 2 modified | `COMPETITORS`, `getCompetitorColumns()`, `useCompetitorFYs()` |
| 3 | Explore API | 1 modified | Competitor spend join, filter, pivot in district handler |
| 4 | UI integration | 4 modified | Merge dynamic columns into Filters, ColumnPicker, Sort, Table |
