# Feature Spec: Opportunity Kanban — Filter & Sort

**Date:** 2026-05-22
**Slug:** kanban-filter-sort
**Branch:** `worktree-saved-views-sidebar`
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/`

## Source Materials

- Opportunity kanban (built): `src/features/views/components/views/KanbanView.tsx`, `src/app/api/views/opps-kanban/route.ts`, prior spec `docs/superpowers/specs/2026-05-21-opportunity-kanban-design.md`
- Grid filter/sort chips to reuse: `src/features/views/components/grid/GridFilterChips.tsx`, `GridSortChips.tsx`, `FilterFieldPicker.tsx`, `SortFieldPicker.tsx`, `widgets/*`
- Filter infra: `src/lib/saved-views/{filter-tree,schema,source-fields,sql-compiler}.ts` (`compileFilterTree`)
- Layout persistence: `src/lib/saved-views/grid-layout-schema.ts`, `src/features/views/hooks/useGridLayout.ts`, `src/features/views/lib/queries.ts` (`useUpdatePlanLayout`/`useUpdateListLayout`)
- Field/column registries: `src/lib/saved-views/source-fields.ts`, `src/features/views/lib/columns.ts`
- Rank labels: `src/app/api/views/data/global-customer-labels.ts` (`getGlobalCustomerLabels`, `rankLabelString`)

## Requirements

**Problem.** The opportunity kanban shows every plan opp for the fiscal year, unsorted-by-the-rep and unfilterable. A rep can't narrow to "my deals over $50k closing this quarter" or order each column to surface the deals that matter.

**Solution.** Add a filter + sort toolbar above the kanban, reusing the grid's chip components, field pickers, and constrained widgets for the SQL-backed opp fields, plus dedicated controls for the derived **rank** dimension. Filters/sort persist on the plan (shared), like the table view. Sort applies **within each column**; filters narrow which cards show and the columns' counts/totals reflect the active filters.

**Scope decisions (locked):**
1. **Filter fields:** Bookings, Close date, Owner, State, Contract type (SQL) + **Rank** (derived). Stage is excluded (it *is* the columns); School year is fixed by the plan.
2. **Sort fields (within column):** Bookings, Close date, Contract type, State (SQL) + **Rank** (derived). Owner is filter-only (it's not a sortable column in the registry).
3. **Approach A** (chosen): reuse `GridFilterChips`/`GridSortChips` (source `opps`) for the SQL fields via a new `excludeFieldIds` prop; add dedicated **Rank filter** and **Rank sort** controls beside them.
4. **Persistence:** per-plan, shared, in a new `viewLayouts.kanban` slot. (Lists remain plan-only / unscoped, as today.)
5. **Rank handling:** because rank is computed in memory (not a DB column), the endpoint fetches the plan's FY opp set, enriches every row with its rank, then filters/sorts/groups/caps in memory — so rank filtering and per-column counts/totals stay correct.

**Success criteria.**
- A rep can add a filter (e.g. Bookings ≥ $50k) and every column updates: only matching cards show, and each column's count + summed bookings reflect the filter.
- A rep can sort each column by Bookings, Close date, Contract type, State, or Rank (asc/desc); ordering applies within every column.
- A rep can filter by rank bucket (Ranked / Win Back / New) and sort by rank; both also apply to the Targeted column.
- The filter/sort state persists on the plan and is shared; reloading restores it.
- Existing kanban behavior (8 stage columns, Targeted column, cards, rank labels, LMS links) is unchanged when no filter/sort is set.
- The existing Vitest suite stays green.

## Field Set

| Field | id | Filter widget | Sortable | Notes |
|---|---|---|---|---|
| Bookings | `net_booking_amount` | numberRange + presets | yes | existing |
| Close date | `close_date` | dateRange | yes | existing |
| State | `state` | multiselect (`states`) | yes | existing |
| Owner | `sales_rep` | multiselect (`users`) | no | **new** SQL field (see below) |
| Contract type | `contract_type` | multiselect (`contract_types`) | yes | **new** SQL field + enum source |
| Rank | `rank` | bucket multiselect (Ranked/Win Back/New) | yes | **derived**, in-memory only |

## Registry Changes

1. **`source-fields.ts` — `SOURCE_FIELDS.opps`:** add
   - `{ id: "contract_type", label: "Contract type", column: "contract_type", type: "text", ops: ["is","is not","is any of","is not any of"] }`
   - `{ id: "sales_rep", label: "Owner", column: "sales_rep_id", type: "text", ops: ["is","is any of"] }`
     Owner filters compile to `sales_rep_id = ANY(selected user ids)`. `opportunities.sales_rep_id` aligns with `user_profiles.id` for ~94% of opps that have a rep; opps with no `sales_rep_id` (~27%) match no owner filter — acceptable (they have no owner).
2. **`columns.ts` — `SOURCE_COLUMNS.opps`:**
   - add a `contract_type` column: `kind:"raw"`, `accessor:"contractType"`, `sortable:true`, `filterFieldId:"contract_type"`, `filterWidget:{ kind:"multiselect", enumSource:"contract_types" }`, `format:"pill"`, `defaultVisible:false`.
   - change the existing `owner` column's `filterFieldId` from `null` → `"sales_rep"` so it compiles. (This also makes Owner filterable in the table view — accepted.)
3. **Enum source `contract_types`:** add `"contract_types"` to `enum-sources.ts` (`dynamic: false` style, fetched), and a `case "contract_types"` in `GET /api/views/enum-values` running `SELECT DISTINCT contract_type FROM opportunities WHERE contract_type IS NOT NULL ORDER BY contract_type`.

These registry additions are shared, so the table (`opps`) view gains the same filter/sort options — intended.

## Layout Shape & Schema

New kanban layout (distinct from `GridViewLayout` — no columns/groupBy):

```ts
type RankBucket = "ranked" | "win_back" | "new";

type KanbanLayout = {
  filters: FilterTreeAnd;                       // SQL fields only
  sort: { id: string; dir: "asc" | "desc" }[];  // ids ∈ opps sortable SQL fields
  rankBuckets: RankBucket[];                     // empty = all buckets
  rankSort: "asc" | "desc" | null;              // null = no rank sort
};
```

**`grid-layout-schema.ts`:** add `kanbanLayoutSchema` —
- `filters: filterAndSchema`
- `sort`: array of sort entries whose `id` is in `SOURCE_FIELDS.opps` (excluding `stage`, `school_yr`)
- `rankBuckets`: array of `z.enum(["ranked","win_back","new"])`
- `rankSort`: `z.enum(["asc","desc"]).nullable()`

Add `kanban: kanbanLayoutSchema.optional()` to `viewLayoutsSchema()`. `ViewTypeKey` (derived from `keyof ViewLayouts`) then includes `"kanban"` automatically. Null/absent → no filter/sort.

**Rank-sort precedence:** when `rankSort` is set it is the **primary** within-column sort key; the `sort` entries follow as tiebreakers.

## API

`GET /api/views/opps-kanban` gains optional params (existing `leaids`, `schoolYr`, `limit`, `planId` unchanged):

| Param | Notes |
|---|---|
| `filters` | JSON-encoded `FilterTreeAnd` over SQL opp fields; validated + compiled via `compileFilterTree("opps", tree, "o", paramOffset)` |
| `sort` | JSON-encoded sort entries (SQL field ids) |
| `rankBuckets` | csv subset of `ranked,win_back,new` |
| `rankSort` | `asc` \| `desc` |

**Algorithm (replaces the current 2-query agg+window model):**
1. Auth; validate `schoolYr`; empty `leaids` → zeroed columns + empty targeted (unchanged).
2. Validate `filters` (Zod `filterAndSchema` + `validateFilterTree`). Compile to `whereSql` + params with alias `o`, param offset after the base params (`leaids`, `schoolYr`, stages).
3. **One** query: in-scope opps (`district_lea_id = ANY`, `school_yr =`, `stage = ANY(8)`) AND the compiled filter `whereSql`. Select the card fields + `net_booking_amount` + `district_lea_id`. `LIMIT 5000` (safety; plan+FY scope is far smaller in practice — set `truncated:true` if hit).
4. `getGlobalCustomerLabels()` → attach `rankLabel` (display) + `rankSortKey` to each row.
5. Apply `rankBuckets` filter in memory (map each row's label → bucket: `#N`→ranked, `Win Back`→win_back, `New`→new).
6. Group rows by stage. Per column: `count` + `totalBookings` from the filtered set; sort cards via the comparator chain (`rankSort` first if set, then `sort` entries; nulls last); cap to 50; `hasMore = count > 50`.
7. **Targeted column:** unchanged query (plan districts with no FY opps + targets), then enrich with rank, apply the **rankBuckets** filter and **rankSort** (the opp-field filters/sort do *not* apply — districts have no bookings/close/owner/contract). Count/total reflect the rank filter.

Response shape adds nothing structurally — same `{ schoolYr, columns, targeted }`; cards already carry `rankLabel`.

**Comparator** (in-memory, shared by columns + targeted for rank): `rank` orders ranked-first by rank number, then Win Back, then New (`desc` reverses); SQL fields compare their values with NULLS LAST. The default order when no sort is set stays today's `close_date ASC, net_booking_amount DESC`.

## UI Components

- **`useKanbanLayout`** (new hook, mirrors `useGridLayout`): seeds `{ filters:{kind:"and",children:[]}, sort:[], rankBuckets:[], rankSort:null }` from `savedLayouts.kanban`, optimistic local state, 500ms debounced PATCH merging `{ ...saved, kanban: next }` via `useUpdatePlanLayout`/`useUpdateListLayout`, re-hydrates on server change, cleans up on unmount.
- **`KanbanToolbar`** (new, rendered above the board in `KanbanView`):
  - `GridFilterChips` (`source="opps"`, new `excludeFieldIds={["stage","school_yr"]}` prop) — bound to `layout.filters` via a thin `GridViewLayout` shim (`{ columns:[], groupBy:null, sort, filters }`), mapping `onChange` back to the kanban layout.
  - `RankFilterChip` (new): bucket multiselect (Ranked / Win Back / New) → `layout.rankBuckets`.
  - `GridSortChips` (`source="opps"`, `excludeFieldIds={["stage","school_yr"]}`) → `layout.sort`.
  - `RankSortChip` (new): a sort chip toggling `layout.rankSort` none → asc → desc → none.
  - A "Clear all" affordance resets filters + sort + rank.
- **`GridFilterChips` / `GridSortChips` change:** add an optional `excludeFieldIds?: string[]` prop, threaded into `FilterFieldPicker` / `SortFieldPicker` to drop those columns from the picker (and from chip rendering). Default `undefined` → unchanged for the grid.
- **`KanbanView`:** call `useKanbanLayout`, render `KanbanToolbar`, thread `filters`/`sort`/`rankBuckets`/`rankSort` into the query key + request. Receives `savedLayouts` (already available to other view bodies via `ViewBodyProps`) — `GroupCanvas` passes the plan's `viewLayouts` blob to `KanbanView` (it currently does not; add it alongside `leaids`/`fiscalYear`/`planId`).

## Persistence Flow

```
Rep adds "Bookings ≥ 50k"
  └→ KanbanToolbar → useKanbanLayout.setLayout({...layout, filters})
        ├→ query key changes → refetch /api/views/opps-kanban?...&filters=...
        └→ 500ms debounce → PATCH /api/territory-plans/[id] { viewLayouts: { ...blob, kanban: {...} } }
```
Shared-but-eventually-consistent, identical to the grid. Server validates `viewLayouts.kanban` via `kanbanLayoutSchema`.

## Phasing

| Phase | Scope |
|---|---|
| **Part 1 — SQL fields** | registry additions (contract_type field+column+enum, sales_rep field, owner filterFieldId); kanban layout schema + `useKanbanLayout`; endpoint accepts `filters`+`sort` (in-memory group/sort/cap with compiled WHERE); `excludeFieldIds` on the grid chips; `KanbanToolbar` with `GridFilterChips`+`GridSortChips`; `GroupCanvas` passes `savedLayouts`. Persisted. |
| **Part 2 — Rank** | `rankBuckets`+`rankSort` params + in-memory rank filter/sort (columns + Targeted); `RankFilterChip`+`RankSortChip`; schema fields. |

Each part ships independently and is independently revertable.

## Performance

- Single SQL query per board load (WHERE-filtered), bounded by plan + FY + 8 stages (`LIMIT 5000` safety). In-memory enrich/filter/sort/cap over that bounded set.
- Stable TanStack Query key: serialized `leaidsKey`, `schoolYr`, `planId`, `limit`, and JSON of `filters`/`sort`/`rankBuckets`/`rankSort` (all primitives).
- `getGlobalCustomerLabels` stays 5-min cached.
- Debounced (500ms) fire-and-forget PATCH; failures surface via the existing toast path.

## Security & Validation

- `getUser()` first (401).
- `filters` validated by `filterAndSchema` + `validateFilterTree("opps", …)`; only `SOURCE_FIELDS.opps` field ids compile — unknown field → 400. Owner compiles to a parameterized `sales_rep_id = ANY($n)`.
- `sort` ids checked against the opps sortable allowlist; `rankBuckets`/`rankSort` against fixed enums.
- Read-only pool, parameterized values, defense-in-depth identifier regex (existing in `sql-compiler`).
- `viewLayouts.kanban` validated by `kanbanLayoutSchema` in the plan/list PATCH handlers.

## Testing

- `kanbanLayoutSchema` — valid layout; rejects unknown sort field, bad rank bucket/sort.
- `enum-values?source=contract_types` — DISTINCT query shape.
- `/api/views/opps-kanban` — filter compiles + narrows counts/totals; within-column sort order; rank bucket filter + rank sort (columns + Targeted); owner filter param shape; empty layout = today's behavior; `truncated` path.
- `useKanbanLayout` — seed, optimistic update, debounced PATCH merge, re-hydrate, unmount cleanup.
- `GridFilterChips`/`GridSortChips` — `excludeFieldIds` drops fields from picker + rendering; grid (no prop) unchanged.
- `RankFilterChip` / `RankSortChip` — interaction (select buckets / cycle direction).
- `KanbanView` — toolbar renders; changing a filter/sort updates the request; default (no layout) renders the board as before.

## Non-goals (v1)

- Filtering/sorting by Stage (it's the columns) or School year (fixed).
- Per-user layout overrides (shared per-plan only, like the grid).
- Drag-to-reorder columns, column hide/show (kanban columns are the fixed stage set).
- Saving named kanban filter presets.
- Free-text search within the board (use the table view).
- Rank as a numeric threshold filter ("top N") — buckets only in v1.
