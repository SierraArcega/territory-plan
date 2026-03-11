# Table Component Guide Expansion — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**Scope:** Expand the table component guide (`Docs/components/tables.md`) and Paper reference page to close gaps identified against Elastic UI's table documentation.

---

## Problem

The current table guide documents styling for a single table pattern (data rows, hover actions, selection, footer). It lacks guidance for common table behaviors (sorting, pagination, search/filtering, loading, error states) and doesn't distinguish between different table types. Teams building new tables have to invent patterns ad-hoc.

## Goals

1. Restructure the guide around **3 table types** with clear use cases
2. Add **8 missing patterns** to the Data Table type
3. Document **keyboard interaction** for all interactive elements
4. Keep guidance **generic** — not tied to any specific dataset or feature
5. Update the **Paper reference page** with visual mockups for every new pattern
6. Use the **Fullmind design token system** (`Docs/components/tokens.md`) throughout

## Non-Goals

- Implementing these patterns in code (that's a separate task)
- Accessibility audit beyond keyboard interaction (separate skill exists for WCAG compliance)
- Responsive/mobile table behavior (future expansion)
- Column visibility toggles

---

## Table Type Model

### 1. Data Table

Browse, sort, filter, and act on a collection of records. The workhorse table.

**Use when:** Displaying a list of entities the user needs to search, sort, filter, select, or take action on.

**Features:** Toolbar (search, filters, sort), column sorting indicators, pagination, checkbox selection, row actions with overflow, expanding rows, inline editing, loading state, error state, empty state, truncation.

**Examples in codebase:** ContactsTable, DistrictsTable.

### 2. Detail Table

Display structured attributes of a single entity. Key-value pairs.

**Use when:** Showing properties of one record — a profile panel, settings view, or plan summary.

**Features:** Two-column key-value layout, optional inline editing, read-only variant. No toolbar, no pagination, no selection.

### 3. Compact/Inline Table

Small table embedded within a larger context — a card, panel, or expanded row.

**Use when:** Showing a small related dataset inside another component. Nested sub-tables, recent activity lists, child records.

**Features:** Minimal chrome (no outer card wrapper when inside a parent), dense spacing, no toolbar, no selection. Supports nested sub-table pattern.

**Examples in codebase:** ActivitiesTable, schools-within-district expansion.

---

## New Patterns (Data Table)

### Pattern 1: Toolbar

Sits directly above the table card wrapper. Horizontal bar with three elements. Background transparent (inherits page bg). Bottom spacing `mb-3` separates it from the table.

#### Search Input

- Left-aligned, takes available width (`flex: 1`)
- Border: `border border-[#C2BBD4] rounded-lg`
- Search icon inside left edge: `w-4 h-4 text-[#A69DC0]`
- Input text: `text-sm text-[#6E6390]` (Plus Jakarta Sans)
- Placeholder: `text-[#A69DC0]` — generic "Search..."
- Focus: `border-[#403770] ring-2 ring-[#403770]/30`
- Padding: `pl-10 pr-4 py-2` (left padding accounts for icon)

**Keyboard:**
- Autofocus optional (configurable)
- `Escape` clears input
- Results filter as-you-type (debounced ~200ms)

#### Filter Chips

- Horizontal row of pill-shaped toggles, right of search or below on narrow widths
- Gap: `gap-2`
- Inactive: `border border-[#D4CFE2] text-[#8A80A8] bg-white rounded-full px-3 py-1 text-xs font-medium`
- Active: `bg-[#403770] text-white border-transparent rounded-full px-3 py-1 text-xs font-medium`
- Optional count badge inside chip: `text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1`
- Multiple chips can be active simultaneously
- Clicking toggles active state

**Keyboard:**
- Arrow keys navigate between chips
- `Space` / `Enter` toggles active state
- `Tab` moves to next toolbar element

#### Sort Dropdown

- Far right of toolbar
- Trigger button: `border border-[#D4CFE2] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390]`
- Shows "Sort by: [Field]" with chevron icon (`w-3 h-3`)
- Dropdown menu: `bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1`
- Menu items: `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]`
- Active sort shows checkmark icon in Plum
- Each field option can toggle ascending/descending (arrow indicator)

**Keyboard:**
- `Enter` / `Space` opens dropdown
- Arrow keys navigate options
- `Enter` selects option
- `Escape` closes, returns focus to trigger

---

### Pattern 2: Sorting Indicators

Column headers gain sort affordance when sortable.

#### States

**Inactive sortable column:**
- No arrow visible by default
- On hover: faint arrow appears in `#A69DC0` at 50% opacity
- Cursor: `pointer`
- Header text stays default `text-[#8A80A8]`

**Active sorted column:**
- Arrow solid in Plum `#403770`
- Points up for ascending, down for descending
- Header text shifts to `#403770` (reinforces active column)

**Non-sortable column:**
- No arrow, no hover change, default cursor

#### Arrow Specs

- Size: `w-3 h-3`
- Position: right of header text, `gap-1`
- Sits within the existing `text-[11px] uppercase tracking-wider` header style

#### Sort Cycling

Click cycles: ascending -> descending -> neutral (unsorted). Three-state cycle matches common convention.

**Keyboard:**
- Sortable column headers are focusable via `Tab`
- `Enter` / `Space` advances through the sort cycle
- Sort state is announced via `aria-sort` attribute on the `<th>`

---

### Pattern 3: Pagination

Lives below the table footer, outside the table card. Separated by `mt-3`.

#### Layout

Flex row, `justify-between`. Full width matching table card.

**Left side — result summary:**
- Text: "Showing 1-25 of 142"
- When filters are active, the total reflects the filtered count. Optionally show the unfiltered total: "Showing 1-25 of 42 (142 total)"
- Style: `text-xs text-[#8A80A8]`

**Right side — controls:**
- Items-per-page selector (optional) + page number buttons

#### Page Number Buttons

- Container: `flex items-center gap-1`
- Previous/Next arrows: `w-8 h-8 rounded-lg` with chevron icon `w-4 h-4`
- Page numbers: `w-8 h-8 rounded-lg text-sm font-medium`
- Inactive: `text-[#6E6390] hover:bg-[#EFEDF5]`
- Active: `bg-[#403770] text-white`
- Disabled (prev on page 1, next on last): `text-[#A69DC0] cursor-not-allowed opacity-50`
- Ellipsis: `text-[#A69DC0]` shown when page count > 7, collapsing middle pages

#### Items Per Page Selector

- Small select button: "25 per page" with chevron
- Style: `border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390]`
- Dropdown options: 10, 25, 50, 100
- Position: right-aligned, before page number buttons, `mr-4`

**Keyboard:**
- Arrow keys move between page buttons
- `Enter` selects page
- `Tab` moves between per-page selector and page controls

---

### Pattern 4: Row Actions + Overflow

Expands the existing 2-icon hover pattern.

#### 2 or Fewer Actions

Current pattern unchanged:
- Icons appear on hover: `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- Icon size: `w-3.5 h-3.5`
- Edit: `text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5]`
- Delete: `text-[#A69DC0] hover:text-[#F37167] hover:bg-[#fef1f0]`

#### 3+ Actions

- First 2 "primary" actions remain as visible icons on hover
- Third position: ellipsis button (vertical dots icon, same `w-3.5 h-3.5`)
- Ellipsis button: `p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5]`

#### Overflow Menu

- Popover: `bg-white rounded-xl shadow-lg border border-[#D4CFE2] py-1`
- Menu items: icon (`w-4 h-4`) + text label
- Item style: `px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5]`
- Destructive items: `text-[#F37167] hover:bg-[#fef1f0]`
- Separator between standard and destructive items: `border-t border-[#E2DEEC] my-1`

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

---

### Pattern 5: Loading State

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

---

### Pattern 6: Error State

Replaces table body content. Header and wrapper stay intact.

#### Layout

- Centered within table body area: `py-10 flex flex-col items-center`
- Alert icon: `w-10 h-10 text-[#F37167]` (triangle or circle-x)
- Heading: `text-sm font-semibold text-[#544A78] mt-3` — e.g. "Unable to load data"
- Description: `text-xs text-[#8A80A8] mt-1 text-center max-w-xs` — contextual message
- Retry button (optional): `text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] px-3 py-1.5 rounded-lg border border-[#D4CFE2] mt-4`

Footer is hidden during error state.

---

### Pattern 7: Truncation

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

---

### Pattern 8: Expanding Rows

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

Only one row expanded at a time. Expanding a new row collapses the previously expanded one. Prevents page from becoming overwhelmingly tall.

---

## Detail Table

### Layout

Two-column key-value pairs within a card wrapper.

**Card:** `bg-white border border-[#D4CFE2] rounded-lg shadow-sm`

**Optional section title:** `text-sm font-semibold text-[#403770] mb-3` — sits above the card

**Label column (left):**
- Fixed width: `w-[140px]` or `w-36`
- Style: `text-xs font-medium text-[#8A80A8] uppercase tracking-wider`

**Value column (right):**
- Style: `text-sm text-[#6E6390]`
- Takes remaining width

**Rows:**
- Separated by `border-b border-[#E2DEEC]` (last row omits border)
- Padding: `py-3 px-4`

### Editable Variant

Value side uses InlineEditCell component. Same click-to-edit, green flash on save patterns as Data Table.

### Read-Only Variant

No hover effects, no edit affordance. Clean label-value pairs.

No header row, no footer, no toolbar, no pagination, no selection.

---

## Compact/Inline Table

### When Embedded in a Card or Panel

- No outer card wrapper (already inside one)
- Smaller text: `text-xs` for data, `text-[10px] uppercase tracking-wider` for headers
- Tighter padding: `px-3 py-2` cells
- Row dividers: `border-b border-[#E2DEEC]`
- No hover highlight on rows
- No selection checkboxes
- No row actions (actions belong to parent context)

### Nested Sub-Table (Inside Expanded Row)

When used inside an expanding row's container:
- Inherits the `bg-[#F7F5FA]` background from the expanded container
- Header differentiates from parent table via smaller `text-[10px]` size
- No additional card wrapper or shadow
- Compact footer optional: same `text-[10px] text-[#A69DC0]` with count only

### Keyboard

No special keyboard interactions beyond standard tab-through of any links or buttons within cells.

---

## Paper Artboard Plan

Create a new Paper artboard **"Table Patterns Reference"** (1440 x ~2800px, auto-height) on the existing Tokens page. Uses generic placeholder data throughout.

### Sections to Mock Up

1. **Data Table — Full Example** — generic 5-column table with toolbar above, pagination below
2. **Toolbar Detail** — zoomed view showing search, filter chips (inactive + active), sort dropdown (open state)
3. **Sorting Indicators** — 3 column headers side by side: inactive, ascending, descending
4. **Pagination Detail** — showing result summary, page buttons (active + inactive + disabled + ellipsis), items-per-page selector
5. **Actions Overflow** — row with 3+ actions showing ellipsis button and open popover menu
6. **Loading State** — side-by-side: skeleton rows (initial) and dimmed overlay (refresh)
7. **Error State** — centered error with icon, message, retry button
8. **Truncation** — cells showing single-line ellipsis, multi-line clamp, and non-truncated name
9. **Expanding Row** — parent row with expanded child containing nested sub-table
10. **Detail Table** — key-value layout, editable and read-only variants side by side
11. **Compact/Inline Table** — small table embedded in a card context

### Annotation Style

Each pattern gets:
- Small label in `text-[10px] uppercase tracking-wider text-[#8A80A8]` identifying the pattern name
- Dot + label legend for states (matching the style from the existing Table Component Guide artboard)

---

## Migration Notes

When restructuring the existing `tables.md`, the following inconsistencies with the token system (`tokens.md`) must be resolved:

### Color Token Migration

The existing guide uses generic Tailwind gray classes that should be replaced with plum-derived tokens:

| Existing Class | Replace With | Reason |
|---|---|---|
| `text-gray-400` (action icons) | `text-[#A69DC0]` (Muted) | Plum-derived neutral per token system |
| `text-gray-500` (headers) | `text-[#8A80A8]` (Secondary) | Plum-derived neutral per token system |
| `text-gray-600` (data cells) | `text-[#6E6390]` (Body) | Plum-derived neutral per token system |
| `hover:text-red-500` / `hover:bg-red-50` (delete) | `hover:text-[#F37167]` / `hover:bg-[#fef1f0]` | Coral semantic error token |
| `border-gray-200` (wrapper, headers) | `border-[#D4CFE2]` (Border Default) | Plum-derived border token |
| `border-gray-100` (row dividers) | `border-[#E2DEEC]` (Border Subtle) | Plum-derived border token |
| `bg-gray-50/80` (header) | `bg-[#F7F5FA]` (Surface Raised) | Plum-derived surface token |
| `bg-gray-50/60` (footer) | `bg-[#F7F5FA]` (Surface Raised) | Same surface token, consistent |
| `hover:bg-gray-50/70` (row hover) | `hover:bg-[#EFEDF5]` (Hover) | Plum-derived hover token |
| `hover:bg-gray-100` (action hover) | `hover:bg-[#EFEDF5]` (Hover) | Same hover token |
| `text-gray-300` (empty state icon, placeholders) | `text-[#A69DC0]` (Muted) | Plum-derived muted token |
| `text-gray-700` (modal cancel button) | `text-[#544A78]` (Strong) | Plum-derived strong text token |
| `bg-red-500 hover:bg-red-600` (destructive button) | `bg-[#F37167] hover:bg-[#F37167]/90` | Coral Strong with opacity for pressed state (no arbitrary hex) |
| `text-gray-600` (modal body text) | `text-[#6E6390]` (Body) | Plum-derived body text token |

### Border Radius Fix

The existing guide uses `rounded-md` for action icon buttons. Per `tokens.md`: "Do not use `rounded-sm` or `rounded-md` in new code." Update all action button instances to `rounded-lg`.

### Font Size Fix

The existing guide uses `text-[13px]` extensively for standard data cells and secondary text. Per `tokens.md`: "Do not introduce arbitrary sizes outside this scale." The 5-tier type scale defines 10px, 12px, 14px, 18px, 20-24px only.

Migration strategy:
- `text-[13px] text-gray-600` (standard data) → `text-sm text-[#6E6390]` (14px Body tier)
- `text-[13px] text-gray-400` (secondary) → `text-xs text-[#8A80A8]` (12px Caption tier)
- `text-[13px] text-gray-300` (empty placeholder) → `text-xs text-[#A69DC0]` (12px Muted)
- `text-[12px] text-gray-300` (ultra-muted) → `text-xs text-[#A69DC0]`

### Shadow Fix

The existing Confirmation Modal section uses `shadow-2xl`. Per `tokens.md`: "Do not use `shadow-md` or `shadow-2xl` in new code." Update to `shadow-xl` (High elevation tier for modals).

### File Reference Path Updates

The existing `tables.md` File Reference lists paths under `src/components/plans/` and `src/components/common/`. Verify these are still accurate during implementation and update if components have moved (e.g. to `src/features/plans/components/` or `src/features/shared/components/`).

### Companion Fix: tokens.md Standard Pairings

Note: `tokens.md` itself has an inconsistency — the Standard Pairings table (Card, Popover rows) uses `border-gray-200` and `border-gray-200/60` while its own Border Color Tiers section defines `#D4CFE2` as the correct card-edge border. This should be fixed as a companion update when the table guide is restructured.

---

## Deliverables

1. **Prerequisite: fix `Docs/components/tokens.md`** — update Standard Pairings table to use plum-derived border tokens (`border-[#D4CFE2]` and `border-[#D4CFE2]/60` instead of `border-gray-200`). Must land before or simultaneously with the tables.md restructure to avoid conflicting guidance.
2. **Updated `Docs/components/tables.md`** — restructured with 3 table types, 8 new Data Table patterns, Detail Table section, Compact/Inline Table section, all migration fixes applied
3. **New Paper artboard** — "Table Patterns Reference" with visual mockups for all patterns using generic data
4. **Existing Paper artboard unchanged** — "Table Component Guide" stays as a concrete implementation example

---

## Open Questions

None — all decisions resolved during brainstorming.

## References

- [Elastic UI Basic Tables](https://eui.elastic.co/next/docs/tabular-content/tables/basic/)
- [Elastic UI In-Memory Tables](https://eui.elastic.co/docs/components/tables/in-memory/)
- [Elastic UI Custom Tables](https://eui.elastic.co/docs/components/tables/custom/)
- Current guide: `Docs/components/tables.md`
- Design tokens: `Docs/components/tokens.md`
