# Table Component Guide Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the table component guide from a single-pattern doc into a comprehensive 3-type reference with 8 new Data Table patterns, then build matching visual mockups in Paper.

**Architecture:** Two deliverables in sequence — first the .md documentation (tokens.md fix + tables.md rewrite), then the Paper artboard. The .md work is a complete rewrite of `tables.md` structured around Data Table / Detail Table / Compact Table types. The Paper work creates a new "Table Patterns Reference" artboard with generic placeholder data.

**Tech Stack:** Markdown (.md files), Paper MCP (design tool)

**Spec:** `Docs/plans/2026-03-11-table-guide-expansion-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `Docs/components/tokens.md` | Fix Standard Pairings table border classes |
| Rewrite | `Docs/components/tables.md` | Complete restructure: 3 table types, 8 new patterns, migration fixes |
| Create | Paper artboard "Table Patterns Reference" | Visual mockups for all patterns via Paper MCP |

---

## Chunk 1: Documentation

### Task 1: Fix tokens.md Standard Pairings

**Files:**
- Modify: `Docs/components/tokens.md` (lines 149-158)

- [ ] **Step 1: Update Standard Pairings border classes**

In the Standard Pairings table, replace generic Tailwind border classes with plum-derived tokens:

| Before | After |
|--------|-------|
| `border border-gray-200` (Card) | `border border-[#D4CFE2]` |
| `border border-gray-200/60` (Popover) | `border border-[#D4CFE2]/60` |
| `border border-gray-300` (Input) | `border border-[#C2BBD4]` |
| `border border-gray-200` (Pill/Chip) | `border border-[#D4CFE2]` |

- [ ] **Step 2: Verify no other `gray-200` or `gray-300` border references remain in tokens.md**

Search `tokens.md` for any remaining `gray-` border references. The only gray classes should be in the `## Colors` section if they're intentionally documenting Tailwind mappings — but the Standard Pairings table is prescriptive and must use plum tokens.

- [ ] **Step 3: Commit**

```bash
git add Docs/components/tokens.md
git commit -m "fix: update tokens.md Standard Pairings to use plum-derived border tokens"
```

---

### Task 2: Rewrite tables.md — Introduction + Table Type Model + Shared Foundations

**Files:**
- Rewrite: `Docs/components/tables.md`

This task replaces the entire file. Write sections 1-2 of the new structure.

- [ ] **Step 1: Write file header and Table Type Model**

Replace the entire file starting with:

```markdown
# Table Component Guide

Standard styling for all data tables in the territory planner. Three table types cover every use case. All patterns use the Fullmind design token system (`tokens.md`).

## Table Types

### Data Table
Browse, sort, filter, and act on a collection of records. The workhorse table.

**Use when:** Displaying a list of entities the user needs to search, sort, filter, select, or take action on.

**Features:** Toolbar (search, filters, sort), column sorting indicators, pagination, checkbox selection, row actions with overflow, expanding rows, inline editing, loading state, error state, empty state, truncation.

### Detail Table
Display structured attributes of a single entity. Key-value pairs.

**Use when:** Showing properties of one record — a profile panel, settings view, or plan summary.

**Features:** Two-column key-value layout, optional inline editing, read-only variant. No toolbar, no pagination, no selection.

### Compact/Inline Table
Small table embedded within a larger context — a card, panel, or expanded row.

**Use when:** Showing a small related dataset inside another component. Nested sub-tables, recent activity lists, child records.

**Features:** Minimal chrome (no outer card wrapper when inside a parent), dense spacing, no toolbar, no selection.

**Examples in codebase:** ActivitiesTable, schools-within-district expansion.
```

Note: Also include `**Examples in codebase:** ContactsTable, DistrictsTable.` under Data Table and no examples line under Detail Table (none exist yet).

- [ ] **Step 2: Write Shared Foundations section**

This section contains the existing wrapper, cell sizing, and cell padding patterns — migrated to plum-derived tokens per the spec's Migration Notes.

Key migrations to apply while writing:
- All `border-gray-*` → plum border tokens (`#D4CFE2`, `#E2DEEC`, `#C2BBD4`)
- All `text-gray-*` → plum text tokens (`#403770`, `#6E6390`, `#8A80A8`, `#A69DC0`, `#544A78`)
- All `bg-gray-*` → plum surface tokens (`#F7F5FA`, `#EFEDF5`)
- All `text-[13px]` → `text-sm` (14px) or `text-xs` (12px) per migration table in spec
- All `text-[12px]` → `text-xs` (same size, sanctioned class)
- All `rounded-md` → `rounded-lg`
- All `hover:bg-gray-*` → `hover:bg-[#EFEDF5]`

Write these subsections:
1. **Wrapper** — same outer container, migrated colors
2. **Cell Text Sizing** — 4-tier table (Primary, Standard, Secondary, Empty), all using token hex values and approved type scale
3. **Cell Padding** — Standard (`px-4 py-3`), Compact (`px-3 py-2` — migrated from old `px-2 py-1`/`px-2 py-1.5` to match spec and Compact/Inline Table type), Actions (`px-3 py-3`)
4. **Brand Colors Reference** — same 5-color table, already correct

- [ ] **Step 3: Verify shared foundations match spec migration table**

Read through the written Shared Foundations section and cross-check every class against the Migration Notes in the spec. No `gray-*` classes should remain. No `text-[13px]`. No `rounded-md`. No `shadow-2xl`.

---

### Task 3: Write tables.md — Data Table Existing Patterns (Migrated)

**Files:**
- Modify: `Docs/components/tables.md` (append after Shared Foundations)

- [ ] **Step 1: Write Header (`<thead>`) section**

Migrate from spec. Key changes from original:
- `bg-gray-50/80` → `bg-[#F7F5FA]`
- `border-b border-gray-200` → `border-b border-[#D4CFE2]`
- `text-gray-500` → `text-[#8A80A8]`

**Note on `text-[11px]`:** The existing header uses `text-[11px]` which is not in the 5-tier type scale. This is a blessed exception for table headers only — the 10px Micro tier is too small for column headers and the 12px Caption tier is slightly too large. Keep `text-[11px]` for table headers and document it as the one allowed exception in the Cell Text Sizing table.

- [ ] **Step 2: Write Rows (`<tbody>`) section**

Migrate from spec. Key changes:
- `border-b border-gray-100` → `border-b border-[#E2DEEC]`
- `hover:bg-gray-50/70` → `hover:bg-[#EFEDF5]`

- [ ] **Step 3: Write Actions Column section**

Migrate existing hover-reveal icons. Key changes:
- `text-gray-400` → `text-[#A69DC0]`
- `hover:text-[#403770]` stays (already correct)
- `hover:bg-gray-100` → `hover:bg-[#EFEDF5]`
- `hover:text-red-500 hover:bg-red-50` → `hover:text-[#F37167] hover:bg-[#fef1f0]`
- `rounded-md` → `rounded-lg`

- [ ] **Step 4: Write Footer section**

Migrate. Key changes:
- `bg-gray-50/60` → `bg-[#F7F5FA]`
- `border-t border-gray-100` → `border-t border-[#E2DEEC]`
- `text-gray-400` → `text-[#A69DC0]`
- `text-gray-500` → `text-[#8A80A8]`
- `text-[12px]` → `text-xs` (same visual size but uses sanctioned Tailwind class instead of arbitrary value)

- [ ] **Step 5: Write Checkbox Selection section**

Migrate. Key changes:
- `border-gray-300` → `border-[#C2BBD4]`
- Selection highlight stays: `bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25` (already correct)
- Focus ring: `focus:ring-[#403770]/30` (already correct)

- [ ] **Step 6: Write Inline Editing section**

Reference `InlineEditCell` component at correct path: `src/features/shared/components/InlineEditCell.tsx`. Update both the path mention AND the import line in code examples:
- `import InlineEditCell from "@/components/common/InlineEditCell"` → `import InlineEditCell from "@/features/shared/components/InlineEditCell"`

Migrate text color classes in code examples:
- `className="text-xs text-gray-600"` → `className="text-xs text-[#6E6390]"`
- `className="text-[13px] text-gray-600 text-right"` → `className="text-sm text-[#6E6390] text-right"`
- `className="text-xs"` stays (already valid)

- [ ] **Step 7: Write Empty State section**

Migrate. Key changes:
- `text-gray-300` → `text-[#A69DC0]`
- `text-gray-600` → `text-[#6E6390]`
- `text-gray-500` → `text-[#8A80A8]`

- [ ] **Step 8: Write Confirmation Modals section**

Migrate. Key changes:
- `shadow-2xl` → `shadow-xl`
- `text-gray-600` → `text-[#6E6390]`
- `text-gray-700` → `text-[#544A78]`
- `bg-red-500 hover:bg-red-600` → `bg-[#F37167] hover:bg-[#F37167]/90`

- [ ] **Step 9: Commit**

```bash
git add Docs/components/tables.md
git commit -m "docs: rewrite tables.md with table type model, shared foundations, and migrated existing patterns"
```

---

### Task 4: Write tables.md — New Data Table Patterns (Part 1: Toolbar, Sorting, Pagination)

**Files:**
- Modify: `Docs/components/tables.md` (append after existing patterns)

- [ ] **Step 1: Write Toolbar section**

Three subsections: Search Input, Filter Chips, Sort Dropdown. Include all Tailwind classes, keyboard interaction notes, and code snippets from spec (Pattern 1). Use generic placeholder content — no dataset-specific labels.

- [ ] **Step 2: Write Sorting Indicators section**

Three states: inactive sortable, active sorted, non-sortable. Include arrow specs, sort cycling behavior, and keyboard section from spec (Pattern 2).

- [ ] **Step 3: Write Pagination section**

Layout, result summary (including filtered state behavior), page number buttons (all states), items-per-page selector, keyboard from spec (Pattern 3).

- [ ] **Step 4: Read back and verify all 3 sections match spec exactly**

Cross-reference every class name, color value, and keyboard behavior against the spec. Check no `gray-*` classes crept in.

- [ ] **Step 5: Commit**

```bash
git add Docs/components/tables.md
git commit -m "docs: add Toolbar, Sorting Indicators, and Pagination patterns to tables.md"
```

---

### Task 5: Write tables.md — New Data Table Patterns (Part 2: Actions, Loading, Error, Truncation, Expanding)

**Files:**
- Modify: `Docs/components/tables.md` (append after Part 1 patterns)

- [ ] **Step 1: Write Row Actions + Overflow section**

Covers: 2-or-fewer actions (migrated), 3+ actions with ellipsis, overflow menu popover, selection+actions interaction, keyboard. From spec Pattern 4.

- [ ] **Step 2: Write Loading State section**

Two variants: initial load (skeleton rows) and refresh (dimmed overlay with progress bar). From spec Pattern 5.

- [ ] **Step 3: Write Error State section**

Centered error with icon, heading, description, optional retry button. From spec Pattern 6.

- [ ] **Step 4: Write Truncation section**

Single-line, multi-line, never-truncate rules, column width hierarchy. From spec Pattern 7.

- [ ] **Step 5: Write Expanding Rows section**

Expand/collapse trigger, expanded row container, accordion behavior. From spec Pattern 8. **Add a Keyboard subsection** (missing from spec but required by Goal 3): `Enter`/`Space` on a focused expand chevron toggles the row expansion. `Tab` moves focus to the next expandable row's chevron.

- [ ] **Step 6: Read back and verify all 5 sections match spec**

- [ ] **Step 7: Commit**

```bash
git add Docs/components/tables.md
git commit -m "docs: add 8 new Data Table patterns to tables.md"
```

---

### Task 6: Write tables.md — Detail Table + Compact/Inline Table + File Reference

**Files:**
- Modify: `Docs/components/tables.md` (append after Data Table section)

- [ ] **Step 1: Write Detail Table section**

Layout (card, label column, value column, rows), editable variant (InlineEditCell reference), read-only variant. From spec Detail Table section.

- [ ] **Step 2: Write Compact/Inline Table section**

Embedded in card/panel rules, nested sub-table (inside expanded row) rules, keyboard note. From spec Compact/Inline Table section.

- [ ] **Step 3: Write File Reference section**

Updated paths based on actual codebase:

| Component | File |
|-----------|------|
| ContactsTable | `src/features/plans/components/ContactsTable.tsx` |
| DistrictsTable | `src/features/plans/components/DistrictsTable.tsx` |
| ActivitiesTable | `src/features/plans/components/ActivitiesTable.tsx` |
| PlansTable | `src/features/plans/components/PlansTable.tsx` |
| TasksTable | `src/features/tasks/components/TasksTable.tsx` |
| ExploreTable | `src/features/map/components/explore/ExploreTable.tsx` |
| InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |

- [ ] **Step 4: Final read-through of complete tables.md**

Read the entire file top to bottom. Check:
- All sections present per spec structure
- No `gray-*` classes anywhere
- No `text-[13px]` anywhere
- No `rounded-md` anywhere
- No `shadow-2xl` anywhere
- All color hex values match tokens.md
- File Reference paths are correct
- Generic language throughout (no dataset-specific content in pattern descriptions)

- [ ] **Step 5: Commit**

```bash
git add Docs/components/tables.md
git commit -m "docs: add Detail Table, Compact/Inline Table, and updated File Reference"
```

---

## Chunk 2: Paper Artboard

All Paper tasks use the Paper MCP tools. Generic placeholder data throughout — use neutral column names like "Name," "Category," "Status," "Value," "Date," "Owner."

**Important:** Do NOT modify the existing "Table Component Guide" artboard (id `XP-0`). It stays as a concrete implementation example per spec Deliverable 4.

**Annotation style for all sections:** Each pattern section gets a label in `10px uppercase tracking-wider #8A80A8`, plus a dot + label legend below to identify states (e.g., "hover state," "active," "disabled"). Match the legend style from the existing Table Component Guide artboard.

### Task 7: Paper — Create Artboard + Data Table Full Example

**Tools:** `create_artboard`, `write_html`, `get_screenshot`

- [ ] **Step 1: Create artboard "Table Patterns Reference"**

Size: 1440 x 2800px. Background: `#FFFCFA` (Off-white). Padding: `48px 64px`. Font: Plus Jakarta Sans.

- [ ] **Step 2: Write page header**

Title: "Table Patterns Reference" with plum accent bar. Subtitle: "Generic patterns for Data Tables, Detail Tables, and Compact Tables."

- [ ] **Step 3: Write section label "DATA TABLE — FULL EXAMPLE"**

Use annotation style: `10px uppercase tracking-wider #8A80A8`.

- [ ] **Step 4: Write toolbar**

Search input (with search icon), 3 filter chips (one active "Active" in plum, two inactive "Pending" and "Archived"), sort dropdown trigger "Sort by: Name."

- [ ] **Step 5: Write Data Table header row**

5 generic columns: Name, Category, Status, Value, Owner. Plus checkbox and actions columns.

- [ ] **Step 6: Write 3 data rows**

Row 1: standard row. Row 2: hover state (bg `#EFEDF5`, actions revealed). Row 3: selected state (Robin's Egg tint, checked checkbox). Use generic placeholder data.

- [ ] **Step 7: Write table footer**

Count: "3 items". Right side: "Total value: $XX,XXX".

- [ ] **Step 8: Write pagination below table**

"Showing 1-25 of 142" on left. Page buttons (1 active, 2-5 inactive, ellipsis, 12) on right. Include "25 per page" selector.

- [ ] **Step 9: Screenshot and review checkpoint**

Check: spacing, typography, contrast, alignment, clipping, repetition. Fix any issues.

---

### Task 8: Paper — Toolbar Detail + Sorting Indicators + Pagination Detail

**Tools:** `write_html`, `get_screenshot`

- [ ] **Step 1: Write section label "TOOLBAR DETAIL"**

- [ ] **Step 2: Write zoomed toolbar**

Larger scale showing: search input with focus ring, filter chips (inactive + active + one with count badge), sort dropdown in open state showing menu with checkmark on active sort and ascending/descending arrows.

- [ ] **Step 3: Write section label "SORTING INDICATORS"**

- [ ] **Step 4: Write 3 column headers side by side**

"Inactive" — header text in `#8A80A8`, faint arrow hint. "Ascending" — header text in `#403770`, solid up arrow. "Descending" — header text in `#403770`, solid down arrow.

- [ ] **Step 5: Write section label "PAGINATION DETAIL"**

- [ ] **Step 6: Write zoomed pagination**

Show all states: result summary text, active page (plum bg), inactive pages, disabled prev button (muted), ellipsis, items-per-page selector.

- [ ] **Step 7: Screenshot and review checkpoint**

---

### Task 9: Paper — Actions Overflow + Loading State + Error State

**Tools:** `write_html`, `get_screenshot`

- [ ] **Step 1: Write section label "ACTIONS OVERFLOW"**

- [ ] **Step 2: Write a row with 3+ actions**

Show: edit icon + archive icon + ellipsis button. Ellipsis menu open as popover beneath, showing "Duplicate" + "Export" items and a separator before red "Delete" item.

- [ ] **Step 3: Write section label "LOADING STATE"**

- [ ] **Step 4: Write side-by-side loading variants**

Left: "Initial Load" — table header + 4 skeleton rows with `#E2DEEC` pulse bars at varying widths. Right: "Refresh" — table with dimmed (`opacity-50`) data rows and a thin plum progress bar beneath the header.

- [ ] **Step 5: Write section label "ERROR STATE"**

- [ ] **Step 6: Write error state**

Table header intact. Body replaced with centered alert icon (`#F37167`), heading "Unable to load data", description text, and "Retry" button.

- [ ] **Step 7: Screenshot and review checkpoint**

---

### Task 10: Paper — Truncation + Expanding Row + Detail Table + Compact Table

**Tools:** `write_html`, `get_screenshot`

- [ ] **Step 1: Write section label "TRUNCATION"**

- [ ] **Step 2: Write 3 cells side by side**

"Single-line" — long text with ellipsis. "Multi-line (2 lines)" — text clamped at 2 lines. "No truncation" — name column at full width.

- [ ] **Step 3: Write section label "EXPANDING ROW"**

- [ ] **Step 4: Write parent row + expanded area with nested sub-table**

Parent row with chevron rotated down. Expanded container with `#F7F5FA` bg, plum left accent border, and a compact nested table (smaller headers, tighter padding) showing 2-3 child rows.

- [ ] **Step 5: Write section label "DETAIL TABLE"**

- [ ] **Step 6: Write two Detail Table variants side by side**

Left: "Read-Only" — 4 key-value rows (Label: Value). Right: "Editable" — same 4 rows but values show the InlineEditCell hover hint (subtle underline or cursor indicator on one row).

- [ ] **Step 7: Write section label "COMPACT / INLINE TABLE"**

- [ ] **Step 8: Write a compact table embedded in a card**

A card wrapper with a title, then a small 3-column table inside using `text-xs` sizing, `px-3 py-2` padding, `text-[10px]` headers.

- [ ] **Step 9: Screenshot and review checkpoint**

- [ ] **Step 10: Call `finish_working_on_nodes` to release the artboard**

---

### Task 11: Final Commit

- [ ] **Step 1: Review all changes**

```bash
git status
git diff --stat
```

Verify only these files changed:
- `Docs/components/tokens.md`
- `Docs/components/tables.md`

- [ ] **Step 2: Commit if any uncommitted documentation changes remain**

```bash
git add Docs/components/tokens.md Docs/components/tables.md
git commit -m "docs: complete table component guide expansion with 3 table types and 8 new patterns"
```
