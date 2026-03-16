# Plans Table Multi-Select Filters — Design Spec

**Date:** 2026-03-15
**Branch:** click-nav-titles-plans
**Status:** Approved

---

## Overview

Add six multi-select filters to the Plans List View so users can narrow the plans table and card grid by Status, Fiscal Year, Owner, States, Districts, and Schools. Filters are fast and interactive — four run entirely client-side, two use async search backed by existing and new API endpoints.

---

## Filter Dimensions

| Filter | Type | Options source | Filtering mechanism |
|---|---|---|---|
| Status | MultiSelect | Static (planning / working / stale / archived) | Client-side |
| Fiscal Year | MultiSelect | Derived from loaded plans | Client-side |
| Owner | MultiSelect | Derived from loaded plans | Client-side |
| States | MultiSelect | Derived from loaded plans | Client-side |
| Districts | AsyncMultiSelect | `/api/districts?search=` | Client-side via `districtLeaids[]` |
| Schools | AsyncMultiSelect | `/api/schools?search=` | Client-side via `schoolNcesIds[]` |

---

## UI Layout

A filter row is rendered between the page header and the plan content area inside `PlansListView`. It is always visible when plans are loaded.

```
[ Status ▾ ]  [ FY ▾ ]  [ Owner ▾ ]  [ States ▾ ]  [ Districts… ]  [ Schools… ]  [✕ Clear]
```

- All six controls share the same visual style and height.
- "Clear all" appears only when at least one filter is active.
- The filter row applies to both card view and table view — `filteredPlans` is passed to both.

---

## Component Architecture

### `AsyncMultiSelect`

New component at `src/features/shared/components/AsyncMultiSelect.tsx`.

A thin wrapper around `MultiSelect` that replaces the static `options` prop with dynamic search:

```ts
interface AsyncMultiSelectProps {
  id: string;
  label: string;
  selected: string[];
  onChange: (values: string[]) => void;
  onSearch: (query: string) => Promise<MultiSelectOption[]>;
  placeholder?: string;
  countLabel?: string;
  searchPlaceholder?: string;
}
```

Behaviour:
- When the user types ≥2 characters in the built-in search box, debounce 250ms then call `onSearch`.
- Results replace the options list in real time.
- Below 2 characters, show an empty list with a "Type to search…" hint.
- Selected items that are no longer in the current search results still render as chips (selection is preserved across searches).
- Loading state: show a spinner inside the dropdown while the search is in flight.
- All other UX (chips, select-all, keyboard nav, close-on-outside-click) is inherited from `MultiSelect` unchanged.

### Filter state in `PlansListView`

```ts
const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
const [selectedFiscalYears, setSelectedFiscalYears] = useState<string[]>([]);
const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
const [selectedDistrictLeaids, setSelectedDistrictLeaids] = useState<string[]>([]);
const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
```

A single `useMemo` applies all six filters in sequence:

```ts
const filteredPlans = useMemo(() => {
  let result = plans ?? [];
  if (selectedStatuses.length)
    result = result.filter(p => selectedStatuses.includes(p.status));
  if (selectedFiscalYears.length)
    result = result.filter(p => selectedFiscalYears.includes(String(p.fiscalYear)));
  if (selectedOwnerIds.length)
    result = result.filter(p => p.owner && selectedOwnerIds.includes(p.owner.id));
  if (selectedStateFips.length)
    result = result.filter(p => p.states.some(s => selectedStateFips.includes(s.fips)));
  if (selectedDistrictLeaids.length)
    result = result.filter(p => p.districtLeaids.some(id => selectedDistrictLeaids.includes(id)));
  if (selectedSchoolIds.length)
    result = result.filter(p => p.schoolNcesIds.some(id => selectedSchoolIds.includes(id)));
  return result;
}, [plans, selectedStatuses, selectedFiscalYears, selectedOwnerIds, selectedStateFips, selectedDistrictLeaids, selectedSchoolIds]);
```

`filteredPlans` replaces `plans` everywhere it is passed to `PlansTable` and the cards grid.

### Option lists for simple filters

Derived from loaded plans to avoid hardcoding and to only show values that actually exist:

- **Status options:** static constant (`planning`, `working`, `stale`, `archived`) with display labels.
- **FY options:** `[...new Set(plans.map(p => p.fiscalYear))].sort()` → `{ value: "2026", label: "FY26" }`.
- **Owner options:** deduplicated from `plans.map(p => p.owner)` → `{ value: owner.id, label: owner.fullName }`.
- **States options:** flattened from `plans.flatMap(p => p.states)`, deduplicated by fips.

---

## Backend Changes

### 1. Plan list response — add `districtLeaids`

Add `districtLeaids: string[]` to the `TerritoryPlan` interface and the `/api/territory-plans` response. This is a flat array of LEAID strings for all districts in the plan, sourced from the existing `plan_districts` join that already populates `districtCount`.

### 2. Plan list response — add `schoolNcesIds`

Add `schoolNcesIds: string[]` to `TerritoryPlan` and the response. Sourced from a schools join (table/model TBD based on existing schema). Can be implemented alongside districts or deferred; the frontend filter is designed to handle both fields being present or empty.

### 3. Schools search endpoint

New endpoint `GET /api/schools?search=<query>&limit=10` following the same shape as `/api/districts?search=`:

```json
{
  "schools": [
    { "ncesId": "...", "name": "Lincoln Elementary", "districtName": "Unified SD", "stateAbbrev": "CA" }
  ]
}
```

---

## Data Model

No new tables required. `districtLeaids` is derived from the existing `plan_districts` table. `schoolNcesIds` source depends on whether an `nces_schools` table (or equivalent) already exists in the schema.

---

## Testing

- Unit tests for `AsyncMultiSelect`: typing triggers `onSearch` after debounce, results populate options, selections persist across searches, loading spinner appears.
- Unit tests for the `filteredPlans` memo: each filter dimension tested in isolation and in combination.
- Integration test: selecting a Status filter reduces the visible plan count in the table.

---

## Out of Scope

- Server-side filtering (all filtering is client-side against the loaded plan list).
- Persisting filter state across page navigation or sessions.
- Filter counts / badge indicators on the filter controls.
