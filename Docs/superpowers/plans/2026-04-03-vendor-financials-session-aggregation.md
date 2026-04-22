# Vendor Financials Session-Level Aggregation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale CSV-sourced Fullmind rows in vendor_financials with live session-level aggregation that runs after every Railway sync, and align column naming between vendor_financials and opportunities.

**Architecture:** A SQL function aggregates sessions (revenue/take by start_time) and opportunities (bookings/pipeline by school_yr/stage) into vendor_financials rows for vendor='fullmind'. Called by the Railway scheduler after each sync cycle. Competitor rows (proximity, elevate, tbt) remain unchanged. Column renames align vendor_financials with opportunities naming conventions. Also fixes the missing `district_opportunity_actuals` materialized view refresh.

**Tech Stack:** PostgreSQL, Python (scheduler), Prisma ORM, TypeScript (app), Vitest

**Spec:** Derived from conversation on 2026-04-03. No separate spec document.

**Key context files:**
- `prisma/schema.prisma` — VendorFinancials model (lines 344-378)
- `scheduler/run_sync.py` — Railway sync orchestration
- `scheduler/sync/supabase_writer.py` — DB write functions, refreshes district_map_features
- `scripts/etl/loaders/vendor_financials.py` — Current CSV-based ETL (being replaced for Fullmind)
- `src/app/api/districts/summary/route.ts` — Main consumer of vendor_financials
- `src/features/map/lib/useMapSummary.ts` — Frontend consumer
- `src/features/map/lib/store.ts` — Metric IDs (line 514-520)
- `src/features/map/components/ViewActionsBar.tsx` — Metric labels
- `src/features/map/components/MapSummaryBar.tsx` — Summary bar display
- `src/app/api/districts/summary/__tests__/route.test.ts` — Summary route tests
- `src/lib/opportunity-actuals.ts` — Queries district_opportunity_actuals mat view
- `scripts/district-opportunity-actuals-view.sql` — Mat view definition

---

### Task 1: Rename columns on vendor_financials (DB + Prisma + app code)

Three renames to align vendor_financials with opportunities naming:
- `delivered_revenue` → `completed_revenue`
- `delivered_take` → `completed_take`
- `all_take` → `total_take`

**Files:**
- Modify: `prisma/schema.prisma` (VendorFinancials model, lines 344-378)
- Modify: `src/app/api/districts/summary/route.ts` (raw SQL queries)
- Modify: `src/app/api/districts/summary/__tests__/route.test.ts`
- Modify: `src/features/map/lib/useMapSummary.ts` (SummaryTotals interface + all references)
- Modify: `src/features/map/lib/store.ts` (ALL_METRIC_IDS array, line 514-520)
- Modify: `src/features/map/components/ViewActionsBar.tsx` (metric labels)
- Modify: `src/features/map/components/MapSummaryBar.tsx` (summary bar config)
- Modify: `scripts/etl/loaders/vendor_financials.py` (CSV ETL column references)

- [ ] **Step 1: Rename DB columns via Supabase migration**

Apply migration to rename the three columns:

```sql
ALTER TABLE vendor_financials RENAME COLUMN delivered_revenue TO completed_revenue;
ALTER TABLE vendor_financials RENAME COLUMN delivered_take TO completed_take;
ALTER TABLE vendor_financials RENAME COLUMN all_take TO total_take;
```

- [ ] **Step 2: Update Prisma schema @map annotations**

In `prisma/schema.prisma`, update the VendorFinancials model:

```prisma
  // Old: deliveredRevenue  Decimal  @default(0) @map("delivered_revenue") @db.Decimal(15, 2)
  completedRevenue  Decimal  @default(0) @map("completed_revenue") @db.Decimal(15, 2)

  // Old: deliveredTake     Decimal  @default(0) @map("delivered_take") @db.Decimal(15, 2)
  completedTake     Decimal  @default(0) @map("completed_take") @db.Decimal(15, 2)

  // Old: allTake           Decimal  @default(0) @map("all_take") @db.Decimal(15, 2)
  totalTake         Decimal  @default(0) @map("total_take") @db.Decimal(15, 2)
```

Run: `npx prisma generate`
Expected: "✔ Generated Prisma Client"

- [ ] **Step 3: Update summary API route raw SQL**

In `src/app/api/districts/summary/route.ts`, replace all occurrences:
- `delivered_revenue` → `completed_revenue` (in SQL strings)
- `delivered_take` → `completed_take` (in SQL strings)
- `all_take` → `total_take` (in SQL strings)
- `deliveredRevenue` → `completedRevenue` (in TypeScript property names)
- `deliveredTake` → `completedTake` (in TypeScript property names)
- `allTake` → `totalTake` (in TypeScript property names)

- [ ] **Step 4: Update summary route tests**

In `src/app/api/districts/summary/__tests__/route.test.ts`, replace all occurrences:
- `delivered_revenue` → `completed_revenue`
- `delivered_take` → `completed_take`
- `all_take` → `total_take`
- `deliveredRevenue` → `completedRevenue`
- `deliveredTake` → `completedTake`
- `allTake` → `totalTake`

- [ ] **Step 5: Update useMapSummary hook**

In `src/features/map/lib/useMapSummary.ts`:
- Rename `deliveredRevenue` → `completedRevenue` in SummaryTotals interface and all references
- Rename `deliveredTake` → `completedTake` in SummaryTotals interface and all references
- Rename `allTake` → `totalTake` in SummaryTotals interface and all references

- [ ] **Step 6: Update store metric IDs**

In `src/features/map/lib/store.ts`, update the ALL_METRIC_IDS array (around line 514-520):
- `"deliveredRevenue"` → `"completedRevenue"`
- `"deliveredTake"` → `"completedTake"`
- `"allTake"` → `"totalTake"`

- [ ] **Step 7: Update ViewActionsBar metric labels**

In `src/features/map/components/ViewActionsBar.tsx`:
- `deliveredRevenue: "Delivered Revenue"` → `completedRevenue: "Completed Revenue"`
- `deliveredTake: "Delivered Take"` → `completedTake: "Completed Take"`
- `allTake: "All Take"` → `totalTake: "Total Take"`

- [ ] **Step 8: Update MapSummaryBar config**

In `src/features/map/components/MapSummaryBar.tsx`:
- Update the metric config object to use new property names and labels
- `deliveredRevenue` → `completedRevenue`
- `deliveredTake` → `completedTake`
- `allTake` → `totalTake`

- [ ] **Step 9: Update CSV ETL script**

In `scripts/etl/loaders/vendor_financials.py`:
- Rename `delivered_revenue` → `completed_revenue` in INSERT column list (line 248) and ON CONFLICT SET clause (line 256)
- Rename `delivered_take` → `completed_take` in INSERT column list (line 249) and ON CONFLICT SET clause (line 259)
- Rename `all_take` → `total_take` in INSERT column list (line 249), ON CONFLICT SET clause (line 261), and all tuple comments

- [ ] **Step 10: Run tests**

Run: `npx vitest run`
Expected: All tests pass (no new failures vs baseline)

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma src/app/api/districts/summary/ src/features/map/ scripts/etl/loaders/vendor_financials.py
git commit -m "refactor: rename delivered→completed, all_take→total_take on vendor_financials"
```

---

### Task 2: Create SQL function for Fullmind session-level aggregation

**Files:**
- Create: `prisma/migrations/manual/create_refresh_fullmind_financials.sql`

This SQL function will be called after each Railway sync. It:
1. Aggregates sessions by district + school year (derived from start_time with July 1 cutoff)
2. Aggregates opportunities by district + school_yr for bookings/pipeline
3. Upserts combined results into vendor_financials WHERE vendor = 'fullmind'

- [ ] **Step 1: Write the SQL function**

Create `prisma/migrations/manual/create_refresh_fullmind_financials.sql`:

```sql
-- Refresh Fullmind vendor_financials from sessions + opportunities
-- Called after each Railway sync cycle
--
-- Revenue/take: aggregated from sessions table using start_time for school year
-- Bookings/pipeline: aggregated from opportunities table using school_yr field
-- School year derivation: start_time >= July 1 of year N → FY(N+1)

CREATE OR REPLACE FUNCTION refresh_fullmind_financials()
RETURNS void AS $$
BEGIN

  -- Temporary table: session-level aggregation by district + school year
  CREATE TEMP TABLE _session_agg AS
  SELECT
    o.district_lea_id AS leaid,
    'FY' || CASE
      WHEN EXTRACT(MONTH FROM s.start_time) >= 7
      THEN RIGHT((EXTRACT(YEAR FROM s.start_time)::int + 1)::text, 2)
      ELSE RIGHT(EXTRACT(YEAR FROM s.start_time)::int::text, 2)
    END AS fiscal_year,
    COALESCE(SUM(s.session_price) FILTER (WHERE s.start_time < NOW()), 0) AS completed_revenue,
    COALESCE(SUM(s.session_price) FILTER (WHERE s.start_time >= NOW()), 0) AS scheduled_revenue,
    COALESCE(SUM(s.session_price), 0) AS total_revenue,
    COALESCE(SUM(s.session_price - COALESCE(s.educator_price, 0)) FILTER (WHERE s.start_time < NOW()), 0) AS completed_take,
    COALESCE(SUM(s.session_price - COALESCE(s.educator_price, 0)) FILTER (WHERE s.start_time >= NOW()), 0) AS scheduled_take,
    COALESCE(SUM(s.session_price - COALESCE(s.educator_price, 0)), 0) AS total_take,
    COUNT(*) FILTER (WHERE s.start_time < NOW()) AS completed_session_count,
    COUNT(*) FILTER (WHERE s.start_time >= NOW()) AS scheduled_session_count,
    COUNT(*) AS session_count
  FROM sessions s
  JOIN opportunities o ON o.id = s.opportunity_id
  WHERE o.district_lea_id IS NOT NULL
    AND s.start_time IS NOT NULL
    AND s.session_price IS NOT NULL
  GROUP BY o.district_lea_id, fiscal_year;

  -- Temporary table: opportunity-level aggregation by district + school_yr
  CREATE TEMP TABLE _opp_agg AS
  WITH stage_weights AS (
    SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
           unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
  )
  SELECT
    o.district_lea_id AS leaid,
    'FY' || RIGHT(o.school_yr, 2) AS fiscal_year,
    COALESCE(SUM(o.net_booking_amount) FILTER (
      WHERE (regexp_match(o.stage, '^(\d+)'))[1]::int >= 6
    ), 0) AS closed_won_bookings,
    COALESCE(SUM(o.net_booking_amount) FILTER (
      WHERE (regexp_match(o.stage, '^(\d+)'))[1]::int BETWEEN 0 AND 5
    ), 0) AS open_pipeline,
    COALESCE(SUM(o.net_booking_amount * sw.weight) FILTER (
      WHERE (regexp_match(o.stage, '^(\d+)'))[1]::int BETWEEN 0 AND 5
    ), 0) AS weighted_pipeline,
    COALESCE(SUM(o.invoiced), 0) AS invoicing,
    COUNT(*) FILTER (
      WHERE (regexp_match(o.stage, '^(\d+)'))[1]::int >= 6
    ) AS closed_won_opp_count,
    COUNT(*) FILTER (
      WHERE (regexp_match(o.stage, '^(\d+)'))[1]::int BETWEEN 0 AND 5
    ) AS open_pipeline_opp_count
  FROM opportunities o
  LEFT JOIN stage_weights sw ON sw.prefix = (regexp_match(o.stage, '^(\d+)'))[1]::int
  WHERE o.district_lea_id IS NOT NULL
    AND o.school_yr IS NOT NULL
    AND o.stage ~ '^\d'
  GROUP BY o.district_lea_id, o.school_yr;

  -- Upsert combined results into vendor_financials
  INSERT INTO vendor_financials (
    leaid, vendor, fiscal_year,
    completed_revenue, scheduled_revenue, total_revenue,
    completed_take, scheduled_take, total_take,
    session_count,
    closed_won_bookings, open_pipeline, weighted_pipeline,
    invoicing, closed_won_opp_count, open_pipeline_opp_count,
    last_updated
  )
  SELECT
    COALESCE(sa.leaid, oa.leaid) AS leaid,
    'fullmind' AS vendor,
    COALESCE(sa.fiscal_year, oa.fiscal_year) AS fiscal_year,
    COALESCE(sa.completed_revenue, 0),
    COALESCE(sa.scheduled_revenue, 0),
    COALESCE(sa.total_revenue, 0),
    COALESCE(sa.completed_take, 0),
    COALESCE(sa.scheduled_take, 0),
    COALESCE(sa.total_take, 0),
    COALESCE(sa.session_count, 0),
    COALESCE(oa.closed_won_bookings, 0),
    COALESCE(oa.open_pipeline, 0),
    COALESCE(oa.weighted_pipeline, 0),
    COALESCE(oa.invoicing, 0),
    COALESCE(oa.closed_won_opp_count, 0),
    COALESCE(oa.open_pipeline_opp_count, 0),
    NOW()
  FROM _session_agg sa
  FULL OUTER JOIN _opp_agg oa ON sa.leaid = oa.leaid AND sa.fiscal_year = oa.fiscal_year
  ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
    completed_revenue = EXCLUDED.completed_revenue,
    scheduled_revenue = EXCLUDED.scheduled_revenue,
    total_revenue = EXCLUDED.total_revenue,
    completed_take = EXCLUDED.completed_take,
    scheduled_take = EXCLUDED.scheduled_take,
    total_take = EXCLUDED.total_take,
    session_count = EXCLUDED.session_count,
    closed_won_bookings = EXCLUDED.closed_won_bookings,
    open_pipeline = EXCLUDED.open_pipeline,
    weighted_pipeline = EXCLUDED.weighted_pipeline,
    invoicing = EXCLUDED.invoicing,
    closed_won_opp_count = EXCLUDED.closed_won_opp_count,
    open_pipeline_opp_count = EXCLUDED.open_pipeline_opp_count,
    last_updated = NOW();

  -- Clean up temp tables
  DROP TABLE _session_agg;
  DROP TABLE _opp_agg;

END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 2: Apply the function to Supabase**

Run the SQL via Supabase MCP or manually.

- [ ] **Step 3: Test the function**

```sql
-- Run it
SELECT refresh_fullmind_financials();

-- Verify results
SELECT fiscal_year, COUNT(*) AS rows,
  SUM(completed_revenue) AS completed_rev,
  SUM(scheduled_revenue) AS scheduled_rev,
  SUM(total_revenue) AS total_rev,
  SUM(session_count) AS sessions,
  SUM(closed_won_bookings) AS bookings,
  SUM(open_pipeline) AS pipeline
FROM vendor_financials
WHERE vendor = 'fullmind'
GROUP BY fiscal_year
ORDER BY fiscal_year;
```

Compare totals against:
```sql
SELECT school_yr,
  SUM(total_revenue) AS opp_total_rev,
  SUM(completed_revenue) AS opp_completed_rev
FROM opportunities
WHERE district_lea_id IS NOT NULL
GROUP BY school_yr ORDER BY school_yr;
```

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/manual/create_refresh_fullmind_financials.sql
git commit -m "feat: add refresh_fullmind_financials() SQL function"
```

---

### Task 3: Add refresh calls to Railway scheduler

**Files:**
- Modify: `scheduler/sync/supabase_writer.py` (add new function after refresh_map_features)
- Modify: `scheduler/run_sync.py` (call new function after sync completes)

- [ ] **Step 1: Add refresh function to supabase_writer.py**

In `scheduler/sync/supabase_writer.py`, after the `refresh_map_features()` function (around line 235), add:

```python
def refresh_fullmind_financials(conn):
    """Refresh Fullmind vendor_financials from sessions + opportunities."""
    logger.info("Refreshing Fullmind vendor_financials...")
    with conn.cursor() as cur:
        cur.execute("SELECT refresh_fullmind_financials()")
    conn.commit()
    logger.info("Refreshed Fullmind vendor_financials")


def refresh_opportunity_actuals(conn):
    """Refresh district_opportunity_actuals materialized view."""
    logger.info("Refreshing district_opportunity_actuals...")
    with conn.cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY district_opportunity_actuals")
    conn.commit()
    logger.info("Refreshed district_opportunity_actuals")
```

- [ ] **Step 2: Call refresh functions from run_sync.py**

In `scheduler/run_sync.py`, find where `refresh_map_features(conn)` is called (around line 163). Add after it:

```python
        refresh_fullmind_financials(conn)
        refresh_opportunity_actuals(conn)
```

Also add the imports at the top of the file:

```python
from sync.supabase_writer import refresh_fullmind_financials, refresh_opportunity_actuals
```

- [ ] **Step 3: Commit**

```bash
git add scheduler/sync/supabase_writer.py scheduler/run_sync.py
git commit -m "feat: refresh fullmind financials and opportunity actuals after Railway sync"
```

---

### Task 4: Update district_map_features to use vendor_financials

The `district_map_features` materialized view may reference old column names. Check and update if needed.

**Files:**
- Check: `scripts/refresh-district-map-features.sql` or equivalent view definition
- Modify if needed

- [ ] **Step 1: Check current view definition**

```sql
SELECT pg_get_viewdef('district_map_features'::regclass, true);
```

Search the output for `delivered_revenue`, `delivered_take`, `all_take`. If found, the view definition needs updating.

- [ ] **Step 2: Update view definition if needed**

If the view references old column names, update the CREATE MATERIALIZED VIEW statement to use `completed_revenue`, `completed_take`, `total_take`.

Apply via Supabase, then refresh:

```sql
REFRESH MATERIALIZED VIEW district_map_features;
```

- [ ] **Step 3: Commit any view changes**

```bash
git add scripts/
git commit -m "fix: update district_map_features for renamed vendor_financials columns"
```

---

### Task 5: Verify end-to-end and clean up

**Files:**
- No new files — verification only

- [ ] **Step 1: Run Vitest**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify summary API returns data with new column names**

Start dev server and hit the summary endpoint:

```bash
curl http://localhost:3005/api/districts/summary?vendors=fullmind&fiscalYear=FY26
```

Verify response contains `completedRevenue`, `completedTake`, `totalTake` (not the old names).

- [ ] **Step 3: Verify vendor_financials has session-level data**

```sql
SELECT fiscal_year,
  SUM(session_count) AS sessions,
  SUM(completed_revenue) AS completed_rev,
  SUM(total_take) AS total_take,
  SUM(closed_won_bookings) AS bookings
FROM vendor_financials
WHERE vendor = 'fullmind'
GROUP BY fiscal_year
ORDER BY fiscal_year;
```

Session counts should be > 0 for FY24-FY26. Completed revenue should closely match the opportunities table totals.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: vendor financials session-level aggregation complete"
```

---

## Execution Order

1. **Task 1** — Column renames (DB + code). Must deploy together to avoid mismatch.
2. **Task 2** — Create SQL function. Can be applied to Supabase independently.
3. **Task 3** — Scheduler integration. Deploy with next Railway container build.
4. **Task 4** — Map features view update. Run after Task 1 column renames are live.
5. **Task 5** — End-to-end verification.

## What's NOT in this plan

- **Removing CSV ETL for Fullmind** — The `vendor_financials.py` script can still be used for Elevate data. Fullmind rows will just be overwritten by the new function. Can remove Fullmind from the CSV loader in a follow-up.
- **Unmatched account aggregation** — 97K sessions on opps without `district_lea_id` are excluded. These need the unmatched accounts FK work from Phase 1 to be wired up.
- **Phase 2a query migration** — Switching app queries from districts FY columns to vendor_financials. Separate plan.
- **Phase 2b Claude query tool** — Separate plan.
