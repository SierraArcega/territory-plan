# Feature Spec: Grid Data Views — Sortable / Filterable / Customizable Tables

**Date:** 2026-05-14
**Slug:** grid-data-views
**Branch:** `worktree-saved-views-sidebar`
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/`

## Source Materials

- Existing Saved Views feature: `src/features/views/` (TableView, ContactsView, OppsView, VacanciesView, NewsView, RfpsView)
- Existing filter infra: `src/lib/saved-views/{filter-tree,schema,source-fields,sql-compiler}.ts`
- Prior spec: `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-spec.md` (Phase C — view bodies)
- Brand tokens: `Documentation/UI Framework/tokens.md`
- Auto-memory: `feedback_inputs_dropdowns_over_typing` (constrained inputs over typing), `feedback_regular_commits` (small focused commits)

## Requirements

**Problem.** The plan/list table views (Districts, Contacts, Opps, Vacancies, RFPs, News) are fixed 5–6 column tables. Reps can't sort by ARR, filter to a single state, hide irrelevant columns, or surface columns they care about (FRPL rate, enrollment, owner). The current implementation is a presentational table, not a data grid.

**Solution.** Replace each entity-specific table body with a shared `GridView` data-grid powered by `@tanstack/react-table`. Sort, filter, and column-picker affordances live in the canvas chrome. Layouts persist on the parent plan/list (shared across the team). All inputs (filters, value pickers) use constrained widgets — dropdowns, multi-selects, range pickers, toggles — never free-text typing when the value set is knowable.

**Scope decisions** (locked):
1. Coverage: all 6 table-shaped entity views (Districts, Contacts, Opps, Vacancies, RFPs, News). News also gets a "View as: cards | table" toggle. Map and Kanban are out of scope.
2. Persistence: per-plan / per-list, **shared** across viewers. One `viewLayouts JSONB` column on `TerritoryPlan` and `SavedList`. Per-user overrides are explicitly out of scope for v1; we add them only if team-layout drift becomes a real problem.
3. Library: `@tanstack/react-table` v8 (already installed). `@tanstack/react-virtual` available if we hit a row-count ceiling.
4. Data path: one new endpoint `GET /api/views/data?source=…` that routes through the existing `src/lib/saved-views/sql-compiler.ts`. Existing `/api/districts`, `/api/contacts`, etc., are untouched so non-grid callers (map, districts tab) don't regress.
5. Sort on derived columns (Tier, Stage): not supported. Only server-side sort on raw DB columns.
6. Save cadence: auto-save, debounced 500ms idle. No save button.
7. Constrained inputs only — text inputs are reserved for Name/Title/City "contains" search; everything else uses a select / multi-select / range / toggle.

**Success criteria.**
- A rep can click any sortable header to cycle none → asc → desc → none, with the page refetched server-side.
- A rep can add a filter by picking a column, then a value from a dropdown/multi-select/range/toggle (no typing for enums, numbers, dates, or booleans).
- A rep can toggle column visibility and drag-reorder columns; the layout persists to the parent plan/list.
- All six grids share one `GridView` component — entity differences live only in the column registry.
- Filter validation reuses the existing Zod schema + SQL compiler from Phase A of saved-views — no new SQL paths.
- Server-side sort respects the 5s `statement_timeout` from the read-only pool.

## Visual Design

**Fidelity:** matches the existing Saved Views canvas chrome. Filter chips render with the same pill style as the prototype's list-builder rules. Column picker is a popover from a gear icon to the right of the view-tabs strip. No new tokens introduced.

**Architectural decisions.**
- The grid's filter chip row sits directly below the canvas header (between the stat grid / progress bar and the view-tabs strip).
- `+ Filter` is the last chip in the row, dashed-outline. Click → field picker popover listing all filterable columns for the current source.
- The gear icon for column picker lives at the right end of the view-tabs strip, adjacent to existing actions (search / share / save).
- Active filters render as chips: `{field}: {value(s)}` with an `×` to remove. Click a chip body = reopen the filter's widget popover.
- Sort indicator: small `↑` / `↓` to the right of the header label when active, with a numeric badge when participating in multi-sort.
- "Reset to defaults" link inside the gear menu drops `viewLayouts.{viewType}` back to null.

## Column Model & Registry

New file: `src/features/views/lib/columns.ts`.

```ts
type FilterWidget =
  | { kind: "multiselect"; values: readonly string[] }
  | { kind: "multiselect"; enumSource: EnumSourceId }
  | { kind: "select"; values: readonly string[] }
  | { kind: "select"; enumSource: EnumSourceId }
  | { kind: "numberRange"; min?: number; max?: number; step?: number;
      presets?: readonly { label: string; range: [number, number] }[] }
  | { kind: "dateRange";
      relativeChips?: readonly ("7d" | "30d" | "90d" | "qtd" | "ytd")[] }
  | { kind: "toggle"; labels: { on: string; off: string } }
  | { kind: "text" };

type EnumSourceId = "states" | "users" | "stages" | "personas" | "seniorities";

interface ColumnDef<TSource extends SavedListSource> {
  id: string;                      // stable, persisted in viewLayouts
  header: string;
  kind: "raw" | "derived";
  accessor: string | ((row: SourceRow<TSource>) => unknown);
  sortable: boolean;               // derived columns: false
  filterFieldId: string | null;    // links to SOURCE_FIELDS for SQL compilation
  filterWidget: FilterWidget | null;
  align: "left" | "right" | "center";
  format: "money" | "number" | "percent" | "date" | "pill" | "text" | "avatar" | "boolean";
  defaultVisible: boolean;
  defaultOrder: number;
}

export const SOURCE_COLUMNS: {
  [S in SavedListSource]: ColumnDef<S>[];
};
```

Initial column inventory per source:

| Source | Columns (default-visible bolded) |
|---|---|
| **districts** | **Name** (text contains), **State** (multiselect, `states`), **Tier** (multiselect derived, no filter widget yet), Enrollment (numberRange), FRPL rate (numberRange 0–1), Is customer (toggle), Has open pipeline (toggle), City (text contains), **FY26 ARR** (numberRange + presets), **Stage** (multiselect derived), Owner (multiselect, `users`) |
| **contacts** | **Name** (text contains), **Title** (text contains), **Persona** (multiselect, `personas`), **Seniority** (multiselect, `seniorities`), Is primary (toggle), **District** (multiselect of in-scope leaids) |
| **opps** | **Stage** (multiselect, `stages`), **Bookings** (numberRange + presets), **Close date** (dateRange), State (multiselect, `states`), School year (multiselect), **Owner** (multiselect, `users`) |
| **vacancies** | **Status** (multiselect, fixed enum), **Category** (multiselect, fixed enum), Fullmind relevant (toggle), Title (text contains), **Posted** (dateRange) |
| **news** | **Relevance** (multiselect, fixed enum: high/med/low), Source (multiselect, `feed_sources`), **Published** (dateRange), Title (text contains) |
| **rfps** | **Status** (multiselect), **Relevance** (multiselect, fixed enum), Min value (numberRange), Max value (numberRange), **Due** (dateRange), State (multiselect, `states`) |

Where a column is `kind: "raw"` and `filterFieldId` is non-null, the field must already exist in `SOURCE_FIELDS` from `src/lib/saved-views/source-fields.ts`. Columns added to the grid that aren't yet filterable are allowed (e.g., for display-only fields) — they pass through `kind: "raw"`, `filterFieldId: null`, `filterWidget: null`.

## Data Model

### Prisma migration

```prisma
model TerritoryPlan {
  // ...existing fields...
  viewLayouts  Json?  @map("view_layouts")
}

model SavedList {
  // ...existing fields...
  viewLayouts  Json?  @map("view_layouts")
}
```

Migration file: `prisma/migrations/<timestamp>_grid_view_layouts/migration.sql`:

```sql
ALTER TABLE territory_plans  ADD COLUMN view_layouts JSONB;
ALTER TABLE saved_lists       ADD COLUMN view_layouts JSONB;
```

No index on `view_layouts` — never queried directly, only read alongside the parent row.

### `viewLayouts` shape (TypeScript)

```ts
type GridViewLayout = {
  columns: {
    id: string;
    order: number;
    width?: number;       // px; absent = auto
    visible: boolean;
  }[];
  sort: {
    id: string;
    dir: "asc" | "desc";
  }[];                    // index 0 is primary, additional entries are tie-breakers
  filters: FilterTreeAnd; // reuses existing filter-tree type
};

type ViewLayouts = {
  table?: GridViewLayout;
  contacts?: GridViewLayout;
  opps?: GridViewLayout;
  vacancies?: GridViewLayout;
  news?: GridViewLayout;
  rfps?: GridViewLayout;
  kanban?: never;         // out of scope
  map?: never;            // out of scope
};
```

Validation lives in `src/lib/saved-views/grid-layout-schema.ts` and is invoked from the plan/list PATCH handlers. Unknown column ids, unknown sort fields, or filter trees referencing unknown fields → 400.

## API

### `GET /api/views/data`

Single endpoint serves all 6 grids.

| Param | Required | Notes |
|---|---|---|
| `source` | yes | one of `districts \| contacts \| opps \| vacancies \| news \| rfps` |
| `leaids` | conditional | csv; required for plans, optional for lists with `scopeMode=rules` |
| `listId` | conditional | when reading from a list with `scopeMode=rules` or `reference`; resolves filter tree server-side |
| `filters` | no | JSON-encoded `FilterTreeAnd`; merged with the plan/list's saved filter (AND) |
| `sort` | no | repeatable `field:dir` pairs; first wins as primary |
| `limit` | no | default 50, max 200 |
| `offset` | no | default 0 |

Response:
```ts
{
  rows: Record<string, unknown>[];  // shape per source
  total: number;
  truncated?: boolean;              // true when statement_timeout hit
}
```

Behaviour:
1. Auth via `getUser()` — 401 if missing.
2. Validate `source` against `SavedListSource`.
3. Validate `filters` via existing `filterTreeAnd` Zod schema.
4. Validate each `sort` entry: field must be in `SOURCE_FIELDS[source]` AND `kind: "raw"` (no derived sort).
5. If `listId` present, load the list with the visibility check (`ownerId === user.id || shared`), then AND its saved filter tree with the request's `filters`.
6. Compile the merged filter + sort + scope into a parameterized read-only SQL query via the extended `sql-compiler.ts`.
7. Execute against the read-only pool (5s `statement_timeout`).
8. On timeout, return `{ rows: [], total: 0, truncated: true }`.

### `GET /api/views/enum-values`

Powers the dynamic multi-select widgets.

| Param | Required | Notes |
|---|---|---|
| `source` | yes | enum source id from the column registry (`states`, `users`, `stages`, `personas`, `seniorities`, `feed_sources`) |

Response: `{ values: { value: string; label: string }[] }`. TanStack Query caches client-side for the session (no staleTime). Implementation is a small switch over known source ids; each branch runs a single GROUP BY query or returns a static list.

### PATCH `/api/territory-plans/[id]` and `/api/lists/[id]`

Existing endpoints. Extend their Zod input schemas to accept optional `viewLayouts: ViewLayouts | null`. Validate via the new `grid-layout-schema.ts`. Null clears the layout (revert to column-registry defaults).

## SQL Compiler Extension

`src/lib/saved-views/sql-compiler.ts` already produces `WHERE` clauses from a filter tree. Add:

```ts
export function buildOrderBy(
  sort: { id: string; dir: "asc" | "desc" }[],
  source: SavedListSource,
): string {
  if (sort.length === 0) return "";
  const parts = sort.map(({ id, dir }) => {
    const field = lookupField(source, id);
    if (!field) throw new Error(`Unknown sort field "${id}"`);
    // Defense-in-depth identifier check even though field came from allowlist
    if (!/^[a-z_][a-z0-9_]*$/i.test(field.column))
      throw new Error("Invalid column");
    const safeDir = dir === "asc" ? "ASC" : "DESC";
    return `${quoteIdent(field.column)} ${safeDir} NULLS LAST`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}
```

`NULLS LAST` matches sales-rep expectations (an unset ARR shouldn't dominate the descending sort).

## UI Components

```
src/features/views/components/grid/
├── GridView.tsx                  ← generic, source-agnostic
├── GridHeader.tsx                ← chips row + + Filter + gear icon
├── GridHeaderCell.tsx            ← header label + sort cycle
├── GridRow.tsx                   ← data-row-kind/data-row-id (existing routing)
├── GridFilterChips.tsx           ← active filter pills + + Filter button
├── GridColumnMenu.tsx            ← gear popover: visibility, reorder, reset
├── FilterFieldPicker.tsx         ← dropdown of filterable columns
├── widgets/
│   ├── MultiSelectWidget.tsx
│   ├── SelectWidget.tsx
│   ├── NumberRangeWidget.tsx
│   ├── DateRangeWidget.tsx
│   ├── ToggleWidget.tsx
│   └── TextWidget.tsx
└── __tests__/...
```

### `GridView` contract

```ts
interface GridViewProps {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;
  parentKind: "plan" | "list";
  parentId: string;
}
```

Inside:
- `useGridLayout(parentKind, parentId, viewType)` returns `{ layout, setLayout }`, with `setLayout` debounced at 500ms onto a PATCH mutation.
- `useReactTable` is configured with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel` (filtering is server-side; the table state mirrors `layout.filters` and `layout.sort` and pushes to the layout hook on change).
- Data query: `useViewsData({ source, leaids, listId, filters, sort, page })` — a new hook in `src/features/views/lib/queries.ts`. Query key is JSON-serialized per CLAUDE.md.

### Filter widget UX

- **MultiSelectWidget:** popover, checkbox list, type-to-filter inside, "Apply" button bottom-right. For dynamic enums, fetches via `useEnumValues(source)` and shows a skeleton until loaded (loading state, never disappears, per CLAUDE.md UX defaults).
- **NumberRangeWidget:** two numeric inputs (min, max) with placeholder hints. Optional preset chips below (e.g., "$0–$50k", "$50k–$250k", "$250k–$1M", "$1M+"). Active preset highlighted.
- **DateRangeWidget:** relative chips ("Last 7 days", "Last 30 days", "QTD", "YTD") at top, custom from–to date pickers below.
- **ToggleWidget:** segmented control with two labels (e.g., "Yes / No"). No "either" option — to clear, remove the chip.
- **TextWidget:** input with 300ms debounce. Only used for Name/Title/City "contains".

### Pagination & narrow-width

- 50 rows per page via existing `ShowMoreButton`. Filter-hint banner from `_shared.tsx` is reused when total ≥ 200.
- Filter chip row scrolls horizontally on narrow viewports (`overflow-x-auto`, no flex-wrap — chips stay one row to keep the chrome compact).
- Sticky thead applies even after the chip row scrolls.

## State & Persistence Flow

```
User clicks "State" header
  └→ GridHeaderCell onSortChange
        └→ setLayout({...layout, sort: [{id:"state", dir:"asc"}]})
              └→ TanStack Query refetches /api/views/data with sort param
              └→ useGridLayout debounces PATCH /api/territory-plans/[id] body { viewLayouts: { table: {...} } }
```

When a different user opens the same plan within 500ms of the change, they see the prior layout; after the PATCH lands and their client refetches the plan (TanStack `invalidateQueries`), they see the new layout. We don't push live updates over a socket — this is shared-but-eventually-consistent.

## Phasing

Per `feedback_regular_commits`. One commit per row.

| Phase | ID | Commit | Notes |
|---|---|---|---|
| **A. Backend foundations** | A1 | prisma migration adds `view_layouts JSONB` to plan + list | |
| | A2 | `src/features/views/lib/columns.ts` — SOURCE_COLUMNS registry | All 6 sources at once; cheaper than incremental |
| | A3 | `src/lib/saved-views/grid-layout-schema.ts` + extend plan/list PATCH | |
| | A4 | `sql-compiler.ts` — add `buildOrderBy` + unit tests | |
| | A5 | `GET /api/views/data` route + tests | |
| | A6 | `GET /api/views/enum-values` route + tests | |
| **B. Grid primitives** | B1 | `GridView` shell w/ `useReactTable` | Renders default columns only, no chrome yet |
| | B2 | `GridHeaderCell` w/ sort cycle | |
| | B3 | `MultiSelectWidget` (static + dynamic enum) | |
| | B4 | `NumberRangeWidget` + `DateRangeWidget` | |
| | B5 | `ToggleWidget` + `SelectWidget` + `TextWidget` | |
| | B6 | `GridFilterChips` + `FilterFieldPicker` | |
| | B7 | `GridColumnMenu` (gear popover) | |
| | B8 | `useGridLayout` hook w/ debounced PATCH | |
| **C. Districts grid** | C1 | wire `GridView` into existing TableView path for districts | Replaces the fixed table; uses defaults from registry |
| | C2 | end-to-end test (filter → sort → column toggle → reload → assert layout) | |
| **D. Roll out to other entities** | D1 | Contacts grid (replace ContactsView body) | |
| | D2 | Opps grid | |
| | D3 | Vacancies grid | |
| | D4 | RFPs grid | |
| | D5 | News "view as: cards | table" toggle + grid | |
| **E. Polish** | E1 | column resize handles | |
| | E2 | column drag-to-reorder via @dnd-kit (already in repo if it is, else inline drag) | |
| | E3 | shift-click multi-sort | |
| | E4 | filtered-empty + filtered-error states | |
| | E5 | mobile pass — chips row scroll, gear popover sized for narrow viewports, touch-action audit | |

Phases A–C ship visible value on the districts grid. D rolls it out one entity per commit (revertable individually). E is deferable polish.

## Performance

- Server-side sort + filter + pagination — never load >50 rows.
- TanStack Query keys serialize `{leaids, listId, filtersJson, sortJson, page}` to primitives.
- Enum-values endpoint cached client-side for the session (no `staleTime`, no auto-refetch).
- Debounced PATCH on layout edits — at most one save per 500ms idle.
- The PATCH is fire-and-forget; we don't block the UI on it. Failure surfaces as a toast (existing pattern in queries.ts).
- Zustand subscriptions in `GridView` use narrow selectors only (e.g., `s => s.detailOpenId`) — no broad `useViewsStore()`.

## Security & Validation

- All API routes call `getUser()` first.
- Visibility check on `listId` (`ownerId === user.id || shared`) before reading the list's filter tree.
- Filter tree validated by existing Zod schema; column names by `SOURCE_FIELDS` allowlist; sort fields by `SOURCE_FIELDS` allowlist with `kind:"raw"` constraint.
- Column ids in `viewLayouts` validated against `SOURCE_COLUMNS` registry; unknown ids 400.
- Read-only Postgres role; 5s `statement_timeout`; truncated → `{ rows: [], truncated: true }` (no 500).
- Defence-in-depth identifier regex (`/^[a-z_][a-z0-9_]*$/i`) on column names before interpolation, matching the existing pattern in `sql-compiler.ts`.

## Mobile

- Grid switches to horizontal scroll on narrow viewports (existing `overflow-x-auto` pattern).
- Filter chip row also scrolls horizontally — never wraps.
- Gear popover uses `maxWidth: calc(100vw - 16px)` per CLAUDE.md.
- Touch-action audit: no `pan-y` on the grid wrapper (it doesn't contain a map, so `pan-y` is safe — but we leave it off because horizontal scroll is needed for the chip row).
- E5 includes the iPhone smoke test.

## Testing

- Vitest co-located in `__tests__/` next to each new component / lib file.
- Coverage targets:
  - `buildOrderBy` — unit tests for valid sort, unknown field, derived field rejection.
  - `grid-layout-schema` — unit tests for valid layouts + each rejection class.
  - `/api/views/data` — auth, source validation, sort validation, filter merge, statement-timeout path.
  - `useGridLayout` — debounce, optimistic update, PATCH failure rollback.
  - `MultiSelectWidget` + `NumberRangeWidget` + `DateRangeWidget` — interaction tests (open/select/apply/clear).
  - `GridView` end-to-end — filter triggers refetch, sort triggers refetch, column toggle persists.
- The existing 2540 Vitest suite must remain green.

## Open Questions

None at this time.

## Non-goals (v1)

- Per-user layout override (only added if team-drift becomes a real problem).
- Sort on derived columns (Tier, Stage).
- Pivot / group-by views.
- Column formula editor.
- Conditional formatting (cell color rules).
- CSV export from the grid (existing plan export covers this; revisit if asked).
- Virtualized rows (`@tanstack/react-virtual`) — defer until row counts demand it.
- Map and Kanban view grid support — they aren't tabular.
