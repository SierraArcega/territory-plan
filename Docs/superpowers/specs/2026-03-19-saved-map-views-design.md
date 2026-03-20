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
activeLayers?: string[];           // serialized OverlayLayerType values: "districts" | "contacts" | etc.
activeResultsTab?: string;         // LayerType values only — never "views"
colorBy?: string;                  // ColorDimension: "engagement" | "enrollment" | etc.

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
searchFilterModes?: Record<string, "all" | "any">;

// Geography filters
geographyFilters?: {
  states: string[];
  zipRadius: { zip: string; radius: number } | null;
};

// Map position
mapCenter?: [number, number];      // [lng, lat]
mapZoom?: number;
```

No DB migration needed — `MapView.state` is already a `Json` column. `searchBounds` is intentionally omitted — it is derived from the map viewport (center + zoom + window size) and would be stale on different screen sizes.

## Snapshot Functions

### `getViewSnapshot()`

Extend the existing function to also serialize:

- `activeLayers`: Convert `Set<OverlayLayerType>` to sorted string array
- `activeResultsTab`: Read directly from store (always a `LayerType` value)
- `colorBy`: Read directly from store
- `layerFilters`: Serialize as-is (already plain objects)
- `dateRange`: Serialize as-is
- `searchFilters`: Serialize as-is
- `searchSort`: Serialize as-is
- `searchFilterModes`: Serialize as-is
- `geographyFilters`: Serialize `{ states: [...geographyStates], zipRadius: geographyZipRadius }`
- `mapCenter` + `mapZoom`: Read from `mapV2Ref.current.getCenter()` and `mapV2Ref.current.getZoom()` at save time

### `applyViewSnapshot(state)`

Extend to restore all new fields. Pattern for each field:

```ts
if (state.activeLayers != null) set({ activeLayers: new Set(state.activeLayers as OverlayLayerType[]) });
if (state.colorBy != null) set({ colorBy: state.colorBy as ColorDimension });
if (state.layerFilters != null) set({ layerFilters: state.layerFilters });
if (state.searchFilters != null) set({ searchFilters: state.searchFilters, isSearchActive: state.searchFilters.length > 0, searchResultsVisible: state.searchFilters.length > 0 });
// ... etc for each field
```

For map position: if `mapCenter` and `mapZoom` are present, defer the `flyTo` call via `queueMicrotask` to avoid race conditions with bounds-triggered refetches during the Zustand `set()` re-render cycle:

```ts
if (state.mapCenter && state.mapZoom != null) {
  queueMicrotask(() => {
    mapV2Ref.current?.flyTo({ center: state.mapCenter, zoom: state.mapZoom, duration: 1000 });
  });
}
```

Legacy saved views missing these fields skip restoration (current state preserved).

### `resetToDefaultView()`

New store action added to the `MapV2Actions` interface:

```ts
resetToDefaultView: () => void;
```

Clears filter/layer state but preserves cosmetic/positional state:

- `activeLayers` → `new Set(["districts"])`
- `layerFilters` → all reset to empty defaults
- `dateRange` → reset to defaults
- `searchFilters` → `[]`, `isSearchActive` → `false`
- `searchResultsVisible` → `false`
- `searchFilterModes` → `{}`
- `geographyStates` → `[]`, `geographyZipRadius` → `null`
- `activeResultsTab` → `"districts"`
- `activeMapViewId` → `null`
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
- Store `activeMapViewId: string | null` in the Zustand store
- Set it when loading a view, clear it on reset
- **Drift detection**: Compare a memoized subset of store state (excluding `mapCenter`/`mapZoom` — position drift is expected) against the loaded view's saved state. Use individual field comparisons rather than full JSON serialization to avoid performance issues. Only recompute when relevant store slices change.

## UI: Right Panel Views Tab

### Tab in `ResultsTabStrip`

Add "Views" as a permanent entry in the tab strip. **Do NOT add "views" to the `LayerType` union** — handle it separately in `ResultsTabStrip` as a special-case tab with a bookmark icon instead of a colored dot. Positioned last (after Activities).

The `activeResultsTab` store field continues to only hold `LayerType` values. Use a separate local/store flag (e.g. `activeResultsTab === "districts" && viewsTabSelected`) or a new `resultsPanelView: "entity" | "views"` store field to track when the Views tab is active.

### Component: `ViewsTab.tsx`

Located in `src/features/map/components/SearchResults/`. Full management interface.

**Header area:**
- "Save Current View" button (primary action)
- Search input to filter views by name

**View cards (scrollable list):**
- View name (bold, inline-editable on click for own views)
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
| `src/features/map/lib/map-view-queries.ts` | Extend `useUpdateMapView` mutation type to accept optional `state` field |
| `src/features/map/components/SearchBar/index.tsx` | Render `SavedViewSwitcher` after fiscal year selector |
| `src/features/map/components/SearchBar/SavedViewSwitcher.tsx` | **New** — compact dropdown for quick view switching/saving |
| `src/features/map/components/SearchResults/ResultsTabStrip.tsx` | Add "Views" tab (special-case, not a `LayerType`) |
| `src/features/map/components/SearchResults/ViewsTab.tsx` | **New** — full saved views management tab |
| `src/features/map/components/SearchResults/index.tsx` | Render `ViewsTab` when Views tab is active |

Note: `ViewActionsBar.tsx` provides Save View, Load View, and Metrics config. The Save/Load functions are superseded by the new SavedViewSwitcher and ViewsTab. The Metrics popover remains useful and should be preserved (either kept in ViewActionsBar or migrated). Removing ViewActionsBar entirely is out of scope for this iteration.

## Edge Cases

- **Legacy saved views**: Missing new fields → skip those fields during apply, don't break
- **Deleted plans/owners in saved filters**: planIds or ownerIds that no longer exist are silently ignored by the API (no results, no errors)
- **Concurrent edits**: Last-write-wins on save. No conflict resolution needed for this use case
- **View drift detection**: Exclude map position from drift comparison. Use memoized field-level comparison (not full JSON serialization) to avoid performance issues. Only recompute when relevant store slices change.
- **flyTo race condition**: Defer map position restoration via `queueMicrotask` so Zustand state settles before the viewport animation triggers bounds-based refetches
- **searchBounds omission**: Intentional — bounds are derived from viewport (center + zoom + screen size) and would be stale across different devices/window sizes

## Out of Scope (v1)

- Overwriting an existing view's state (update state) — views are created as new; user can delete and re-save
- Renaming views — inline-edit is included in ViewsTab but formal rename API can be added later if needed
- Folder/tagging organization for saved views
