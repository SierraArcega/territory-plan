# Plan Modal — Add District Combobox

**Date:** 2026-03-23
**Status:** Draft
**Location:** Districts tab of the plan detail modal (`DistrictsTable` component)

## Problem

When viewing a plan's Districts tab in the plan detail modal, there is no way to add a district directly. The empty state only offers "Go to Map," forcing users to leave the modal, navigate to the map, enter PLAN_ADD mode, click districts on the map, and return. For users who know which districts they want by name, this is unnecessarily slow.

## Solution

Add a combobox/autocomplete input to the Districts tab toolbar that lets users search districts by name and add them to the plan with a single click. Optimistic updates ensure the district appears in the table instantly.

## Interaction Flow

### 1. Entry Point: "+ Add District" Button

- A new **"+ Add District"** button in the DistrictsTable toolbar (left side, before filter/sort controls)
- Styled as a dashed-border plum button matching existing UI patterns
- Clicking it transforms the button into a search input field (320px wide)

### 2. Search

- User types a district name (minimum 2 characters)
- After 300ms debounce, fires a request to `/api/districts/search` with a `name` query param
- Limit: 10 results
- Dropdown appears below the input with results

### 3. Dropdown Results

Each result row shows:
- **District name** (semibold, plum color) with search term highlighted
- **State abbreviation + enrollment** (gray, compact) on a second line
- **Account type badge** on the right, driven by the `accountType` field from the search result:
  - `"Customer"` = teal (`#6EA3BE`) background
  - `"Prospect"` = gray (`#f3f4f6`) background
  - Other/null = no badge

Special states:
- Districts already in the plan: grayed out, "In this plan" badge (salmon), not clickable
- No results: "No districts matching [query]" with helper text
- Loading: subtle spinner or skeleton in the dropdown

### 4. Adding a District

- Click a result row to add the district
- **Optimistic update**: immediately inject a complete `TerritoryPlanDistrict` into the cached plan data via `queryClient.setQueryData`
  - Fields populated from search result: `leaid`, `name`, `stateAbbrev`, `enrollment`, `owner`
  - Fields set to defaults: `addedAt: new Date().toISOString()`, `renewalTarget: null`, `winbackTarget: null`, `expansionTarget: null`, `newBusinessTarget: null`, `notes: null`, `returnServices: []`, `newServices: []`, `tags: []`, `actuals: null`, `opportunities: []`, `pacing: null`
- The new row appears in the table with a brief plum highlight animation (background `rgba(64,55,112,0.06)` fading out over ~1s)
- The search input clears and refocuses — ready for the next search
- The API call (`POST /api/territory-plans/[id]/districts`) fires in the background
- On success: invalidate the plan query to sync server state
- On failure: roll back the optimistic insert, show an error toast

### 5. Closing the Combobox

- Press **Escape** or click outside to collapse back to the "+ Add District" button
- The dropdown dismisses on blur

### 6. Rapid Click Protection

- After clicking a result, briefly disable that row (~500ms) to prevent double-adds
- The API already uses `skipDuplicates: true` as a server-side safety net

## Empty State Update

The current empty state ("No districts yet" + "Go to Map") is updated:
- Primary CTA: **"+ Add Districts"** button (plum, solid) — focuses the combobox
- Secondary CTA: **"Go to Map"** button (outlined) — existing behavior
- Updated copy: "Search by name to add districts, or browse the map."

## API Changes

### `/api/districts/search` — Add `name` Query Param

Add a lightweight `name` shortcut parameter to the existing search route:

```
GET /api/districts/search?name=jeffer&limit=10
```

When `name` is provided:
- Adds a case-insensitive `contains` filter on the district `name` field
- Works alongside existing filter/sort/pagination params
- No bounding box required (nationwide search)

This avoids forcing the client to construct a full `filters` JSON array for a simple name search.

**Implementation detail:** In the route handler, read `url.searchParams.get("name")` and inject `{ name: { contains: nameValue, mode: "insensitive" } }` into the Prisma `where` clause. The response still returns the full shape (`data`, `matchingLeaids`, `matchingCentroids`, `pagination`) — the client hook reads only `data` and ignores the rest.

## Components

### New: `AddDistrictCombobox`

**Location:** `src/features/plans/components/AddDistrictCombobox.tsx`

**Props:**
- `planId: string` — the plan to add districts to
- `existingLeaids: Set<string>` — leaids already in the plan (for dedup)
- `onAdded?: (leaid: string) => void` — callback after optimistic add (for highlight animation)

**Internal state:**
- `isOpen: boolean` — whether the combobox is expanded
- `query: string` — current search text
- `debouncedQuery: string` — debounced value that triggers the API call

**Uses:**
- `useAddDistrictsToPlan` mutation (existing) with optimistic update config
- A new `useDistrictNameSearch(query)` hook wrapping the API call

### New: `useDistrictNameSearch`

**Location:** `src/features/plans/lib/queries.ts`

```ts
function useDistrictNameSearch(query: string, options?: { enabled?: boolean })
```

- Calls `GET /api/districts/search?name={query}&limit=10`
- Enabled only when `query.length >= 2`
- Returns `{ data, isLoading }` for the dropdown

### Modified: `DistrictsTable`

- Add `AddDistrictCombobox` to the toolbar row
- Pass `planId` and `existingLeaids` derived from `districts` prop
- Handle highlight animation for newly added rows (track via a `recentlyAdded` Set with auto-expiry)

### Modified: `DistrictsTable` Empty State

- Add "+ Add Districts" as primary CTA
- Demote "Go to Map" to secondary/outlined button

## Scope

### In scope
- `AddDistrictCombobox` component
- `useDistrictNameSearch` query hook
- `name` param on `/api/districts/search`
- Optimistic update on `useAddDistrictsToPlan`
- Updated empty state in `DistrictsTable`
- Highlight animation for newly added rows

### Out of scope
- Quick-target setting inline after add (use existing table inline edit)
- Filter-based bulk add (map workflow)
- Changes to `PlanOverviewSection` sidebar (keeps existing PLAN_ADD map mode)
- Changes to `PlanDistrictsTab` in the map search results panel

## Accessibility

Follow the WAI-ARIA 1.2 combobox pattern:
- Input has `role="combobox"`, `aria-expanded`, `aria-controls` pointing to the listbox
- Dropdown list has `role="listbox"`, each result has `role="option"`
- Arrow keys navigate results, Enter selects the focused item
- `aria-activedescendant` tracks the currently focused option
- `aria-label="Search districts to add"` on the input
- Disabled ("In this plan") options have `aria-disabled="true"`

## Testing

- Combobox opens/closes on click and Escape
- Search fires after 300ms debounce, minimum 2 chars
- Results render with name, state, enrollment, status
- Already-in-plan districts shown as disabled
- Click adds district optimistically to table
- Failed add rolls back optimistic update
- Empty state shows both CTAs
- No duplicate adds (client-side dedup + server skipDuplicates)
