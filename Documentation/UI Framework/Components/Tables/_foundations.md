# Table Component Foundations

Standard styling for all data tables in the territory planner. Four table types cover
every use case. All patterns use the Fullmind design token system (`tokens.md`).

For pagination controls, see `Navigation/pagination.md` (canonical source).

## Visual Reference — Paper Design System

File: "Mapomatic Design System" → Page: "Components" → Artboard: "Tables" (ID: `1CS-0`)

Use `mcp__paper__get_screenshot(nodeId: "1CS-0")` for a visual overview, or `mcp__paper__get_children(nodeId: "1CS-0")` to browse individual sections.

## Choosing a Table Type

| Question | Tier |
|---|---|
| Showing key-value attributes of a single record? | **Detail Table** |
| Small related dataset inside a card, panel, or expanded row? | **Compact Table** |
| Browsable list with sort + basic actions, <8 columns? | **Data Table** |
| Needs column management, multi-sort, filters, saved views, bulk selection, or 8+ columns? | **Data Grid** |

Rule of thumb: if you're unsure between Data Table and Data Grid, **start with Data Grid** — it's easier to disable features than to retrofit them later.

## Standard Foundation: TanStack React Table

All new tables should use `useReactTable` from `@tanstack/react-table` with `getCoreRowModel`. Simpler tiers just use fewer features from the same foundation. This ensures any table can grow features without a rewrite.

The shared `ColumnDef` interface (see `data-grid.md`) is the canonical column definition format for all tiers. New Data Tables should define columns using this interface so they can be upgraded to Data Grids without restructuring. Existing tables will be migrated incrementally.

## Table Types

### Data Grid

Browse, sort, filter, and manage large datasets with full column control. The power table.

**Use when:** Displaying a collection of entities that needs column management, multi-sort, composable filters, saved views, bulk selection, or has 8+ columns of varied data.

**Features:** Everything in Data Table, plus: column picker, column reordering, multi-sort, composable filter bar, saved views, select-all escalation, bulk action bar, server-side pagination, export.

**See:** `data-grid.md` for the full spec.

**Examples in codebase:** ExploreTable.

### Data Table

Browse, sort, filter, and act on a collection of records. The workhorse table.

**Use when:** Displaying a list of entities the user needs to search, sort, filter, select, or take action on, with a manageable number of columns.

**Features:** Toolbar (search, filters, sort), column sorting indicators, pagination, checkbox selection, row actions with overflow, expanding rows, inline editing, loading state, error state, empty state, truncation.

**Examples in codebase:** ContactsTable, DistrictsTable.

### Detail Table

Display structured attributes of a single entity. Key-value pairs.

**Use when:** Showing properties of one record — a profile panel, settings view, or plan summary.

**Features:** Two-column key-value layout, optional inline editing, read-only variant. No toolbar, no pagination, no selection.

### Compact/Inline Table

Small table embedded within a larger context — a card, panel, or expanded row.

**Use when:** Showing a small related dataset inside another component. Nested sub-tables, recent activity lists, child records.

**Features:** Minimal chrome (no outer card wrapper when inside a parent), dense spacing, no toolbar, no selection.

**Examples in codebase:** ActivitiesTable, schools-within-district expansion.

---

## Shared Foundations

### Wrapper

Every data table uses the same outer container:

```tsx
<div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm">
  <div className="overflow-x-auto">
    <table className="min-w-full">
      ...
    </table>
  </div>
  {/* Footer */}
  <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
    ...
  </div>
</div>
```

Key classes:
- `border border-[#D4CFE2] rounded-lg` — plum-derived border with rounded corners
- `bg-white shadow-sm` — white background with light elevation
- `overflow-hidden` + `overflow-x-auto` — horizontal scroll on narrow screens

### Cell Text Sizing

4-tier table for all cell content. `text-[11px]` is the one blessed exception — used only for table column headers where 10px (Micro) is too small and 12px (Caption) is slightly too large.

| Content type | Class | Token reference |
|---|---|---|
| Primary name/title | `text-sm font-medium text-[#403770]` | Body tier, Primary text |
| Standard data | `text-sm text-[#6E6390]` | Body tier, Body text |
| Secondary/muted | `text-xs text-[#8A80A8]` | Caption tier, Secondary text |
| Empty placeholder | `text-xs text-[#A69DC0]` with `&mdash;` | Caption tier, Muted text |

### Cell Padding

| Context | Classes | Notes |
|---|---|---|
| Standard cells | `px-4 py-3` | Data Table default |
| Compact cells | `px-3 py-2` | Compact/Inline Table default (migrated from `px-2 py-1`) |
| Actions cells | `px-3 py-3` | Hover-reveal icon column |

### Brand Colors Reference

| Token | Value | Usage |
|---|---|---|
| Plum | `#403770` | Primary text, links, selected states |
| Coral | `#F37167` | Accents, primary badges, destructive actions |
| Steel blue | `#6EA3BE` | Links (email), secondary accents |
| Robin's egg | `#C4E7E6` | Selection highlights, light backgrounds |
| Sage | `#8AA891` | Active status badge |

---

## File Reference

| Component | File |
|---|---|
| ContactsTable | `src/features/plans/components/ContactsTable.tsx` |
| DistrictsTable | `src/features/plans/components/DistrictsTable.tsx` |
| ActivitiesTable | `src/features/plans/components/ActivitiesTable.tsx` |
| PlansTable | `src/features/plans/components/PlansTable.tsx` |
| TasksTable | `src/features/tasks/components/TasksTable.tsx` |
| ExploreTable | `src/features/map/components/explore/ExploreTable.tsx` |
| InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
