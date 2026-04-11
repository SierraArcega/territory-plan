# FY-Agnostic Financial Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 18 FY-specific filter keys (e.g., `fy26_open_pipeline_value`) with 8 FY-agnostic keys (e.g., `open_pipeline`) that query `district_financials` for the user-selected fiscal year. Auto-detect the default FY from the current date. Add a tooltip explaining the FY auto-detection logic.

**Architecture:** The filter/sort system currently maps FY-specific keys to Prisma District model fields that were removed during normalization. This plan replaces those with FY-agnostic keys that the search route handles via Prisma relation filters (for WHERE) and raw SQL (for ORDER BY) against the `district_financials` table. The existing `selectedFiscalYear` store state (already used for map tiles) becomes the FY for financial filters too. The `getDefaultFiscalYear()` function in `src/features/shared/lib/fiscal-year.ts` provides auto-detection.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, Zustand, Tailwind 4, Lucide icons

**Sub-skills:** Use `/frontend-design` for the FY tooltip component and `/design-review` after implementation.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/shared/lib/fiscal-year.ts` | Modify | Add `getDefaultFiscalYearKey()` returning `"fy26"` format |
| `src/features/shared/lib/filters.ts` | Modify | Replace 18 FY entries with 8 agnostic keys, add `FINANCIAL_FIELD_MAP` |
| `src/app/api/districts/search/route.ts` | Modify | Accept `fy` param, handle financial filters via relation, financial sort via raw SQL |
| `src/features/map/lib/store.ts` | Modify | Auto-detect default FY, add financial filter keys to domain columns |
| `src/features/map/components/SearchBar/DistrictsDropdown.tsx` | Modify | Use agnostic filter keys, show labels without FY prefix |
| `src/features/map/components/SearchBar/FilterPills.tsx` | Modify | Update labels and money column set |
| `src/features/map/components/SearchBar/index.tsx` | Modify | Update domain columns, add tooltip to FY selector |
| `src/features/map/components/SearchResults/index.tsx` | Modify | Update sort options to agnostic keys, pass `fy` to API, re-fetch on FY change |

---

### Task 1: Add `getDefaultFiscalYearKey()` helper

**Files:**
- Modify: `src/features/shared/lib/fiscal-year.ts`

- [ ] **Step 1: Add the helper function**

The existing `getDefaultFiscalYear()` returns a number (e.g., `2026`). Add a companion that returns the store-compatible string format (e.g., `"fy26"`).

```ts
import type { FiscalYear } from "@/features/map/lib/store";

// Get default fiscal year based on current date
// If we're past June (month >= 6), we're in the next fiscal year
export function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

/** Return store-compatible FY key, e.g. "fy26". Clamped to fy24–fy27. */
export function getDefaultFiscalYearKey(): FiscalYear {
  const fy = getDefaultFiscalYear();
  const suffix = fy % 100; // 2026 → 26
  if (suffix <= 24) return "fy24";
  if (suffix >= 27) return "fy27";
  return `fy${suffix}` as FiscalYear;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/lib/fiscal-year.ts && git commit -m "feat: add getDefaultFiscalYearKey() helper for store-compatible FY string"
```

---

### Task 2: Replace FY-specific filter keys with agnostic keys in `filters.ts`

**Files:**
- Modify: `src/features/shared/lib/filters.ts`

- [ ] **Step 1: Replace FY entries and add `FINANCIAL_FIELD_MAP`**

In `DISTRICT_FIELD_MAP`, remove lines 45–63 (the 18 FY-specific entries). They map to Prisma fields that no longer exist on the District model.

Add a new exported `FINANCIAL_FIELD_MAP` below `DISTRICT_FIELD_MAP`. This maps FY-agnostic filter keys to `DistrictFinancials` Prisma field names:

```ts
// FY-agnostic filter key → DistrictFinancials Prisma field name
// These are handled separately from scalar District filters — they require
// a relation filter against district_financials for the selected fiscal year.
export const FINANCIAL_FIELD_MAP: Record<string, string> = {
  open_pipeline: "openPipeline",
  weighted_pipeline: "weightedPipeline",
  closed_won_bookings: "closedWonBookings",
  invoicing: "invoicing",
  closed_won_opp_count: "closedWonOppCount",
  sessions_revenue: "totalRevenue",    // DistrictFinancials.totalRevenue (vendor revenue, not education finance)
  sessions_take: "totalTake",
  sessions_count: "sessionCount",
};

/** Set of filter column keys that target district_financials (not districts). */
export const FINANCIAL_COLUMNS = new Set(Object.keys(FINANCIAL_FIELD_MAP));
```

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/lib/filters.ts && git commit -m "feat: replace FY-specific filter keys with agnostic FINANCIAL_FIELD_MAP"
```

---

### Task 3: Update search route to handle financial filters and FY param

**Files:**
- Modify: `src/app/api/districts/search/route.ts`

This is the largest change. The route needs to:
1. Accept a `fy` query param (default from `getDefaultFiscalYearKey()`)
2. Separate financial filters from scalar filters
3. Build Prisma relation `where` for financial filters
4. Handle financial sorting via raw SQL pre-query
5. Pass selected FY to `CARD_SELECT.districtFinancials.where`

- [ ] **Step 1: Add imports and FY param parsing**

Add to imports:

```ts
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
  FINANCIAL_FIELD_MAP,
  FINANCIAL_COLUMNS,
} from "@/features/shared/lib/filters";
import { getDefaultFiscalYearKey } from "@/features/shared/lib/fiscal-year";
```

After the `limit` parsing (around line 107), add FY param:

```ts
  // Fiscal year for financial filters/sort (default: auto-detect from current date)
  const VALID_FYS = ["FY24", "FY25", "FY26", "FY27"] as const;
  const fyParam = url.searchParams.get("fy") || getDefaultFiscalYearKey();
  const fiscalYear = fyParam.toUpperCase();
  if (!VALID_FYS.includes(fiscalYear as typeof VALID_FYS[number])) {
    return NextResponse.json({ error: "Invalid fiscal year" }, { status: 400 });
  }
```

- [ ] **Step 2: Separate financial filters from scalar filters**

In the filter separation block (around line 130–142), add financial filters as a third category. Replace the existing block:

```ts
  // Separate relation/special filters from scalar filters
  // Scalar filters map directly to District columns via DISTRICT_FIELD_MAP.
  // Financial filters target district_financials for the selected FY.
  // Relation filters need custom Prisma where clauses (tags, plans, competitors).
  const RELATION_COLUMNS = new Set(["tags", "planNames", "competitorChurned", "competitorEngagement"]);
  const scalarFilters: FilterDef[] = [];
  const financialFilters: FilterDef[] = [];
  const relationFilters: FilterDef[] = [];
  for (const f of filters) {
    if (FINANCIAL_COLUMNS.has(f.column)) {
      financialFilters.push(f);
    } else if (f.column.startsWith("competitor_") || RELATION_COLUMNS.has(f.column)) {
      relationFilters.push(f);
    } else {
      scalarFilters.push(f);
    }
  }
```

- [ ] **Step 3: Build financial relation where clause**

After the relation where block (after the `competitorChurned` handler, around line 247), add:

```ts
  // Financial filters → Prisma relation filter on districtFinancials
  if (financialFilters.length > 0) {
    for (const f of financialFilters) {
      const prismaField = FINANCIAL_FIELD_MAP[f.column];
      if (!prismaField) continue;
      if (!relationWhere.AND) relationWhere.AND = [];
      (relationWhere.AND as unknown[]).push({
        districtFinancials: {
          some: {
            vendor: "fullmind",
            fiscalYear,
            [prismaField]: buildCondition(f),
          },
        },
      });
    }
  }
```

Also import `buildCondition` — but it's not currently exported. Instead, inline the condition building or export it. The simplest approach: export `buildCondition` from `filters.ts`.

In `filters.ts`, change `function buildCondition` to `export function buildCondition`.

- [ ] **Step 4: Handle financial sorting via raw SQL**

Replace the sort block (around line 303–305). When the sort column is a financial field, use a raw SQL pre-query to get ordered leaids, then use those as the pagination source:

```ts
  // Sort — check if sorting by a financial column
  const isFinancialSort = FINANCIAL_COLUMNS.has(sortCol);
  const prismaSort = !isFinancialSort ? (SORT_FIELD_MAP[sortCol] ?? "enrollment") : "enrollment";
  const orderBy = !isFinancialSort ? { [prismaSort]: sortDir } : undefined;
```

Then replace the count + fetch block (around line 308–317):

```ts
  let total: number;
  let districts: any[];

  if (isFinancialSort) {
    // Financial sort: raw SQL to get ordered leaids, then Prisma for card data
    // First get all matching leaids via Prisma (respects all filters)
    const allMatching = await prisma.district.findMany({
      where,
      select: { leaid: true },
    });
    total = allMatching.length;
    const allLeaids = allMatching.map((d) => d.leaid);

    if (allLeaids.length === 0) {
      districts = [];
    } else {
      // Sort by financial column via raw SQL
      const dfColumn = FINANCIAL_FIELD_MAP[sortCol]!;
      // Convert camelCase to snake_case for raw SQL
      const snakeCol = dfColumn.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      const sortedLeaids = await prisma.$queryRaw<{ leaid: string }[]>`
        SELECT d.leaid
        FROM districts d
        LEFT JOIN district_financials df ON df.leaid = d.leaid
          AND df.vendor = 'fullmind' AND df.fiscal_year = ${fiscalYear}
        WHERE d.leaid = ANY(${allLeaids})
        ORDER BY COALESCE(df.${Prisma.raw(snakeCol)}, 0) ${Prisma.raw(sortDir === "asc" ? "ASC" : "DESC")}
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      const pageLeaids = sortedLeaids.map((r) => r.leaid);

      // Fetch card data preserving sort order
      const unsorted = await prisma.district.findMany({
        where: { leaid: { in: pageLeaids } },
        select: cardSelect,
      });
      // Re-sort to match SQL order
      const byLeaid = new Map(unsorted.map((d) => [d.leaid, d]));
      districts = pageLeaids.map((l) => byLeaid.get(l)).filter(Boolean);
    }
  } else {
    // Scalar sort: standard Prisma query
    [total, districts] = await Promise.all([
      prisma.district.count({ where }),
      prisma.district.findMany({
        where,
        select: cardSelect,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }
```

Add import for `Prisma` at the top:

```ts
import { Prisma } from "@prisma/client";
```

- [ ] **Step 5: Make CARD_SELECT dynamic for the selected FY**

Replace the static `CARD_SELECT` const with a function that accepts the fiscal year:

```ts
// Fields returned per district card
function getCardSelect(fiscalYear: string) {
  return {
    leaid: true,
    name: true,
    stateAbbrev: true,
    countyName: true,
    enrollment: true,
    isCustomer: true,
    accountType: true,
    ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
    ellPct: true,
    swdPct: true,
    childrenPovertyPercent: true,
    medianHouseholdIncome: true,
    expenditurePerPupil: true,
    urbanCentricLocale: true,
    districtFinancials: {
      where: { vendor: "fullmind", fiscalYear },
      select: { openPipeline: true, closedWonBookings: true, invoicing: true, weightedPipeline: true },
    },
    territoryPlans: {
      select: { plan: { select: { id: true, name: true, color: true } } },
    },
  } as const;
}
```

Then use it in the route: `const cardSelect = getCardSelect(fiscalYear);`

- [ ] **Step 6: Include `financialFilters` in `hasAttributeFilters` check**

Update the `hasAttributeFilters` line:

```ts
  const hasAttributeFilters = scalarFilters.length > 0 || financialFilters.length > 0 || relationFilters.length > 0 || countyWhere !== null;
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/districts/search/route.ts src/features/shared/lib/filters.ts && git commit -m "feat: search route accepts fy param, handles financial filters via relation + raw SQL sort"
```

---

### Task 4: Update store to auto-detect default FY

**Files:**
- Modify: `src/features/map/lib/store.ts`

- [ ] **Step 1: Import and use `getDefaultFiscalYearKey`**

Add import near the top (with other imports):

```ts
import { getDefaultFiscalYearKey } from "@/features/shared/lib/fiscal-year";
```

Replace the hardcoded default (around line 537):

```ts
  selectedFiscalYear: getDefaultFiscalYearKey(),
```

Also update the `compareFyB` default to use it:

```ts
  compareFyB: getDefaultFiscalYearKey(),
```

- [ ] **Step 2: Add financial filter keys to domain column sets**

In the `DOMAIN_COLUMNS` block in `SearchBar/index.tsx` (line 73–98), the `fullmind` set references the old FY-prefixed keys. This also needs to be updated — but that's Task 6. In the store itself, no domain columns are defined.

- [ ] **Step 3: Commit**

```bash
git add src/features/map/lib/store.ts && git commit -m "feat: auto-detect default fiscal year from current date"
```

---

### Task 5: Update `DistrictsDropdown` — agnostic filter keys

**Files:**
- Modify: `src/features/map/components/SearchBar/DistrictsDropdown.tsx`

- [ ] **Step 1: Update `SECTION_COLUMNS` fullmind set**

Replace the FY-specific columns (line 14–17):

```ts
  fullmind: new Set([
    "isCustomer", "hasOpenPipeline", "salesExecutive", "owner",
    "open_pipeline", "closed_won_bookings", "invoicing",
    "tags",
  ]),
```

- [ ] **Step 2: Update `countSectionFilters` — remove FY regex fallback**

Remove the line (43): `if (section === "fullmind" && /^fy\d+_/.test(f.column)) return true;`

The agnostic keys are now in the set, so the regex is unnecessary.

- [ ] **Step 3: Update `FullmindContent` — use agnostic filter keys and show FY in label**

Replace the three `RangeFilter` lines (290–292):

```tsx
      <RangeFilter label={`Pipeline (${fyLabel})`} column="open_pipeline" min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label={`Bookings (${fyLabel})`} column="closed_won_bookings" min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label={`Invoicing (${fyLabel})`} column="invoicing" min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
```

The label now shows e.g. "Pipeline (FY26)" — the FY context comes from the selector, not the filter key.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchBar/DistrictsDropdown.tsx && git commit -m "feat: use FY-agnostic financial filter keys in DistrictsDropdown"
```

---

### Task 6: Update `SearchBar/index.tsx` — domain columns + FY tooltip

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx`

- [ ] **Step 1: Update `DOMAIN_COLUMNS` fullmind set**

Replace the fullmind set (line 77–81):

```ts
  fullmind: new Set([
    "isCustomer", "hasOpenPipeline", "salesExecutive", "owner",
    "open_pipeline", "closed_won_bookings", "invoicing",
    "planNames", "tags",
  ]),
```

- [ ] **Step 2: Add FY auto-detect tooltip**

Use `/frontend-design` skill for this component. The tooltip should explain the FY auto-detection logic. It should appear on hover/click of an info icon next to the FY toggle buttons.

Add a tooltip component inline (after the FY toggle button group, around line 443):

```tsx
            {/* FY info tooltip */}
            <div className="relative group">
              <button
                className="flex items-center justify-center w-5 h-5 rounded-full text-[#A69DC0] hover:text-[#544A78] hover:bg-[#EFEDF5] transition-colors"
                aria-label="Fiscal year info"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 p-2.5 bg-white rounded-lg shadow-lg border border-[#D4CFE2] text-xs text-[#6E6390] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                <p className="font-semibold text-[#544A78] mb-1">Fiscal Year</p>
                <p>Auto-detected from today&apos;s date. The fiscal year runs Jul 1 – Jun 30.</p>
                <p className="mt-1 text-[#8A80A8]">Before July → current calendar year (e.g., FY26 in April 2026). After June → next year.</p>
                <p className="mt-1 text-[#8A80A8]">This controls which financial data is shown for filters, sort, and district cards.</p>
              </div>
            </div>
```

Place this right after the Compare button (line 449), inside the `flex items-center gap-1.5` div.

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchBar/index.tsx && git commit -m "feat: update domain columns, add FY auto-detect tooltip"
```

---

### Task 7: Update `FilterPills` — agnostic labels

**Files:**
- Modify: `src/features/map/components/SearchBar/FilterPills.tsx`

- [ ] **Step 1: Update `COLUMN_LABELS`**

Replace the three FY-specific labels (lines 17–19):

```ts
  open_pipeline: "Pipeline",
  closed_won_bookings: "Bookings",
  invoicing: "Invoicing",
  weighted_pipeline: "Wtd Pipeline",
  closed_won_opp_count: "Closed Won Opps",
  sessions_revenue: "Sessions Revenue",
  sessions_take: "Sessions Take",
  sessions_count: "Session Count",
```

Remove the old `fy26_*` entries.

- [ ] **Step 2: Update `MONEY_COLUMNS`**

Replace the FY-specific entries (line 49):

```ts
const MONEY_COLUMNS = new Set([
  "open_pipeline", "closed_won_bookings", "invoicing", "weighted_pipeline",
  "sessions_revenue", "sessions_take",
  "expenditurePerPupil", "totalRevenue", "federalRevenue", "stateRevenue", "localRevenue",
  "techSpending", "titleIRevenue", "esserFundingTotal", "capitalOutlayTotal", "debtOutstanding",
  "medianHouseholdIncome", "spedExpenditurePerStudent",
]);
```

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchBar/FilterPills.tsx && git commit -m "feat: update FilterPills to FY-agnostic labels"
```

---

### Task 8: Update `SearchResults` — sort options, FY param, re-fetch on FY change

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx`

- [ ] **Step 1: Update sort options**

Replace the sort options (around line 308–313):

```ts
  const sortOptions = [
    { column: "enrollment", label: "Enrollment" },
    { column: "name", label: "Name" },
    { column: "expenditurePerPupil", label: "Expenditure/Pupil" },
    { column: "open_pipeline", label: "Pipeline" },
    { column: "invoicing", label: "Invoicing" },
  ];
```

- [ ] **Step 2: Pass `fy` param to API calls**

In the `fetchResults` function, add the FY param to the URL. After the sort/order params (around line 198):

```ts
      params.set("fy", state.selectedFiscalYear.toUpperCase());
```

Also add it to the CSV export fetch (around line 392):

```ts
      params.set("fy", state.selectedFiscalYear.toUpperCase());
```

- [ ] **Step 3: Re-fetch when FY changes**

Add `selectedFiscalYear` to the store subscriptions. In the existing effect that re-fetches on filter/sort changes (around line 249–261):

```ts
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
```

Add `selectedFiscalYear` to the dependency array of the effect:

```ts
  }, [searchFilters, searchSort, isSearchActive, selectedFiscalYear]);
```

- [ ] **Step 4: Update CSV export headers**

Replace the FY-specific CSV headers (around line 402):

```ts
      const headers = ["LEAID", "Name", "State", "County", "Enrollment", "Customer", "Owner", "ELL %", "SWD %", "Poverty %", "Median Income", "$/Pupil", "Pipeline", "Bookings", "Plans"];
```

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/index.tsx && git commit -m "feat: pass fy param to search API, re-fetch on FY change"
```

---

### Task 9: Run type check and fix any breakages

- [ ] **Step 1: Generate Prisma client**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx prisma generate`

- [ ] **Step 2: Run type check**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit 2>&1 | head -80`

Expected: No errors, or errors in unrelated test files.

- [ ] **Step 3: Fix any type errors found**

Common issues:
- Test files referencing old `fy26_*` filter keys — update to agnostic keys
- `buildCondition` export — make sure it's exported from `filters.ts`
- Any remaining references to removed Prisma fields

- [ ] **Step 4: Commit fixes**

```bash
git add -A && git commit -m "fix: resolve type errors from FY-agnostic filter migration"
```

---

### Task 10: Update test files

**Files:**
- Modify: `src/features/shared/lib/__tests__/filters.test.ts`
- Modify: `src/features/map/components/SearchBar/__tests__/SearchBar.test.tsx`
- Modify: `src/features/map/components/SearchResults/__tests__/SearchResults.test.tsx`
- Modify: `src/app/api/districts/search/__tests__/county-filter.test.ts`

- [ ] **Step 1: Update filter tests**

In `filters.test.ts`, update any test cases that use FY-specific column names (e.g., `fy26_open_pipeline_value`) to use the new agnostic keys (e.g., `open_pipeline`).

- [ ] **Step 2: Update SearchBar tests**

In `SearchBar.test.tsx`, update any filter mock data or assertions that reference FY-specific columns.

- [ ] **Step 3: Run tests**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run --reporter=verbose 2>&1 | tail -40`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: update tests for FY-agnostic financial filters"
```

---

### Task 11: Run design review

Use `/design-review` skill to audit the FY tooltip and updated FilterPills against the Fullmind design system (`Documentation/UI Framework/tokens.md`). Check:
- Tooltip uses correct plum-derived neutrals (not Tailwind grays)
- Info icon uses Lucide-compatible SVG or replace with Lucide `Info` icon
- Filter pill labels are clear without FY prefix
- FY toggle button group still renders correctly

---

### Old → New Filter Key Quick Reference

| Old key | New key | `district_financials` DB column |
|---------|---------|-------------------------------|
| `fy25_net_invoicing` / `fy26_net_invoicing` | `invoicing` | `invoicing` |
| `fy25_closed_won_net_booking` / `fy26_closed_won_net_booking` | `closed_won_bookings` | `closed_won_bookings` |
| `fy26_open_pipeline_value` / `fy27_open_pipeline_value` | `open_pipeline` | `open_pipeline` |
| `fy26_open_pipeline_weighted` / `fy27_open_pipeline_weighted` | `weighted_pipeline` | `weighted_pipeline` |
| `fy25_closed_won_opp_count` / `fy26_closed_won_opp_count` | `closed_won_opp_count` | `closed_won_opp_count` |
| `fy25_sessions_revenue` / `fy26_sessions_revenue` | `sessions_revenue` | `total_revenue` |
| `fy25_sessions_take` / `fy26_sessions_take` | `sessions_take` | `total_take` |
| `fy25_sessions_count` / `fy26_sessions_count` | `sessions_count` | `session_count` |
