# Sort + Group Toolbar — Backend Context

## TL;DR
- The "frontend-only" assumption **holds for Sort** with no caveats: `layout.sort` is already an array of `{ id, dir }` validated against `SOURCE_FIELDS` and compiled to a NULLS-LAST multi-column `ORDER BY` (no length cap in code).
- For **Group**, the cleanest path is what the prompt proposes: FE prepends `{ id: groupBy, dir: 'asc' }` onto the existing sort array before fetching. **No new API plumbing is required** — but `groupBy` itself MUST be persisted on `viewLayouts` (FE-only state will lose it on refresh).
- Adding optional `groupBy` to `gridLayoutSchema` is backward-compatible: existing persisted blobs that lack the field will still validate (`.optional()` Zod field) and re-hydrate cleanly.
- **Districts has a real gap**: `target`, `pipeline`, `won_range`, `stage` are `kind:"derived"` and `sortable:false`. `target/pipeline/won_range` are enriched in JS *after* the SQL returns (in `route.ts` step 15), so sorting on them is impossible without an SQL refactor. `stage` has no SQL column at all today (no `SOURCE_FIELDS.districts.stage`) — adding it requires a derived SQL expression.
- News `mode === "cards"` should hide the Group control. Sort can stay enabled (cards still render in a deterministic order), but Group has no visual home in a card stack.

## Sort plumbing trace

Flow (read top-down):

1. `src/features/views/hooks/useViewsData.ts:43` — FE appends `sort=<id>:<dir>` repeatedly to the URL for each entry.
2. `src/app/api/views/data/route.ts:104-131` — parses repeated `sort` params, validates each `id` against `SOURCE_FIELDS[source]` (rejects unknown with 400), and validates `dir ∈ {asc,desc}`.
3. `src/lib/saved-views/sql-compiler.ts:290-305` (`buildOrderBy`) — maps `id → field.column`, applies `/^[a-z_][a-z0-9_]*$/i` defense-in-depth regex, emits `"col" ASC|DESC NULLS LAST` joined by commas.
4. `src/app/api/views/data/route.ts:255-262` — SQL composed as `SELECT t.*, COUNT(*) OVER() AS __total FROM <table> t WHERE … <orderBy> LIMIT $n OFFSET $n`.

**Length cap**: none in code. The route loops the entire array. Postgres handles ~32k expressions fine; the practical cap will be URL length (~2 KB on most servers). Group-by + 1-2 user sorts is trivially safe.

**Same code path for all 6 sources** — the source's table is looked up via `SOURCE_TABLES`, and the same `buildOrderBy` is invoked. No source-specific SQL.

## Schema impact for `groupBy`

Add to `src/lib/saved-views/grid-layout-schema.ts`:

```ts
const groupBySchema = z.object({ id: z.string() }).nullable().optional();

return z.object({
  columns: /* … existing … */,
  sort:    /* … existing … */,
  filters: /* … existing … */,
  groupBy: groupBySchema.superRefine((gb, ctx) => {
    if (gb && !sortableFieldIds.has(gb.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: `Group field "${gb.id}" is not sortable for source "${source}"` });
    }
  }),
});
```

Replicate the `groupBy` field on `newsLayoutSchema` (it's an independent object today, not an extension).

**Backward compatibility**: Existing rows in `SavedList.viewLayouts` / `TerritoryPlan.viewLayouts` (Prisma JSON columns) lack `groupBy`. With `.optional()`, `safeParse` succeeds and `data.groupBy` is `undefined` — both PATCH endpoints (`src/app/api/lists/[id]/route.ts:111` and `src/app/api/territory-plans/[id]/route.ts:551`) re-write the whole `viewLayouts` blob from the parsed value, so undefined fields are not persisted. **No migration needed.**

## Groupable columns per source

A column is "groupable" iff it appears in `SOURCE_FIELDS` (i.e. sortable) AND its `SOURCE_COLUMNS` entry has a discrete widget (`multiselect | select | toggle`). All from `src/features/views/lib/columns.ts`:

- **districts**: `state` (multiselect), `is_customer` (toggle), `has_open_pipe` (toggle), `has_target` (toggle).
- **contacts**: `persona` (multiselect), `seniority` (multiselect), `is_primary` (toggle). (`leaid` is sortable in fields but `sortable:false` in columns — see gaps.)
- **opps**: `stage` (multiselect), `state` (multiselect), `school_yr` (multiselect).
- **vacancies**: `status` (multiselect), `category` (multiselect), `fullmind_relevant` (toggle).
- **news**: `relevance` (multiselect), `feed_source` (multiselect).
- **rfps**: `status` (multiselect), `relevance` (multiselect), `state` (multiselect).

## Sortable column gaps

| Source | Column | Issue | Fix |
|---|---|---|---|
| districts | `target` | `derived`, JS-enriched post-SQL (route.ts:280-298) | **SQL refactor**: lateral subquery for plan-target sum in the main SELECT; only works when `planId` present. |
| districts | `pipeline` (`weighted_pipeline`) | Same — JS-enriched after the query | **SQL refactor**: lateral join on `district_opportunity_actuals`. |
| districts | `won_range` | Same; also a tuple, not a scalar | Sort on min or max; SQL refactor required. |
| districts | `stage` | No `SOURCE_FIELDS.districts.stage` entry, no SQL column | **Add derived field** — needs a SQL CASE expression (probably based on customer + open-pipeline state). Touches `quoteIdent` discipline because `field.column` would need a non-identifier. |
| contacts | `name` | `sortable:false` in `SOURCE_COLUMNS` despite `name` not existing in `SOURCE_FIELDS.contacts` either | **Add `name` to `SOURCE_FIELDS.contacts`** (column: `name`, type: text) and flip `sortable:true`. Pure flag flip — DB has the column. |
| opps | `owner` | `sortable:false`; not in `SOURCE_FIELDS.opps` | Add `owner_id` or `owner_name` field — DB has it via `ownerUser` relation, but `opportunities` table needs the join exposed. |
| contacts | `leaid` | `sortable:false` in column, but **is in** `SOURCE_FIELDS.contacts` | Pure flag flip on the column. |

For `districts.target/pipeline/won_range`, FE-only Group is impossible — the rows arrive in default order and JS enrichment cannot pre-sort.

## News cards-mode

- Sort: **keep enabled** in cards mode — controls render order top-to-bottom.
- Group: **hide** in cards mode (or auto-switch to table when user picks a Group field). Cards have no group-header affordance and the prototype renders a 2-column card grid where group separators look broken.
- Implementation: the toolbar reads `layout.mode` (defaulting to `"cards"`); render the GroupFieldPicker only when `source !== "news" || layout.mode === "table"`.

## Test coverage to add

Extend in `src/lib/saved-views/__tests__/`:

- `grid-layout-schema.test.ts` — add cases: (a) accepts `groupBy: { id: "state" }` on districts, (b) accepts `groupBy: null`, (c) rejects `groupBy: { id: "target" }` (non-sortable), (d) parses a legacy blob without `groupBy` (backward-compat).
- `sql-compiler-order-by.test.ts` — confirm groupBy-prefixed sort emits the group column first in ORDER BY (this is a frontend concern but worth an integration-style assertion: `buildOrderBy([{id:"state",dir:"asc"},{id:"enrollment",dir:"desc"}], "districts")` already covered — just rename for clarity).
- No new `route.test.ts` work needed — the API contract is unchanged.
