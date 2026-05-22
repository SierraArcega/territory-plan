# Customer Rank, Churn Risk, and Plan Notes — Districts Grid

**Date:** 2026-05-18
**Worktree:** `saved-views-sidebar`
**Scope:** Add three new columns to the districts grid (`source: districts`):
Customer Rank (derived global), Churn Risk (per-plan editable enum), and
Plan Notes (per-plan editable free text).

## Goals

A rep looking at the Table tab of a Plan should be able to:

1. See where each district ranks among all Fullmind customers by FY26 revenue,
   with `New` and `Win Back` labels for districts that don't currently have
   FY26 revenue.
2. Set a Churn Risk per district within the plan: `low`, `medium`, `high`,
   `churned`. Editable inline. Visible to anyone with access to the plan.
3. Read and edit the plan-scoped notes inline from the grid — no need to open
   the district detail panel for a quick note update.

## Non-Goals

- Customer Rank filtering (sort only in v1; range/threshold filter punted).
- Notes / Churn Risk on saved Lists where `source=districts` (these are
  plan-scoped — they render empty in non-plan list contexts).
- Bulk editing of churn risk or notes across rows.
- Multi-user concurrent-edit conflict UI for notes — last-write-wins.
- Churn Risk history / audit trail.

## Decisions

| Decision | Resolution |
|---|---|
| Rank universe | Global — all Fullmind customers |
| Revenue metric | `district_financials.total_revenue` for `vendor='fullmind'`, `fiscal_year='26'` |
| `New` definition | No revenue rows in `fiscal_year IN ('24','25','26')` |
| `Win Back` definition | Has FY25 revenue, no FY26 revenue |
| Rank display | `#1`, `#2`, … as text; `New` and `Win Back` as text labels |
| Churn Risk storage | `territory_plan_districts.churn_risk` (per-plan-per-district) |
| Churn Risk values | `low \| medium \| high \| churned` (nullable) |
| Notes source | `territory_plan_districts.notes` (already exists) |
| Inline edit shape | In-cell editor for both — `<select>` for churn risk, contenteditable for notes |
| Compute strategy | SQL CTE for rank, computed in `views/data` API route with 5-minute in-memory cache |
| New API surface | Extend existing `PUT /api/territory-plans/[id]/districts/[leaid]` to accept `churnRisk` |

## Architecture

### Data flow (read path)

```
GET /api/views/data?source=districts&planId=…
  └─ existing SQL on `districts` table (filter + paginate)
  └─ NEW: fetchGlobalCustomerLabels(rowLeaids)
        └─ module-scoped Map<leaid, {rank, label}> with 5-min TTL
        └─ on miss, one query against district_financials
  └─ existing fetchDistrictPlanEnrichment(planId, rowLeaids)
        └─ EXTENDED: also selects churn_risk + notes from territory_plan_districts
```

The two enrichments run in parallel — `Promise.all` in the route handler.
`fetchGlobalCustomerLabels` runs for every `source=districts` request
(plan or list), even when `planId` is null. The plan enrichment only runs
when `planId` is set.

### Data flow (write path)

```
ChurnRiskCell  ─┐
                ├─ PUT /api/territory-plans/[planId]/districts/[leaid]
PlanNotesCell ─┘     body: { churnRisk?, notes? }
                     └─ Prisma update on TerritoryPlanDistrict
                     └─ returns updated row
                     └─ TanStack Query optimistic update on
                        ["views", "data", planId, …]
```

The existing PUT handler already accepts `notes`. We extend it to also
accept `churnRisk` (validated against the allowed enum values).

## Schema Change

Single Prisma migration:

```prisma
model TerritoryPlanDistrict {
  // … existing fields
  churnRisk String? @map("churn_risk") @db.VarChar(16)
  // …
}
```

SQL:

```sql
ALTER TABLE territory_plan_districts
  ADD COLUMN churn_risk VARCHAR(16);

ALTER TABLE territory_plan_districts
  ADD CONSTRAINT territory_plan_districts_churn_risk_check
  CHECK (churn_risk IS NULL OR churn_risk IN ('low','medium','high','churned'));
```

No backfill — `NULL` is the default and represents "not assessed".

### Why a string column instead of a Prisma enum?

Consistent with how the codebase models other small, app-controlled enums
(e.g., `Opportunity.stage`, `Vacancy.status`) — keeps migrations cheap and
matches the existing `multiselect`-with-`values` widget shape in
`SOURCE_COLUMNS`. The CHECK constraint enforces the invariant at the DB
layer; TypeScript narrowing on the client uses a `const` tuple.

## Customer Rank Computation

A single SQL CTE produces `{leaid, rank, label}` for every district that
has financial data in `fiscal_year IN ('24','25','26')`:

```sql
WITH fy_revenue AS (
  SELECT
    leaid,
    SUM(total_revenue) FILTER (WHERE fiscal_year = '26') AS fy26,
    SUM(total_revenue) FILTER (WHERE fiscal_year = '25') AS fy25,
    SUM(total_revenue) FILTER (WHERE fiscal_year = '24') AS fy24
  FROM district_financials
  WHERE vendor = 'fullmind'
    AND fiscal_year IN ('24', '25', '26')
    AND leaid IS NOT NULL
  GROUP BY leaid
),
ranked AS (
  SELECT
    leaid,
    fy26, fy25, fy24,
    CASE
      WHEN COALESCE(fy26, 0) > 0
        THEN RANK() OVER (ORDER BY COALESCE(fy26, 0) DESC)
      ELSE NULL
    END AS rank
  FROM fy_revenue
)
SELECT
  leaid,
  rank,
  CASE
    WHEN rank IS NOT NULL THEN 'rank'
    WHEN COALESCE(fy25, 0) > 0 THEN 'win_back'
    WHEN COALESCE(fy24, 0) > 0 THEN 'win_back'
    ELSE 'new'
  END AS label
FROM ranked;
```

Note on `Win Back`: per the decision, FY24 OR FY25 revenue (without FY26)
both count as Win Back. Anything older with no FY24/FY25/FY26 is `new`.

### Caching

The CTE output is a `Map<leaid, {rank: number | null, label: "rank" | "win_back" | "new"}>`
held in module-scoped memory in the API route file, with a 5-minute TTL:

```ts
let cache: { byLeaid: Map<string, GlobalLabel>; expiresAt: number } | null = null;

async function getGlobalCustomerLabels(): Promise<Map<string, GlobalLabel>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.byLeaid;
  const byLeaid = await runRankCTE();
  cache = { byLeaid, expiresAt: now + 5 * 60 * 1000 };
  return byLeaid;
}
```

Districts not in the map are treated as `{rank: null, label: 'new'}` —
no financial history at all means truly new.

Cache lives per Node process (Next.js serverless function instance). Stale
data risk: at most 5 minutes lag behind the hourly financial refresh —
acceptable. No invalidation hook needed.

### Why not a materialized view?

- The cache lives where the data is consumed and is trivial to reason about.
- A materialized view introduces a refresh schedule we'd have to coordinate
  with `refresh_fullmind_financials()`.
- If query load ever justifies it, we promote without changing call sites.

## Column Registry Additions

Three new entries in the `districts` array of `SOURCE_COLUMNS`
(`src/features/views/lib/columns.ts`), all default-hidden:

```ts
{
  id: "customer_rank",
  header: "Customer rank",
  kind: "derived",
  accessor: "customerRank",
  sortable: true,
  filterFieldId: null,
  filterWidget: null,
  align: "left",
  format: "pill",
  defaultVisible: false,
  defaultOrder: 20,
},
{
  id: "churn_risk",
  header: "Churn risk",
  kind: "derived",
  accessor: "churnRisk",
  sortable: true,
  filterFieldId: "churn_risk",
  filterWidget: {
    kind: "multiselect",
    values: ["low", "medium", "high", "churned"],
  },
  align: "left",
  format: "pill",
  defaultVisible: false,
  defaultOrder: 21,
},
{
  id: "plan_notes",
  header: "Notes",
  kind: "derived",
  accessor: "planNotes",
  sortable: false,
  filterFieldId: null,
  filterWidget: null,
  align: "left",
  format: "text",
  defaultVisible: false,
  defaultOrder: 22,
},
```

### Sort semantics

- `customer_rank`: ascending puts `#1` first. `New` and `Win Back` sort
  *after* numbered ranks (highest first, then Win Back, then New) — server-
  side `ORDER BY` uses `(label = 'rank') DESC, rank ASC NULLS LAST,
  (label = 'win_back') DESC`.
- `churn_risk`: severity ordering. Server-side maps to numeric:
  `churned=4, high=3, medium=2, low=1, null=0`. Descending = worst first.

**Sort path cannot use the JS cache.** When the user sorts by
`customer_rank`, the filter compiler injects the rank CTE as an inline
sub-CTE in the main query and LEFT JOINs on `leaid` — pagination then
works correctly. The in-memory cache only short-circuits the per-row
enrichment step that happens *after* pagination. Sort-by-rank therefore
pays the CTE cost (~5–10ms) on every request, which is fine because (a)
sort is a rare action and (b) Postgres caches the underlying scan.

### Filter semantics

Only `churn_risk` is filterable in v1, via a multiselect on the four
allowed values. Filter compilation joins to `territory_plan_districts`
when a `planId` is in scope. No-plan list contexts: filter is hidden
from the UI (rendered disabled with a tooltip "Available inside a plan").

## Server-Side Wiring (`/api/views/data`)

Two extensions to `src/app/api/views/data/route.ts`:

1. **New helper:** `fetchGlobalCustomerLabels(leaids: string[])`. Implements
   the cache + CTE described above. Called for every `source=districts`
   request after the main query returns rows, in parallel with the plan
   enrichment.

2. **Extend `fetchDistrictPlanEnrichment`:** select `churn_risk, notes`
   from `territory_plan_districts` and merge into the enrichment entry.
   Add `churnRisk: string | null` and `notes: string | null` to
   `DistrictEnrichmentEntry`.

3. **Sort and filter compilation:** the `churn_risk` and `customer_rank`
   columns are derived, so the existing filter/sort compiler in
   `src/lib/saved-views/` needs new cases:
   - `churn_risk` filter → join to `territory_plan_districts` and
     `WHERE churn_risk = ANY(...)`. Falls through to no-op when `planId`
     is null.
   - `customer_rank` sort → join to the rank CTE on `leaid`, ORDER BY
     `(label='rank') DESC, rank ASC NULLS LAST, (label='win_back') DESC`.

The compiler additions live next to existing derived-column handling
(e.g., `has_target`, `last_activity_date`) and follow the same shape.

## Write Path

Extend `PUT /api/territory-plans/[id]/districts/[leaid]/route.ts`:

```ts
// Add to the body destructure:
const { …, churnRisk } = body;

// Validate:
const VALID_CHURN = ["low","medium","high","churned"] as const;
if (churnRisk !== undefined && churnRisk !== null
    && !VALID_CHURN.includes(churnRisk)) {
  return NextResponse.json({ error: "Invalid churnRisk" }, { status: 400 });
}

// Append to updateData:
if (churnRisk !== undefined) updateData.churnRisk = churnRisk;
```

Return shape gains `churnRisk: string | null` (same level as `notes`).

### Mutation hooks

Two new hooks in `src/features/views/lib/queries.ts`:

- `useUpdatePlanDistrictNotes(planId, leaid)` — debounced 600ms,
  optimistic update on the active `["views", "data", …]` cache key.
- `useUpdatePlanDistrictChurnRisk(planId, leaid)` — immediate, optimistic.

Both call the same PUT route. They invalidate the matching views/data
key on success (and refetch only when the in-flight optimistic update
diverges from server state).

## UI Components

Two new cell renderers under `src/features/views/components/grid/cells/`:

### `ChurnRiskCell.tsx`

- Hover state: shows current value as a pill (`Low`, `Medium`, `High`,
  `Churned`) with a faint chevron, or an empty `—` placeholder.
- Click: collapses pill into a native `<select>` with options
  `(unset), Low, Medium, High, Churned`. Native to keep keyboard
  navigation working inside the grid.
- Onchange: fires the mutation hook with optimistic update. The pill
  re-appears immediately with the new value.
- Color tokens:
  - `low` → mint (`bg-success-50 text-success-700`)
  - `medium` → amber (`bg-warning-50 text-warning-700`)
  - `high` → coral (`bg-danger-50 text-danger-700`)
  - `churned` → slate (`bg-neutral-100 text-neutral-700`)
  Token names follow the existing pill palette in
  `Documentation/UI Framework/tokens.md`.

### `PlanNotesCell.tsx`

- Hover state: one-line truncated text with `text-ellipsis`. Empty cell
  shows `—` placeholder.
- Click: cell becomes `contenteditable`, row height grows to fit content
  up to a max of 6 lines (then scrolls). Border thickens to indicate
  edit mode.
- Save triggers: blur, `Cmd+Enter`, OR 600ms idle while typing.
- Optimistic update — pending state shows a faint pulse animation on
  the cell border.
- `Esc` cancels and restores the prior value.

### Non-plan contexts

Both cells render disabled (no click affordance, tooltip "Open inside
a plan to edit") when the grid is showing a saved List with
`source=districts`. The columns still appear in the column picker, just
with empty values.

## Renderer wiring

The existing grid renderer (`src/features/views/components/grid/`) dispatches
on `column.format`. We add:

- `format: "pill"` already exists; the `customer_rank` and `churn_risk`
  cells override the default pill renderer by `column.id`.
- A new dispatch case keyed by `column.id` for `plan_notes` and
  `churn_risk` to swap in the editable cells.

No changes to the column-picker / sort / group toolbars — they read the
new `ColumnDef`s automatically.

## Testing

- Vitest unit tests for the rank CTE wrapper: feed fixture revenue rows,
  assert the returned Map matches expected `{rank, label}` per leaid,
  including `New` (no history), `Win Back` (FY24 only, FY25 only,
  FY24+FY25), tied ranks (same revenue), and a real top-3.
- Vitest unit test for the cache TTL: first call hits DB, second within
  5 minutes does not, after 5 minutes hits DB again. Mock `Date.now`.
- Vitest unit test for the PUT handler rejecting bad `churnRisk` values.
- Component test for `ChurnRiskCell`: changing the select fires the
  mutation and the pill updates.
- Component test for `PlanNotesCell`: typing + blur fires the debounced
  mutation; `Esc` reverts.
- E2E (Playwright if used here, otherwise skip): from a Plan's Table tab,
  show the three columns, change churn risk, type a note, reload page,
  values persist.

## File Inventory

**New files:**
- `src/features/views/components/grid/cells/ChurnRiskCell.tsx`
- `src/features/views/components/grid/cells/PlanNotesCell.tsx`
- `src/features/views/lib/__tests__/global-customer-labels.test.ts`
- `prisma/migrations/<ts>_add_churn_risk_to_territory_plan_districts/migration.sql`

**Modified files:**
- `prisma/schema.prisma` — add `churnRisk` to `TerritoryPlanDistrict`
- `src/app/api/views/data/route.ts` — add `fetchGlobalCustomerLabels`,
  extend `fetchDistrictPlanEnrichment` with `churnRisk`/`notes`, wire
  both into the rows mapper
- `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` — accept
  + return `churnRisk`
- `src/features/views/lib/columns.ts` — three new `ColumnDef` entries
- `src/features/views/lib/queries.ts` — two mutation hooks
- `src/lib/saved-views/filter-compiler.ts` (or wherever derived-column
  compilation lives) — handle `churn_risk` filter + `customer_rank` sort
- `src/features/views/components/grid/{whatever-dispatches-on-format}.tsx`
  — dispatch new cell types by `column.id`

## Error Handling

- Rank CTE failure: log + return an empty map. Rows render with no rank
  (column shows `—`). Does not block the grid.
- Plan enrichment failure: existing behavior — log + zero-value enrichment.
- PUT failure: optimistic update rolls back; toast surfaces the error.
- Schema migration: zero-downtime; the column is nullable from creation,
  no read paths break before frontend deploys.

## Out-of-scope follow-ups (parking lot)

- Rank-bucket display variant ("Top 10 / Top 50 / …") behind a setting.
- Customer Rank `numberRange` filter ("Top 50 only").
- Bulk-edit churn risk for selected rows.
- Churn Risk change history surfaced in the district detail timeline.
- Surfacing the same three fields on the Map tab tooltip / right rail.
