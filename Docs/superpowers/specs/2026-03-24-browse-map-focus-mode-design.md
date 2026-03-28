# Browse Map → Focus Mode Navigation

**Date:** 2026-03-24
**Status:** Draft

## Problem

The "Browse Map" button in the plan detail modal (Plans tab) calls `viewPlan()` and `onClose()` but never switches to the Map tab. Users click it and nothing visible happens — they stay on the Plans tab.

## Solution

Wire the "Browse Map" button to navigate to the Map tab and enter focus mode for the selected plan, zooming to its associated states.

## Behavior

When the user clicks "Browse Map" in the plan detail modal, execute in this order:

1. **Compute bounds** from `plan.states` using `STATE_BBOX` lookup (same pattern as `PlanOverviewSection.tsx:handleFocusMap`)
2. **Enter focus mode** — `focusPlan(plan.id, stateAbbrevs, leaids, bounds)` from map V2 store
   - `stateAbbrevs`: `plan.states.map(s => s.abbrev)`
   - `leaids`: `plan.districts.map(d => d.leaid)` (may be empty `[]` — that's fine)
   - Filters the map to the plan's states
   - Sets `pendingFitBounds` so the map flies to those states (800ms animation)
   - Highlights plan districts, dims non-plan districts
   - Saves current filters for restoration via `unfocusPlan()`
3. **Switch to Map tab** — `setActiveTab("map")` from app store (`src/features/shared/lib/app-store.ts`)
4. **Close the modal** — `onClose()`

### Edge Cases

- **Plan with states but no districts** (e.g., Montana plan with 1 state, 0 districts): Still enter focus mode and zoom to the state. The `leaids` array will be `[]` — focus mode still filters to the state and zooms correctly.
- **Plan with no states at all**: Skip `focusPlan()`, just switch to the Map tab.
- **Plan with states on opposite coasts**: Acceptable — `fitBounds` will zoom out to show the combined bounding box of all states.

## Changes

### `src/features/map/components/SearchResults/PlanDistrictsTab.tsx`

**`BrowseMapButton` component (lines 807–823):**

- Change props from `{ planId, onClose }` to `{ plan, onClose }` (receives full `TerritoryPlanDetail`)
- Import `useMapStore` from app store (`src/features/shared/lib/app-store.ts`) for `setActiveTab`
- Import `STATE_BBOX` from `MapV2Container`
- Replace `viewPlan(planId)` with the execution sequence above
- Update both call sites (lines 128 and 178) to pass `plan` instead of `planId`

### No other files changed

All required utilities (`STATE_BBOX`, `focusPlan`, `setActiveTab`) already exist. The bounds computation pattern is already proven in `PlanOverviewSection.tsx:handleFocusMap`.

## Testing

- Manual: Click "Browse Map" on a plan with states and districts → should navigate to map, zoom to states, enter focus mode with districts highlighted
- Manual: Click "Browse Map" on a plan with states but no districts → should navigate to map, zoom to states, enter focus mode
- Manual: Click "Browse Map" on a plan with no states → should navigate to map at default view
- Manual: After focus mode, click unfocus → filters restore to previous state
