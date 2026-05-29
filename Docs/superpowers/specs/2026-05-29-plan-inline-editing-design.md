# Plan District Inline Editing — Design Spec

**Date:** 2026-05-29  
**Branch:** `feat/plan-inline-editing`  
**Status:** Approved

## Problem

Editing per-district targets and churn risk in the plan detail table requires two steps today: click the row to expand a full panel, then click an individual card to edit. For the most common action — updating a target or flagging churn risk — this is one click too many, and the expanded panel takes up significant vertical space.

## Scope

`PlanDistrictsTab` — the Table view inside the plan detail modal. Two cells in the collapsed district row become directly interactive. The expand-row panel (YoY pacing, services, notes) is **not touched**.

| Cell | Before | After |
|---|---|---|
| Target | Static formatted total | Clickable chip → `TargetBreakdownPopover` |
| Churn Risk | Static colour pill | `ChurnRiskCell` (exists in views, unwired here) |

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

### Wiring `ChurnRiskCell`

`ChurnRiskCell` (`src/features/views/components/grid/cells/ChurnRiskCell.tsx`) already handles:
- Click-to-edit with native `<select>` dropdown
- `useUpdatePlanDistrict(planId, leaid)` mutation with auto-save on change
- Disabled/read-only display mode

In the collapsed `DistrictRow`, replace the static churn pill with:
```tsx
<ChurnRiskCell
  value={row.churnRisk}
  planId={String(plan.id)}
  leaid={row.leaid}
  disabled={false}
/>
```

**One import, one line change — zero new logic.**

## Data Flow

Both mutations hit the existing API route `PUT /api/territory-plans/[id]/districts/[leaid]`. No new API work, no schema changes.

```
Target popover  →  useUpdateDistrictTargets()   (plans/lib/queries.ts:431)
                   mutate({ planId, leaid, renewalTarget, expansionTarget,
                             winbackTarget, newBusinessTarget })

Churn dropdown  →  useUpdatePlanDistrict()       (views/lib/queries.ts:416)
                   mutate({ churnRisk })
```

## Error Handling

Both mutations use TanStack Query's `onError` callback. The existing hooks roll back optimistic updates and surface errors via the app's existing toast pattern. No additional error-handling code needed in the new components.

## Files Changed

| Action | File |
|---|---|
| **Create** | `src/features/plans/components/TargetBreakdownPopover.tsx` |
| **Create** | `src/features/plans/components/__tests__/TargetBreakdownPopover.test.tsx` |
| **Modify** | `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` |

No API routes, no Prisma schema, no migrations.

## Testing

### `TargetBreakdownPopover.test.tsx`
- Renders 4 inputs pre-filled with prop values
- Live total updates as a field changes
- Save fires `useUpdateDistrictTargets` with all 4 fields
- Escape key calls `onClose`
- Click-outside calls `onClose`

### `PlanDistrictsTab`
Existing tests are unchanged. `ChurnRiskCell` already has its own test suite in the views feature. No new integration test needed for the churn wiring.

## What We Explicitly Did Not Do

- No generic `<InlineEditCell>` abstraction — YAGNI
- No custom-styled dropdown for churn — native `<select>` in `ChurnRiskCell` is the established pattern
- No changes to the expand-row panel — it still serves pacing, services, notes
- No keyboard navigation beyond Escape-to-close and Tab between target fields
- No movement of `useUpdateDistrictTargets` from `plans/lib/queries.ts`
- No new API endpoints or schema changes
