# Bulk Selection & Actions — Plan Districts Table

**Date:** 2026-05-26  
**Feature area:** Views → Plan Table view (`/views/plans/[planId]/table`)  
**Status:** Approved design, pending implementation plan

---

## Problem

The Plan Table view (`GridView`) paginates at 50 rows. When a user filters to 401 districts (e.g. State = MT) there is no way to act on all of them at once. Per-row actions exist (via `RowActionsMenu`) but no bulk path. Use case driving this: bulk-removing all filtered districts from a plan, running contact enrichment on a filtered subset, and exporting the filtered district set to CSV.

---

## Design Overview

Add a **checkbox column** to the districts table (GridView, `showRowActions` mode only), a **selection bar** that appears on selection, and a **Bulk Actions dropdown** with three actions. Selection supports two modes: explicit (specific rows on the current page) and all-filtered (all rows matching the active filters, across all pages).

---

## Selection State Model

### Two modes

| Mode | How entered | What it means |
|---|---|---|
| `explicit` | Click individual checkboxes or header checkbox | Specific leaids selected (current page only) |
| `all-filtered` | Click "Select all N" promote link | All districts matching current filters, server-resolved |

### State shape (local to GridView)

```ts
type SelectionState =
  | { mode: 'none' }
  | { mode: 'explicit'; leaids: Set<string> }
  | { mode: 'all-filtered'; total: number };
```

- `mode: 'none'` — no checkboxes shown as checked, selection bar hidden
- `mode: 'explicit'` — `leaids` is a subset of the current page's rows
- `mode: 'all-filtered'` — `total` is `q.data.total` (the count the server returned); no leaid array held client-side

### State transitions

```
none
  → explicit      header checkbox clicked (selects all current-page leaids)
  → explicit      individual row checkbox clicked

explicit
  → explicit      more/fewer rows toggled
  → all-filtered  "Select all N" promote link clicked
  → none          clear (✕) clicked, or filters change

all-filtered
  → none          clear (✕) clicked, or filters change
```

**Filters-change reset:** whenever `querySig` changes (same signal already used for page reset), selection resets to `none`.

---

## UI Components

### 1. GridView — checkbox column

Rendered only when `showRowActions` is true (plan context, districts source).

- First column: `w-9` fixed width, no header label
- Header cell: indeterminate checkbox when `mode=explicit` and all page rows selected; plain checkbox (unchecked) otherwise. Click toggles select-all-on-page.
- Row cell: checked when leaid is in `explicit.leaids` or `mode=all-filtered`. Click toggles the individual row (forces mode back to `explicit` if transitioning from `all-filtered`).

### 2. Selection bar

Inserted between the filter-chips strip and the table header. Hidden when `mode=none`.

```
[ ✓ 50 of 50 on this page selected  ·  Select all 401  ✕ ]   [ Bulk Actions ▾ ]
```

- **`mode=explicit`, all page rows checked:** shows "50 of 50 on this page selected · Select all 401" promote link.
- **`mode=explicit`, partial page:** shows "N selected" with no promote link.
- **`mode=all-filtered`:** full-width plum banner — "All 401 filtered districts selected" with clear button at right.
- **Bulk Actions button** always visible when selection bar is visible (right-aligned).

### 3. BulkActionsMenu component

`src/features/views/components/grid/actions/BulkActionsMenu.tsx`

Dropdown anchored to the Bulk Actions button. Three items:

```
🔍  Find Contacts          →  opens FindContactsPopover
⬇   Export to CSV          →  triggers client-side export
─────────────────────────
🗑   Remove from plan       →  opens inline confirm
```

Remove is separated by a divider and uses red text — not the default item style.

### 4. FindContactsPopover component

`src/features/views/components/grid/actions/FindContactsPopover.tsx`

Mirrors the existing `ContactsActionBar` popover exactly:
- "TARGET ROLE" label + dropdown (`TARGET_ROLES` options from `contact-types.ts`)
- School Level checkboxes when Principal is selected
- Scope badge: red pill showing "N districts" (the selection count)
- "Start enrichment" button → calls `useBulkEnrich` with `leaids` derived from selection (see API section)

Progress tracking (polling, stall detection, toast) reuses the same logic as `ContactsActionBar`. Extract into a shared hook `useBulkEnrichFlow` in `src/features/plans/lib/enrich-flow.ts` rather than duplicating.

**Leaid resolution for `all-filtered` mode:** `FindContactsPopover` receives the `SelectionState`. When `mode=all-filtered`, it cannot pass leaids directly to `useBulkEnrich`. Before calling `handleStartEnrichment`, the popover calls `GET /api/territory-plans/[id]/districts/export` (leaids-only, no column data) to fetch all matching leaids, then passes them to the enrich API. A `resolvingLeaids` boolean controls the Start button's loading state during this prefetch. The `ContactsActionBar` (no selection scope) continues to pass no `leaids`, preserving its existing "all plan districts" behavior.

### 5. Remove confirmation

Inline popover (not a modal) anchored to the Bulk Actions button:

```
Remove 401 districts from this plan?
This cannot be undone.

                    [ Cancel ]  [ Remove 401 ]
```

Count comes from selection state. On confirm, calls the bulk-remove mutation, then resets selection to `none` on success.

### 6. Export to CSV

Client-side export of district rows. Columns: District Name, State, LEAID, Renewal Target, Winback Target, Expansion Target, New Business Target, Revenue, Take, Pipeline, Prior FY Revenue, Enrollment.

For `mode=explicit`: data is already in `q.data.rows` — filter by selected leaids.  
For `mode=all-filtered`: call a new lightweight endpoint (see API) to fetch all matching rows without the pagination cap.

Filename: `{plan-name}-districts-{date}.csv`

---

## API Changes

### A. Bulk remove endpoint (new)

`DELETE /api/territory-plans/[id]/districts`  
Body: `{ leaids: string[] }`

Added as a `DELETE` export in the **existing** `src/app/api/territory-plans/[id]/districts/route.ts` (same file as the POST handler). This keeps the URL at `/districts` rather than creating a `/districts/bulk-remove` sub-path.

- Deletes all `TerritoryPlanDistrict` rows for the given leaids in one `deleteMany` call.
- Runs `syncClassificationTagsForDistrict` in batches of 10 (same pattern as the POST route).
- Calls `syncPlanRollups(planId)` once at the end.
- Returns `{ removed: number }`.
- Error if `leaids` is empty or not an array.

For `mode=all-filtered` the client resolves leaids via the export endpoint before calling this (see §C below).

### B. Bulk-enrich — add optional leaids scoping

`POST /api/territory-plans/[id]/contacts/bulk-enrich`  
Add optional field: `leaids?: string[]`

When `leaids` is provided, restrict the set of districts processed to only those leaids (instead of all `plan.districts`). All other logic (rollup detection, school-level filtering for Principal, Clay webhook dispatch) is unchanged.

### C. Bulk-export / all-leaids endpoint (new)

`GET /api/territory-plans/[id]/districts/export`  
Query params: pass through the same `filters` and `sort` that the GridView uses (serialised the same way as `/api/views/data`).

Returns all matching district rows with the columns needed for CSV — no pagination cap. Reuses the existing views-data query logic but skips LIMIT/OFFSET and returns the full result set.

This endpoint is used in two places:
1. Export CSV when `mode=all-filtered`
2. Resolving all leaids when `mode=all-filtered` before calling bulk-remove

---

## Frontend Query Hook

`useBulkRemoveDistrictsFromPlan` in `src/features/plans/lib/queries.ts`:

```ts
export function useBulkRemoveDistrictsFromPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, leaids }: { planId: string; leaids: string[] }) =>
      fetchJson(`${API_BASE}/territory-plans/${planId}/districts`, {
        method: 'DELETE',
        body: JSON.stringify({ leaids }),
      }),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['territoryPlans'] });
      queryClient.invalidateQueries({ queryKey: ['territoryPlan', planId] });
      queryClient.invalidateQueries({ queryKey: ['views', 'data'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['teamProgress'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
```

---

## Shared Enrich Hook (extraction)

Extract `useBulkEnrichFlow` from `ContactsActionBar` into `src/features/plans/lib/enrich-flow.ts`. Both `ContactsActionBar` and `FindContactsPopover` import it. The hook encapsulates:
- `isEnriching` state + `setIsEnriching`
- Toast state
- Modal state
- Progress polling via `useEnrichProgress`
- Stall detection timer
- `handleStartEnrichment(params)` callback
- `handleStartEnrichmentRef` for retrying after rollup expansion

The hook accepts `planId` and returns `{ isEnriching, toast, modalState, progressPercent, handleStartEnrichment, bulkEnrich, expandRollup }`.

---

## Scope Limitations

- **Table view only.** Bulk selection is not added to Kanban, Map, Contacts, Opps, or Signals views — only the `table` viewType in a plan context.
- **Districts only.** `showRowActions` is already gated on `source === 'districts'`. Bulk selection follows the same gate.
- **No cross-page explicit selection.** Checking a row on page 1, navigating to page 2, and checking rows there is not supported. Page navigation resets explicit selection. To act on multi-page sets, use "Select all N".
- **Export CSV column set is fixed.** It exports the district-level columns listed above; it does not mirror the user's current column visibility configuration (that can be a follow-up).

---

## Files Changed

**New files:**
- `src/features/views/components/grid/actions/BulkActionsMenu.tsx`
- `src/features/views/components/grid/actions/FindContactsPopover.tsx`
- `src/features/plans/lib/enrich-flow.ts` (extracted from ContactsActionBar)
- `src/app/api/territory-plans/[id]/districts/export/route.ts`
- Test files for all of the above

**Modified files:**
- `src/features/views/components/grid/GridView.tsx` — selection state, checkbox column, selection bar, BulkActionsMenu
- `src/features/plans/lib/queries.ts` — add `useBulkRemoveDistrictsFromPlan`
- `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` — add optional `leaids` scoping
- `src/features/plans/components/ContactsActionBar.tsx` — consume `useBulkEnrichFlow` hook

---

## Testing

- `GridView` unit tests: selection state transitions, checkbox render, selection bar render/hide, querySig-change resets selection
- `BulkActionsMenu` unit test: items render, Find Contacts opens popover, Remove opens confirm
- `FindContactsPopover` unit test: role selector, school-level conditional, start calls hook with correct leaids
- Bulk-remove route test: deletes only the given leaids, runs sync, returns count
- Bulk-enrich route test: when `leaids` provided, scopes processing to only those leaids
- Export route test: returns full result set without pagination cap
