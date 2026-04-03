# County-Level Filtering for Geography Panel

**Date:** 2026-03-31
**Status:** Approved

## Summary

Add county-level filtering to the Geography dropdown in the search bar. Users can search for counties by name, see state abbreviations alongside results, and select multiple counties across different states as standalone filters independent of the state filter.

## Motivation

Sales reps often work regions that span state borders (e.g., Kansas City metro, DC-Maryland-Virginia corridor). County-level filtering lets them target specific geographic areas without selecting entire states. Currently the Geography panel only supports ZIP Code + Radius and State filtering — county fills the gap between "entire state" and "specific ZIP radius."

## Data Context

- 3,136 unique (county, state) combinations exist in the district table
- 1,873 unique county names, but many are shared across states (Washington County appears in 30 states, Jefferson County in 25)
- County names are unique within each state — no disambiguation needed when state is known
- `countyName` field already exists on the District model and is already in `DISTRICT_FIELD_MAP`

## Design

### API Endpoint: `GET /api/counties`

**No query parameters.** Returns the full list of distinct county+state pairs.

**Response:**
```json
[
  { "countyName": "Harris County", "stateAbbrev": "TX" },
  { "countyName": "Washington County", "stateAbbrev": "AL" },
  ...
]
```

**Implementation:**
- Queries distinct `(countyName, stateAbbrev)` pairs from the `district` table using Prisma `groupBy`
- Sorted alphabetically by county name, then state abbreviation
- Returns all ~3,136 pairs in a single response (~100KB)

### Data Hook: `useCounties()`

TanStack Query hook (following the project's preferred data-fetching pattern):
- Fetches `/api/counties` once
- `staleTime: Infinity` — county data is static, no need to refetch during a session
- Cached globally — if multiple components need counties, TanStack Query serves from cache
- Located in a shared queries file (e.g., `src/features/shared/lib/queries.ts` or `src/features/map/lib/queries.ts`)

### UI: County Section in GeographyDropdown

Added below the existing State filter section in `GeographyDropdown.tsx`.

**Data loading:**
- Uses `useCounties()` hook — data loaded once and cached by TanStack Query
- No local `useEffect` + `fetch` needed

**Search input:**
- Text field with placeholder "Search county..."
- Filters the preloaded list client-side (instant, no API calls per keystroke)
- Case-insensitive substring match on county name
- If states are selected in the state filter, additionally narrows the list to those states (convenience, not required)

**Results list:**
- Scrollable dropdown below search input
- Each result displays as `County Name (ST)` — e.g., "Washington County (AL)"
- Checkbox-style multi-select, consistent with state filter pattern
- Results sourced directly from preloaded database data — values match exactly, no case mismatch possible

**Selected counties:**
- Displayed as removable pills below the search input
- Each pill shows `County Name (ST)` with × to remove
- Independent of state filter — removing a state does not remove its counties
- Selecting a county does not auto-select its parent state

### Filter Integration

**Filter structure:**
- Column: `"countyName"`
- Op: `"in"`
- Value: array of objects `[{ countyName: "Harris County", stateAbbrev: "TX" }, ...]`

**Search API handling (special case in `/api/districts/search/route.ts`):**
- Handle `countyName` filter as a special case before `buildWhereClause` (same pattern as `urbanicity` coercion and `_zipRadius`)
- Extract the structured objects from the filter value
- Build a compound Prisma `OR` clause: `{ OR: [{ countyName: "Harris County", stateAbbrev: "TX" }, { countyName: "Washington County", stateAbbrev: "AL" }] }`
- Remove the `countyName` filter from the array before passing remaining filters to `buildWhereClause`

**Why structured objects instead of pipe-delimited strings:**
- Explicit — no parsing ambiguity
- Type-safe — no risk of splitting on a `|` that might appear in data
- Matches what the API returns — round-trip fidelity

**Filter domain classification:**
- Add `"countyName"` to the `geography` domain set in `SearchBar/index.tsx` so selections count toward the Geography badge

### Edge Cases

- **Empty state:** County section shows just the search input. No results displayed until the user starts typing.
- **No results:** Shows "No counties found" inline below the input.
- **State filter interaction:** If states are selected, county search is scoped to those states for convenience. Already-selected counties are never removed when states change.
- **Overlapping filters:** If a user selects both "TX" in states and "Harris County (TX)" in counties, both filters apply. The overlap is harmless — districts must match both, and they will.

### Testing

- Integration test: create a county filter, serialize it, send to search API, confirm matching districts return
- Unit test: county filter special case in search route correctly builds compound OR clause
- Unit test: `/api/counties` endpoint returns correct distinct county+state pairs
- Component test: GeographyDropdown renders county section, client-side search filters list, selections create filters
