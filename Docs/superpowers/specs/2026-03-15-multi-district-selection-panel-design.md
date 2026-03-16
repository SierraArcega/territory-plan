# Multi-District Selection Panel

**Date:** 2026-03-15
**Branch:** feature/multi-district-selection-panel (off main)
**Status:** Approved for implementation

---

## Overview

Replace the current opt-in multi-select mode with always-on district selection. When one or more districts are selected on the map, the left panel switches to a dedicated selection list view. Each district in the list has per-row actions (Explore, Add to Plan) and a bulk Add All action. Exploring a single district navigates into the existing detail view with a back arrow that returns to the selection list.

---

## What Changes

### Removed
- **Multi-select toggle** — `multiSelectMode` and `toggleMultiSelectMode` removed from the store and UI. Multi-select is always on.
- **`MultiSelectChip.tsx`** — the floating pill bar at the bottom of the map is removed entirely. Selection management moves into the left panel.
- **`SelectModePill.tsx`** — the floating "Select" toggle button on the map that rendered `multiSelectMode`. Also remove its mount point from `MapV2Shell.tsx`.
- **Panel collapse button** — the `<` toggle that hides/shows the FloatingPanel is removed. The desktop hidden-state recovery branch in `FloatingPanel` (the floating "Menu" button shown in hidden mode on desktop/tablet) is also removed. The panel is always visible on desktop; tablet auto-collapse `useEffect` remains unchanged. The mobile bottom-drawer hidden-state button is **not changed** (covered by the mobile Out of Scope clause).
- **Direct single-click-to-detail** — a single map click no longer navigates directly to `DISTRICT` panel state. It adds the district to the selection set.
- **`multiSelectMode` Escape handler** — the `if (store.multiSelectMode)` branch in the `MapV2Container` Escape key handler is removed.

### Added
- **`MULTI_DISTRICT` panel state** — a new value in the `PanelState` union in `store.ts`.
- **`SelectionListPanel` component** — new panel component rendered when `panelState === "MULTI_DISTRICT"`.
- **Per-row district actions** — each district row has an "Explore" button and a "+ Plan" dropdown.
- **Bulk "Add All to Plan" action** — dropdown at the top of the list targeting all selected districts.
- **Escape clears selection** — when `panelState === "MULTI_DISTRICT"`, pressing Escape calls `clearSelectedDistricts()` (same effect as "Clear all").

### Modified
- **Map district click** — calls `toggleLeaidSelection(leaid)` instead of `selectDistrict(leaid)`.
- **School-layer clicks** — school markers still call `selectDistrict(leaid)` directly (navigates to `DISTRICT` state). This is intentional: school clicks are a secondary navigation path separate from the bulk selection flow.
- **`toggleLeaidSelection`** — inline panel-state transition logic added (see Store Changes below).
- **`clearSelectedDistricts`** — sets `panelState: "BROWSE"` in addition to clearing the set.
- **`goBack()` to `MULTI_DISTRICT`** — clears `selectedLeaid` (sets to `null`) in addition to restoring panel state, so no stale single-district reference lingers while in the list view.
- **Back arrow in `DistrictDetailPanel`** — when the navigation origin is `MULTI_DISTRICT`, the back arrow label reads "← Back to N selected" and `goBack()` returns to `MULTI_DISTRICT` with `selectedLeaids` preserved.

---

## Interaction Flow

### 1. Clicking the map
- Every district click calls `toggleLeaidSelection(leaid)`.
- If the district is already in `selectedLeaids`, it is removed.
- If `selectedLeaids` is empty after removal, panel returns to `BROWSE`.
- If `selectedLeaids` becomes non-empty and `panelState === "BROWSE"`, panel switches to `MULTI_DISTRICT`.
- School marker clicks bypass this and still call `selectDistrict(leaid)` → `DISTRICT` state.
- No district is set as `selectedLeaid` via a map district click — only via "Explore".

### 2. Selection list panel (`MULTI_DISTRICT`)
Header:
- Title: "N Districts Selected"
- Subtitle: "Click map to add more"
- "Clear all" button — calls `clearSelectedDistricts()`, returns panel to `BROWSE`
- No back arrow

Bulk action bar:
- Label: "Add all N to a plan"
- "+ Add All" dropdown — same plan list as the existing AddToPlanButton; calls `useAddDistrictsToPlan` with all `selectedLeaids`

District rows (one per selected leaid, ordered by name, capped at 20 visible — see Data Fetching):
- Checkbox — click deselects that district; if last, panel returns to `BROWSE`
- District name (truncated with ellipsis if too long)
- State abbreviation + student count
- "+ Plan" dropdown button — adds just that district to a chosen plan
- "Explore" button — sets `selectedLeaid` to this leaid, navigates to `DISTRICT` panel state (pushing `MULTI_DISTRICT` onto the nav history, with deduplication — see Store Changes)

### 3. District detail (navigated from Explore)
- Back arrow label: "← Back to N selected" (N = `selectedLeaids.size`)
- `goBack()` returns to `MULTI_DISTRICT`; `selectedLeaids` is unchanged; `selectedLeaid` is cleared
- All existing district detail cards and actions remain intact
- "Add to Plan" in the detail view works as today (single district)

### 4. Escape key

New handler structure in `MapV2Container` (replace the existing multiSelectMode branch):

```ts
if (panelState === "MULTI_DISTRICT") {
  clearSelectedDistricts()  // also sets panelState → BROWSE
} else if (panelState !== "BROWSE") {
  goBack()
  fitBounds()  // existing behavior
}
```

The `MULTI_DISTRICT` check must come first to prevent the general `goBack()` branch from catching it.

---

## Store Changes (`store.ts`)

```ts
// PanelState union — add new value
type PanelState = "BROWSE" | "DISTRICT" | "MULTI_DISTRICT" | "PLAN_NEW" | ...

// Remove these fields and actions entirely
multiSelectMode: boolean
toggleMultiSelectMode: () => void

// toggleLeaidSelection — add inline panel-state transitions + 20-district cap
toggleLeaidSelection: (leaid: string) => {
  const next = new Set(state.selectedLeaids)
  if (next.has(leaid)) {
    next.delete(leaid)
  } else {
    if (next.size >= 20) return  // hard cap — no-op, do not add
    next.add(leaid)
  }
  const panelState =
    next.size === 0 ? "BROWSE"
    : state.panelState === "BROWSE" ? "MULTI_DISTRICT"
    : state.panelState  // stay in MULTI_DISTRICT or any other state
  set({ selectedLeaids: next, panelState })
}

// clearSelectedDistricts — also resets panelState
clearSelectedDistricts: () => set({ selectedLeaids: new Set(), panelState: "BROWSE" })

// goBack — clear selectedLeaid when returning to MULTI_DISTRICT
// (existing goBack already handles navigation stack; add selectedLeaid: null
//  when the destination state is MULTI_DISTRICT)

// Nav stack deduplication for Explore:
// When navigating from MULTI_DISTRICT to DISTRICT via Explore,
// only push MULTI_DISTRICT if the top of panelHistory !== "MULTI_DISTRICT".
// This prevents repeated Explore → Back → Explore cycles from accumulating
// duplicate MULTI_DISTRICT entries in the history stack.
```

---

## Component Changes

| File | Change |
|------|--------|
| `src/features/map/components/MultiSelectChip.tsx` | **Delete** |
| `src/features/map/components/SelectModePill.tsx` | **Delete** |
| `src/features/map/components/MapV2Shell.tsx` | Remove `<MultiSelectChip />` and `<SelectModePill />` mount points |
| `src/features/map/components/FloatingPanel.tsx` | Remove collapse toggle button; remove hidden-state recovery branch |
| `src/features/map/components/PanelContent.tsx` | Add `MULTI_DISTRICT` case → render `<SelectionListPanel />` |
| `src/features/map/components/MapV2Container.tsx` | District click: `toggleLeaidSelection`; remove dead `multiSelectMode` Escape branch; add `MULTI_DISTRICT` Escape handler |
| `src/features/map/lib/store.ts` | Remove `multiSelectMode`, add `MULTI_DISTRICT`, update `toggleLeaidSelection`, `clearSelectedDistricts`, `goBack` |
| `src/features/map/components/panels/district/DistrictDetailPanel.tsx` | Update back arrow label when origin is `MULTI_DISTRICT` |
| `src/features/map/components/panels/SelectionListPanel.tsx` | **New file** |

---

## `SelectionListPanel` Component

```
SelectionListPanel
├── Header: "N Districts Selected" + Clear All button
├── BulkActionBar: "Add all N to a plan" + AddAll dropdown
└── ScrollableList
    └── DistrictSelectionRow (one per leaid, up to 20)
        ├── Checkbox (deselect)
        ├── DistrictInfo (name, state, students) — fetched via useDistrictDetail(leaid)
        ├── PlanDropdownButton ("+ Plan") — single district
        └── ExploreButton → navigate to DISTRICT
```

---

## Data Fetching

Each row needs district name, state abbreviation, and student count.

Use `useDistrictDetail(leaid)` per row — already cached by React Query, so revisiting the same district does not re-fetch. Add a loading skeleton per row while data resolves.

**Selection cap:** The `toggleLeaidSelection` action enforces a hard cap of **20 districts**. If `selectedLeaids.size >= 20` and the user tries to add another, the action is a no-op (no state change, no error — map click simply does nothing). This prevents unbounded parallel requests from the selection list. A follow-up could add a batch summary endpoint to lift this limit.

---

## Out of Scope
- Keyboard multi-select (Shift+click range selection) — not changed
- The existing `PlanFormPanel` (PLAN_NEW state) — not changed
- Mobile/responsive layout changes to FloatingPanel — not changed
- "Find Similar" behavior — not changed
- Batch district summary API endpoint — deferred; current per-row fetching with a 20-district cap is sufficient
