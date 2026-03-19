# Saved Map Views — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem

Users configure complex combinations of entity filters (plans, contacts, vacancies, activities), district search filters, layer visibility, styles, and map position. There is no way to save and restore these configurations, so users rebuild them from scratch each session.

## Solution

Extend the existing `MapViewState` / `/api/map-views` system to capture the full map experience — overlay filters, search filters, active layers, styles, and map position — in a single named "saved view." Provide two UI surfaces: a compact quick-switcher in the search bar and a full management tab in the right results panel.

## Data Model

Extend `MapViewState` in `store.ts` with these optional fields (backward compatible — legacy saved views missing these fields are applied without overwriting current state):

```ts
// Existing fields stay unchanged. New additions:

// Overlay layer state
activeLayers?: string[];           // e.g. ["districts", "contacts", "plans"]
activeResultsTab?: string;         // "districts" | "plans" | "contacts" | "vacancies" | "activities"

// Entity layer filters
layerFilters?: {
  contacts: ContactLayerFilter;
  vacancies: VacancyLayerFilter;
  plans: PlanLayerFilter;
  activities: ActivityLayerFilter;
};
dateRange?: {
  vacancies: DateRange;
  activities: DateRange;
};

// District search filters
searchFilters?: ExploreFilter[];
searchSort?: { column: string; direction: "asc" | "desc" };

// Map position
mapCenter?: [number, number];      // [lng, lat]
mapZoom?: number;
```

No DB migration needed — `MapView.state` is already a `Json` column.

## Snapshot Functions

### `getViewSnapshot()`

Extend the existing function to also serialize:

- `activeLayers`: Convert `Set<OverlayLayerType>` to sorted string array
- `activeResultsTab`: Read directly from store
- `layerFilters`: Serialize as-is (already plain objects)
- `dateRange`: Serialize as-is
- `searchFilters`: Serialize as-is
- `searchSort`: Serialize as-is
- `mapCenter` + `mapZoom`: Read from `mapV2Ref.current.getCenter()` and `mapV2Ref.current.getZoom()` at save time

### `applyViewSnapshot(state)`

Extend to restore all new fields. Pattern for each field:

```ts
if (state.activeLayers != null) set({ activeLayers: new Set(state.activeLayers) });
if (state.layerFilters != null) set({ layerFilters: state.layerFilters });
// ... etc
```

For map position: if `mapCenter` and `mapZoom` are present, call `mapV2Ref.current?.flyTo({ center, zoom, duration: 1000 })`.

Legacy saved views missing these fields skip restoration (current state preserved).

### `resetToDefaultView()`

New store action. Clears filter/layer state but preserves cosmetic/positional state:

- `activeLayers` → `new Set(["districts"])`
- `layerFilters` → all reset to empty defaults
- `dateRange` → reset to defaults
- `searchFilters` → `[]`
- `isSearchActive` → `false`
- `searchResultsVisible` → `false`
- `activeResultsTab` → `"districts"`
- Styles, fiscal year, map position: **left unchanged**

## UI: Search Bar Quick-Switcher

### Component: `SavedViewSwitcher.tsx`

Located in `src/features/map/components/SearchBar/`. Rendered in the search bar after the fiscal year selector.

**Trigger button:**
- Bookmark icon + label text
- Label shows:
  - `"Default View"` — when no saved view is active
  - `"{view name}"` — when a saved view is loaded
  - `"Unsaved View"` — when state has drifted from loaded view

**Dropdown (below button):**
- "Default" row at top — calls `resetToDefaultView()`, clears active view ID
- List of saved views (own + shared), sorted by most recently updated
  - Active view gets a checkmark
  - Shared views show owner name in subtle text
- "+ Save current view" at bottom
  - Expands to inline input: name field + "Share with team" checkbox + Save button
  - Calls existing `useCreateMapView` mutation with `getViewSnapshot()` payload

**State tracking:**
- Store a `activeMapViewId: string | null` in the Zustand store
- Set it when loading a view, clear it on reset or when filters change after load

## UI: Right Panel Views Tab

### Tab in `ResultsTabStrip`

Add "Views" as a permanent entry in the tab strip. It is not tied to an overlay layer — always visible. Uses a bookmark icon instead of a dot. Positioned last (after Activities).

### Component: `ViewsTab.tsx`

Located in `src/features/map/components/SearchResults/`. Full management interface.

**Header area:**
- "Save Current View" button (primary action)
- Search input to filter views by name

**View cards (scrollable list):**
- View name (bold)
- Owner avatar + name (for shared views) or "You" for own views
- Last updated timestamp (relative, e.g. "2 days ago")
- "Active" badge on the currently loaded view
- Action buttons:
  - Load (applies the view)
  - Delete (own views only, with confirmation)
  - Share toggle (own views only)

**Empty state:**
- When no saved views exist: icon + "No saved views yet" + "Save your current filters and styles as a named view"

## Files Changed

| File | Change |
|------|--------|
| `src/features/map/lib/store.ts` | Extend `MapViewState`, update `getViewSnapshot()`, `applyViewSnapshot()`, add `resetToDefaultView()`, add `activeMapViewId` state |
| `src/features/map/components/SearchBar/index.tsx` | Render `SavedViewSwitcher` after fiscal year selector |
| `src/features/map/components/SearchBar/SavedViewSwitcher.tsx` | **New** — compact dropdown for quick view switching/saving |
| `src/features/map/components/SearchResults/ResultsTabStrip.tsx` | Add "Views" tab |
| `src/features/map/components/SearchResults/ViewsTab.tsx` | **New** — full saved views management tab |
| `src/features/map/components/SearchResults/index.tsx` | Render `ViewsTab` when Views tab is active |
| `src/features/map/lib/layers.ts` | Add "views" to layer types or handle separately in tab strip |

## Edge Cases

- **Legacy saved views**: Missing new fields → skip those fields during apply, don't break
- **Deleted plans/owners in saved filters**: planIds or ownerIds that no longer exist are silently ignored by the API (no results, no errors)
- **Concurrent edits**: Last-write-wins on save. No conflict resolution needed for this use case.
- **View drift detection**: Compare serialized current snapshot against the loaded view's state to determine if "Unsaved View" label should show. Use shallow JSON comparison of the snapshot.
