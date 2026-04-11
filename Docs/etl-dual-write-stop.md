# ETL Dual-Write Stop: Deprecated District FY Columns

**Date:** 2026-04-11
**Context:** Database normalization Phase 3c
**Branch:** `feat/db-normalization-query-tool`

## Summary

The Python ETL pipeline (`fullmind.py` in the external repo) currently writes financial
data to **two locations**:

1. **`district_financials` table** (normalized, canonical) — vendor + fiscal year rows
2. **`districts` table FY columns** (deprecated, flat) — 18 columns like `fy25_sessions_revenue`, `fy26_net_invoicing`, etc.

After Phase 3b, the 18 FY columns have been **dropped from the Prisma schema** and
are no longer read by any application code. The columns still exist in the database
but are dead weight.

## What needs to change in `fullmind.py`

### Stop writing to these `districts` columns:

**FY25:**
- `fy25_sessions_revenue`
- `fy25_sessions_take`
- `fy25_sessions_count`
- `fy25_closed_won_opp_count`
- `fy25_closed_won_net_booking`
- `fy25_net_invoicing`

**FY26:**
- `fy26_sessions_revenue`
- `fy26_sessions_take`
- `fy26_sessions_count`
- `fy26_closed_won_opp_count`
- `fy26_closed_won_net_booking`
- `fy26_net_invoicing`
- `fy26_open_pipeline_opp_count`
- `fy26_open_pipeline`
- `fy26_open_pipeline_weighted`

**FY27:**
- `fy27_open_pipeline_opp_count`
- `fy27_open_pipeline`
- `fy27_open_pipeline_weighted`

### Also stop writing to these columns (dropped in Phase 3b):

- `districts.sales_executive` (string) — replaced by `sales_executive_id` UUID FK
- `districts.state_location` — replaced by `state_abbrev` FK to `states` table
- `schools.owner` (string) — replaced by `owner_id` UUID FK
- `states.territory_owner` (string) — replaced by `territory_owner_id` UUID FK
- `unmatched_accounts.sales_executive` (string) — replaced by `sales_executive_id` UUID FK
- `unmatched_accounts` FY columns: `fy25_net_invoicing`, `fy26_net_invoicing`, `fy26_open_pipeline`, `fy27_open_pipeline`

### Keep writing to:

- `district_financials` table — this is the canonical source for all vendor financial data
- Person FK columns (`sales_executive_id`, `owner_id`, `territory_owner_id`) — these are the normalized replacements
- `state_abbrev` on districts — this is the normalized FK

## After the ETL changes

Once `fullmind.py` stops writing to the deprecated columns, the columns can be safely
dropped from the database via migration:

```sql
ALTER TABLE districts
  DROP COLUMN IF EXISTS fy25_sessions_revenue,
  DROP COLUMN IF EXISTS fy25_sessions_take,
  DROP COLUMN IF EXISTS fy25_sessions_count,
  -- ... (all 18 FY columns)
  DROP COLUMN IF EXISTS sales_executive,
  DROP COLUMN IF EXISTS state_location;
```

The Prisma schema has already been updated (Phase 3b) — no app-side changes needed.

## Materialized view note

The `district_map_features` materialized view previously read `fy26_open_pipeline` and
`fy27_open_pipeline` from the districts table. If this view still exists, it needs to be
updated to read from `district_financials` instead before dropping the columns.

Check: `SELECT definition FROM pg_matviews WHERE matviewname = 'district_map_features';`
