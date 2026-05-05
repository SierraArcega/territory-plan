# Implementation Plan: Activities Table View

**Spec:** `docs/superpowers/specs/2026-05-05-activities-table-view-spec.md`
**Backend context:** `docs/superpowers/specs/2026-05-05-activities-table-view-backend-context.md`
**Branch:** `worktree-activities-table-view`

## Phasing

Three phases. Phase 1 = backend extensions + new bulk route (independent of UI).
Phase 2 = filter-store + ViewToggle wiring (small, unblocks UI). Phase 3 = the
table UI itself, broken into independent task groups so they can be parallelized.

Commit after each task group. Tests are written **with** each task group, not
saved for the end (per `feedback_regular_commits.md`).

---

## Phase 1 — Backend (independent of UI)

### Task 1.1 — Extend `GET /api/activities`

**Files:**
- `src/app/api/activities/route.ts` — add `?contactIds=`, `?sortBy=`, `?sortDir=`. Extend `?search=` to OR against `notes` + `outcome` columns (currently title-only).
- `src/features/shared/types/api-types.ts` — add `contactIds?: number[]`, `sortBy?: ActivitySortKey`, `sortDir?: "asc" \| "desc"` to `ActivitiesParams`. Define `ActivitySortKey = "date" \| "type" \| "title" \| "district" \| "owner" \| "status"`.
- `src/features/activities/lib/queries.ts` — extend `buildActivitiesQueryString` to serialize the new params (stable key, alphabetical sort preserved).
- Response shape (`ActivityListItem`) — add `districtName: string \| null`, `contactName: string \| null`, `ownerFullName: string \| null`, `outcomePreview: string \| null`. Compute these via Prisma `include` for first district + first contact + owner; truncate notes/outcome to first 80 chars.

**Tests:** `src/app/api/activities/__tests__/route.test.ts`
- `?search` matches notes
- `?search` matches outcome
- `?contactIds=1,2` filters
- `?sortBy=title&sortDir=asc` orders correctly
- response includes new fields

### Task 1.2 — Extend `PATCH /api/activities/[id]`

**Files:**
- `src/app/api/activities/[id]/route.ts` — accept optional `createdByUserId` in PATCH body. Auth: caller must be admin OR be the current owner.
- `src/features/activities/lib/queries.ts` `useUpdateActivity` mutation type — add `createdByUserId?: string`.
- Optimistic cache patch in `onMutate` — add `createdByUserId` patch.

**Tests:** extend `src/app/api/activities/[id]/__tests__/route.test.ts`
- Owner can reassign to another user
- Non-owner non-admin cannot reassign
- Admin can reassign anyone's row

### Task 1.3 — New `PATCH /api/activities/bulk`

**Files:**
- `src/app/api/activities/bulk/route.ts` (new) — `PATCH` handler. Body: `{ ids: string[], updates: { ownerId?: string, status?: ActivityStatus } }`. Cap 500 ids. Per-row auth check (own row OR admin). Skip rows where `source === "system"` (matches single-row PATCH behavior).
- `src/features/activities/lib/queries.ts` — new `useBulkUpdateActivities` mutation with optimistic cache patching across the listed ids; invalidate `["activities"]` and each `["activity", id]` on settle.

**Tests:** `src/app/api/activities/bulk/__tests__/route.test.ts`
- 1 own row + 1 other-user row → 1 success, 1 forbidden in the response per-row result
- > 500 ids → 400
- Empty `updates` → 400
- `ownerId` change persists for caller's rows
- `status` change persists
- Admin can update any row

**Commit:** `feat(api): activities Table view backend extensions`

---

## Phase 2 — Store + ViewToggle wiring (small, blocks Phase 3)

### Task 2.1 — Filter store: add Table view fields

**Files:**
- `src/features/activities/lib/filters-store.ts`:
  - `CalendarView`: replace `quarter` references — actual type already has `"schedule" | "month" | "week" | "map"`. Add `"table"`. (No `quarter` value to remove from the type itself; only `Grain = "quarter"` exists, which we keep — it's just no longer reachable from the toggle.)
  - `ActivitiesFilters`: add `contactIds: number[]`, `dateFrom: string \| null`, `dateTo: string \| null`.
  - `EMPTY_FILTERS` updated.
  - `ChromeState`: add `tableSorts: SortRule[]`, `tableVisibleColumns: string[]`, `tablePage: number`, `tablePageSize: number` plus their setters. (`SortRule` imported from `DataGrid/types.ts`.)
  - `persist.partialize`: include the new table-state fields.
  - `deriveActivitiesParams`: branch on a `view` argument — if `view === "table"`, drop the anchor+grain date computation and instead pass `startDateFrom: filters.dateFrom?.slice(0,10)` / `startDateTo: filters.dateTo?.slice(0,10)` only when set; pass `contactIds`, `sortBy`, `sortDir`, `limit`, `offset`. (Function takes a new optional `view` param so callers don't need refactoring.)

**Tests:** `src/features/activities/lib/__tests__/filters-store.test.ts`
- New fields default correctly
- `deriveActivitiesParams({ view: "table" })` skips anchor+grain, uses dateFrom/dateTo
- `deriveActivitiesParams({ view: "table" })` returns `limit/offset/sortBy/sortDir`
- Old views still derive anchor+grain
- Persist round-trip preserves the new table fields

### Task 2.2 — ViewToggle: replace Quarter with Table

**Files:**
- `src/features/activities/components/page/ViewToggle.tsx`:
  - Remove the `quarter` option.
  - Add `{ id: "table", label: "Table", view: "table", grain: "week", Icon: Table }` (lucide `Table`) between `month` and `map`.
  - `activeId` adds `if (view === "table") return "table"`.

**Tests:** `src/features/activities/components/page/__tests__/ViewToggle.test.tsx`
- Renders Table button
- Quarter button is gone
- Click Table → `onChange({ view: "table", grain: "week" })`

**Commit:** `feat(activities): wire Table view into chrome + filter store`

---

## Phase 3 — Table UI

Three task groups can run in parallel after Phase 2 lands.

### Task 3.1 — Toolbar + DataGrid wiring (`ActivitiesTableView`)

**Files:**
- `src/features/activities/components/page/ActivitiesTableView.tsx` (new):
  - Reads `useActivitiesChrome` for filters, sorts, page, pageSize, visibleColumns.
  - Calls `useActivities(deriveActivitiesParams({ filters, anchorIso, grain, view: "table" }))`.
  - Renders `<ActivitiesTableToolbar />`, `<DataGrid />` (with custom `cellRenderers` for the 4 editable columns), pagination footer, `<BulkActionBar />`.
  - Selection state held locally (set of activity ids).
  - Row click handler → `setOpenActivityId` from the parent shell (props).
  - Drawer prev/next walks the **paginated** sorted result list.
- `src/features/activities/components/page/table/ActivitiesTableToolbar.tsx` (new):
  - Search input (debounced 250ms, writes to `filters.text`).
  - `Reset` button (only when any filter active).
  - `<ExportMenu />` and `<ColumnsPicker />`.
- `src/features/activities/components/page/table/ColumnsPicker.tsx` (new):
  - Multi-checkbox dropdown of the `ColumnDef[]`. Persists selection to `tableVisibleColumns` via store.
- `src/features/activities/components/page/table/ExportMenu.tsx` (new):
  - Dropdown: "Export selected" (disabled when none selected), "Export all filtered". Uses `rowsToCsv` + `downloadCsv` from `src/features/reports/lib/csv.ts`. Filename: `activities-{YYYY-MM-DD}.csv`.
- `src/features/activities/components/page/table/columns.ts` (new):
  - Defines `ColumnDef[]` for the 8 + extra columns. Wide bundle (8) marked `isDefault: true`. Each `key` matches an `ActivityListItem` field for sort/filter wiring.
- `src/features/activities/components/page/ActivitiesPageShell.tsx`:
  - Add `view === "table"` branch that renders `ActivitiesTableView` and **suppresses** `ActivitiesDateRange`, `ActivitiesFilterChips`, `UpcomingRail`. Keep header + scope toggle + drawer.

**Tests:** `src/features/activities/components/page/__tests__/ActivitiesTableView.test.tsx`
- Renders 8 default columns
- Search input writes to filter store
- Page change updates store
- 200+ banner appears at threshold
- Empty state (no filters): "No activities yet" + CTA
- Empty state (filters active): "No matches" + Reset
- Error state shows retry
- Loading shows skeleton rows
- Row click calls `onActivityClick`

### Task 3.2 — Column-header filters + sort

**Files:**
- `src/features/activities/components/page/table/ActivitiesTableHeader.tsx` (new):
  - Row of column-header buttons. Click label → cycle sort (asc → desc → off). Shift-click → multi-sort. Click `▾` icon → open `ColumnFilterPopover` with column key.
  - Active-filter dot on filter trigger when that column has a value in `filters`.
- `src/features/activities/components/page/table/ColumnFilterPopover.tsx` (new):
  - Generic dispatcher that picks the body by `column.filterType` ("date" | "enum" | "text" | "relation").
- Filter bodies (one file each in `src/features/activities/components/page/table/filters/`):
  - `DateRangeFilter.tsx` — preset chips + custom range.
  - `TypeFilter.tsx` — reuses `PopoverItem` + `ACTIVITY_CATEGORIES` accordion (extract a shared internal component if cleanly separable; otherwise inline).
  - `OwnerFilter.tsx` — user list, "Me" pinned, search if >5.
  - `StatusFilter.tsx` — `ACTIVITY_STATUS_CONFIG` swatches.
  - `DistrictFilter.tsx` — search-as-you-type via `useDistricts({ search, limit: 25 })`.
  - `ContactFilter.tsx` — search-as-you-type via `useSearchContacts(search)`.
  - `TextFilter.tsx` — single text input, debounced.
- All filter bodies write to `useActivitiesChrome.patchFilters`.

**Tests:** `src/features/activities/components/page/table/__tests__/ActivitiesTableHeader.test.tsx`
- Click date column → sort asc, click again → desc, third click → off
- Shift-click adds to multi-sort
- Filter trigger shows dot when filter active
- Popover opens with correct body for each column type

Plus one test per filter body (focus on writes-to-store behavior).

### Task 3.3 — Editable cells + BulkActionBar

**Files:**
- `src/features/activities/components/page/table/cells/EditableDateCell.tsx` (new) — date+time popover. Calls `useUpdateActivity({ activityId, startDate })`.
- `src/features/activities/components/page/table/cells/EditableTypeCell.tsx` (new) — type dropdown. Calls `useUpdateActivity({ activityId, type })`.
- `src/features/activities/components/page/table/cells/EditableOwnerCell.tsx` (new) — user picker. Calls `useUpdateActivity({ activityId, createdByUserId })`. Disabled (read-only) for non-owner / non-admin callers (greyed avatar with tooltip "Only owner or admin can reassign").
- `src/features/activities/components/page/table/cells/EditableStatusCell.tsx` (new) — status dropdown using `ACTIVITY_STATUS_CONFIG`. Calls `useUpdateActivity({ activityId, status })`.
- `src/features/activities/components/page/table/BulkActionBar.tsx` (new):
  - Sticky bottom; visible when `selectedIds.size > 0`.
  - Buttons: Reassign owner ▾ (user picker), Change status ▾ (status picker), Export CSV (selected rows only via `rowsToCsv`), Clear selection.
  - Calls `useBulkUpdateActivities`. Shows toast on success/failure with per-row counts.
- All editable cells `stopPropagation` on click so the row doesn't open the drawer.

**Tests:** Each cell gets a focused test (`__tests__/Editable{X}Cell.test.tsx`):
- Click cell opens popover
- Selecting a value calls `useUpdateActivity` with the right shape
- `stopPropagation` verified (row click handler not fired)
- Permission check on `EditableOwnerCell` (non-owner non-admin → disabled state)

`BulkActionBar.test.tsx`:
- Hidden with no selection
- Reassign owner triggers `useBulkUpdateActivities`
- Export selected calls `rowsToCsv` + `downloadCsv`
- Clear empties selection

**Commit per task group:**
- 3.1: `feat(activities): table view shell, toolbar, columns, export`
- 3.2: `feat(activities): column-header filters and sort`
- 3.3: `feat(activities): inline-editable cells and bulk action bar`

---

## Test strategy

- All tests Vitest + Testing Library + jsdom, co-located in `__tests__/`.
- Mock `@/lib/supabase/server` (`getUser`, `isAdmin`) and `@/lib/prisma` per existing patterns from `src/app/api/activities/__tests__/route.test.ts`.
- TanStack Query in tests uses a per-test `QueryClient` with `retry: false` and `gcTime: 0`.
- Avoid `act()` warnings by awaiting `findByRole` over `getByRole` for popovers.
- Visual regression handled by manual dev-server smoke after Phase 3 lands.

## Risks / mitigation

| Risk | Mitigation |
|------|-----------|
| Search across notes/outcome on a multi-thousand row table is slow | Phase 1 uses simple `ILIKE` OR; if slow in prod, follow up with tsvector + GIN migration (out of scope for v1) |
| Bulk PATCH partial failures confuse users | Response returns `{ succeeded: string[], failed: { id, reason }[] }` per-row; toast summarizes both counts |
| Inline edit + filter shifting the row out from under the cursor | `keepPreviousData` on `useActivities` + optimistic cache update means the row shows the new value immediately; row reorder happens on next refetch only |
| User clicks editable cell expecting drawer | Hover states + small pencil icon on editable cells signal the difference; documented in design-review checklist |
| `quarter` removed from toggle but old persisted state has `grain: "quarter"` | `ViewToggle.activeId` now defaults to `"month"` for `view === "month" && grain === "quarter"`; users see Month selected and the grain auto-corrects on next interaction |

## Ordering / dependencies

```
Phase 1 (1.1, 1.2, 1.3) — independent, parallelizable
       ↓
Phase 2 (2.1 → 2.2)     — sequential, small
       ↓
Phase 3 (3.1, 3.2, 3.3) — parallelizable after 2.2
```

3.1 can land first (table renders read-only). 3.2 + 3.3 can land independently after.
