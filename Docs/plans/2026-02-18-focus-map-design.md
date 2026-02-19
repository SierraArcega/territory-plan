# Focus Map — Design Doc

**Date:** 2026-02-18
**Status:** Approved

---

## Goal

Add a toggle button on PlanViewPanel that narrows the map to the plan's states, highlights plan districts, dims non-plan districts, and zooms to fit — giving a focused view of a territory plan's footprint.

## Architecture

### New Store State (`map-v2-store.ts`)

- `focusPlanId: string | null` — the plan currently in focus mode (null = unfocused)
- `preFocusFilters: { filterStates: string[], filterPlanId: string | null } | null` — snapshot of filters before focusing, restored on unfocus

### New Store Actions

- `focusPlan(planId, states: string[], leaids: string[])` — saves current filters, sets `filterStates` to the plan's state abbreviations, sets `filterPlanId` to the plan ID, sets `focusPlanId`, triggers fitBounds
- `unfocusPlan()` — restores `preFocusFilters`, clears `focusPlanId`

### Map Zoom

The action emits a bounds-fit signal. MapV2Container computes a combined bounding box from the plan's states using existing `STATE_BBOX` lookup and calls `fitBounds` with standard padding (`{ left: 380, top: 50, bottom: 50, right: 50 }`) and `duration: 800`.

## Visual Treatment

Non-plan districts within filtered states get the existing base fill (light gray) — already naturally dimmed compared to plan-highlighted districts. The `filterPlanId` filter makes plan districts show vendor/engagement colors while non-plan districts show as default gray fill. No new layers or opacity logic needed.

## UI — The Button

Located in PlanViewPanel stats area (below badges, near the stats grid):

- **Unfocused:** "Focus Map" with a crosshairs/target icon, secondary/outline style
- **Focused:** "Exit Focus" with active styling (filled plum background, white text)

## Interactions

- Click "Focus Map" → save filters, apply plan filters, zoom to fit, toggle button state
- Click "Exit Focus" → restore saved filters, toggle button back (no zoom-back animation)

## Edge Cases

- **0 districts:** Button disabled/hidden
- **1 state:** fitBounds uses that single state's bbox — works fine
- **User changes filters while focused:** unfocus restores pre-focus filters, not mid-focus changes
- **Navigate away from PlanViewPanel:** Focus stays active (toggle-only exit)

## Out of Scope

- No new map layers or opacity logic
- No "focus" button on HomePanel (HomePanel → viewPlan → PlanViewPanel has the button)
- No per-district zoom — shows whole plan footprint at state level
- No zoom-back animation on unfocus
