# Data Table

Browse, sort, filter, and act on a collection of records. The workhorse table.

See `_foundations.md` for shared wrapper, cell text sizing, and cell padding specs.

---

### Header (`<thead>`)

```tsx
<thead>
  <tr className="border-b border-[#D4CFE2] bg-[#F7F5FA]">
    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider">
      Column Name
    </th>
    {/* Empty header for actions column */}
    <th className="w-20 px-3 py-3" />
  </tr>
</thead>
```

Rules:
- Background: `bg-[#F7F5FA]` (Surface Raised)
- Bottom border: `border-b border-[#D4CFE2]` (Border Default)
- Font: `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider`
- Padding: `px-4 py-3`
- Actions column header is empty (`w-20 px-3 py-3`, no text)
- Right-aligned numeric columns: add `text-right`

### Rows (`<tbody>`)

```tsx
<tbody>
  {items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    return (
      <tr
        key={item.id}
        className={`
          group transition-colors duration-100 hover:bg-[#EFEDF5]
          ${!isLast ? "border-b border-[#E2DEEC]" : ""}
        `}
      >
        ...
      </tr>
    );
  })}
</tbody>
```

Rules:
- **No `divide-y`** — use conditional `border-b border-[#E2DEEC]` (Border Subtle) on every row except the last
- `group` class on `<tr>` for hover-reveal actions
- Hover: `hover:bg-[#EFEDF5]` (Hover surface)
- Transition: `transition-colors duration-100`

### Actions Column (hover-reveal icons)

Actions are icon-only buttons that appear on row hover:

```tsx
<td className="px-3 py-3">
  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
    {/* Edit */}
    <button
      onClick={handleEdit}
      className="p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5] transition-colors"
      aria-label="Edit"
      title="Edit"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
    {/* Delete */}
    <button
      onClick={handleDelete}
      className="p-1.5 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors"
      aria-label="Delete"
      title="Delete"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</td>
```

Rules:
- Container: `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- Icon buttons: `p-1.5 text-[#A69DC0] rounded-lg hover:bg-[#EFEDF5] transition-colors`
- Icon size: `w-3.5 h-3.5`
- Edit hover: `hover:text-[#403770]`
- Delete hover: `hover:text-[#F37167] hover:bg-[#fef1f0]`
- Always include `aria-label` and `title` for accessibility
- **No text labels** — icons only, with tooltips

### Footer

```tsx
<div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA] flex items-center justify-between">
  <span className="text-xs font-medium text-[#A69DC0] tracking-wide">
    {count} {noun}{count !== 1 ? "s" : ""}
  </span>
  {/* Optional: summary stats on the right */}
  <div className="flex items-center gap-4">
    <span className="text-xs text-[#A69DC0]">
      Label: <span className="font-medium text-[#8A80A8]">{value}</span>
    </span>
  </div>
</div>
```

Rules:
- Background: `bg-[#F7F5FA]` (Surface Raised)
- Border: `border-t border-[#E2DEEC]` (Border Subtle)
- Text: `text-xs font-medium text-[#A69DC0] tracking-wide`
- Layout: `flex items-center justify-between`
- Right side is optional (used for totals in DistrictsTable, selection count in ContactsTable)

### Checkbox Selection

If a table needs row selection with bulk actions:

- Header: `<th className="w-12 pl-4 pr-2 py-3">` with a select-all checkbox
- Row: `<td className="pl-4 pr-2 py-3">` with per-row checkbox
- Checkbox: `className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30 cursor-pointer"`
- Selected row highlight: `bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25`

### Inline Editing

Use the `InlineEditCell` component (`src/features/shared/components/InlineEditCell.tsx`) for click-to-edit cells:

```tsx
import InlineEditCell from "@/features/shared/components/InlineEditCell";

{/* Text field */}
<InlineEditCell
  type="text"
  value={item.name}
  onSave={async (value) => handleSave(item.id, "name", value)}
  className="text-sm font-medium text-[#403770]"
/>

{/* Select field */}
<InlineEditCell
  type="select"
  value={item.status}
  onSave={async (value) => handleSave(item.id, "status", value)}
  options={STATUS_OPTIONS}
  className="text-xs text-[#6E6390]"
/>

{/* Date field */}
<InlineEditCell
  type="date"
  value={item.startDate}
  onSave={async (value) => handleSave(item.id, "startDate", value)}
  className="text-xs"
/>

{/* Currency with display formatting */}
<InlineEditCell
  type="text"
  value={item.amount != null ? String(item.amount) : null}
  onSave={async (value) => { /* parse and save */ }}
  placeholder="-"
  displayFormat={(v) => `$${parseFloat(v).toLocaleString()}`}
  className="text-sm text-[#6E6390] text-right"
/>
```

Supported types: `text`, `textarea`, `select`, `date`

Props:
- `value` — string or null
- `onSave` — async function, called on blur/enter
- `placeholder` — shown when value is null (default `"---"`)
- `className` — applied to the display wrapper
- `displayFormat` — optional `(value: string) => string` for custom display rendering
- `options` — required for `type="select"`, array of `{ value, label }`

Behavior:
- Click to enter edit mode, Escape to cancel
- Text/date: Enter to save, blur to save
- Select: auto-saves on change
- Shows a green flash on successful save

### Empty State

When a table has no rows, show a centered empty state:

```tsx
<div className="text-center py-12 bg-white rounded-lg border border-[#D4CFE2]">
  <svg className="w-16 h-16 mx-auto text-[#A69DC0] mb-4" ...>
    {/* Relevant icon */}
  </svg>
  <h3 className="text-lg font-medium text-[#6E6390] mb-2">No items yet</h3>
  <p className="text-sm text-[#8A80A8] max-w-sm mx-auto">
    Helpful description of how to add items.
  </p>
</div>
```

### Confirmation Modals

All destructive actions use a consistent confirmation dialog:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
  <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
    <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Item?</h3>
    <p className="text-[#6E6390] text-sm mb-6">
      Are you sure? This action cannot be undone.
    </p>
    <div className="flex justify-end gap-3">
      <button className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#F37167]/90 rounded-lg transition-colors disabled:opacity-50">
        Delete
      </button>
    </div>
  </div>
</div>
```

### Toolbar

Sits directly above the table card wrapper. Horizontal bar with three elements. Background transparent (inherits page bg). Bottom spacing `mb-3` separates it from the table.

#### Search Input

| Property | Value |
|---|---|
| Alignment | Left-aligned, takes available width (`flex: 1`) |
| Border | `border border-[#C2BBD4] rounded-lg` |
| Search icon | `w-4 h-4 text-[#A69DC0]` inside left edge |
| Input text | `text-sm text-[#6E6390]` (Plus Jakarta Sans) |
| Placeholder | `text-[#A69DC0]` — generic "Search..." |
| Focus | `border-[#403770] ring-2 ring-[#403770]/30` |
| Padding | `pl-10 pr-4 py-2` (left padding accounts for icon) |

**Keyboard:**
- Autofocus optional (configurable)
- `Escape` clears input
- Results filter as-you-type (debounced ~200ms)

#### Filter Chips

| Property | Value |
|---|---|
| Layout | Horizontal row of pill-shaped toggles, right of search or below on narrow widths |
| Gap | `gap-2` |
| Inactive | `border border-[#D4CFE2] text-[#8A80A8] bg-white rounded-full px-3 py-1 text-xs font-medium` |
| Active | `bg-[#403770] text-white border-transparent rounded-full px-3 py-1 text-xs font-medium` |
| Count badge | `text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1` (optional, inside chip) |

Multiple chips can be active simultaneously. Clicking toggles active state.

**Keyboard:**
- Arrow keys navigate between chips
- `Space` / `Enter` toggles active state
- `Tab` moves to next toolbar element

#### Sort Dropdown

| Property | Value |
|---|---|
| Position | Far right of toolbar |
| Trigger button | `border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390]` |
| Trigger label | "Sort by: [Field]" with chevron icon (`w-3 h-3`) |
| Dropdown menu | `bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1` |
| Menu items | `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]` |
| Active sort | Checkmark icon in Plum |
| Direction | Each field option can toggle ascending/descending (arrow indicator) |

**Keyboard:**
- `Enter` / `Space` opens dropdown
- Arrow keys navigate options
- `Enter` selects option
- `Escape` closes, returns focus to trigger

### Sorting Indicators

Column headers gain sort affordance when sortable.

#### States

| State | Arrow | Header text | Cursor |
|---|---|---|---|
| Inactive sortable | No arrow by default; on hover faint arrow in `#A69DC0` at 50% opacity | `text-[#8A80A8]` (default) | `pointer` |
| Active sorted (asc) | Solid up arrow in `#403770` | `text-[#403770]` | `pointer` |
| Active sorted (desc) | Solid down arrow in `#403770` | `text-[#403770]` | `pointer` |
| Non-sortable | No arrow, no hover change | `text-[#8A80A8]` (default) | `default` |

#### Arrow Specs

- Size: `w-3 h-3`
- Position: right of header text, `gap-1`
- Sits within the existing `text-[11px] uppercase tracking-wider` header style

#### Sort Cycling

Click cycles: ascending -> descending -> neutral (unsorted). Three-state cycle.

**Keyboard:**
- Sortable column headers are focusable via `Tab`
- `Enter` / `Space` advances through the sort cycle
- Sort state is announced via `aria-sort` attribute on the `<th>`

### Pagination

See `Navigation/pagination.md` for the canonical pagination spec.
Lives below the table footer, outside the table card. Separated by `mt-3`.

### Row Actions + Overflow

Expands the existing 2-icon hover pattern for rows with 3 or more actions.

#### 2 or Fewer Actions

Current pattern unchanged — see Actions Column above:
- Icons appear on hover: `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- Icon size: `w-3.5 h-3.5`
- Edit: `text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5]`
- Delete: `text-[#A69DC0] hover:text-[#F37167] hover:bg-[#fef1f0]`

#### 3+ Actions

- First 2 "primary" actions remain as visible icons on hover
- Third position: ellipsis button (vertical dots icon, same `w-3.5 h-3.5`)
- Ellipsis button: `p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5]`

#### Overflow Menu

| Element | Classes |
|---|---|
| Popover | `bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1` |
| Menu items | icon (`w-4 h-4`) + text label |
| Item style | `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]` |
| Destructive items | `text-[#F37167] hover:bg-[#fef1f0]` |
| Separator | `border-t border-[#E2DEEC] my-1` (between standard and destructive items) |

#### Selection + Actions Interaction

When one or more rows are selected:
- Row-level actions are hidden (not just disabled — fully hidden)
- Bulk action buttons appear in the toolbar area instead
- This prevents conflicting "act on one" vs "act on selected" interactions

**Keyboard:**
- `Enter` / `Space` opens ellipsis menu
- Arrow keys navigate menu items
- `Enter` selects item
- `Escape` closes menu, returns focus to ellipsis button

### Loading State

Two variants based on context.

#### Initial Load (No Data Yet)

- Table card renders with header row intact
- Body shows 4-5 skeleton rows matching column layout
- Skeleton bars: `bg-[#E2DEEC]/60 animate-pulse rounded h-4` (uses Border Subtle token, not Robin's Egg which is reserved for selection)
- Varying widths per column to mimic realistic data: name ~60%, status ~30%, value ~40%
- Footer is hidden during initial load

#### Refresh (Data Already Visible)

- Existing rows stay visible but dim: `opacity-50`
- Horizontal progress bar appears at top of table body, below header
- Bar: `h-0.5 bg-[#403770]` with sliding/pulse animation
- Stale data remains readable while fresh data loads — less jarring than full skeleton replacement

Both variants preserve table card wrapper and header to prevent layout shift.

### Error State

Replaces table body content. Header and wrapper stay intact.

#### Layout

| Element | Classes |
|---|---|
| Container | `py-10 flex flex-col items-center` (centered within table body area) |
| Alert icon | `w-10 h-10 text-[#F37167]` (triangle or circle-x) |
| Heading | `text-sm font-semibold text-[#544A78] mt-3` |
| Description | `text-xs text-[#8A80A8] mt-1 text-center max-w-xs` |
| Retry button | `text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] px-3 py-1.5 rounded-lg border border-[#D4CFE2] mt-4` (optional) |

Footer is hidden during error state.

### Truncation

Rules for when cell content exceeds available width.

#### Single-Line Truncation (Default)

- Applied to all standard data cells
- Classes: `overflow-hidden text-ellipsis whitespace-nowrap`
- Full value accessible via native `title` attribute on hover

#### Multi-Line Truncation

- For description/notes columns that allow wrapping
- Cap at specific line count: `line-clamp-2` or `line-clamp-3`
- Full content accessible via row expansion or tooltip

#### Never Truncate

- Primary name/title column (first data column) should generally not truncate
- Give it `flex: 1` or generous `min-width`
- If it must truncate on very narrow screens, fall back to single-line with title tooltip

#### Column Width Hierarchy

To make truncation predictable:
- **Name/title:** flexible, takes remaining space
- **Fixed-width columns** (status badges, dates, currency): explicit `width` so they never compress
- **Actions column:** always `w-20` fixed

### Expanding Rows

Row expansion reveals content beneath the parent row.

#### Expand/Collapse Trigger

- Chevron icon: `w-4 h-4` in dedicated first column or alongside row content
- Collapsed: points right
- Expanded: rotates down, `transition-transform duration-150`
- Color: `text-[#8A80A8]`, hover: `text-[#403770]`

#### Expanded Row Container

- Full-width beneath parent row
- Background: `bg-[#F7F5FA]`
- Padding: `px-8 py-4`
- Border: `border-b border-[#E2DEEC]`
- Left accent: `border-l-2 border-[#403770]` to visually anchor to parent

#### Accordion Behavior

Only one row expanded at a time. Expanding a new row collapses the previously expanded one. Prevents the page from becoming overwhelmingly tall.

**Keyboard:**
- `Enter` / `Space` on a focused expand chevron toggles the row expansion
- `Tab` navigates to the next expandable row's chevron
