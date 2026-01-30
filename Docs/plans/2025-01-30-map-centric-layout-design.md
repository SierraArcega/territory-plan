# Map-Centric Layout Design

**Date:** 2025-01-30
**Status:** Approved

## Goal

Make the map the center of the Territory Planner experience by maximizing map viewport space and adding smart pan/zoom behavior when states are selected.

## Design Decisions

### 1. Layout Changes

**Before (4 rows, ~138px overhead):**
- Header: ~56px
- Filter Bar: ~50px
- Map: remaining space
- Footer: ~32px

**After (1 row, ~48px overhead):**
- Merged Nav/Filter Bar: 48px
- Map: everything else

**Net gain:** ~90px more vertical space for the map.

### 2. Merged Navigation Bar

Combines header and filter bar into a single 48px row:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ◉ Fullmind │ 🔍 Search districts...  │ State ▾ │ Status ▾ │ Sales ▾ │ × │ ☐ │ ║ │ Plans (12) │
└─────────────────────────────────────────────────────────────────────────┘
```

**Contents (left to right):**
- Fullmind wordmark/logo (links to home/reset)
- Search box (flex, max-width)
- State dropdown
- Status dropdown
- Sales Exec dropdown
- Clear button (when filters active)
- Multi-select toggle
- Vertical divider
- Plans button with district count

**Styling:**
- Height: 48px (py-2.5)
- Background: white with subtle bottom border
- Inputs/buttons: h-9 (compact)

### 3. Footer Removal

Footer removed entirely:
- Legend dots are redundant with CustomerOverviewLegend on map
- Data attribution can live in settings/about page if needed

### 4. Map Viewport Behavior

**When a state is clicked and panel opens:**

```
┌──────────────────────────────────────┬──────────┐
│                                      │          │
│         ┌─────────────┐              │  Panel   │
│         │   STATE     │              │  420px   │
│         │  (fitted)   │              │          │
│         └─────────────┘              │          │
│                                      │          │
│    ◄── centered in this area ──►    │          │
└──────────────────────────────────────┴──────────┘
```

- Calculate visible area = viewport width - panel width (420px)
- Fit state bounding box into visible area
- Use `fitBounds()` with padding: `{ top: 60, bottom: 40, left: 40, right: 460 }`
- Max zoom: 8 (prevent over-zoom on small states)
- Animation duration: 500ms

**When a district is clicked:**
- Check if district is visible (not behind panel)
- If hidden → pan to make visible
- If visible → no movement
- Never zoom on district click

**When panel closes:**
- No auto-zoom out
- "Back to US" button available for manual reset

## Files to Modify

1. **`src/app/page.tsx`**
   - Remove header section
   - Remove footer section
   - Simplify layout to filter bar + map

2. **`src/components/filters/FilterBar.tsx`**
   - Add Fullmind logo (left side)
   - Add Plans button with count (right side, after divider)
   - Reduce height to 48px
   - Compact all inputs to h-9

3. **`src/components/map/MapContainer.tsx`**
   - Add `fitBoundsToState(stateCode)` function
   - Add `ensureDistrictVisible(leaid)` function
   - Call these on state/district selection
   - Account for panel width in calculations

## Implementation Order

1. Remove header and footer from page.tsx
2. Update FilterBar with logo and Plans button
3. Add viewport logic to MapContainer
4. Test state selection flow
5. Test district selection flow
