# Filter Bar Consolidation Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

The map page has three overlapping search/filter surfaces using two different stores:

| Component | Store | Connected to MapV2? |
|-----------|-------|---------------------|
| **Top FilterBar** (`shared/components/filters/FilterBar.tsx`) | `useMapStore` (old `app-store`) | No — dead wiring |
| **Left panel SearchBar** (`map/components/SearchBar.tsx`) | `useMapV2Store` | Partially — navigates only |
| **LayerBubble** (`map/components/LayerBubble.tsx`) | `useMapV2Store` | Yes — all real filtering |

The top bar dropdowns (States, Districts status, Sales Execs) look functional but do nothing to the current map. Users have no way to know that the actual filters live inside the LayerBubble floating panel.

## Decision

Rewire the top FilterBar to `useMapV2Store`, consolidate search into the top bar, and clean up redundant components.

## Design

### Top FilterBar (rewired)

The existing `FilterBar.tsx` is rewritten to use `useMapV2Store` instead of `useMapStore`. It contains:

1. **Fullmind logo** — clicking navigates to home (existing behavior)
2. **District search** — autocomplete input, same behavior as current `SearchBar.tsx` (debounced API call to `/api/districts`, click result calls `selectDistrict(leaid)`)
3. **States dropdown** — multi-select checkbox dropdown, reads/writes `filterStates` from `useMapV2Store`
4. **Status dropdown** — simplified single-select: All Districts, Customers, Pipeline, Customer + Pipeline, No Fullmind Data. Maps to `filterAccountTypes` in `useMapV2Store`
5. **Sales Exec / Owner dropdown** — single-select, reads/writes `filterOwner` from `useMapV2Store`, fetches from `/api/sales-executives`
6. **Territory Plan dropdown** — single-select, reads/writes `filterPlanId` from `useMapV2Store`, fetches from `/api/territory-plans`
7. **Clear filters button** — resets all top-bar filters

**Removed:** Multi-Select toggle (not needed).

### Status → Account Type Mapping

The simplified status dropdown maps to the V2 store's `filterAccountTypes`:

| Status label | `filterAccountTypes` value |
|---|---|
| All Districts | `[]` (no filter) |
| Customers | `["customer"]` |
| Pipeline | `["prospect"]` |
| Customer + Pipeline | `["customer", "prospect"]` |
| No Fullmind Data | `["investigation", "administrative"]` |

### Left Panel SearchBar — Removed

- `SearchBar.tsx` and `SearchPanel.tsx` are deleted
- The search icon tab in the `IconBar` sidebar is removed or repurposed
- District search now lives exclusively in the top bar

### LayerBubble — Unchanged (keeps duplicates)

LayerBubble retains its States, Owner, and Plan filters. Since both surfaces read/write the same `useMapV2Store` values, they stay in sync automatically. LayerBubble remains the power-user panel for:

- Vendor layer toggles
- Engagement-level filters (Fullmind + competitors)
- Account type checkboxes (granular)
- Signal layers (enrollment, ELL, SWD, expenditure)
- Locale filters
- School type toggles
- Color/palette customization
- Saved views
- Fiscal year selector

### Old Store Cleanup

`useMapStore` in `app-store.ts` loses its map-filter-related state:
- `filters.stateAbbrev`, `filters.statusFilter`, `filters.salesExecutive`, `filters.searchQuery`
- `setStateFilter`, `setStatusFilter`, `setSalesExecutive`, `setSearchQuery`, `clearFilters`
- Associated `useStates`, `useSalesExecutives` hooks used only by the old FilterBar

The old store retains non-map state (activeTab, sidebarCollapsed, etc.) used by `page.tsx` and `AppShell`.

### Data Flow

```
Top FilterBar                     LayerBubble
     |                                 |
     +----> useMapV2Store <------------+
                  |
                  v
         buildFilterExpression()
                  |
                  v
         MapV2Container.setFilter()
                  |
                  v
           MapLibre GL layers
```

Both surfaces write to the same store. The map subscribes to the store and applies filters reactively.

## Files Affected

| File | Change |
|------|--------|
| `src/features/shared/components/filters/FilterBar.tsx` | Rewrite to use `useMapV2Store`, add territory plan dropdown, replace status dropdown |
| `src/features/shared/components/filters/SearchBox.tsx` | Rewrite to use `useMapV2Store` (or replace with adapted `SearchBar` logic) |
| `src/features/shared/components/filters/MultiSelectToggle.tsx` | Delete |
| `src/features/map/components/SearchBar.tsx` | Delete |
| `src/features/map/components/panels/SearchPanel.tsx` | Delete |
| `src/features/map/components/IconBar.tsx` | Remove search tab |
| `src/features/map/components/PanelContent.tsx` | Remove SearchPanel case |
| `src/features/shared/lib/app-store.ts` | Remove map filter state (keep activeTab, sidebar, etc.) |
| `src/features/shared/lib/__tests__/app-store.test.ts` | Update tests for removed state |

## Non-Goals

- Redesigning LayerBubble's internal layout
- Changing how `buildFilterExpression()` works
- Adding new filter types not already in the store
- Changing the MapSummaryBar or ViewActionsBar
