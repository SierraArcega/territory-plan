# Data Grid

Browse, sort, filter, and manage large datasets with full column control. The power table.

See `_foundations.md` for shared wrapper, cell text sizing, cell padding specs, and the decision tree for choosing between table types.

---

## Column Definitions

The core building block. Every grid starts here.

### Shared `ColumnDef` Interface

```ts
interface ColumnDef {
  key: string;           // matches API response field name
  label: string;         // human-readable header text
  group: string;         // for column picker grouping (e.g., "Basics", "Finance", "Pipeline")
  isDefault: boolean;    // visible by default before user customization
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags" | "relation";
  enumValues?: string[]; // for filterType: "enum"
  relationSource?: string; // for filterType: "relation"
  width?: number;        // explicit column width in px (applied as min-width + max-width on th/td)
  editable?: boolean;    // enables inline editing for this column
  sortable?: boolean;    // defaults to true; set false to disable sorting
}
```

Rules:
- One column definition file per entity, co-located with the grid: `columns/[entity]Columns.ts`
- Column keys must match the API response field names exactly — no mapping layer
- Every column gets a `group` — even if there's only one group. Future-proofs the column picker.
- `isDefault` controls initial visibility. Users toggle via the column picker, persisted to localStorage.
- Currency columns: include `($)` in the label — the cell formatter uses this to auto-detect currency formatting.
- Set `width` on columns where content has a predictable size (IDs, states, dates, badges). Columns without `width` fall back to `max-w-[240px]` with browser auto-sizing. Aim for total column widths to fit within 1440px viewport when possible to minimize horizontal scrolling.

Column ordering:
- Definition order = default display order
- Users can drag-to-reorder; reordered state persists to localStorage
- Column picker shows columns grouped by `group`, alphabetical within each group

---

## Table Setup & Core Rendering

### TanStack Wiring

```tsx
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef as TanStackColumnDef,
} from "@tanstack/react-table";

// Convert our ColumnDef[] to TanStack's format
const tanstackColumns = useMemo<TanStackColumnDef<Record<string, unknown>>[]>(
  () => visibleColumns.map((key) => ({
    id: key,
    accessorKey: key,
    header: columnLabel(key, entityType),
    cell: ({ getValue }) => renderCell(getValue(), key),
  })),
  [visibleColumns, entityType]
);

const table = useReactTable({
  data,
  columns: tanstackColumns,
  getCoreRowModel: getCoreRowModel(),
});
```

Rules:
- Column conversion from `ColumnDef` to TanStack's format happens in one `useMemo` — never inline
- Data is always `Record<string, unknown>[]` — the cell renderer handles type detection
- `getCoreRowModel` is the only required row model. Sorting, filtering, pagination are all server-side.

### Rendering

Uses the same wrapper from `_foundations.md`:
- Outer: `flex flex-col gap-2 min-h-0 flex-1` — fills parent height, shrinks in flex containers
- Card wrapper: `overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm flex-1 min-h-0 flex flex-col`
- Scroll area: `overflow-auto flex-1 min-h-0` — contains the `<table>`, scrolls both axes
- Header: `bg-[#F7F5FA]`, `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider`
- Row hover: `hover:bg-[#EFEDF5]`, `border-b border-[#E2DEEC]`
- Uses `flexRender` for header and cell content instead of hardcoded JSX

### Column Width Behavior

- Columns with `width` set: `style={{ width, minWidth: width, maxWidth: width }}` on both `<th>` and `<td>`. No `max-w-[240px]` class.
- Columns without `width`: browser auto-sizes, capped at `max-w-[240px]` with `truncate`.
- Table uses `min-w-full` — it never collapses narrower than its container.

### Cell Formatting

One shared `renderCell` function that auto-detects type:

| Data type | Detection | Format |
|---|---|---|
| Currency | Column label contains `($)`, or key starts with `comp_` | `$1.2M` / `$45.3K` / `$999` |
| Percentage | Key matches `/percent\|rate\|proficiency/i` | `73.2%` |
| Boolean | `typeof value === "boolean"` | `Yes` / `No` |
| Date | ISO string pattern | `toLocaleDateString()` |
| Array with `name` + `color` | Array of objects | Colored pills (dot + label) |
| Array with `name` only | Array of objects | Comma-joined names |
| Null/undefined | Nullish check | Em dash `—` in Muted (`#A69DC0`) |

---

## Sorting

Server-side multi-sort. TanStack handles the UI indicators; the API handles ordering.

### Sort State

```ts
type SortRule = { column: string; direction: "asc" | "desc" };
// Stored as an array — order matters for multi-sort priority
sorts: SortRule[]
```

### Column Header Behavior

- Click cycles: ascending → descending → remove (three-state)
- Multi-sort: hold `Shift` + click to add a secondary sort. Without Shift, replaces all sorts.
- Sort indicators follow existing specs from `data-table.md`: `w-3 h-3` arrows, `#403770` when active, `#A69DC0` at 50% opacity on hover when inactive
- Active sorted column header text changes to `text-[#403770]` (Primary)

### Sort Dropdown (Toolbar)

- Shows all active sort rules in priority order
- Users can add rules, remove rules, reorder via drag, toggle direction
- Spec matches existing toolbar sort dropdown from `data-table.md`

### API Contract

- Sort rules passed as query params: `?sort=name:asc,enrollment:desc`
- API is always the source of truth for row order

Rules:
- Every column is sortable by default. Set `sortable: false` on `ColumnDef` to opt out.
- Maximum 3 sort rules active at once — the dropdown enforces this.

---

## Filtering

Server-side filtering with a composable filter bar.

### Filter State

```ts
type FilterRule = {
  column: string;
  operator: string;  // depends on filterType
  value: string | string[] | number | boolean;
};
filters: FilterRule[]
```

### Operators by `filterType`

| filterType | Operators |
|---|---|
| `text` | `contains`, `equals`, `startsWith`, `isEmpty`, `isNotEmpty` |
| `number` | `=`, `>`, `<`, `>=`, `<=`, `between` |
| `enum` | `is`, `isNot`, `isAny` (multi-select) |
| `boolean` | `is` (true/false) |
| `date` | `is`, `before`, `after`, `between`, `isEmpty` |
| `tags` | `hasAny`, `hasAll`, `hasNone` |
| `relation` | `hasAny`, `hasNone` |

### Filter Bar UI

Lives in the toolbar, after search. Each active filter renders as a pill:

- Pill: `border border-[#D4CFE2] rounded-full px-3 py-1 text-xs font-medium text-[#6E6390] bg-white`
- Remove (`×`): `text-[#A69DC0] hover:text-[#F37167]`
- "Add filter" button: `text-xs font-medium text-[#403770] rounded-full px-3 py-1 border border-dashed border-[#C2BBD4]`
- "Clear all" link (when any filters active): `text-xs text-[#F37167] hover:underline`

The filter bar uses **removable pills** (not static chips). Each pill represents one active filter and can be dismissed individually via its `×` button. The "Add filter" button opens a dropdown flow to compose a new filter. This is distinct from static filter chips (preset toggles) — Data Grid filters are always user-composed.

### Add Filter Flow

1. Click "Add filter" → dropdown of columns (grouped by `group` from ColumnDef)
2. Select column → operator dropdown populates based on `filterType`
3. Select operator → value input appears (text field, number input, enum multi-select, date picker)
4. Confirm → filter pill appears, data re-fetches

### API Contract

- Filters passed as JSON in query param: `?filters=[{"column":"state","operator":"is","value":"TX"}]`
- Server applies all filters as AND conditions

Rules:
- Filters and search are additive (AND). Search filters across the primary name/title column.
- Filter state persists to saved views.

---

## Pagination

Server-side pagination. See `Navigation/pagination.md` for the canonical pagination control spec.

### Pagination State

```ts
type PaginationState = {
  page: number;       // 1-indexed current page
  pageSize: number;   // rows per page
  total: number;      // total matching rows (from API response)
};
```

### API Contract

- Request: `?page=1&pageSize=50`
- Response includes `total` count
- Default page size: `50`. Options: `[25, 50, 100, 200]` (Data Grid uses larger options than the standard `[10, 25, 50, 100]` in `pagination.md` because grid datasets are typically larger — 10 is too few rows, and 200 is included for power users)

### Integration

- Pagination control sits below the table footer, outside the card wrapper, separated by `mt-3`
- Page size selector lives in the pagination bar
- Changing filters, sort, or search resets to page 1

### Footer

Uses the standard footer container from `_foundations.md` (`px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]`).

- Left side: `{count} {entity}` in `text-xs font-medium text-[#A69DC0]`
- Right side: optional summary stats (e.g., `Pipeline total: $5.1M`)

Rules:
- Pagination is always server-side — never load full datasets client-side
- The grid passes `onPageChange` and `onPageSizeChange` callbacks up; the parent owns the state

---

## Selection & Bulk Actions

Checkbox-based row selection with a bulk action bar.

### Selection State

```ts
selectedIds: Set<string>          // currently selected row IDs
selectAllMatchingFilters: boolean // "select all 1,234 results" mode
```

### Checkbox Column

- Leading control column, always first: `w-12 pl-4 pr-2`
- Header checkbox: select/deselect all rows on current page
- Row checkbox: `w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30 cursor-pointer`
- Selected row highlight: `bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25`

### Select-All Escalation

When all rows on the current page are selected, show a banner above the table body:

```
All 50 rows on this page are selected. [Select all 1,234 matching results]
```

- Banner: `bg-[#C4E7E6]/20 text-xs text-[#403770] text-center py-2 border-b border-[#E2DEEC]`
- Link: `font-semibold underline cursor-pointer`
- When "select all matching" is active: `All 1,234 results selected. [Clear selection]`

### Bulk Action Bar

Appears above the table when `selectedIds.size > 0`, replacing the normal toolbar:

- Background: `bg-[#403770]` (Plum), full width, `rounded-xl`
- Text: `text-white text-sm` — `"12 selected"` on the left
- Action buttons: `text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors`
- Available actions depend on entity type (e.g., "Add to Plan", "Assign Owner", "Add Tags", "Export CSV")
- "Clear selection" link: `text-white/70 hover:text-white text-xs underline`

### Row Actions Interaction

- When any rows are selected, per-row hover actions are hidden (matching `data-table.md` spec)
- This prevents conflicting "act on one" vs "act on many" affordances

Rules:
- Selection is optional per grid — omit the checkbox column and bulk bar if the entity doesn't support bulk operations
- `selectAllMatchingFilters` sends the current filter/search state to the API, not a list of IDs
- Selection clears when entity type changes or filters change significantly

---

## Column Management

User-controlled column visibility and ordering.

### Column Picker (Toolbar Button)

- Trigger: "Columns" button with grid icon, right side of toolbar
- Style: `border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390]`
- Count badge: `text-[10px] font-bold bg-[#403770] text-white rounded-full px-1.5 ml-1`

### Column Picker Dropdown

- Container: `bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 py-2 w-72 max-h-[400px] overflow-y-auto`
- Search: `px-3 py-1.5 text-xs border-b border-[#E2DEEC]` with placeholder "Search columns..."
- Group header: `text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider px-3 pt-3 pb-1`
- Each column: checkbox + label, `px-3 py-1.5 text-sm text-[#6E6390] hover:bg-[#EFEDF5]`
- Checked style: `bg-[#403770] border-[#403770]` checkbox with white checkmark, label in `text-[#403770] font-medium`
- Unchecked: `border-[#C2BBD4]` checkbox, label in `text-[#6E6390]`
- "Reset to defaults" link: `text-xs text-[#403770] hover:underline px-3 py-2 border-t border-[#E2DEEC]`

### Column Reordering

- Drag-to-reorder column headers directly in the table
- Drop indicator: `2px solid #403770` vertical line at drop position
- Also reorderable via drag in the column picker dropdown

### Persistence

- Column visibility and order saved to `localStorage`: `explore-columns-{entity}`
- Saved views capture column state as part of the view snapshot

Rules:
- At least one column must remain visible — the picker prevents unchecking the last column
- The primary name/title column cannot be hidden — always pinned visible
- Column reorder state is separate from definition order — resetting restores definition order

---

## Saved Views

Named snapshots of grid configuration.

### Saved View Shape

```ts
type SavedView = {
  id: string;          // generated UUID
  name: string;        // user-defined label
  columns: string[];   // visible column keys in order
  filters: FilterRule[];
  sorts: SortRule[];
  pageSize: number;
};
```

### Saved Views Bar

Lives above the toolbar, horizontal row of tabs:

- Each view: `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors`
- Active view: `bg-[#403770] text-white`
- Inactive view: `text-[#6E6390] hover:bg-[#EFEDF5]`
- Dirty indicator (view modified): `w-1.5 h-1.5 rounded-full bg-[#F37167]` dot on the tab
- "Save view" button: `text-xs text-[#403770] font-medium border border-dashed border-[#C2BBD4] rounded-lg px-3 py-1.5 hover:bg-[#EFEDF5]`

### Save Flow

1. Configure grid (columns, filters, sorts) to desired state
2. Click "Save view" → inline text input appears
3. Type name, Enter to confirm → view tab appears
4. Modified views show the Coral dirty dot

### View Actions (right-click or ellipsis on tab)

- Rename, Duplicate, Delete
- Menu style: same overflow menu spec from `data-table.md`

### Persistence

- Saved per entity to `localStorage`: `explore-views-{entity}`
- Loading a view applies all its state in one action
- No "default" saved view — unmodified grid state is the default
- Maximum 10 saved views per entity
- View names must be unique within an entity
- Views are local to the browser (not synced to server — future enhancement)

---

## Inline Editing

Click-to-edit cells using the `InlineEditCell` component, integrated with TanStack cell rendering.

### Which Cells Are Editable

Determined by `editable: true` on the `ColumnDef`. The cell renderer checks this flag and wraps editable cells in `InlineEditCell`.

### Integration

```tsx
cell: ({ getValue, row }) => {
  const colDef = columnDefs.find((c) => c.key === key);
  if (colDef?.editable) {
    return (
      <InlineEditCell
        type={inferEditType(colDef)}
        value={formatForEdit(getValue(), key)}
        onSave={async (value) => handleSave(row.original.id, key, value)}
        displayFormat={inferDisplayFormat(key)}
        className="text-sm text-[#6E6390]"
      />
    );
  }
  return renderCell(getValue(), key);
}
```

### Edit Type Inference from `filterType`

| filterType | Edit type | Notes |
|---|---|---|
| `text` | `"text"` | Single-line input |
| `enum` | `"select"` | Options from `enumValues` |
| `date` | `"date"` | HTML date picker |
| `number` | `"text"` | Text input with currency/number `displayFormat` |
| `boolean`, `tags`, `relation` | Not inline-editable | Use dedicated popovers |

### Custom Editable Cells

For richer editing (owner assignment with search, tag picker with create-new, service selector):

- Self-contained component managing its own open/close state
- `useRef` + click-outside to dismiss
- Calls mutation hook directly (not through generic `onSave`)
- Display mode edit affordance: `hover:border-dashed hover:border-[#403770]/30 hover:bg-[#403770]/5`

Rules:
- `e.stopPropagation()` on editable cells — prevents triggering row click
- Editable cells are the exception, not the default. Most columns are read-only.
- Optimistic updates via TanStack Query's `onMutate` — cell shows new value immediately, reverts on error

---

## Toolbar

The control center above the grid. Composable — grids use only the controls they need.

### Layout

```tsx
<div className="flex items-center gap-3 mb-3 flex-wrap">
  {/* Left group */}
  <SearchInput />
  <FilterBar />

  {/* Right group */}
  <div className="flex items-center gap-2 ml-auto">
    <SortDropdown />
    <ColumnPicker />
    <ExportButton />
  </div>
</div>
```

Rules:
- Toolbar sits above the table card, separated by `mb-3`
- Background: transparent (inherits page background)
- Wraps on narrow widths via `flex-wrap`
- Left group: search + active filter pills
- Right group: column management, sort, export (pushed right with `ml-auto`)

### Search Input

- `flex: 1`, min-width `200px`, max-width `320px`
- Searches the primary name/title column
- Debounced 200ms, resets to page 1 on change
- See `data-table.md` for full search input spec

### Export Button (optional)

- Icon-only: download icon `w-4 h-4`
- Style: `border border-[#D4CFE2] rounded-lg p-2 text-[#6E6390] hover:bg-[#EFEDF5]`
- Exports current filtered/sorted results as CSV

### Toolbar Replacement During Selection

When `selectedIds.size > 0`, the bulk action bar replaces the toolbar. Transition: `transition-opacity duration-150`.

### Minimum Viable Toolbar

Not every Data Grid needs every control:
- **Read-only browsing:** search + sort
- **Data management:** search + sort + filters + column picker
- **Full power grid:** all controls + saved views bar above

---

## Loading, Error, and Empty States

All three states follow the existing specs from `data-table.md`.

### Loading — Initial Load

- Table card with header row intact
- Body shows 5 skeleton rows matching visible column layout
- Skeleton bars: `bg-[#E2DEEC]/60 animate-pulse rounded h-4`
- Varying widths: name ~60%, status ~30%, currency ~40%
- Footer and pagination hidden

### Loading — Refresh

- Existing rows dim: `opacity-50`
- Progress bar below header: `h-0.5 bg-[#403770]` with sliding animation
- Toolbar remains fully interactive

### Error State

- Replaces table body. Header, wrapper, toolbar stay intact.
- Same centered layout from `data-table.md`: alert icon `w-10 h-10 text-[#F37167]`, heading in `text-sm font-semibold text-[#544A78]`, description in `text-xs text-[#8A80A8]`, retry button
- Retry re-fetches with current filter/sort/pagination state

### Empty State — No Results (Filters Active)

Distinct from "no data" — means filters are too narrow:

- Icon: funnel/filter icon `w-10 h-10 text-[#A69DC0]`
- Heading: `"No matching results"` in `text-sm font-semibold text-[#544A78]`
- Description: `"Try adjusting your filters or search term"` in `text-xs text-[#8A80A8]`
- Action: `"Clear all filters"` button — `text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg px-3 py-1.5`

### Empty State — No Data Exists

Entity has zero records:

- Icon: entity-relevant icon `w-10 h-10 text-[#A69DC0]`
- Heading: `"No {entity} yet"` in `text-sm font-semibold text-[#544A78]`
- Description: contextual guidance on creating the first record
- Optional CTA: `bg-[#403770] text-white rounded-lg px-4 py-2 text-sm font-medium`

Rules:
- Always distinguish "no results" from "no data" — different icons, copy, and actions
- Never show a spinner replacing the whole grid — always preserve header and wrapper

---

## Accessibility

### Keyboard Navigation

- `Tab` moves focus through toolbar controls, then into the table
- `Arrow keys` move focus between cells when the table has focus
- `Space` toggles checkboxes (row selection, column picker items)
- `Enter` activates sort on a focused column header, opens inline edit on an editable cell
- `Escape` cancels inline edit, closes dropdowns/popovers — focus returns to the cell/control that was activated

### ARIA

- Table uses `role="grid"` with `aria-rowcount` and `aria-colcount` reflecting total (not just visible) rows/columns
- Sortable column headers: `aria-sort="ascending"` / `"descending"` / `"none"`
- Checkbox column header: `aria-label="Select all rows on this page"`
- Bulk action bar: `role="toolbar"` with `aria-label="Bulk actions for {n} selected items"`
- Filter pills: each pill is a button with `aria-label="{column} {operator} {value}, remove filter"`
- Empty/error states: `role="status"` so screen readers announce the change
- Footer count and bulk selection count: `aria-live="polite"` so dynamic updates are announced without interrupting

### Color Contrast

All text/background pairings meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text). The plum-derived palette was designed with this constraint — see `tokens.md` for validated pairings. Interactive states (hover, focus) use visible outlines or background shifts, never color alone.

---

## Assembly Example

Full assembly showing how all feature blocks combine.

### Props Interface

```tsx
interface DataGridProps {
  // Data
  data: Record<string, unknown>[];
  columnDefs: ColumnDef[];       // full column definitions for picker, filtering, edit inference
  entityType: string;
  isLoading: boolean;
  // Columns
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void; // handles both reorder and visibility toggle
  // Sorting
  sorts: SortRule[];
  onSort: (column: string) => void;
  // Filtering
  filters: FilterRule[];
  onAddFilter: (filter: FilterRule) => void;
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
  // Search (optional)
  searchTerm?: string;
  onSearch?: (term: string) => void;
  // Pagination
  pagination: { page: number; pageSize: number; total: number };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  // Selection (optional)
  selectedIds?: Set<string>;
  selectAllMatchingFilters?: boolean;
  onToggleSelect?: (id: string) => void;
  onSelectPage?: (ids: string[]) => void;
  onSelectAllMatching?: () => void;
  onClearSelection?: () => void;
  // Row interaction
  onRowClick?: (row: Record<string, unknown>) => void;
}
```

### Render Structure

```
SavedViewsBar
Toolbar (or BulkActionBar when selected)
┌─ Table Card Wrapper ──────────────────────┐
│  <thead> with sort indicators             │
│  Select-all escalation banner (if needed) │
│  <tbody> with cell rendering + editing    │
│  Footer (count + summary stats)           │
└───────────────────────────────────────────┘
Pagination
```

### Parent Layout Contract

The DataGrid uses `flex-1 min-h-0` to fill available height. For the horizontal scrollbar to stay visible at the bottom of the viewport (instead of being buried below all rows), the parent must provide a height-constrained flex container:

```tsx
{/* Page root — fixed viewport height */}
<div className="flex flex-col h-[calc(100vh-64px)]">
  {/* Header, toolbar, etc. — shrink-0 */}
  <div className="shrink-0">...</div>

  {/* DataGrid wrapper — flex-1 passes remaining height down */}
  <div className="flex-1 min-h-0 flex flex-col">
    <DataGrid ... />
  </div>
</div>
```

The chain must be unbroken: page (fixed height, flex-col) → wrapper (`flex-1 min-h-0 flex flex-col`) → DataGrid outer (`flex-1 min-h-0`) → card (`flex-1 min-h-0 flex flex-col`) → scroll area (`flex-1 min-h-0 overflow-auto`). If any ancestor uses `overflow-auto` instead of `flex flex-col`, the DataGrid card will grow to content height and the horizontal scrollbar will be buried.

### Key Architectural Rules

- **Data Grid is a presentational component.** It receives data, state, and callbacks. It does not own API calls or global store access.
- **The parent component owns the state** — wires up the API hook, manages filters/sorts/pagination in the store, passes everything down.
- **One grid component, many entity types.** The same `DataGrid` renders districts, activities, tasks, contacts, and plans. Entity-specific behavior comes from the `ColumnDef` files and cell renderers.
- **Features are additive.** Omit props to disable features — no `selectedIds` means no checkbox column, no `filters` means no filter bar.

---

## File Reference

| Component | File |
|---|---|
| DataGrid (shared) | `src/features/shared/components/DataGrid/DataGrid.tsx` |
| DataGrid types | `src/features/shared/components/DataGrid/types.ts` |
| renderCell utility | `src/features/shared/components/DataGrid/renderCell.tsx` |
| SelectAllBanner | `src/features/shared/components/DataGrid/SelectAllBanner.tsx` |
| ExploreOverlay (state owner) | `src/features/map/components/explore/ExploreOverlay.tsx` |
| Entity cell renderers | `src/features/map/components/explore/cellRenderers.tsx` |
| District column definitions | `src/features/map/components/explore/columns/districtColumns.ts` |
| Activity column definitions | `src/features/map/components/explore/columns/activityColumns.ts` |
| Task column definitions | `src/features/map/components/explore/columns/taskColumns.ts` |
| Contact column definitions | `src/features/map/components/explore/columns/contactColumns.ts` |
| Plan column definitions | `src/features/map/components/explore/columns/planColumns.ts` |
| InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
| Design reference | Paper → Components → Tables artboard (Data Grid sections) |
