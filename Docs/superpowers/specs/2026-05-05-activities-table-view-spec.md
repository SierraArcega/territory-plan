# Feature Spec: Activities Table View

**Date:** 2026-05-05
**Slug:** activities-table-view
**Branch:** `worktree-activities-table-view`

## Requirements

Replace the **Quarter** option in the Activities page `ViewToggle` (top right, between
Month and Map) with a new **Table** view that renders all activities as a paginated,
sortable, filterable, partially-inline-editable data table.

| Decision | Value |
|----------|-------|
| Primary use | Both fast lookup AND audit/triage equally |
| Date scope | All time by default; date is a column filter |
| Filter chrome | Hide existing chip bar in Table view; replace with column-header filters + a search bar |
| Row click | Opens existing `ActivityDetailDrawer` |
| Default columns | Date, Type, Title, District, Contact(s), Owner, Status, Outcome notes preview |
| Bulk actions | Export CSV, reassign owner, change status |
| Default sort | Date desc (most recent first) |
| Inline editable cells | Date, Type, Owner, Status |
| Pagination | Server-side; 50 rows/page; 200+ banner |

## Visual Design

### Approved approach

**Direction A + inline editing.** Filter UI lives on the table itself
(column-header popovers + a top search bar). The existing `ActivitiesFilterChips`
bar is hidden in Table view. Clicking an editable cell opens an inline popover;
clicking elsewhere on the row opens the existing `ActivityDetailDrawer`.

### Key architectural decisions

- **Filter state is shared** with calendar views via `useActivitiesChrome.filters`,
  so switching Table → Schedule preserves what's selected. Two new fields:
  `contactIds: number[]`, `dateFrom: string | null`, `dateTo: string | null`.
- **`deriveActivitiesParams` branches on `view`**: when `view === "table"` it
  uses `dateFrom/dateTo` (or no dates at all); otherwise it uses anchor+grain
  as today.
- **Row click vs cell click:** non-editable cells delegate the click up to the
  row (drawer); editable cells `stopPropagation` and open their own popover.
- **Inline editing reuses `useUpdateActivity`'s existing `onMutate`**, which
  already does optimistic cache patching for `status`, `type`, `startDate`,
  `endDate`. Owner reassignment is genuinely new and requires a new
  `createdByUserId` field on the PATCH route plus auth check.
- **Bulk mutations** go through a new `PATCH /api/activities/bulk` endpoint
  with shape `{ ids: string[], updates: { ownerId?, status? } }`. Per-row auth
  check (own row OR admin). Cap at 500 IDs per request.

### Layout

    +-------------------------------------------------------------------------------+
    | Activities      [My / All Fullmind] · [Synced]   [Schedule|Week|Month|Table|Map] [+New]
    +-------------------------------------------------------------------------------+
    | [⌘K Search by title, notes, district, contact…]   [Reset] [Export▾] [Cols▾]   |
    +-------------------------------------------------------------------------------+
    | [✓] Date↓  Type▾  Title▾  District▾  Contact▾  Owner▾  Status▾  Outcome▾      |
    +-------------------------------------------------------------------------------+
    |  May 5   ROAD_TRIP  Trip to Syracuse   Syracuse C…  J. Patel  Me     Synced    "Visited principal — opened pilot…"
    |  May 4   CONFERENCE Empowering Every…  —           A. Diaz   Me     Past due   "Walk-through booked next week…"
    |  ...                                                                           |
    +-------------------------------------------------------------------------------+
    | Page 1 of 8 · 50 of 387 results · 200+ — narrow your filters for faster scrolling
    +-------------------------------------------------------------------------------+
    | [4 selected]   Reassign owner ▾   Change status ▾   Export CSV          Clear  |  (sticky bottom)
    +-------------------------------------------------------------------------------+

In Table view the date-range strip (`ActivitiesDateRange`) is also hidden,
since "Date" is a column filter.

## Component Plan

### Existing components to reuse

| Component | File | Use |
|-----------|------|-----|
| `DataGrid` | `src/features/shared/components/DataGrid/DataGrid.tsx` | Table renderer (handles selection, sort, expand, footer) |
| `SelectAllBanner` | `src/features/shared/components/DataGrid/SelectAllBanner.tsx` | "Select all matching filters" banner |
| `ActivityDetailDrawer` | `src/features/activities/components/page/ActivityDetailDrawer.tsx` | Row-click target |
| `ActivityFormModal` | `src/features/activities/components/ActivityFormModal.tsx` | "+ New" CTA from empty state |
| `useActivities` / `useActivity` / `useUpdateActivity` / `useDeleteActivity` / `usePrefetchActivity` | `src/features/activities/lib/queries.ts` | Data fetching |
| `useActivitiesChrome` | `src/features/activities/lib/filters-store.ts` | Filter / view state |
| `rowsToCsv` / `slugifyForFilename` / `downloadCsv` | `src/features/reports/lib/csv.ts` | Export |
| `useDistricts`, `useUsers`, `useTags`, `useStates`, `useTerritoryPlans` | shared `lib/queries.ts` | Filter popover data |
| `useSearchContacts` | `src/features/activities/lib/queries.ts` | Contact filter autocomplete |
| `cn` | `src/features/shared/lib/cn.ts` | Class merging |
| `ACTIVITY_STATUS_CONFIG` / `ACTIVITY_CATEGORIES` / `ACTIVITY_TYPE_LABELS` / `CATEGORY_LABELS` | `src/features/activities/types.ts` | Enum definitions and colors |
| `useProfile` | `src/features/shared/lib/queries.ts` | Current user (default owner) |

### New components to build

| Component | Path | Responsibility |
|-----------|------|----------------|
| `ActivitiesTableView` | `src/features/activities/components/page/ActivitiesTableView.tsx` | Top-level container — toolbar + DataGrid + footer + bulk-action bar |
| `ActivitiesTableToolbar` | `src/features/activities/components/page/table/ActivitiesTableToolbar.tsx` | Search input + Reset + Export menu + Columns picker |
| `ActivitiesTableHeader` | `src/features/activities/components/page/table/ActivitiesTableHeader.tsx` | Column-header row with sort + filter trigger per column |
| `ColumnFilterPopover` | `src/features/activities/components/page/table/ColumnFilterPopover.tsx` | Generic popover dispatcher — picks a typed body by column |
| `DateRangeFilter` | `src/features/activities/components/page/table/filters/DateRangeFilter.tsx` | Anytime / Today / This week / Last 7 / Last 30 / Last 90 / Custom |
| `TypeFilter` | `src/features/activities/components/page/table/filters/TypeFilter.tsx` | Category + type accordion (reuses existing `PopoverItem` style) |
| `OwnerFilter` | `src/features/activities/components/page/table/filters/OwnerFilter.tsx` | User multi-select with "Me" pinned |
| `StatusFilter` | `src/features/activities/components/page/table/filters/StatusFilter.tsx` | Status multi-select with color swatches |
| `DistrictFilter` | `src/features/activities/components/page/table/filters/DistrictFilter.tsx` | Search-as-you-type multi-select |
| `ContactFilter` | `src/features/activities/components/page/table/filters/ContactFilter.tsx` | Search-as-you-type multi-select |
| `TextFilter` | `src/features/activities/components/page/table/filters/TextFilter.tsx` | Single text input (Title, Outcome) |
| `EditableDateCell` | `src/features/activities/components/page/table/cells/EditableDateCell.tsx` | Inline date+time picker |
| `EditableTypeCell` | `src/features/activities/components/page/table/cells/EditableTypeCell.tsx` | Type dropdown |
| `EditableOwnerCell` | `src/features/activities/components/page/table/cells/EditableOwnerCell.tsx` | User picker |
| `EditableStatusCell` | `src/features/activities/components/page/table/cells/EditableStatusCell.tsx` | Status pill dropdown |
| `BulkActionBar` | `src/features/activities/components/page/table/BulkActionBar.tsx` | Sticky bottom bar — reassign owner, change status, export, clear |
| `ExportMenu` | `src/features/activities/components/page/table/ExportMenu.tsx` | Selected vs All-filtered export |
| `ColumnsPicker` | `src/features/activities/components/page/table/ColumnsPicker.tsx` | Visible-columns dropdown (DataGrid-compatible) |

### Components to extend

| Component | Change |
|-----------|--------|
| `ViewToggle` | Replace `quarter` option with `table`. New `CalendarView` value `"table"`. New icon (`Table` from lucide). |
| `ActivitiesPageShell` | Add `view === "table"` branch that renders `ActivitiesTableView` and **suppresses** `ActivitiesDateRange`, `ActivitiesFilterChips`, `UpcomingRail`. Keep header + scope toggle + drawer. |
| `filters-store.ts` `CalendarView` | `"schedule" \| "month" \| "week" \| "table" \| "map"` (drop `quarter`'s grain branch). |
| `filters-store.ts` `ActivitiesFilters` | Add `contactIds: number[]`, `dateFrom: string \| null`, `dateTo: string \| null`. |
| `deriveActivitiesParams` | Branch on `view === "table"`: ignore anchor+grain, send `startDateFrom: dateFrom`, `startDateTo: dateTo` only if set. Send `contactIds`, `sortBy`, `sortDir`, `limit: 50`, `offset: page * 50`. |
| `GET /api/activities` (`route.ts`) | Extend `search` to OR against `notes` + `outcome` (currently title only). Accept `?contactIds=` array. Accept `?sortBy=date\|type\|title\|district\|owner\|status` + `?sortDir=asc\|desc`. |
| `ActivitiesParams` (`api-types.ts`) | Add `contactIds?: number[]`, `sortBy?: SortKey`, `sortDir?: "asc" \| "desc"`. |
| `ActivityListItem` response shape | Include first district name, first contact name, owner full name, outcome preview (first 80 chars of `outcome` or `notes`) for table rendering without per-row hydration. |
| `useActivitiesChrome` `persist` partialize | Add `tableSorts`, `tableVisibleColumns`, `tablePage`, `tablePageSize` to persist table-specific UI state. |

### New backend routes

| Route | Method | Body / Params | Purpose |
|-------|--------|---------------|---------|
| `/api/activities/bulk` | `PATCH` | `{ ids: string[], updates: { ownerId?: string, status?: ActivityStatus } }` | Bulk reassign / status change. Per-row auth (own row OR admin). Cap 500 IDs. |
| `/api/activities/[id]` | `PATCH` (extend) | Add `createdByUserId?: string` to body | Single-row owner reassign — used by `EditableOwnerCell`. |

## Backend Design

See: `docs/superpowers/specs/2026-05-05-activities-table-view-backend-context.md`

### Summary

- **No schema changes.** Existing indexes cover the new filter combos.
- **Routes to extend**: `GET /api/activities` (search → notes/outcome, sortBy/sortDir, contactIds), `PATCH /api/activities/[id]` (allow owner reassign).
- **Routes to add**: `PATCH /api/activities/bulk`.
- **Response shape**: `ActivityListItem` gains `districtName: string | null`, `contactName: string | null`, `ownerFullName: string | null`, `outcomePreview: string | null` to avoid N+1 in the table renderer.
- **Auth**: existing `getUser()` + `isAdmin()` from `src/lib/supabase/server.ts`. Bulk endpoint validates each id's ownership against the caller before applying.
- **Performance**: Cap bulk IDs at 500. Server-side pagination + sort means the table never holds >50 rows in memory.

## States

- **Loading (initial)**: 8 skeleton rows × 8 cells. Toolbar buttons disabled.
- **Loading (refetch on filter change)**: existing rows fade to 60%; spinner in toolbar. `keepPreviousData` so rows don't unmount.
- **Empty (no filters)**: centered illustration + "No activities yet — log your first one." CTA opens `ActivityFormModal`.
- **Empty (filters active)**: "No matches for these filters." `Reset filters` button.
- **Error**: red-bordered card in tbody area: "Couldn't load activities." `[Retry]` button. Toolbar remains usable.
- **Banner at ≥200 results**: yellow strip above footer: "200+ matching — narrow your filters for faster scrolling."
- **Optimistic edit error**: cell reverts; toast at bottom-right: "Couldn't save change. Try again." (Reuses existing toast utility.)

## Out of Scope

- Saved table views (rely on existing saved-views infrastructure later — for v1, the table state is in `useActivitiesChrome.persist`).
- Inline editing of Title, District, Contact, Outcome notes (these route to the drawer).
- Mobile-optimized table layout (table view auto-redirects to Schedule on viewports < md).
- Excel/XLSX export — CSV only for v1.
- Cross-page select (`Select all matching filters` selects all matching, but bulk mutation cap is 500; UI shows "first 500 selected" if >500).
- Tsvector / GIN index migration — defer until row count justifies it.
- Removing the `Quarter` filter capability from saved calendar views — existing data with `grain: "quarter"` continues to render under Month view as before; only the **toggle button** is replaced.
