# Plans Table Multi-Select Filters — Design Spec

**Date:** 2026-03-15
**Branch:** click-nav-titles-plans
**Status:** Approved

---

## Overview

Add six multi-select filters to the Plans List View so users can narrow the plans table and card grid by Status, Fiscal Year, Owner, States, Districts, and Schools. Filters are fast and interactive — four run entirely client-side, two use async search backed by existing API endpoints.

---

## Filter Dimensions

| Filter | Type | Options source | Filtering mechanism |
|---|---|---|---|
| Status | MultiSelect | Static constant | Client-side |
| Fiscal Year | MultiSelect | Derived from loaded plans | Client-side |
| Owner | MultiSelect | Derived from loaded plans | Client-side |
| States | MultiSelect | Derived from loaded plans | Client-side |
| Districts | AsyncMultiSelect | `/api/districts?search=` (exists) | Client-side via `districtLeaids[]` |
| Schools | AsyncMultiSelect | `/api/schools?search=` (exists) | Client-side via `schoolNcesIds[]` |

---

## UI Layout

A filter row is rendered between the page header and the plan content area inside `PlansListView`. It is always visible when plans are loaded.

```
[ Status ▾ ]  [ FY ▾ ]  [ Owner ▾ ]  [ States ▾ ]  [ Districts… ]  [ Schools… ]  [✕ Clear]
```

- All six controls share the same visual style and height.
- "Clear all" appears only when at least one filter is active. Computed as:
  `const anyFilterActive = [selectedStatuses, selectedFiscalYears, selectedOwnerIds, selectedStateFips, selectedDistrictLeaids, selectedSchoolIds].some(f => f.length > 0)`
- The filter row applies to both card view and table view — `filteredPlans` is passed to both.
- When `filteredPlans.length === 0` but `plans.length > 0` (active filters produced no results), show an inline "No plans match your filters" message in place of the table/cards. Do not show the first-time-user onboarding empty state in this case — that is reserved for when no plans exist at all.
- Chips in `AsyncMultiSelect` are shown for 2+ selections, matching `MultiSelect`'s threshold.

---

## Component Architecture

### `AsyncMultiSelect`

New component at `src/features/shared/components/AsyncMultiSelect.tsx`.

A controlled component (not a wrapper around `MultiSelect`) that provides the same visual UX — trigger button, chips, dropdown with search, keyboard navigation — but sources options dynamically via async search rather than a static prop.

```ts
interface AsyncMultiSelectProps {
  id: string;
  label: string;
  selected: string[];           // array of values (e.g. LEAIDs)
  onChange: (values: string[]) => void;
  onSearch: (query: string) => Promise<MultiSelectOption[]>;
  placeholder?: string;
  countLabel?: string;        // customises the "N items" trigger label word, default "items"
  searchPlaceholder?: string;
}
```

**Behaviour:**

- When the user types ≥2 characters in the search box, debounce 250ms then call `onSearch`. Below 2 characters, show an empty list with a "Type to search…" hint.
- Results replace the displayed option list in real time.
- Loading state: show a spinner inside the dropdown while the search is in flight.
- Error state: on `onSearch` rejection, clear the results list and show "Search failed — try again" in place of the results.
- **Label persistence:** The component maintains an internal `Map<string, string>` (value → label) that accumulates labels for every item the user has selected. This map is used to render chips and the trigger label for selections that are no longer in the current search results. When `onChange` removes a value, its entry is also removed from the map.
- **Select-all is disabled** for `AsyncMultiSelect`. Search results are a small slice of a potentially large dataset and bulk-selecting search results is not the intended interaction. The select-all row is not rendered.
- Chips, trigger label format (`"X items"` for 4+), outside-click-to-close, and Escape-to-close behaviour match `MultiSelect`.
- Test file: `src/features/shared/components/__tests__/AsyncMultiSelect.test.tsx`

### Filter state in `PlansListView`

```ts
const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
const [selectedFiscalYears, setSelectedFiscalYears] = useState<string[]>([]);
const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
const [selectedDistrictLeaids, setSelectedDistrictLeaids] = useState<string[]>([]);
const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
```

A single `useMemo` applies all six filters in sequence. Fields that may not yet be present on older API responses are guarded with `?? []`:

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
    result = result.filter(p => (p.districtLeaids ?? []).some(id => selectedDistrictLeaids.includes(id)));
  if (selectedSchoolIds.length)
    result = result.filter(p => (p.schoolNcesIds ?? []).some(id => selectedSchoolIds.includes(id)));
  return result;
}, [plans, selectedStatuses, selectedFiscalYears, selectedOwnerIds, selectedStateFips, selectedDistrictLeaids, selectedSchoolIds]);
```

`filteredPlans` replaces `plans` everywhere it is passed to `PlansTable` and the cards grid.

### Option lists for simple filters

Derived from loaded plans to only show values that actually exist:

- **Status options:** static constant `[{ value: "planning", label: "Planning" }, { value: "working", label: "Working" }, { value: "stale", label: "Stale" }, { value: "archived", label: "Archived" }]`.
- **FY options:** `[...new Set(plans.map(p => p.fiscalYear))].sort()` mapped to `{ value: String(year), label: "FY" + String(year).slice(-2) }`. Note: `value` is a string to match the `MultiSelectOption` interface; the `useMemo` filter compares with `String(p.fiscalYear)` to match.
- **Owner options:** `plans.flatMap(p => p.owner ? [p.owner] : [])` deduplicated by `id` → `{ value: owner.id, label: owner.fullName }`.
- **States options:** `plans.flatMap(p => p.states)` deduplicated by `fips` → `{ value: s.fips, label: s.abbrev }` (or full name if preferred).

### `onSearch` handlers (call-site transformation)

Both async filters transform the raw API response into `MultiSelectOption[]` at the call site in `PlansListView`:

```ts
const searchDistricts = async (query: string): Promise<MultiSelectOption[]> => {
  const res = await fetch(`/api/districts?search=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.districts ?? []).map((d: { leaid: string; name: string; stateAbbrev: string | null }) => ({
    value: d.leaid,
    label: d.stateAbbrev ? `${d.name} (${d.stateAbbrev})` : d.name,
  }));
};

const searchSchools = async (query: string): Promise<MultiSelectOption[]> => {
  const res = await fetch(`/api/schools?search=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.schools ?? []).map((s: { ncessch: string; schoolName: string; stateAbbrev?: string }) => ({
    value: s.ncessch,
    label: s.stateAbbrev ? `${s.schoolName} (${s.stateAbbrev})` : s.schoolName,
  }));
};
```

---

## Backend Changes

### 1. Plan list response — add `districtLeaids`

Two co-located changes required:
- **`src/features/shared/types/api-types.ts`** — add `districtLeaids: string[]` to the `TerritoryPlan` interface (line ~315).
- **`/api/territory-plans` route** — include the field in the response, sourced from the existing `plan_districts` join that already populates `districtCount`.

### 2. Plan list response — add `schoolNcesIds`

Two co-located changes required:
- **`src/features/shared/types/api-types.ts`** — add `schoolNcesIds: string[]` to the `TerritoryPlan` interface, using `ncessch` as the identifier.
- **`/api/territory-plans` route** — include the field in the response. Can be implemented alongside districts or deferred; the frontend `useMemo` guards with `?? []` so it degrades gracefully until the field is available.

### 3. Schools search endpoint — extend existing

`GET /api/schools?search=<query>&limit=10` already exists and supports `schoolName` search. Add a `districtName` field to its response items. This field is not used in the label in the current implementation but is included for future use (e.g. showing district context as a subtitle in the dropdown). The `searchSchools` transform ignores it for now. Current response shape uses `ncessch` as the school identifier — this name is used throughout the spec and must match `TerritoryPlan.schoolNcesIds`.

---

## Data Model

No new tables required. `districtLeaids` is derived from the existing `plan_districts` table. `schoolNcesIds` is derived from the existing schools table using the `ncessch` identifier.

---

## Testing

### `AsyncMultiSelect` unit tests
- Typing ≥2 chars triggers `onSearch` after 250ms debounce; typing <2 chars does not.
- Results from `onSearch` populate the options list.
- Selections persist as chips when a new search clears the results list.
- Chip labels resolve from the internal label map, not from the current options list.
- Loading spinner is shown while `onSearch` is in flight.
- Error state ("Search failed — try again") is shown when `onSearch` rejects.
- Select-all row is not rendered.

### `filteredPlans` memo unit tests
- Each of the six filter dimensions tested in isolation.
- Two filters active simultaneously reduces correctly.
- `districtLeaids: undefined` on a plan does not throw (null-guard test).
- `schoolNcesIds: undefined` on a plan does not throw (null-guard test).

### Integration test
- Selecting a Status filter reduces the visible plan count in the rendered table.

---

## Out of Scope

- Server-side filtering (all filtering is client-side against the loaded plan list).
- Persisting filter state across page navigation or sessions.
- Filter counts / badge indicators on the filter controls.
