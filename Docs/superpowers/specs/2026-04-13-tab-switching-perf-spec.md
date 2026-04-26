# Tab Switching Performance Fix

**Date:** 2026-04-13  
**Problem:** Significant lag when switching between layer tabs (Districts, Contacts, Vacancies, Activities, Plans) on the Maps tab. Each tab switch triggers multiple store mutations, re-evaluates all overlay query hooks, and re-renders the entire SearchResults tree.

## Root Causes

1. **Multiple sequential store mutations per tab switch.** `handleEntityChevronClick` calls `toggleLayer()` then `openResultsPanel()` — two separate `set()` calls, two React re-renders.

2. **Unstable query keys.** `useMapVacancies`, `useMapContacts`, and `useMapActivities` include raw filter/dateRange objects in their query keys. Every `setLayerFilter` call creates new object references via spread, triggering TanStack Query key comparison failures and unnecessary refetches — even when filter values haven't changed.

3. **Monolithic SearchResults component.** `SearchResults/index.tsx` subscribes to `layerFilters`, `dateRange`, `mapBounds`, and `activeLayers` at the top level and runs all overlay query hooks on every render. Changing any layer's state re-evaluates hooks for every layer.

## Solution: Approach B — Isolate Tab Rendering

### Change 1: Stable Query Keys

**Files:** `src/features/map/lib/queries.ts`

Replace object references in query keys with the already-computed `queryString`:

```ts
// Before
queryKey: ["mapVacancies", qBounds, filters, dateRange, geoStates]

// After
queryKey: ["mapVacancies", queryString]
```

Apply to all three overlay query hooks: `useMapVacancies`, `useMapContacts`, `useMapActivities`. The `buildOverlayParams` function already serializes filter values into a deterministic URL string — two identical filter states produce identical strings.

### Change 2: Batched Store Action

**Files:** `src/features/map/lib/store.ts`, `src/features/map/components/SearchBar/index.tsx`

Add a new `switchToLayer` action that combines `toggleLayer` + `openResultsPanel` into a single `set()`:

```ts
switchToLayer: (layer) =>
  set((s) => {
    const next = new Set(s.activeLayers);
    next.add(layer);
    return {
      activeLayers: next,
      activeResultsTab: layer,
      searchResultsVisible: true,
    };
  }),
```

Update `handleEntityChevronClick` in `SearchBar/index.tsx` to call `switchToLayer` instead of `toggleLayer` + `openResultsPanel` separately. Note: `switchToLayer` only activates (adds to set) — it is used for opening a layer tab. The existing `toggleLayer` action is preserved for deactivating layers via the toggle button.

### Change 3: Isolated Tab Containers

**New files in `src/features/map/components/SearchResults/`:**
- `ContactsTabContainer.tsx`
- `VacanciesTabContainer.tsx`
- `ActivitiesTabContainer.tsx`
- `PlansTabContainer.tsx`

Each container:
- Subscribes to only its own store slice (e.g., `layerFilters.vacancies`, `dateRange.vacancies`)
- Calls its own query hook (e.g., `useMapVacancies`)
- Reports raw GeoJSON to the store via `setOverlayGeoJSON(layer, data)`
- Receives filtered GeoJSON as a prop from the shell (after cross-filter)
- Renders the existing presentation component (e.g., `<VacanciesTab>`)

### Change 4: Slim SearchResults Shell

**File:** `src/features/map/components/SearchResults/index.tsx`

Remove from SearchResults:
- `layerFilters` subscription
- `dateRange` subscription
- Individual overlay query hooks (`contactsQuery`, `vacanciesQuery`, `activitiesQuery`, `plansQuery`)

Keep in SearchResults:
- `activeResultsTab` (tab switching)
- `activeLayers` (show `<LayerOffPrompt>` vs container)
- `searchResultsVisible` (panel open/close)
- `useCrossFilter` (needs all overlay data — see Change 5)
- Districts logic (no overlay query, stays inline)
- `tabCounts` computation

Conditionally render tab containers based on `activeResultsTab`.

### Change 5: Overlay GeoJSON Store Slice + Cross-Filter

**File:** `src/features/map/lib/store.ts`

Add new state and action:
```ts
// State
overlayGeoJSON: {
  contacts: FeatureCollection | null;
  vacancies: FeatureCollection | null;
  activities: FeatureCollection | null;
  plans: FeatureCollection | null;
}

// Action
setOverlayGeoJSON: (layer, data) => set(...)
```

**File:** `src/features/map/lib/useCrossFilter.ts` — no changes needed.

Cross-filter stays in the SearchResults shell. It reads `overlayGeoJSON` from the store (populated by tab containers) and produces `filteredContacts`, `filteredVacancies`, `filteredActivities`, and `overlayDerivedLeaids`. Filtered data is passed down to tab containers as props.

**Data flow:**
1. Tab container fetches data via query hook
2. Tab container writes raw GeoJSON to store: `setOverlayGeoJSON("vacancies", data)`
3. SearchResults shell reads `overlayGeoJSON` from store, runs `useCrossFilter`
4. Shell passes filtered data down: `<VacanciesTabContainer filteredData={filteredVacancies} />`

## What Does NOT Change

- Dropdown components (VacanciesDropdown, ContactsDropdown, etc.)
- Map layer rendering pipeline (`layers.ts`, MapLibre sources/layers)
- `useCrossFilter.ts` logic
- Existing presentation tab components (`VacanciesTab`, `ContactsTab`, etc.)
- `toggleLayer` action (still used for deactivating layers via toggle)

## Expected Result

- Tab switching: 1 store update → 1 re-render of the shell → conditional swap of mounted container. No cascade through all query hooks.
- Filter changes on one layer: only that layer's container re-renders and refetches.
- Query deduplication: identical filter states produce identical query keys — no phantom refetches.
