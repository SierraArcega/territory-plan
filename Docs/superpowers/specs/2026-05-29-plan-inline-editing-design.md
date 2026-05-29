# Plan District Inline Editing — Design Spec

**Date:** 2026-05-29  
**Branch:** `feat/plan-inline-editing`  
**Status:** Approved

## Problem

Editing per-district targets and churn risk in the plan detail table requires two steps today: click the row to expand a full panel, then click an individual card to edit. For the most common action — updating a target or flagging churn risk — this is one click too many, and the expanded panel takes up significant vertical space.

## Scope

**`GridView` (the plan Table view)** — the full-page plan workspace reachable from the portfolio, with Map/Table/Kanban/Signals tabs. `TableView` is a thin wrapper over `GridView`; all changes land in `GridView`. The plan detail modal's Districts tab (`PlanDistrictsTab`) is out of scope.

> **Correction from initial brainstorm:** The screenshot targets the views GridView, not `PlanDistrictsTab`. `ChurnRiskCell` is already wired in `GridView` — zero new work needed for churn risk.

| Cell | Before | After |
|---|---|---|
| Target (`c.id === "target"`) | Static formatted sum | Clickable chip → `TargetBreakdownPopover` |
| Churn Risk | ✅ Already inline-editable via `ChurnRiskCell` | No change |

## Design

### New component: `TargetBreakdownPopover`

**File:** `src/features/plans/components/TargetBreakdownPopover.tsx`

**Props:**
```ts
interface Props {
  planId: string        // String — matches useUpdateDistrictTargets / ChurnRiskCell conventions
  leaid: string
  renewal: number | null   // Parent converts Prisma Decimal → number before passing
  expansion: number | null
  winback: number | null
  newBusiness: number | null
  onClose: () => void
}
```

**Behaviour:**
- Renders 4 labelled currency inputs: Renewal, Expansion, Win Back, New Biz — pre-filled with current values
- Live-summing Total row updates as the user types
- **Save** commits all 4 fields atomically via a single `useUpdateDistrictTargets()` mutation call, then calls `onClose()`
- **Cancel**, Escape, or click-outside discards changes and calls `onClose()`
- Positioned with `position: absolute` on a `position: relative` wrapper at the target cell — no portal, no Floating UI dependency
- On mount: checks `getBoundingClientRect()` of the trigger; if within 200px of viewport bottom, opens upward (`bottom: 100%`) instead of downward
- Target size: ~90 lines

**State in `DistrictRow`:**
```ts
const [targetOpen, setTargetOpen] = useState(false)
```
The target cell renders a clickable chip when `!targetOpen`; renders `<TargetBreakdownPopover>` when `targetOpen`. Popover's `onClose` sets `targetOpen` to false.

### Wiring into `GridView`

In `GridView.tsx`, the `cell` renderer already handles `churn_risk` via `ChurnRiskCell`. Add a parallel case for `target`:

```tsx
if (c.id === "target" && planId != null && leaid) {
  return (
    <TargetCell
      planId={planId}
      leaid={leaid}
      row={row}
    />
  );
}
```

`TargetCell` is a small wrapper (defined in `GridView.tsx` or extracted alongside) that manages `targetOpen` state and renders either the clickable chip or `TargetBreakdownPopover`.

### Views data route — individual fields

The GridView row currently carries `target` (the sum) but not the 4 sub-fields. The popover needs the breakdown. Extend `fetchDistrictPlanEnrichment` in `src/app/api/views/data/route.ts`:

- Extend `TargetRow` type and SQL to also select `renewal_target`, `winback_target`, `expansion_target`, `new_business_target`
- Extend `DistrictEnrichmentEntry` with `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`
- Map them in the `for (const r of targetRows)` loop
- Include in the row data enrichment at line ~351

### Cache invalidation

`useUpdateDistrictTargets.onSettled` (in `plans/lib/queries.ts`) must also invalidate the views data cache so the target sum re-fetches after a save:

```ts
queryClient.invalidateQueries({ queryKey: ["views", "data"] });
```

## Data Flow

```
Target popover  →  useUpdateDistrictTargets()   (plans/lib/queries.ts:431)
                   mutate({ planId, leaid, renewalTarget, expansionTarget,
                             winbackTarget, newBusinessTarget })
                   onSettled: invalidates ["territoryPlan"], ["planDistrict"],
                              ["teamProgress"], ["leaderboard"], ["views","data"]

Churn dropdown  →  ChurnRiskCell already wired in GridView — no changes
```

API route: existing `PUT /api/territory-plans/[id]/districts/[leaid]`. No schema changes.

## Error Handling

`useUpdateDistrictTargets` uses TanStack Query's `onError` callback with optimistic rollback already implemented. No additional error handling needed in `TargetBreakdownPopover`.

## Files Changed

| Action | File |
|---|---|
| **Create** | `src/features/plans/components/TargetBreakdownPopover.tsx` |
| **Create** | `src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx` |
| **Modify** | `src/app/api/views/data/route.ts` — extend TargetRow + DistrictEnrichmentEntry |
| **Modify** | `src/features/plans/lib/queries.ts` — add `["views","data"]` invalidation |
| **Modify** | `src/features/views/components/grid/GridView.tsx` — add `target` cell case |

No Prisma schema changes, no migrations.

## Testing

### `TargetBreakdownPopover.test.tsx`
- Renders 4 inputs pre-filled with prop values
- Live total updates as a field changes
- Save fires `useUpdateDistrictTargets` with all 4 fields
- Escape key calls `onClose`
- Click-outside calls `onClose`

### `GridView` / `views data route`
Existing tests unchanged. No new integration test needed — `ChurnRiskCell` and `useUpdateDistrictTargets` already have unit coverage.

## What We Explicitly Did Not Do

- No generic `<InlineEditCell>` abstraction — YAGNI
- No custom-styled dropdown for churn — `ChurnRiskCell` is already the pattern and already wired
- No changes to `PlanDistrictsTab` or its expand-row panel
- No keyboard navigation beyond Escape-to-close and Tab between target fields
- No new API endpoints or schema changes
