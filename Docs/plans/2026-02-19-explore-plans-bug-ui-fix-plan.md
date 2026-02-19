# Explore Plans Bug & UI Fix Marathon — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 bugs and UI issues in the Explore page related to Territory Plans.

**Architecture:** Fix data layer first (API keys, DB columns, aggregate queries), then UI polish (cell renderers, totals row), then new feature (plan summary panel). Each task is one commit.

**Tech Stack:** Next.js API routes, Prisma ORM, PostgreSQL, React/Zustand, Tailwind CSS

---

### Task 1: Fix KPI Card Aggregate Key Mismatch

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

**What:** The API returns aggregate keys that don't match what `ExploreKPICards` expects. Fix the API return objects to use the keys the component reads.

**Step 1: Fix district aggregates (lines ~291-300)**

Change the return from:
```ts
aggregates: {
  count: aggResult._count.leaid,
  enrollment_sum: aggResult._sum.enrollment,
  fy26_open_pipeline_sum: aggResult._sum.fy26OpenPipeline,
  fy26_closed_won_sum: aggResult._sum.fy26ClosedWonNetBooking,
},
```
To:
```ts
aggregates: {
  count: aggResult._count.leaid,
  enrollment_sum: aggResult._sum.enrollment,
  pipeline_sum: aggResult._sum.fy26OpenPipeline,
  closed_won_sum: aggResult._sum.fy26ClosedWonNetBooking,
},
```

**Step 2: Fix activity aggregates (lines ~396-401)**

Change from:
```ts
aggregates: {
  count: total,
  completed_count: completedCount,
  positive_outcomes: positiveOutcomes,
  unique_districts_touched: uniqueDistrictCount,
},
```
To:
```ts
aggregates: {
  count: total,
  completed: completedCount,
  positiveOutcomes: positiveOutcomes,
  districtsTouched: uniqueDistrictCount,
},
```

**Step 3: Fix task aggregates (lines ~497-502)**

Change from:
```ts
aggregates: {
  count: total,
  overdue_count: overdueCount,
  completed_count: completedCount,
  blocked_count: blockedCount,
},
```
To:
```ts
aggregates: {
  count: total,
  overdue: overdueCount,
  completed: completedCount,
  blocked: blockedCount,
},
```

**Step 4: Fix contact aggregates (lines ~595-600)**

Change from:
```ts
aggregates: {
  count: total,
  primary_count: primaryCount,
  unique_districts: uniqueDistrictCount,
  contacts_with_recent_activity: contactsWithRecentActivity,
},
```
To:
```ts
aggregates: {
  count: total,
  primaryCount: primaryCount,
  districtsCovered: uniqueDistrictCount,
  withRecentActivity: contactsWithRecentActivity,
},
```

**Step 5: Verify in browser**

Run `npm run dev`, open Explore page, switch through each entity tab. KPI cards should now show real numbers instead of "—".

**Step 6: Commit**
```
fix(explore): align API aggregate keys with KPI card expectations
```

---

### Task 2: Add Computed Columns to territory_plans Table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260219_plan_rollup_columns/migration.sql`
- Modify: `src/lib/explore-filters.ts`

**Step 1: Add columns to Prisma schema**

In the `TerritoryPlan` model, add these fields before the Relations comment:
```prisma
  // Denormalized rollup columns (synced when districts/targets change)
  districtCount     Int      @default(0) @map("district_count")
  stateCount        Int      @default(0) @map("state_count")
  renewalRollup     Decimal  @default(0) @map("renewal_rollup") @db.Decimal(15, 2)
  expansionRollup   Decimal  @default(0) @map("expansion_rollup") @db.Decimal(15, 2)
  winbackRollup     Decimal  @default(0) @map("winback_rollup") @db.Decimal(15, 2)
  newBusinessRollup Decimal  @default(0) @map("new_business_rollup") @db.Decimal(15, 2)
```

**Step 2: Create migration SQL**

Create directory `prisma/migrations/20260219_plan_rollup_columns/` and write `migration.sql`:
```sql
-- Add denormalized rollup columns to territory_plans
ALTER TABLE territory_plans
  ADD COLUMN district_count INT NOT NULL DEFAULT 0,
  ADD COLUMN state_count INT NOT NULL DEFAULT 0,
  ADD COLUMN renewal_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN expansion_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN winback_rollup DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN new_business_rollup DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Backfill from existing data
UPDATE territory_plans tp SET
  district_count = sub.cnt,
  renewal_rollup = sub.r,
  expansion_rollup = sub.e,
  winback_rollup = sub.w,
  new_business_rollup = sub.n
FROM (
  SELECT
    plan_id,
    COUNT(*)::int AS cnt,
    COALESCE(SUM(renewal_target), 0) AS r,
    COALESCE(SUM(expansion_target), 0) AS e,
    COALESCE(SUM(winback_target), 0) AS w,
    COALESCE(SUM(new_business_target), 0) AS n
  FROM territory_plan_districts
  GROUP BY plan_id
) sub
WHERE tp.id = sub.plan_id;

-- Backfill state_count
UPDATE territory_plans tp SET
  state_count = sub.cnt
FROM (
  SELECT plan_id, COUNT(*)::int AS cnt
  FROM territory_plan_states
  GROUP BY plan_id
) sub
WHERE tp.id = sub.plan_id;
```

**Step 3: Apply migration**

```bash
npx prisma db execute --file prisma/migrations/20260219_plan_rollup_columns/migration.sql
npx prisma migrate resolve --applied "20260219_plan_rollup_columns"
npx prisma generate
```

**Step 4: Add new columns to PLANS_FIELD_MAP**

In `src/lib/explore-filters.ts`, add to `PLANS_FIELD_MAP`:
```ts
export const PLANS_FIELD_MAP: Record<string, string> = {
  name: "name",
  status: "status",
  fiscalYear: "fiscalYear",
  description: "description",
  color: "color",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  // Denormalized rollup columns — filterable and sortable
  districtCount: "districtCount",
  stateCount: "stateCount",
  renewalRollup: "renewalRollup",
  expansionRollup: "expansionRollup",
  winbackRollup: "winbackRollup",
  newBusinessRollup: "newBusinessRollup",
  // ownerName handled via relation in sort logic
};
```

**Step 5: Commit**
```
feat(plans): add denormalized rollup columns to territory_plans table
```

---

### Task 3: Sync Rollup Columns on District Add/Remove/Update

**Files:**
- Create: `src/lib/plan-rollup-sync.ts`
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts`
- Modify: `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`

**Step 1: Create sync helper**

Create `src/lib/plan-rollup-sync.ts`:
```ts
import prisma from "@/lib/prisma";

/**
 * Recompute and update the denormalized rollup columns on a territory plan.
 * Call this after any change to the plan's districts or their targets.
 */
export async function syncPlanRollups(planId: string): Promise<void> {
  const [districtAgg, stateCount] = await Promise.all([
    prisma.territoryPlanDistrict.aggregate({
      where: { planId },
      _count: { districtLeaid: true },
      _sum: {
        renewalTarget: true,
        expansionTarget: true,
        winbackTarget: true,
        newBusinessTarget: true,
      },
    }),
    prisma.territoryPlanState.count({ where: { planId } }),
  ]);

  await prisma.territoryPlan.update({
    where: { id: planId },
    data: {
      districtCount: districtAgg._count.districtLeaid,
      stateCount,
      renewalRollup: districtAgg._sum.renewalTarget ?? 0,
      expansionRollup: districtAgg._sum.expansionTarget ?? 0,
      winbackRollup: districtAgg._sum.winbackTarget ?? 0,
      newBusinessRollup: districtAgg._sum.newBusinessTarget ?? 0,
    },
  });
}
```

**Step 2: Add sync call to POST (add districts)**

In `src/app/api/territory-plans/[id]/districts/route.ts`, import and call after the district add:
```ts
import { syncPlanRollups } from "@/lib/plan-rollup-sync";
```

Add `await syncPlanRollups(planId);` right before the return statement (after auto-tag sync, before `return NextResponse.json`).

**Step 3: Add sync call to DELETE (remove district)**

In `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`, import and call after the delete:
```ts
import { syncPlanRollups } from "@/lib/plan-rollup-sync";
```

Add `await syncPlanRollups(planId);` right before `return NextResponse.json({ success: true });`.

**Step 4: Add sync call to PUT (update targets)**

In the same `[leaid]/route.ts` PUT handler, import is already done. Add `await syncPlanRollups(planId);` before the return (both return paths — the one after service refresh and the one without).

**Step 5: Update handlePlans to read from columns instead of computing in JS**

In `src/app/api/explore/[entity]/route.ts`, update `handlePlans` to read the stored columns:
- Add `districtCount`, `stateCount`, `renewalRollup`, `expansionRollup`, `winbackRollup`, `newBusinessRollup` to the `select` object
- Remove the JS-side rollup computation loop (replace with direct field reads)
- The `_districts` array is still needed for the expanded row, but rollups come from the plan columns

In the data mapping, change:
```ts
return {
  id: p.id,
  name: p.name,
  description: p.description,
  status: p.status,
  fiscalYear: p.fiscalYear,
  color: p.color,
  ownerName: p.ownerUser?.fullName ?? null,
  districtCount: p.districtCount,
  stateCount: p.stateCount,
  renewalRollup: Number(p.renewalRollup),
  expansionRollup: Number(p.expansionRollup),
  winbackRollup: Number(p.winbackRollup),
  newBusinessRollup: Number(p.newBusinessRollup),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  _districts: planDistricts,
};
```

**Step 6: Verify in browser**

Open Explore → Plans tab. Sort by District Count or Renewal Rollup. Add filter "Districts > 0". Both should work now.

**Step 7: Commit**
```
feat(plans): sync denormalized rollup columns on district changes
```

---

### Task 4: Fix Plans Aggregate Query to Respect Filters

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`

**Step 1: Replace raw SQL with Prisma aggregate**

In `handlePlans`, replace the raw SQL aggregate query (lines ~714-726) with a Prisma aggregate that uses the same `where` clause:

```ts
// Compute aggregates across ALL matching plans (respects filters)
const aggResult = await prisma.territoryPlan.aggregate({
  where,
  _sum: {
    districtCount: true,
    renewalRollup: true,
    expansionRollup: true,
    winbackRollup: true,
    newBusinessRollup: true,
  },
});
```

And update the return:
```ts
aggregates: {
  totalDistricts: aggResult._sum.districtCount ?? 0,
  renewalSum: Number(aggResult._sum.renewalRollup ?? 0),
  expansionSum: Number(aggResult._sum.expansionRollup ?? 0),
  winbackSum: Number(aggResult._sum.winbackRollup ?? 0),
  newBusinessSum: Number(aggResult._sum.newBusinessRollup ?? 0),
},
```

**Step 2: Verify in browser**

Add a filter (e.g., Status is "working"). KPI cards should update to show only filtered plan totals.

**Step 3: Commit**
```
fix(explore): plans aggregate query now respects active filters
```

---

### Task 5: Plan Color Column → Color Swatch

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Add a color swatch cell renderer**

In the column-building `useMemo`, add a check for the `color` column when entity is `plans`. Add this before the generic `else` block (around line 745):

```tsx
} else if (key === "color" && entityType === "plans") {
  cellRenderer = (info: { getValue: () => unknown }) => {
    const hex = info.getValue();
    if (!hex || typeof hex !== "string") return <span className="text-gray-300">{"\u2014"}</span>;
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-full shrink-0 border border-black/10"
          style={{ backgroundColor: hex }}
        />
        <span className="text-[13px] text-gray-500 font-mono">{hex}</span>
      </span>
    );
  };
```

**Step 2: Verify in browser**

Open Explore → Plans, add "Color" column. Should show colored circle + hex label.

**Step 3: Commit**
```
fix(explore): render plan color column as swatch instead of raw hex
```

---

### Task 6: Plan Status → Styled Badges

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Add status badge renderer**

Add a status color map near the top of the file (after the TAG_COLUMNS set):
```tsx
const PLAN_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  planning: { bg: "#6EA3BE18", text: "#4d7285" },
  working:  { bg: "#40377018", text: "#403770" },
  stale:    { bg: "#FFCF7020", text: "#997c43" },
  archived: { bg: "#9CA3AF18", text: "#6B7280" },
};
```

In the column-building `useMemo`, add before the color check:
```tsx
} else if (key === "status" && entityType === "plans") {
  cellRenderer = (info: { getValue: () => unknown }) => {
    const status = info.getValue();
    if (!status || typeof status !== "string") return <span className="text-gray-300">{"\u2014"}</span>;
    const style = PLAN_STATUS_STYLES[status] || PLAN_STATUS_STYLES.archived;
    return (
      <span
        className="px-2 py-0.5 text-[11px] font-medium rounded-full capitalize"
        style={{ backgroundColor: style.bg, color: style.text }}
      >
        {status}
      </span>
    );
  };
```

**Step 2: Verify in browser**

Plans tab — Status column should show colored badges.

**Step 3: Commit**
```
fix(explore): render plan status as styled badges
```

---

### Task 7: Fiscal Year → FY Format

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Add fiscal year formatter**

In the column-building `useMemo`, add:
```tsx
} else if (key === "fiscalYear") {
  cellRenderer = (info: { getValue: () => unknown }) => {
    const year = info.getValue();
    if (year == null || typeof year !== "number") return <span className="text-gray-300">{"\u2014"}</span>;
    return `FY${String(year).slice(-2)}`;
  };
```

**Step 2: Verify in browser**

Plans tab — Fiscal Year column should show "FY26" instead of "2026".

**Step 3: Commit**
```
fix(explore): format fiscal year as FY26 instead of raw number
```

---

### Task 8: Plan Expanded Row Totals

**Files:**
- Modify: `src/components/map-v2/explore/ExploreTable.tsx`

**Step 1: Add totals row to expanded plan subtable**

In the expanded plan row section (around line 982-1025), after the district `<tbody>` rows and before the closing `</tbody>`, add a totals footer row:

```tsx
{/* Totals row */}
{(row.original._districts as unknown[])?.length > 0 && (() => {
  const districts = row.original._districts as Array<{
    renewalTarget: number; expansionTarget: number;
    winbackTarget: number; newBusinessTarget: number;
  }>;
  const totals = districts.reduce(
    (acc, d) => ({
      renewal: acc.renewal + (d.renewalTarget || 0),
      expansion: acc.expansion + (d.expansionTarget || 0),
      winback: acc.winback + (d.winbackTarget || 0),
      newBusiness: acc.newBusiness + (d.newBusinessTarget || 0),
    }),
    { renewal: 0, expansion: 0, winback: 0, newBusiness: 0 }
  );
  return (
    <tr className="border-t-2 border-gray-200 font-semibold text-[#403770]">
      <td className="py-2">Total</td>
      <td className="py-2 text-right">{totals.renewal ? `$${totals.renewal.toLocaleString()}` : "\u2014"}</td>
      <td className="py-2 text-right">{totals.expansion ? `$${totals.expansion.toLocaleString()}` : "\u2014"}</td>
      <td className="py-2 text-right">{totals.winback ? `$${totals.winback.toLocaleString()}` : "\u2014"}</td>
      <td className="py-2 text-right">{totals.newBusiness ? `$${totals.newBusiness.toLocaleString()}` : "\u2014"}</td>
      <td className="py-2"></td>
    </tr>
  );
})()}
```

**Step 2: Verify in browser**

Expand a plan row. Should see a bolded "Total" row at the bottom with summed targets.

**Step 3: Commit**
```
fix(explore): add totals row to plan expanded district subtable
```

---

### Task 9: Plan Row Click → Summary Panel

**Files:**
- Modify: `src/lib/map-v2-store.ts` (add `plan_card` type)
- Create: `src/components/map-v2/right-panels/PlanCard.tsx`
- Modify: `src/components/map-v2/RightPanel.tsx` (render PlanCard)
- Modify: `src/components/map-v2/explore/ExploreOverlay.tsx` (wire up row click)
- Modify: `src/lib/api.ts` (add useTerritoryPlan single-plan hook if not exists)

**Step 1: Add plan_card type to store**

In `src/lib/map-v2-store.ts`, update the `RightPanelContent` interface:
```ts
export interface RightPanelContent {
  type: "district_card" | "task_form" | "task_edit" | "activity_form" | "activity_edit" | "plan_edit" | "contact_detail" | "contact_form" | "plan_card";
  id?: string;
}
```

**Step 2: Create PlanCard component**

Create `src/components/map-v2/right-panels/PlanCard.tsx` with:
- Fetch plan data using existing `useTerritoryPlan(planId)` hook (or inline fetch)
- Header: plan color swatch + name + status badge + FY label
- Section: owner name
- Section: target rollups as a compact 4-row grid (Renewal, Expansion, Win Back, New Business)
- Section: scrollable district list with per-district targets
- "Open Plan" button at bottom linking to `/plans/[id]` (if such a route exists) or just informational

Style per Fullmind brand: Plum text, Steel Blue accents, off-white card backgrounds.

**Step 3: Wire up in RightPanel**

In `src/components/map-v2/RightPanel.tsx`:
- Import `PlanCard`
- Add `plan_card` to the width logic (use 380px like district_card)
- Add render case for `plan_card`

**Step 4: Wire up row click in ExploreOverlay**

In `src/components/map-v2/explore/ExploreOverlay.tsx`, update `handleRowClick`:
```ts
const handleRowClick = (row: Record<string, unknown>) => {
  if (exploreEntity === "districts" && row.leaid) {
    openRightPanel({ type: "district_card", id: row.leaid as string });
  } else if (exploreEntity === "plans" && row.id) {
    openRightPanel({ type: "plan_card", id: row.id as string });
  }
};
```

**Step 5: Verify in browser**

Click a plan row in Explore → Plans. Side panel should open with plan summary.

**Step 6: Commit**
```
feat(explore): add plan summary panel on row click
```
