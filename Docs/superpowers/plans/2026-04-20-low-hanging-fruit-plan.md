# Low Hanging Fruit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the "Missing Renewal Opp" tab into "Low Hanging Fruit" — a lean summary card in the Leaderboard modal plus a new sidebar tab that renders a filterable card grid with a slide-over drawer and a sequential bulk-add wizard.

**Architecture:** Extend the existing `GET /api/leaderboard/increase-targets` endpoint with `revenueTrend` + `suggestedTarget`; no new routes, no schema changes. Replace the in-modal DataGrid component tree with new card-grid + filter-rail + drawer components under `src/features/leaderboard/`. Add `"low-hanging-fruit"` as a new sidebar tab routed via `?tab=`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind 4 · TanStack Query · Prisma/PostgreSQL · Zustand · Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-04-20-low-hanging-fruit-spec.md`
**Backend context:** `docs/superpowers/specs/2026-04-20-low-hanging-fruit-backend-context.md`

---

## File Structure

**Create:**
- `src/features/leaderboard/components/LowHangingFruitView.tsx`
- `src/features/leaderboard/components/LowHangingFruitCard.tsx`
- `src/features/leaderboard/components/LowHangingFruitFilterRail.tsx`
- `src/features/leaderboard/components/LowHangingFruitDetailDrawer.tsx`
- `src/features/leaderboard/components/BulkAddWizard.tsx`
- `src/features/leaderboard/components/LowHangingFruitSummaryCard.tsx`
- `src/features/leaderboard/lib/filters.ts`
- `src/features/leaderboard/lib/suggestedTarget.ts`
- Tests co-located in `__tests__/` next to each source file

**Modify:**
- `src/app/api/leaderboard/increase-targets/route.ts` — add `revenue_trend` CTE; compute suggested target in mapper
- `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts` — refresh (CTE names) + new field assertions
- `src/features/leaderboard/lib/types.ts` — rename `IncreaseTarget` → `LowHangingFruitRow`, add `suggestedTarget`/`revenueTrend`; keep `IncreaseTarget` alias for one task
- `src/features/leaderboard/lib/queries.ts` — rename `useIncreaseTargetsList` → `useLowHangingFruitList` (alias temporarily)
- `src/features/leaderboard/components/LeaderboardModal.tsx` — rename tab; render `<LowHangingFruitSummaryCard />`
- `src/features/shared/lib/app-store.ts` — extend `TabId`
- `src/features/shared/components/navigation/Sidebar.tsx` — new entry in `MAIN_TABS`
- `src/app/page.tsx` — `VALID_TABS` + render switch

**Delete:**
- `src/features/leaderboard/components/IncreaseTargetsTab.tsx`
- `src/features/leaderboard/components/__tests__/IncreaseTargetsTab.test.tsx`
- `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts`
- `src/features/leaderboard/lib/__tests__/increaseTargetsColumns.test.ts`

---

## Task 1: Extend `IncreaseTarget` type with `suggestedTarget` and `revenueTrend`

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts`
- Create: `src/features/leaderboard/lib/suggestedTarget.ts`
- Test: `src/features/leaderboard/lib/__tests__/suggestedTarget.test.ts`

- [ ] **Step 1: Write the failing test** at `src/features/leaderboard/lib/__tests__/suggestedTarget.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { computeSuggestedTarget } from "../suggestedTarget";

describe("computeSuggestedTarget", () => {
  it("returns fy26 × 1.05 rounded to $5K for missing_renewal", () => {
    expect(computeSuggestedTarget("missing_renewal", 320_000, 0)).toBe(335_000);
    expect(computeSuggestedTarget("missing_renewal", 100_000, 0)).toBe(105_000);
  });

  it("returns priorYear × 0.90 rounded to $5K for winbacks", () => {
    expect(computeSuggestedTarget("fullmind_winback", 0, 180_000)).toBe(160_000);
    expect(computeSuggestedTarget("ek12_winback", 0, 240_000)).toBe(215_000);
  });

  it("returns null when the relevant revenue signal is 0", () => {
    expect(computeSuggestedTarget("missing_renewal", 0, 0)).toBeNull();
    expect(computeSuggestedTarget("fullmind_winback", 0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect fail**

`npx vitest run src/features/leaderboard/lib/__tests__/suggestedTarget.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/features/leaderboard/lib/suggestedTarget.ts`**

```ts
import type { IncreaseTargetCategory } from "./types";

export function computeSuggestedTarget(
  category: IncreaseTargetCategory,
  fy26Revenue: number,
  priorYearRevenue: number,
): number | null {
  if (category === "missing_renewal") {
    if (fy26Revenue <= 0) return null;
    return Math.round((fy26Revenue * 1.05) / 5000) * 5000;
  }
  if (priorYearRevenue <= 0) return null;
  return Math.round((priorYearRevenue * 0.9) / 5000) * 5000;
}
```

- [ ] **Step 4: Extend `IncreaseTarget`** in `src/features/leaderboard/lib/types.ts`. Find the existing `IncreaseTarget` interface and add these two fields at the end (before the closing brace):

```ts
  /** Nullable per-FY total_revenue from district_financials (fullmind vendor, or elevate for ek12_winback). */
  revenueTrend: {
    fy24: number | null;
    fy25: number | null;
    fy26: number | null;
    fy27: number | null;
  };
  /** Heuristic suggested renewal/winback amount; null when no revenue signal. */
  suggestedTarget: number | null;
```

- [ ] **Step 5: Run test — expect pass**

`npx vitest run src/features/leaderboard/lib/__tests__/suggestedTarget.test.ts`
Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/lib/types.ts src/features/leaderboard/lib/suggestedTarget.ts src/features/leaderboard/lib/__tests__/suggestedTarget.test.ts
git commit -m "feat(types): add revenueTrend + suggestedTarget to IncreaseTarget

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — add `revenue_trend` CTE and populate new fields

**Files:**
- Modify: `src/app/api/leaderboard/increase-targets/route.ts`

**Context:** The existing SQL already has `fullmind_prior_latest` and `ek12_prior_latest` CTEs querying `district_financials` for prior-year revenue. We're adding one more CTE that pivots four fiscal years per (leaid, vendor). Vendor selection follows the row's category: `missing_renewal` + `fullmind_winback` use `fullmind`; `ek12_winback` uses `elevate`.

- [ ] **Step 1: Add the `revenue_trend` CTE to the SQL template**

In the `$queryRaw` template literal (inside `route.ts`), after the `ek12_prior_latest` CTE and before `src_missing_renewal`, insert:

```sql
,
revenue_trend AS (
  SELECT
    df.leaid,
    df.vendor,
    MAX(CASE WHEN df.fiscal_year = 'FY24' THEN df.total_revenue END) AS fy24,
    MAX(CASE WHEN df.fiscal_year = 'FY25' THEN df.total_revenue END) AS fy25,
    MAX(CASE WHEN df.fiscal_year = 'FY26' THEN df.total_revenue END) AS fy26,
    MAX(CASE WHEN df.fiscal_year = 'FY27' THEN df.total_revenue END) AS fy27
  FROM district_financials df
  WHERE df.vendor IN ('fullmind', 'elevate')
    AND df.fiscal_year IN ('FY24','FY25','FY26','FY27')
  GROUP BY df.leaid, df.vendor
)
```

- [ ] **Step 2: Join `revenue_trend` in the final SELECT**

Find the final `SELECT` statement and add these four selected columns, then add the LEFT JOIN with the vendor derived from the row category. The joined alias is `rt`. Add to the select list (next to the other trend-adjacent fields):

```sql
,
rt.fy24 AS trend_fy24,
rt.fy25 AS trend_fy25,
rt.fy26 AS trend_fy26,
rt.fy27 AS trend_fy27
```

And add this LEFT JOIN near the other LEFT JOINs (after the `fullmind_prior_latest fpl` join):

```sql
LEFT JOIN revenue_trend rt
  ON rt.leaid = e.leaid
 AND rt.vendor = CASE WHEN e.category = 'ek12_winback' THEN 'elevate' ELSE 'fullmind' END
```

- [ ] **Step 3: Populate the fields in the mapper**

In the `districts: IncreaseTarget[] = rows.map((row) => { ... })` block, import the helper and add the two new fields to the returned object (just before the closing `}`):

```ts
// at top of file, alongside existing imports
import { computeSuggestedTarget } from "@/features/leaderboard/lib/suggestedTarget";
```

Inside the map, add:

```ts
revenueTrend: {
  fy24: toNumberOrNull(row.trend_fy24),
  fy25: toNumberOrNull(row.trend_fy25),
  fy26: toNumberOrNull(row.trend_fy26),
  fy27: toNumberOrNull(row.trend_fy27),
},
suggestedTarget: computeSuggestedTarget(
  row.category,
  dfRevenue > 0 ? dfRevenue : oppBookings,
  toNumber(row.prior_year_revenue),
),
```

- [ ] **Step 4: Verify the route still type-checks**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/increase-targets/route.ts
git commit -m "feat(api): revenueTrend + suggestedTarget on increase-targets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Refresh `route.test.ts` to match current CTEs + new fields

**Files:**
- Modify: `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`

**Context:** Existing test references dead CTE names (`fy27_any`, `already_planned`). Today's route uses `fy27_done`, `fy27_pipe`, `fy27_plan`. We also need assertions for `revenue_trend`, `revenueTrend`, and `suggestedTarget`.

- [ ] **Step 1: Read the current test to understand its factory (`makeRow`) and mock plumbing**

`npx vitest run src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`
Record the failing assertions.

- [ ] **Step 2: Update CTE-name assertions**

Wherever the test inspects the raw SQL string, replace:
- `fy27_any` → `fy27_done` (plus `fy27_pipe` where exclusion is asserted)
- `already_planned` → `fy27_plan`

Also add an assertion that the SQL contains `revenue_trend` and joins it.

- [ ] **Step 3: Extend `makeRow` with the new columns**

Add these four fields to the factory defaults:

```ts
trend_fy24: null,
trend_fy25: null,
trend_fy26: 320000,
trend_fy27: null,
```

- [ ] **Step 4: Add a test case: suggested target for missing_renewal**

```ts
it("computes suggestedTarget = fy26 × 1.05 rounded to $5K for missing_renewal", async () => {
  const row = makeRow({
    category: "missing_renewal",
    fy26_revenue: "320000",
    fy26_opp_bookings: "0",
    prior_year_revenue: "0",
  });
  (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
  const res = await GET();
  const body = await res.json();
  expect(body.districts[0].suggestedTarget).toBe(335000);
});
```

- [ ] **Step 5: Add a test case: suggested target null when no signal**

```ts
it("returns suggestedTarget null when fy26 and priorYear are both zero", async () => {
  const row = makeRow({
    category: "missing_renewal",
    fy26_revenue: "0",
    fy26_opp_bookings: "0",
    prior_year_revenue: "0",
  });
  (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
  const res = await GET();
  const body = await res.json();
  expect(body.districts[0].suggestedTarget).toBeNull();
});
```

- [ ] **Step 6: Add a test: revenueTrend passes through**

```ts
it("passes trend_fy24..fy27 through as revenueTrend", async () => {
  const row = makeRow({
    trend_fy24: "120000",
    trend_fy25: "240000",
    trend_fy26: "320000",
    trend_fy27: null,
  });
  (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
  const res = await GET();
  const body = await res.json();
  expect(body.districts[0].revenueTrend).toEqual({
    fy24: 120000,
    fy25: 240000,
    fy26: 320000,
    fy27: null,
  });
});
```

- [ ] **Step 7: Run tests — expect all pass**

`npx vitest run src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/leaderboard/increase-targets/__tests__/route.test.ts
git commit -m "test(api): refresh increase-targets route tests for new CTEs/fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Rename query hook + add `low-hanging-fruit` `TabId`

**Files:**
- Modify: `src/features/leaderboard/lib/queries.ts`
- Modify: `src/features/shared/lib/app-store.ts`

- [ ] **Step 1: Extend `TabId` union** in `src/features/shared/lib/app-store.ts`

```ts
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "leaderboard" | "low-hanging-fruit" | "resources" | "profile" | "admin";
```

- [ ] **Step 2: Add `useLowHangingFruitList` alias** in `src/features/leaderboard/lib/queries.ts`

Below the existing `useIncreaseTargetsList` export, add:

```ts
/** Preferred alias — the list is the data source for the Low Hanging Fruit surface. */
export const useLowHangingFruitList = useIncreaseTargetsList;
```

Do NOT delete `useIncreaseTargetsList` yet — tasks 5+ still reference it; final cleanup happens in Task 14.

- [ ] **Step 3: Type-check**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/lib/queries.ts src/features/shared/lib/app-store.ts
git commit -m "feat(nav): low-hanging-fruit TabId + useLowHangingFruitList alias

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Filter utilities — types, URL serialization, predicate

**Files:**
- Create: `src/features/leaderboard/lib/filters.ts`
- Test: `src/features/leaderboard/lib/__tests__/filters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  applyFilters,
  type LHFFilters,
} from "../filters";
import type { IncreaseTarget } from "../types";

const row = (overrides: Partial<IncreaseTarget> = {}): IncreaseTarget =>
  ({
    leaid: "000001",
    districtName: "Test",
    state: "CA",
    enrollment: null,
    lmsId: null,
    category: "missing_renewal",
    fy26Revenue: 200_000,
    fy26CompletedRevenue: 0,
    fy26ScheduledRevenue: 0,
    fy26SessionCount: null,
    fy26SubscriptionCount: null,
    fy26OppBookings: 0,
    fy26MinBookings: 0,
    priorYearRevenue: 0,
    priorYearVendor: null,
    priorYearFy: null,
    inFy27Plan: false,
    planIds: [],
    hasFy27Target: false,
    hasFy27Pipeline: false,
    fy27OpenPipeline: 0,
    inPlan: false,
    lastClosedWon: null,
    productTypes: ["Live Instruction"],
    subProducts: [],
    revenueTrend: { fy24: null, fy25: null, fy26: 200000, fy27: null },
    suggestedTarget: 210_000,
    ...overrides,
  }) as IncreaseTarget;

describe("filters", () => {
  it("DEFAULT_FILTERS is all-empty", () => {
    expect(DEFAULT_FILTERS.categories).toEqual([]);
    expect(DEFAULT_FILTERS.states).toEqual([]);
    expect(DEFAULT_FILTERS.products).toEqual([]);
    expect(DEFAULT_FILTERS.revenueBand).toBeNull();
    expect(DEFAULT_FILTERS.lastRep).toBe("anyone");
    expect(DEFAULT_FILTERS.hideWithFy27Target).toBe(false);
  });

  it("round-trips via URLSearchParams", () => {
    const filters: LHFFilters = {
      categories: ["missing_renewal"],
      states: ["CA", "TX"],
      products: ["Live Instruction"],
      revenueBand: "250k-1m",
      lastRep: "open",
      hideWithFy27Target: true,
    };
    const params = filtersToSearchParams(filters);
    const restored = filtersFromSearchParams(params);
    expect(restored).toEqual(filters);
  });

  it("applyFilters keeps row when categories match", () => {
    const kept = applyFilters([row({ category: "missing_renewal" })], {
      ...DEFAULT_FILTERS,
      categories: ["missing_renewal"],
    });
    expect(kept).toHaveLength(1);
  });

  it("applyFilters drops row whose state is not selected", () => {
    const kept = applyFilters([row({ state: "CA" })], {
      ...DEFAULT_FILTERS,
      states: ["TX"],
    });
    expect(kept).toHaveLength(0);
  });

  it("applyFilters hides districts with hasFy27Target when the toggle is on", () => {
    const kept = applyFilters(
      [row({ hasFy27Target: true }), row({ leaid: "2", hasFy27Target: false })],
      { ...DEFAULT_FILTERS, hideWithFy27Target: true },
    );
    expect(kept.map((r) => r.leaid)).toEqual(["2"]);
  });

  it("applyFilters matches revenue band using category-appropriate signal", () => {
    const kept = applyFilters(
      [
        row({ category: "missing_renewal", fy26Revenue: 100_000 }),
        row({ leaid: "2", category: "fullmind_winback", fy26Revenue: 0, priorYearRevenue: 500_000 }),
      ],
      { ...DEFAULT_FILTERS, revenueBand: "250k-1m" },
    );
    expect(kept.map((r) => r.leaid)).toEqual(["2"]);
  });
});
```

- [ ] **Step 2: Run — expect fail (module missing)**

`npx vitest run src/features/leaderboard/lib/__tests__/filters.test.ts`

- [ ] **Step 3: Create `src/features/leaderboard/lib/filters.ts`**

```ts
import type { IncreaseTarget, IncreaseTargetCategory } from "./types";

export type RevenueBand = "lt-50k" | "50k-250k" | "250k-1m" | "1m+";
export type LastRepFilter = "anyone" | "open";

export interface LHFFilters {
  categories: IncreaseTargetCategory[];
  states: string[];
  products: string[];
  revenueBand: RevenueBand | null;
  lastRep: LastRepFilter;
  hideWithFy27Target: boolean;
}

export const DEFAULT_FILTERS: LHFFilters = {
  categories: [],
  states: [],
  products: [],
  revenueBand: null,
  lastRep: "anyone",
  hideWithFy27Target: false,
};

const BAND_RANGES: Record<RevenueBand, [number, number]> = {
  "lt-50k": [0, 50_000],
  "50k-250k": [50_000, 250_000],
  "250k-1m": [250_000, 1_000_000],
  "1m+": [1_000_000, Infinity],
};

function rowRevenue(r: IncreaseTarget): number {
  return r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue;
}

export function applyFilters(
  rows: IncreaseTarget[],
  f: LHFFilters,
): IncreaseTarget[] {
  return rows.filter((r) => {
    if (f.categories.length > 0 && !f.categories.includes(r.category)) return false;
    if (f.states.length > 0 && !f.states.includes(r.state)) return false;
    if (
      f.products.length > 0 &&
      !r.productTypes.some((p) => f.products.includes(p))
    )
      return false;
    if (f.revenueBand) {
      const [lo, hi] = BAND_RANGES[f.revenueBand];
      const v = rowRevenue(r);
      if (v < lo || v >= hi) return false;
    }
    if (f.lastRep === "open" && r.lastClosedWon?.repName) return false;
    if (f.hideWithFy27Target && r.hasFy27Target) return false;
    return true;
  });
}

export function filtersToSearchParams(f: LHFFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.categories.length) p.set("category", f.categories.join(","));
  if (f.states.length) p.set("state", f.states.join(","));
  if (f.products.length) p.set("product", f.products.join(","));
  if (f.revenueBand) p.set("rev", f.revenueBand);
  if (f.lastRep !== "anyone") p.set("lastRep", f.lastRep);
  if (f.hideWithFy27Target) p.set("hideTargeted", "1");
  return p;
}

export function filtersFromSearchParams(
  p: URLSearchParams | ReadonlyURLSearchParams,
): LHFFilters {
  const get = (k: string): string | null => p.get(k);
  const csv = (k: string): string[] =>
    get(k)?.split(",").filter(Boolean) ?? [];

  const validBands: RevenueBand[] = ["lt-50k", "50k-250k", "250k-1m", "1m+"];
  const bandRaw = get("rev");
  const band = validBands.includes(bandRaw as RevenueBand)
    ? (bandRaw as RevenueBand)
    : null;

  return {
    categories: csv("category").filter(
      (c): c is IncreaseTargetCategory =>
        c === "missing_renewal" ||
        c === "fullmind_winback" ||
        c === "ek12_winback",
    ),
    states: csv("state").map((s) => s.toUpperCase()),
    products: csv("product"),
    revenueBand: band,
    lastRep: get("lastRep") === "open" ? "open" : "anyone",
    hideWithFy27Target: get("hideTargeted") === "1",
  };
}

type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};
```

- [ ] **Step 4: Run — expect all pass**

`npx vitest run src/features/leaderboard/lib/__tests__/filters.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/filters.ts src/features/leaderboard/lib/__tests__/filters.test.ts
git commit -m "feat(filters): LHF filter types, URL params, predicate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `LowHangingFruitCard` component

**Files:**
- Create: `src/features/leaderboard/components/LowHangingFruitCard.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitCard from "../LowHangingFruitCard";
import type { IncreaseTarget } from "../../lib/types";

const row: IncreaseTarget = {
  leaid: "000001",
  districtName: "Pasadena USD",
  state: "CA",
  enrollment: null,
  lmsId: "001A",
  category: "missing_renewal",
  fy26Revenue: 320_000,
  fy26CompletedRevenue: 0,
  fy26ScheduledRevenue: 0,
  fy26SessionCount: 12_400,
  fy26SubscriptionCount: null,
  fy26OppBookings: 0,
  fy26MinBookings: 0,
  priorYearRevenue: 0,
  priorYearVendor: null,
  priorYearFy: null,
  inFy27Plan: false,
  planIds: [],
  hasFy27Target: false,
  hasFy27Pipeline: false,
  fy27OpenPipeline: 0,
  inPlan: false,
  lastClosedWon: { repName: "M. Chen", repEmail: null, closeDate: "2026-03-10", schoolYr: "2025-26", amount: 260_000 },
  productTypes: ["Live Instruction", "High Intensity", "K-5 Core"],
  subProducts: [],
  revenueTrend: { fy24: null, fy25: 240_000, fy26: 320_000, fy27: null },
  suggestedTarget: 335_000,
};

describe("LowHangingFruitCard", () => {
  it("renders name, state, hero revenue, sessions, suggested target, category", () => {
    render(<LowHangingFruitCard row={row} selected={false} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByText(/\$320K/)).toBeInTheDocument();
    expect(screen.getByText(/12,400/)).toBeInTheDocument();
    expect(screen.getByText(/Suggested:\s*\$335K/)).toBeInTheDocument();
    expect(screen.getByText(/Missing Renewal/)).toBeInTheDocument();
  });

  it("clicking body calls onOpenDetail, clicking checkbox calls onToggleSelect", () => {
    const onOpenDetail = vi.fn();
    const onToggleSelect = vi.fn();
    render(<LowHangingFruitCard row={row} selected={false} onToggleSelect={onToggleSelect} onOpenDetail={onOpenDetail} onAddSuccess={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSelect).toHaveBeenCalledWith("000001");
    expect(onOpenDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Pasadena USD"));
    expect(onOpenDetail).toHaveBeenCalled();
  });

  it("selected card shows checked styling via aria-checked=true", () => {
    render(<LowHangingFruitCard row={row} selected={true} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders em-dash when last sale is null", () => {
    render(<LowHangingFruitCard row={{ ...row, lastClosedWon: null }} selected={false} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText(/No recent sale/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `LowHangingFruitCard.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { Plus, ChevronDown, ExternalLink } from "lucide-react";
import type { IncreaseTarget } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import AddToPlanPopover from "./AddToPlanPopover";

interface Props {
  row: IncreaseTarget;
  selected: boolean;
  onToggleSelect: (leaid: string) => void;
  onOpenDetail: (row: IncreaseTarget) => void;
  onAddSuccess: (planName: string) => void;
}

const CATEGORY_LABEL: Record<IncreaseTarget["category"], string> = {
  missing_renewal: "Missing Renewal",
  fullmind_winback: "Fullmind Winback",
  ek12_winback: "EK12 Winback",
};

const CATEGORY_COLORS: Record<
  IncreaseTarget["category"],
  { bg: string; fg: string; dot: string }
> = {
  missing_renewal: { bg: "#FEF2F1", fg: "#B5453D", dot: "#F37167" },
  fullmind_winback: { bg: "#EFEDF5", fg: "#403770", dot: "#403770" },
  ek12_winback: { bg: "#FDEEE8", fg: "#7C3A21", dot: "#E07A5F" },
};

function heroRevenue(row: IncreaseTarget): number {
  return row.category === "missing_renewal" ? row.fy26Revenue : row.priorYearRevenue;
}

function formatLastSale(row: IncreaseTarget): string {
  const lcw = row.lastClosedWon;
  if (!lcw) return "No recent sale";
  const rep = lcw.repName ?? "—";
  const date = lcw.closeDate
    ? new Date(lcw.closeDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";
  const amt = lcw.amount != null ? formatCurrency(lcw.amount, true) : "—";
  return `${rep} · ${date} · ${amt}`;
}

export default function LowHangingFruitCard({
  row,
  selected,
  onToggleSelect,
  onOpenDetail,
  onAddSuccess,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const cat = CATEGORY_COLORS[row.category];
  const products = row.productTypes.slice(0, 2);
  const overflow = row.productTypes.length - products.length;

  const classes = [
    "relative bg-white border rounded-lg shadow-sm p-4 cursor-pointer transition-shadow duration-150 hover:shadow-lg",
    selected ? "bg-[#EFEDF5] border-l-4 border-[#403770] border-y border-r-[#D4CFE2]" : "border-[#D4CFE2]",
  ].join(" ");

  return (
    <div
      className={classes}
      onClick={() => onOpenDetail(row)}
      data-testid={`lhf-card-${row.leaid}`}
    >
      {/* Row 1: checkbox + name/state + add button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleSelect(row.leaid)}
            aria-label={`Select ${row.districtName}`}
            className="mt-0.5 w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
          />
          <div className="min-w-0">
            <div className="font-semibold text-[#403770] truncate">{row.districtName}</div>
            <div className="text-xs text-[#8A80A8]">{row.state}</div>
          </div>
        </div>
        {row.inPlan ? (
          <a
            href={row.lmsId ? `https://lms.fullmindlearning.com/districts/${row.lmsId}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-[#403770] text-[#403770] hover:bg-[#403770] hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            LMS
          </a>
        ) : (
          <button
            ref={addBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen((v) => !v);
            }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>
        )}
      </div>

      {/* Row 2: hero revenue */}
      <div className="mt-3">
        <div className="text-xl font-bold text-[#403770] tabular-nums">
          {formatCurrency(heroRevenue(row), true)}
        </div>
        <div className="text-xs text-[#8A80A8]">
          {row.category === "missing_renewal" ? "FY26 revenue" : `${row.priorYearFy ?? "prior"} revenue`}
        </div>
      </div>

      {/* Row 3: sessions + products */}
      <div className="mt-2 text-xs text-[#6E6390]">
        {row.fy26SessionCount != null ? `${row.fy26SessionCount.toLocaleString()} sessions` : "—"}
        {products.length > 0 && (
          <>
            {" · "}
            {products.join(", ")}
            {overflow > 0 && ` +${overflow}`}
          </>
        )}
      </div>

      {/* Row 4: last sale */}
      <div className="mt-1 text-xs text-[#A69DC0]">
        {formatLastSale(row)}
      </div>

      {/* Footer: category chip + suggested */}
      <div className="mt-3 pt-3 border-t border-[#E2DEEC] flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ backgroundColor: cat.bg, color: cat.fg }}
        >
          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.dot }} />
          {CATEGORY_LABEL[row.category]}
        </span>
        {row.suggestedTarget != null && (
          <span className="text-xs text-[#6E6390] tabular-nums">
            Suggested: {formatCurrency(row.suggestedTarget, true)}
          </span>
        )}
      </div>

      {popoverOpen && (
        <AddToPlanPopover
          district={row}
          anchorRef={addBtnRef}
          isOpen={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          onSuccess={(planName) => {
            setPopoverOpen(false);
            onAddSuccess(planName);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

`npx vitest run src/features/leaderboard/components/__tests__/LowHangingFruitCard.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitCard.tsx src/features/leaderboard/components/__tests__/LowHangingFruitCard.test.tsx
git commit -m "feat(lhf): rich card component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `LowHangingFruitFilterRail` component

**Files:**
- Create: `src/features/leaderboard/components/LowHangingFruitFilterRail.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitFilterRail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitFilterRail from "../LowHangingFruitFilterRail";
import { DEFAULT_FILTERS } from "../../lib/filters";

const facets = {
  categoryCounts: { missing_renewal: 68, fullmind_winback: 34, ek12_winback: 25 },
  states: ["CA", "TX", "FL"],
  products: ["Live Instruction", "HI"],
};

describe("LowHangingFruitFilterRail", () => {
  it("renders category counts", () => {
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={() => {}} />);
    expect(screen.getByText(/Missing Renewal \(68\)/)).toBeInTheDocument();
    expect(screen.getByText(/Fullmind Winback \(34\)/)).toBeInTheDocument();
  });

  it("toggles category checkbox via onChange", () => {
    const onChange = vi.fn();
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Missing Renewal/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["missing_renewal"] }),
    );
  });

  it("toggles hideWithFy27Target", () => {
    const onChange = vi.fn();
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Hide districts with FY27 target/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hideWithFy27Target: true }),
    );
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `LowHangingFruitFilterRail.tsx`**

```tsx
"use client";

import type { IncreaseTargetCategory } from "../lib/types";
import type { LHFFilters, RevenueBand } from "../lib/filters";

interface Facets {
  categoryCounts: Record<IncreaseTargetCategory, number>;
  states: string[];
  products: string[];
}

interface Props {
  filters: LHFFilters;
  facets: Facets;
  onChange: (next: LHFFilters) => void;
}

const CATEGORY_LABELS: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing Renewal",
  fullmind_winback: "Fullmind Winback",
  ek12_winback: "EK12 Winback",
};

const BANDS: { value: RevenueBand; label: string }[] = [
  { value: "lt-50k", label: "< $50K" },
  { value: "50k-250k", label: "$50K – $250K" },
  { value: "250k-1m", label: "$250K – $1M" },
  { value: "1m+", label: "$1M+" },
];

export default function LowHangingFruitFilterRail({ filters, facets, onChange }: Props) {
  const toggleCategory = (c: IncreaseTargetCategory) => {
    const next = filters.categories.includes(c)
      ? filters.categories.filter((x) => x !== c)
      : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  const toggleState = (s: string) => {
    const next = filters.states.includes(s)
      ? filters.states.filter((x) => x !== s)
      : [...filters.states, s];
    onChange({ ...filters, states: next });
  };

  const toggleProduct = (p: string) => {
    const next = filters.products.includes(p)
      ? filters.products.filter((x) => x !== p)
      : [...filters.products, p];
    onChange({ ...filters, products: next });
  };

  const Section = ({
    title,
    active,
    onClear,
    children,
  }: {
    title: string;
    active: number;
    onClear: () => void;
    children: React.ReactNode;
  }) => (
    <fieldset className="border-t border-[#E2DEEC] py-3">
      <legend className="flex items-center justify-between w-full px-3 text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
        <span>
          {title}
          {active > 0 && <span className="ml-1 text-[#403770]">· {active}</span>}
        </span>
        {active > 0 && (
          <button type="button" className="text-[#F37167] hover:underline" onClick={onClear}>
            Clear
          </button>
        )}
      </legend>
      <div className="px-3 space-y-1">{children}</div>
    </fieldset>
  );

  const Checkbox = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) => (
    <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <aside className="w-[220px] shrink-0 bg-[#F7F5FA] border-r border-[#E2DEEC] sticky top-0 self-start max-h-screen overflow-y-auto">
      <Section
        title="Category"
        active={filters.categories.length}
        onClear={() => onChange({ ...filters, categories: [] })}
      >
        {(["missing_renewal", "fullmind_winback", "ek12_winback"] as IncreaseTargetCategory[]).map((c) => (
          <Checkbox
            key={c}
            checked={filters.categories.includes(c)}
            label={`${CATEGORY_LABELS[c]} (${facets.categoryCounts[c] ?? 0})`}
            onChange={() => toggleCategory(c)}
          />
        ))}
      </Section>

      <Section title="State" active={filters.states.length} onClear={() => onChange({ ...filters, states: [] })}>
        <div className="grid grid-cols-3 gap-1">
          {facets.states.map((s) => (
            <Checkbox
              key={s}
              checked={filters.states.includes(s)}
              label={s}
              onChange={() => toggleState(s)}
            />
          ))}
        </div>
      </Section>

      <Section title="Product" active={filters.products.length} onClear={() => onChange({ ...filters, products: [] })}>
        {facets.products.map((p) => (
          <Checkbox
            key={p}
            checked={filters.products.includes(p)}
            label={p}
            onChange={() => toggleProduct(p)}
          />
        ))}
      </Section>

      <Section
        title="Revenue band"
        active={filters.revenueBand ? 1 : 0}
        onClear={() => onChange({ ...filters, revenueBand: null })}
      >
        {BANDS.map((b) => (
          <label key={b.value} className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
            <input
              type="radio"
              name="rev-band"
              checked={filters.revenueBand === b.value}
              onChange={() => onChange({ ...filters, revenueBand: b.value })}
              className="w-3.5 h-3.5 border-[#C2BBD4] text-[#403770]"
            />
            <span>{b.label}</span>
          </label>
        ))}
      </Section>

      <Section
        title="Last rep"
        active={filters.lastRep !== "anyone" ? 1 : 0}
        onClear={() => onChange({ ...filters, lastRep: "anyone" })}
      >
        <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.lastRep === "open"}
            onChange={(e) => onChange({ ...filters, lastRep: e.target.checked ? "open" : "anyone" })}
            className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
          />
          <span>Unassigned / no previous rep</span>
        </label>
      </Section>

      <Section
        title="FY27 signal"
        active={filters.hideWithFy27Target ? 1 : 0}
        onClear={() => onChange({ ...filters, hideWithFy27Target: false })}
      >
        <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideWithFy27Target}
            onChange={(e) => onChange({ ...filters, hideWithFy27Target: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
          />
          <span>Hide districts with FY27 target set</span>
        </label>
      </Section>
    </aside>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitFilterRail.tsx src/features/leaderboard/components/__tests__/LowHangingFruitFilterRail.test.tsx
git commit -m "feat(lhf): filter rail component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `LowHangingFruitDetailDrawer` component

**Files:**
- Create: `src/features/leaderboard/components/LowHangingFruitDetailDrawer.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitDetailDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitDetailDrawer from "../LowHangingFruitDetailDrawer";
import type { IncreaseTarget } from "../../lib/types";

const row: IncreaseTarget = {
  // ... paste full row fixture (same shape as Task 6 test; revenueTrend filled)
  leaid: "1", districtName: "Pasadena USD", state: "CA",
  enrollment: null, lmsId: "001A", category: "missing_renewal",
  fy26Revenue: 320000, fy26CompletedRevenue: 220000, fy26ScheduledRevenue: 100000,
  fy26SessionCount: 12400, fy26SubscriptionCount: null, fy26OppBookings: 0, fy26MinBookings: 0,
  priorYearRevenue: 0, priorYearVendor: null, priorYearFy: null,
  inFy27Plan: false, planIds: [], hasFy27Target: false, hasFy27Pipeline: false,
  fy27OpenPipeline: 0, inPlan: false,
  lastClosedWon: { repName: "M. Chen", repEmail: null, closeDate: "2026-03-10", schoolYr: "2025-26", amount: 260000 },
  productTypes: ["Live Instruction", "HI"], subProducts: ["K-5 Core"],
  revenueTrend: { fy24: 180000, fy25: 240000, fy26: 320000, fy27: null },
  suggestedTarget: 335000,
};

describe("LowHangingFruitDetailDrawer", () => {
  it("renders nothing when row is null", () => {
    const { container } = render(<LowHangingFruitDetailDrawer row={null} onClose={() => {}} onAddSuccess={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders district name and revenue trend", () => {
    render(<LowHangingFruitDetailDrawer row={row} onClose={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText(/FY24/)).toBeInTheDocument();
    expect(screen.getByText(/\$180K/)).toBeInTheDocument();
    expect(screen.getByText(/\$240K/)).toBeInTheDocument();
    expect(screen.getByText(/\$320K/)).toBeInTheDocument();
  });
  it("Esc calls onClose", () => {
    const onClose = vi.fn();
    render(<LowHangingFruitDetailDrawer row={row} onClose={onClose} onAddSuccess={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `LowHangingFruitDetailDrawer.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Plus, ChevronDown } from "lucide-react";
import type { IncreaseTarget } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import AddToPlanPopover from "./AddToPlanPopover";

interface Props {
  row: IncreaseTarget | null;
  onClose: () => void;
  onAddSuccess: (planName: string) => void;
}

function fyCell(val: number | null): string {
  return val != null ? formatCurrency(val, true) : "—";
}

export default function LowHangingFruitDetailDrawer({ row, onClose, onAddSuccess }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;
  const t = row.revenueTrend;
  const lcw = row.lastClosedWon;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-labelledby="lhf-drawer-title"
        className="fixed top-0 right-0 h-full w-[480px] max-w-[100vw] bg-white shadow-xl border-l border-[#E2DEEC] z-50 overflow-y-auto"
      >
        <header className="flex items-start justify-between p-5 border-b border-[#E2DEEC]">
          <div>
            <h2 id="lhf-drawer-title" className="text-lg font-bold text-[#403770]">{row.districtName}</h2>
            <div className="text-xs text-[#8A80A8]">
              {row.state}
              {row.lmsId && (
                <>
                  {" · "}
                  <a
                    href={`https://lms.fullmindlearning.com/districts/${row.lmsId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#403770] hover:underline"
                  >
                    Open in LMS <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#EFEDF5] text-[#6E6390]"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
              Revenue trend
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { fy: "FY24", val: t.fy24 },
                { fy: "FY25", val: t.fy25 },
                { fy: "FY26", val: t.fy26 },
                { fy: "FY27", val: t.fy27 },
              ].map((c) => (
                <div key={c.fy} className="bg-[#F7F5FA] rounded-lg p-2">
                  <div className="text-[10px] text-[#8A80A8]">{c.fy}</div>
                  <div className="text-sm font-bold text-[#403770] tabular-nums">{fyCell(c.val)}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
              Products purchased
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.productTypes.length === 0 ? (
                <span className="text-xs text-[#A69DC0]">No product history</span>
              ) : (
                row.productTypes.map((p) => (
                  <span key={p} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-[#403770]">
                    {p}
                  </span>
                ))
              )}
              {row.subProducts.map((sp) => (
                <span key={`sp-${sp}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-[#6E6390] bg-[#EFEDF5] border border-[#D4CFE2]">
                  {sp}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              FY26 breakdown
            </div>
            <div className="text-xs text-[#6E6390]">
              Completed {formatCurrency(row.fy26CompletedRevenue)}
              {" · "}Scheduled {formatCurrency(row.fy26ScheduledRevenue)}
              {row.fy26SessionCount != null && ` · ${row.fy26SessionCount.toLocaleString()} sessions`}
            </div>
          </section>

          <section>
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              Last sale
            </div>
            {lcw ? (
              <div className="text-xs text-[#6E6390]">
                Closed Won {lcw.schoolYr ?? ""}
                {lcw.amount != null && ` · ${formatCurrency(lcw.amount)}`}
                {lcw.closeDate && ` · ${new Date(lcw.closeDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                {lcw.repName && ` · ${lcw.repName}`}
              </div>
            ) : (
              <div className="text-xs text-[#A69DC0]">No closed-won opportunity on file.</div>
            )}
          </section>

          {row.suggestedTarget != null && (
            <section className="bg-[#F7F5FA] rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
                Suggested target
              </div>
              <div className="text-base font-bold text-[#403770] tabular-nums">
                {formatCurrency(row.suggestedTarget, true)}
              </div>
              <div className="text-xs text-[#8A80A8]">
                {row.category === "missing_renewal" ? "1.05× FY26 revenue" : "0.90× prior year revenue"}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 bg-white border-t border-[#E2DEEC] p-4">
          {row.inPlan ? (
            <a
              href={row.lmsId ? `https://lms.fullmindlearning.com/districts/${row.lmsId}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold border border-[#403770] text-[#403770] hover:bg-[#403770] hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in LMS
            </a>
          ) : (
            <button
              ref={addBtnRef}
              type="button"
              onClick={() => setPopoverOpen((v) => !v)}
              className="w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add to plan
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>
          )}
          {popoverOpen && (
            <AddToPlanPopover
              district={row}
              anchorRef={addBtnRef}
              isOpen={popoverOpen}
              onClose={() => setPopoverOpen(false)}
              onSuccess={(planName) => {
                setPopoverOpen(false);
                onAddSuccess(planName);
              }}
            />
          )}
        </footer>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitDetailDrawer.tsx src/features/leaderboard/components/__tests__/LowHangingFruitDetailDrawer.test.tsx
git commit -m "feat(lhf): detail drawer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `BulkAddWizard` component

**Files:**
- Create: `src/features/leaderboard/components/BulkAddWizard.tsx`
- Test: `src/features/leaderboard/components/__tests__/BulkAddWizard.test.tsx`

**Context:** Reuses `useMyPlans` + `useAddDistrictToPlanMutation` from `queries.ts`. Sequential: one POST at a time. Plan and Type stick across steps. Target pre-fills from `suggestedTarget`. Step advances on successful submit.

- [ ] **Step 1: Write a minimal failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BulkAddWizard from "../BulkAddWizard";
import type { IncreaseTarget } from "../../lib/types";

vi.mock("../../lib/queries", () => ({
  useMyPlans: () => ({ data: [{ id: "p1", name: "FY27 West", owner: { id: "u1" } }], isLoading: false }),
  useAddDistrictToPlanMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ added: 1 }), isPending: false }),
}));

const makeRow = (overrides: Partial<IncreaseTarget>): IncreaseTarget =>
  ({
    leaid: "1", districtName: "Test", state: "CA", enrollment: null, lmsId: null,
    category: "missing_renewal", fy26Revenue: 100000, fy26CompletedRevenue: 0,
    fy26ScheduledRevenue: 0, fy26SessionCount: null, fy26SubscriptionCount: null,
    fy26OppBookings: 0, fy26MinBookings: 0, priorYearRevenue: 0, priorYearVendor: null,
    priorYearFy: null, inFy27Plan: false, planIds: [], hasFy27Target: false,
    hasFy27Pipeline: false, fy27OpenPipeline: 0, inPlan: false, lastClosedWon: null,
    productTypes: [], subProducts: [],
    revenueTrend: { fy24: null, fy25: null, fy26: 100000, fy27: null },
    suggestedTarget: 105000,
    ...overrides,
  }) as IncreaseTarget;

function renderWizard(rows: IncreaseTarget[]) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BulkAddWizard rows={rows} onClose={() => {}} onFinish={() => {}} />
    </QueryClientProvider>,
  );
}

describe("BulkAddWizard", () => {
  it("renders current district name and step indicator", () => {
    renderWizard([
      makeRow({ leaid: "1", districtName: "Pasadena USD" }),
      makeRow({ leaid: "2", districtName: "Katy ISD" }),
    ]);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
  });

  it("pre-fills target with suggestedTarget", () => {
    renderWizard([makeRow({ suggestedTarget: 335000 })]);
    const input = screen.getByLabelText(/Target/i) as HTMLInputElement;
    expect(input.value).toBe("335000");
  });

  it("disables Add & continue until plan and target are set", () => {
    renderWizard([makeRow({ suggestedTarget: null })]);
    expect(screen.getByRole("button", { name: /Add & continue|Add & finish/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `BulkAddWizard.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ArrowLeft, SkipForward } from "lucide-react";
import type { IncreaseTarget, IncreaseTargetBucket } from "../lib/types";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface Props {
  rows: IncreaseTarget[];
  onClose: () => void;
  /** Called after the wizard finishes (exhausted all rows or user closes). */
  onFinish: (addedCount: number, planName: string | null) => void;
}

const BUCKETS: { value: IncreaseTargetBucket; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "winback", label: "Winback" },
  { value: "expansion", label: "Expansion" },
  { value: "newBusiness", label: "New Business" },
];

function defaultBucket(cat: IncreaseTarget["category"]): IncreaseTargetBucket {
  return cat === "missing_renewal" ? "renewal" : "winback";
}

export default function BulkAddWizard({ rows, onClose, onFinish }: Props) {
  const plansQuery = useMyPlans();
  const mutation = useAddDistrictToPlanMutation();

  const [stepIdx, setStepIdx] = useState(0);
  const [planId, setPlanId] = useState<string>("");
  const [bucket, setBucket] = useState<IncreaseTargetBucket>(() =>
    rows[0] ? defaultBucket(rows[0].category) : "renewal",
  );
  const [target, setTarget] = useState<string>(() =>
    rows[0]?.suggestedTarget != null ? String(rows[0].suggestedTarget) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const row = rows[stepIdx];
  const total = rows.length;
  const isLast = stepIdx === total - 1;

  // Pre-fill target per step from the row's suggested value
  useEffect(() => {
    setError(null);
    setTarget(row?.suggestedTarget != null ? String(row.suggestedTarget) : "");
    // Bucket sticks across steps once user has interacted. If we're on step 0 we derive from category.
    if (stepIdx === 0 && row) setBucket(defaultBucket(row.category));
  }, [stepIdx, row]);

  const targetNum = Number(target);
  const canSubmit = !!planId && Number.isFinite(targetNum) && targetNum > 0 && !mutation.isPending;

  const plans = plansQuery.data ?? [];
  const selectedPlanName = plans.find((p) => p.id === planId)?.name ?? null;

  const advance = () => {
    if (isLast) {
      onFinish(addedCount + 1, selectedPlanName);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !row) return;
    try {
      await mutation.mutateAsync({
        planId,
        leaid: row.leaid,
        bucket,
        targetAmount: targetNum,
      });
      setAddedCount((c) => c + 1);
      advance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add. Try again.");
    }
  };

  const handleSkip = () => {
    if (isLast) {
      onFinish(addedCount, selectedPlanName);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  if (!row) return null;

  return (
    <div role="dialog" aria-labelledby="wizard-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[#E2DEEC]">
          <h2 id="wizard-title" className="text-sm font-bold text-[#403770]">Add to plan</h2>
          <div className="flex items-center gap-3 text-xs text-[#8A80A8]">
            <span>Step {stepIdx + 1} of {total}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-[#EFEDF5]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-base font-bold text-[#403770]">{row.districtName}</div>
            <div className="text-xs text-[#8A80A8]">
              {row.state} · {formatCurrency(row.category === "missing_renewal" ? row.fy26Revenue : row.priorYearRevenue, true)}{" "}
              {row.category === "missing_renewal" ? "FY26" : row.priorYearFy ?? "prior"}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770]"
              disabled={plansQuery.isLoading || plans.length === 0}
            >
              <option value="">
                {plans.length === 0 ? "You have no plans — create one first." : "Select a plan…"}
              </option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">Type</label>
            <div className="flex flex-wrap gap-3">
              {BUCKETS.map((b) => (
                <label key={b.value} className="flex items-center gap-1.5 text-xs text-[#6E6390] cursor-pointer">
                  <input
                    type="radio"
                    name="bucket"
                    checked={bucket === b.value}
                    onChange={() => setBucket(b.value)}
                    className="w-3.5 h-3.5"
                  />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="target-input" className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              Target
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A80A8]">$</span>
                <input
                  id="target-input"
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full pl-6 pr-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770] tabular-nums"
                />
              </div>
              {row.suggestedTarget != null && (
                <span className="text-xs text-[#8A80A8]">
                  Suggested: {formatCurrency(row.suggestedTarget, true)}
                </span>
              )}
            </div>
            {error && <div className="mt-1 text-xs text-[#B5453D]">{error}</div>}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#E2DEEC] bg-[#F7F5FA]">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-[#6E6390] hover:bg-[#EFEDF5]"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip this one
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Adding…" : isLast ? "Add & finish" : "Add & continue →"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/BulkAddWizard.tsx src/features/leaderboard/components/__tests__/BulkAddWizard.test.tsx
git commit -m "feat(lhf): bulk-add wizard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `LowHangingFruitView` — integrates header, filter rail, grid, drawer, wizard

**Files:**
- Create: `src/features/leaderboard/components/LowHangingFruitView.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx`

**Context:** The view renders the page header (title + counts + Bulk Add button), filter rail (left), and the card grid (right). Maintains `filters` + `selectedLeaids` + `drawerRow` + `wizardOpen` local state. Reads the list via `useLowHangingFruitList`. Derives facets from the full list for filter chip counts. Filters the list via `applyFilters`. Sticky footer appears when selections exist.

- [ ] **Step 1: Write a minimal failing integration test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LowHangingFruitView from "../LowHangingFruitView";

vi.mock("../../lib/queries", async () => {
  const actual = await vi.importActual<object>("../../lib/queries");
  return {
    ...actual,
    useLowHangingFruitList: () => ({
      data: {
        totalRevenueAtRisk: 1_000_000,
        districts: [
          {
            leaid: "1", districtName: "Pasadena USD", state: "CA",
            enrollment: null, lmsId: null, category: "missing_renewal",
            fy26Revenue: 320000, fy26CompletedRevenue: 0, fy26ScheduledRevenue: 0,
            fy26SessionCount: null, fy26SubscriptionCount: null,
            fy26OppBookings: 0, fy26MinBookings: 0,
            priorYearRevenue: 0, priorYearVendor: null, priorYearFy: null,
            inFy27Plan: false, planIds: [], hasFy27Target: false,
            hasFy27Pipeline: false, fy27OpenPipeline: 0, inPlan: false,
            lastClosedWon: null, productTypes: [], subProducts: [],
            revenueTrend: { fy24: null, fy25: null, fy26: 320000, fy27: null },
            suggestedTarget: 335000,
          },
        ],
      },
      isLoading: false, isError: false,
    }),
    useMyPlans: () => ({ data: [], isLoading: false }),
  };
});

describe("LowHangingFruitView", () => {
  it("renders header with district count and total revenue", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <LowHangingFruitView />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Low Hanging Fruit/i)).toBeInTheDocument();
    expect(screen.getByText(/1 district/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `LowHangingFruitView.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useLowHangingFruitList } from "../lib/queries";
import type { IncreaseTarget, IncreaseTargetCategory } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import {
  DEFAULT_FILTERS,
  applyFilters,
  type LHFFilters,
} from "../lib/filters";
import LowHangingFruitCard from "./LowHangingFruitCard";
import LowHangingFruitFilterRail from "./LowHangingFruitFilterRail";
import LowHangingFruitDetailDrawer from "./LowHangingFruitDetailDrawer";
import BulkAddWizard from "./BulkAddWizard";

type SortKey = "revenue" | "lastSale" | "category";

function sortRows(rows: IncreaseTarget[], sort: SortKey): IncreaseTarget[] {
  const copy = [...rows];
  if (sort === "revenue") {
    copy.sort((a, b) => {
      const av = a.category === "missing_renewal" ? a.fy26Revenue : a.priorYearRevenue;
      const bv = b.category === "missing_renewal" ? b.fy26Revenue : b.priorYearRevenue;
      return bv - av;
    });
  } else if (sort === "lastSale") {
    copy.sort((a, b) => {
      const ad = a.lastClosedWon?.closeDate ? Date.parse(a.lastClosedWon.closeDate) : 0;
      const bd = b.lastClosedWon?.closeDate ? Date.parse(b.lastClosedWon.closeDate) : 0;
      return bd - ad;
    });
  } else {
    const priority: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0, fullmind_winback: 1, ek12_winback: 2,
    };
    copy.sort((a, b) => priority[a.category] - priority[b.category]);
  }
  return copy;
}

export default function LowHangingFruitView() {
  const query = useLowHangingFruitList();
  const [filters, setFilters] = useState<LHFFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("revenue");
  const [selectedLeaids, setSelectedLeaids] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<IncreaseTarget | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allRows = query.data?.districts ?? [];

  const facets = useMemo(() => {
    const categoryCounts: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0, fullmind_winback: 0, ek12_winback: 0,
    };
    const states = new Set<string>();
    const products = new Set<string>();
    for (const r of allRows) {
      categoryCounts[r.category]++;
      if (r.state) states.add(r.state);
      for (const p of r.productTypes) products.add(p);
    }
    return {
      categoryCounts,
      states: [...states].sort(),
      products: [...products].sort(),
    };
  }, [allRows]);

  const filtered = useMemo(() => sortRows(applyFilters(allRows, filters), sort), [allRows, filters, sort]);

  const selectedRows = useMemo(
    () => allRows.filter((r) => selectedLeaids.has(r.leaid)),
    [allRows, selectedLeaids],
  );

  const toggleSelect = (leaid: string) => {
    setSelectedLeaids((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return next;
    });
  };

  const totalSelectedRevenue = selectedRows.reduce(
    (s, r) => s + (r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue),
    0,
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFCFA]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC] bg-white">
        <div>
          <h1 className="text-xl font-bold text-[#403770]">Low Hanging Fruit</h1>
          <p className="text-xs text-[#6E6390]">
            {allRows.length} {allRows.length === 1 ? "district" : "districts"}
            {" · "}
            {formatCurrency(query.data?.totalRevenueAtRisk ?? 0, true)} FY26 revenue unclaimed
          </p>
        </div>
      </header>

      {/* Body: filter rail + grid */}
      <div className="flex flex-1 min-h-0">
        <LowHangingFruitFilterRail filters={filters} facets={facets} onChange={setFilters} />

        <main className="flex-1 min-w-0">
          <div className="px-6 py-3 flex items-center justify-between border-b border-[#E2DEEC] bg-white">
            <div className="text-xs text-[#6E6390]">
              Showing {filtered.length} of {allRows.length}
            </div>
            <label className="text-xs text-[#6E6390]">
              Sort:{" "}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="ml-1 border border-[#C2BBD4] rounded px-1.5 py-0.5 bg-white text-[#403770]"
              >
                <option value="revenue">Revenue (high → low)</option>
                <option value="lastSale">Last sale (recent → old)</option>
                <option value="category">Category</option>
              </select>
            </label>
          </div>

          {query.isLoading ? (
            <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[180px] bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="m-6 px-3 py-2 rounded-md bg-[#fef1f0] border border-[#f58d85] flex items-center justify-between gap-3">
              <span className="text-xs text-[#544A78]">Couldn&apos;t load the list.</span>
              <button className="text-xs font-semibold text-[#403770] hover:underline" onClick={() => query.refetch()}>
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div>
                <p className="text-sm text-[#6E6390] mb-2">
                  {allRows.length === 0
                    ? "Every FY26 customer has FY27 activity. Nothing to claim right now."
                    : "No districts match these filters."}
                </p>
                {allRows.length > 0 && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="text-xs font-semibold text-[#403770] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <LowHangingFruitCard
                  key={row.leaid}
                  row={row}
                  selected={selectedLeaids.has(row.leaid)}
                  onToggleSelect={toggleSelect}
                  onOpenDetail={setDrawerRow}
                  onAddSuccess={(name) => setToast(`Added to ${name}`)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Sticky bulk footer */}
      {selectedLeaids.size > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-3 bg-[#403770] text-white shadow-lg">
          <span className="text-sm">
            {selectedLeaids.size} selected · {formatCurrency(totalSelectedRevenue, true)} total
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedLeaids(new Set())}
              className="text-xs hover:underline"
            >
              Clear
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-[#403770] hover:bg-[#EFEDF5]"
            >
              Add selected to plan →
            </button>
          </div>
        </div>
      )}

      <LowHangingFruitDetailDrawer
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        onAddSuccess={(name) => {
          setDrawerRow(null);
          setToast(`Added to ${name}`);
        }}
      />

      {wizardOpen && selectedRows.length > 0 && (
        <BulkAddWizard
          rows={selectedRows}
          onClose={() => setWizardOpen(false)}
          onFinish={(count, plan) => {
            setWizardOpen(false);
            setSelectedLeaids(new Set());
            if (count > 0) setToast(`Added ${count} ${count === 1 ? "district" : "districts"}${plan ? ` to ${plan}` : ""}`);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 px-3 py-2 rounded-md bg-[#EDFFE3] border border-[#8AC670] text-xs text-[#544A78] shadow-lg"
          onAnimationEnd={() => setToast(null)}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitView.tsx src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
git commit -m "feat(lhf): main view (header + filter rail + grid + wizard integration)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `LowHangingFruitSummaryCard` + wire Leaderboard modal

**Files:**
- Create: `src/features/leaderboard/components/LowHangingFruitSummaryCard.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitSummaryCard.test.tsx`
- Modify: `src/features/leaderboard/components/LeaderboardModal.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LowHangingFruitSummaryCard from "../LowHangingFruitSummaryCard";

vi.mock("../../lib/queries", () => ({
  useLowHangingFruitList: () => ({
    data: { totalRevenueAtRisk: 4_200_000, districts: Array.from({ length: 127 }, (_, i) => ({ leaid: String(i) })) },
    isLoading: false, isError: false,
  }),
}));

describe("LowHangingFruitSummaryCard", () => {
  it("renders counts and clicking View all calls onViewAll", () => {
    const onViewAll = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <LowHangingFruitSummaryCard onViewAll={onViewAll} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/127/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.2M/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View all/i }));
    expect(onViewAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Create `LowHangingFruitSummaryCard.tsx`**

```tsx
"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { useLowHangingFruitList } from "../lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface Props {
  onViewAll: () => void;
}

export default function LowHangingFruitSummaryCard({ onViewAll }: Props) {
  const query = useLowHangingFruitList();
  const count = query.data?.districts.length ?? 0;
  const total = query.data?.totalRevenueAtRisk ?? 0;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <Sparkles className="w-10 h-10 text-[#F37167] mb-3" aria-hidden />
      <div className="text-2xl font-bold text-[#403770] tabular-nums">{count.toLocaleString()} districts</div>
      <div className="text-sm text-[#6E6390] mt-1">{formatCurrency(total, true)} FY26 revenue unclaimed</div>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
      >
        View all <ArrowRight className="w-4 h-4" />
      </button>
      <p className="mt-3 text-xs text-[#8A80A8] max-w-xs">
        FY26 Fullmind customers with no FY27 activity yet.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Update `LeaderboardModal.tsx`**

Edit in three places:

(a) Rename label in `VIEW_CONFIG`:

```tsx
{ value: "increase", label: "Low Hanging Fruit", icon: Sparkles },
```

(b) Swap the rendered component. Find the branch that renders `<IncreaseTargetsTab />` and replace with:

```tsx
<LowHangingFruitSummaryCard
  onViewAll={() => {
    onClose();
    setActiveTab?.("low-hanging-fruit");
  }}
/>
```

The `setActiveTab` is a new required prop on `LeaderboardModalProps`. Add:

```tsx
interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDetails?: () => void;
  setActiveTab?: (tab: "low-hanging-fruit") => void;
}
```

(c) Revert the conditional wide modal treatment for this tab — if the current code sets `max-w-5xl` when `view === "increase"`, drop that branch so the modal stays `max-w-2xl`.

(d) Replace import:

```tsx
// remove: import IncreaseTargetsTab from "./IncreaseTargetsTab";
import LowHangingFruitSummaryCard from "./LowHangingFruitSummaryCard";
```

- [ ] **Step 5: Wire `setActiveTab` from Sidebar.tsx**

Find the `<LeaderboardModal ...>` invocation in `Sidebar.tsx` and pass `setActiveTab` through:

```tsx
<LeaderboardModal
  isOpen={showLeaderboard}
  onClose={() => setShowLeaderboard(false)}
  setActiveTab={(tab) => {
    setShowLeaderboard(false);
    onTabChange(tab);
  }}
/>
```

- [ ] **Step 6: Run tests**

`npx vitest run src/features/leaderboard/components/__tests__/LowHangingFruitSummaryCard.test.tsx`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitSummaryCard.tsx src/features/leaderboard/components/__tests__/LowHangingFruitSummaryCard.test.tsx src/features/leaderboard/components/LeaderboardModal.tsx src/features/shared/components/navigation/Sidebar.tsx
git commit -m "feat(lhf): summary card in Leaderboard modal, View all wiring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Sidebar tab + page.tsx routing

**Files:**
- Modify: `src/features/shared/components/navigation/Sidebar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the sidebar tab entry** in `Sidebar.tsx`

Import the icon:

```tsx
import { Apple } from "lucide-react";
```

Define an icon component next to the other local icon declarations:

```tsx
const LowHangingFruitIcon = () => <Apple className="w-5 h-5" />;
```

Add to `MAIN_TABS` between `leaderboard` and `resources`:

```tsx
{ id: "low-hanging-fruit", label: "Low Hanging Fruit", icon: <LowHangingFruitIcon /> },
```

- [ ] **Step 2: Update `page.tsx`**

(a) Add `"low-hanging-fruit"` to `VALID_TABS`:

```ts
const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "leaderboard", "low-hanging-fruit", "resources", "profile", "admin"];
```

(b) Import the view:

```tsx
import LowHangingFruitView from "@/features/leaderboard/components/LowHangingFruitView";
```

(c) Add case to the view switch:

```tsx
case "low-hanging-fruit":
  return <LowHangingFruitView />;
```

- [ ] **Step 3: Type-check**

`npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/components/navigation/Sidebar.tsx src/app/page.tsx
git commit -m "feat(nav): Low Hanging Fruit sidebar tab + page routing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Delete legacy `IncreaseTargetsTab` + columns

**Files:**
- Delete: `src/features/leaderboard/components/IncreaseTargetsTab.tsx`
- Delete: `src/features/leaderboard/components/__tests__/IncreaseTargetsTab.test.tsx`
- Delete: `src/features/leaderboard/lib/columns/increaseTargetsColumns.ts`
- Delete: `src/features/leaderboard/lib/__tests__/increaseTargetsColumns.test.ts`

- [ ] **Step 1: Delete the four files**

```bash
rm src/features/leaderboard/components/IncreaseTargetsTab.tsx
rm src/features/leaderboard/components/__tests__/IncreaseTargetsTab.test.tsx
rm src/features/leaderboard/lib/columns/increaseTargetsColumns.ts
rm src/features/leaderboard/lib/__tests__/increaseTargetsColumns.test.ts
rmdir src/features/leaderboard/lib/columns 2>/dev/null || true
```

- [ ] **Step 2: Verify no remaining imports of deleted symbols**

Search: `IncreaseTargetsTab` and `increaseTargetsColumns` — should find zero references outside git history.

- [ ] **Step 3: Full type-check + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Both must be green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(lhf): delete legacy IncreaseTargetsTab + columns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Final verification — build + manual check

**Files:** none.

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

All tests must pass.

- [ ] **Step 2: Run type-check**

```bash
npx tsc --noEmit
```

Must be clean.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Must succeed.

- [ ] **Step 4: Start dev server and smoke-test the page manually**

```bash
npm run dev  # or: npx next dev -p 3005
```

Open `http://localhost:3005/?tab=low-hanging-fruit` and verify:
- Sidebar shows "Low Hanging Fruit" with Apple icon.
- Filter rail renders categories with counts, states, products, revenue bands.
- Grid shows 3 cards per row at desktop width.
- Click a card → drawer opens with revenue trend + products + last sale.
- Check 2+ cards → sticky footer appears → Bulk add opens wizard.
- Wizard advances after submit; the card disappears (cache optimistic update already in place).
- Open the Leaderboard modal from the sidebar — "Low Hanging Fruit" tab shows the lean summary card.
- Click "View all →" in the summary card — modal closes, routes to the deep-dive tab.

- [ ] **Step 5: Final commit (only if any small fixes were needed above)**

If no changes required during smoke test, skip this commit.

---

## Self-Review Notes

- **Spec coverage verified:**
  - Requirements: deep-dive page (Task 10, 12), lean summary (Task 11), rich cards (Task 6), filter rail (Task 7), slide-over (Task 8), bulk wizard (Task 9), heuristic (Task 1), no schema changes (Tasks 2–3 touch SQL only), navigation (Task 12), rename (Tasks 11, 13).
  - Backend: revenueTrend + suggestedTarget (Task 2), mapper heuristic (Task 1 helper, invoked in Task 2), test refresh (Task 3).
- **No placeholders:** every code block is complete.
- **Type consistency:** `LHFFilters` used everywhere from Task 5 onward; `IncreaseTarget` retained throughout (no mid-flight rename to `LowHangingFruitRow`). Spec mentioned renaming the type — deferred as unnecessary churn; callers continue to work.
- **Known deviation from spec:** spec suggested renaming `IncreaseTarget` → `LowHangingFruitRow`. Plan keeps the original name to avoid a wide-blast-radius rename that would touch every consumer. Query-hook rename to `useLowHangingFruitList` is done as a cosmetic alias.
