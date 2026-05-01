# Investigation Plan: Orphaned `district_financials` Rows

**Status:** open
**Owner:** Sierra
**Triggered by:** KIPP: ENDEAVOR ACADEMY surfaced as `missing_renewal` on the Low Hanging Fruit page despite having no live opps, sessions, or subscriptions.

## Problem

`district_financials` (vendor='fullmind') contains **113 rows for districts that have no live opportunity covering that fiscal year**. These rows drive the Low Hanging Fruit page (and several other revenue surfaces) but reflect either pre-merger CSV history or stale data from before opportunities were re-mapped. We don't know yet which is which without per-row inspection.

## What we know

The 113 orphans split cleanly into two buckets:

### Bucket A — CSV-loaded historical (101 rows)

| FY | Rows | Total revenue |
|----|-----:|--------------:|
| FY24 | 48 | $8.46M |
| FY25 | 30 | $1.80M |
| FY26 | 23 | $138K |

- All `last_updated = 2026-02-22` (single bulk-load timestamp).
- All have `subscription_count = 0` and `closed_won_opp_count = 0`.
- Loaded by `scripts/etl/loaders/vendor_financials.py` from a "Customer Book Consolidation" CSV.
- These are the only DB record we have of $10.4M of historical revenue. **Don't auto-delete.**

### Bucket B — `refresh_fullmind_financials()` leftovers (12 rows)

These rows were once correct — at refresh time an opp pointed at the LEAID — then the opp got remapped or deleted, and the financial row never got cleaned up. The function only INSERTs/UPDATEs; it never DELETEs.

| District | Orphan FY | Rev | Bookings | Live opps elsewhere? |
|---|---|---:|---:|---|
| KIPP: Endeavor Academy (MO) | FY26 | $57K | $114K | none |
| Pine Bush Central SD (NY) | FY25 | $102K | $161K | none |
| New York City DOE | FY26 | $31K | $59K | none |
| Lexington SD 1 (SC) | FY26 | $23K | $40K | FY25, FY27 |
| Shade Canyon District (CA) | FY26 | $18K | $33K | none |
| Minisink Valley Central (NY) | FY26 | $11K | $36K | FY27 |
| Achievement First Hartford | FY26 | $1K | $32K | none |
| Live Oak USD (CA) | FY26 | $8K | $12K | none |
| Woodville Elementary (CA) | FY22, FY25, FY26 | $0–$188K | varies | FY23 |
| Bristol Local SD (OH) | FY26 | $0 | $10K | none |

## Goals

1. Decide each Bucket B row: **delete**, **investigate further**, or **keep**.
2. Decide each Bucket A FY26 row (23): is it real revenue, or staleness the CSV missed superseding?
3. Patch `refresh_fullmind_financials()` so future remaps don't leave orphans.
4. Leave Bucket A FY24/FY25 (78 rows, $10.3M) alone unless we do a separate historical-revenue audit.

## Investigation steps

### Step 1 — Bucket B: classify each of the 12 rows

For each LEAID + FY pair, run:

```sql
-- Substitute :leaid and :fy
SELECT
  -- Same-account opps anywhere (helps spot a remap)
  (SELECT json_agg(json_build_object(
     'id', id, 'name', name, 'school_yr', school_yr,
     'district_lea_id', district_lea_id,
     'current_district', (SELECT name FROM districts WHERE leaid=o.district_lea_id),
     'district_lms_id', district_lms_id, 'stage', stage,
     'net_booking_amount', net_booking_amount, 'sales_rep_name', sales_rep_name))
   FROM opportunities o
   WHERE o.district_lms_id IN (
     SELECT DISTINCT district_lms_id FROM opportunities WHERE district_lea_id = :leaid
   )) AS related_opps,

  -- Subscriptions whose school_name mentions the district name
  (SELECT json_agg(json_build_object(
     'sub_id', s.id, 'school_name', s.school_name,
     'opp_name', o.name, 'opp_district', o.district_lea_id,
     'net_total', s.net_total))
   FROM subscriptions s JOIN opportunities o ON o.id = s.opportunity_id
   WHERE s.school_name ILIKE '%' || (SELECT name FROM districts WHERE leaid=:leaid) || '%'
   LIMIT 10) AS related_subs;
```

Classify each row:
- **Remapped** (a same-`district_lms_id` opp now points to a different LEAID) → delete the orphan; revenue lives at the new LEAID.
- **Deleted** (no related opp anywhere) → delete the orphan; the deletion was deliberate.
- **Unclear** → flag for human review (don't delete).

### Step 2 — Bucket A FY26 (23 rows): real or stale?

For each row, compare CSV-loaded revenue against live FY26 opps for the same district:

```sql
-- Substitute :leaid
SELECT df.total_revenue AS csv_revenue, df.closed_won_bookings AS csv_bookings,
       (SELECT SUM(total_revenue) FROM opportunities
        WHERE district_lea_id = :leaid AND school_yr='2025-26') AS opp_revenue,
       (SELECT array_agg(name || ' [' || stage || ']')
        FROM opportunities WHERE district_lea_id = :leaid AND school_yr='2025-26') AS opp_names
FROM district_financials df
WHERE df.leaid = :leaid AND df.vendor='fullmind' AND df.fiscal_year='FY26';
```

If `opp_revenue` covers `csv_revenue`, the financials row is double-counting — delete. If `opp_revenue` is null/zero, the CSV is the only record — keep but flag for sales-ops to confirm whether it should also be in opportunities.

### Step 3 — Patch the refresh function

`refresh_fullmind_financials()` currently does INSERT … ON CONFLICT DO UPDATE. Add a DELETE step that runs BEFORE the upsert:

```sql
-- Delete fullmind rows whose underlying source data has disappeared.
-- Intentionally limited to vendor='fullmind' so we don't touch the CSV-loaded
-- Elevate / competitor rows that this function doesn't own.
DELETE FROM district_financials df
WHERE df.vendor = 'fullmind'
  AND NOT EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.district_lea_id = df.leaid
      AND 'FY' || RIGHT(o.school_yr, 2) = df.fiscal_year
  )
  AND df.subscription_count = 0  -- don't delete CSV-loaded historical
  AND df.closed_won_opp_count = 0;
```

The `subscription_count = 0 AND closed_won_opp_count = 0` guard is wrong for our case (Bucket B has these > 0). The right guard is "this row was last produced by this function," which we'd track via a `source` column. **Open question:** is it worth adding a `source` column to `district_financials` to disambiguate `'fullmind_refresh'` from `'csv_load'`?

Cheaper alternative: run the delete only for rows whose `last_updated` < `NOW() - INTERVAL '1 hour'` (i.e. older than this refresh cycle). Anything written by this run survives; anything older that has no source survives only if the source is something other than this function.

Pick one of:
- (a) Add `source TEXT` column to `district_financials`. Migrate existing rows (`'fullmind_refresh'` if `subscription_count > 0 OR closed_won_opp_count > 0`, else `'csv_load'`). DELETE only `source='fullmind_refresh'` orphans.
- (b) Use the `last_updated < NOW() - INTERVAL '1 hour'` heuristic. Simpler, no schema change, but fragile if refresh is rerun rapidly.
- (c) Status quo: don't auto-delete, run a manual cleanup periodically.

### Step 4 — Document the decision and ship

- If (a) or (b): write a migration, update `scripts/etl/loaders/vendor_financials.py` to set `source='csv_load'` if (a).
- Surface this audit's outcome in the LHF spec / data-model doc so future readers don't repeat the investigation.

## Out of scope

- Backfilling missing opportunities for Bucket A historical rows (separate sales-ops project).
- Touching Elevate / competitor rows in `district_financials` (different vendor, different ownership).

## Decision log

- **2026-04-30:** Confirmed KIPP: Endeavor (LEAID 2900031) is a Bucket B row. Underlying opp was remapped to KIPP St. Louis (LEAID 2900591) by the `2026-04-30_backfill_resolved_opp_district_leaid.sql` migration. Surgical row-delete approved as a one-off; full cleanup deferred to this plan.
