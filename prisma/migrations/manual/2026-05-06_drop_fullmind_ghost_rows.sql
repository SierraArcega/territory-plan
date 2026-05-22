-- 2026-05-06_drop_fullmind_ghost_rows.sql
-- Delete orphaned (leaid, fiscal_year) rows from district_financials where
-- vendor='fullmind'. A row is orphaned when no opportunity in `opportunities`
-- currently aggregates to that (leaid, school_yr) tuple.
--
-- Background: refresh_fullmind_financials() is INSERT...ON CONFLICT DO UPDATE
-- only — it never deletes. So whenever an opp gets re-parented, deleted, or
-- drops out of the OpenSearch sync window, the prior (leaid, fy) row is left
-- stranded. As of 2026-05-06 there are 213 such rows holding ~$10M of stale
-- bookings/revenue. See:
--   * docs/architecture.md "Opp → district mapping" (forthcoming)
--   * scripts/audit-fullmind-financials.py — produces a 4-CSV audit pack
--
-- Scope of this migration:
--   * Sweep 203 ghost rows whose old (leaid, fy) has no live opps AND is not
--     tied to a recently-reparented opp captured in opportunity_snapshots.
--   * PRESERVE 10 ghost rows tied to recently-reparented opps. Those are the
--     audit set — each remap will be reviewed manually (some are correct
--     reorgs like KIPP/GEO; others are clearly wrong like
--     Oakville→Santa Clara). Once audited, a follow-up will (a) fix the
--     wrong remaps in Salesforce and (b) patch refresh_fullmind_financials()
--     to delete-then-insert so future re-parents stop leaking.
--   * Other vendors (proximity, ek12, etc.) untouched.

BEGIN;

WITH live AS (
  SELECT district_lea_id AS leaid, 'FY' || RIGHT(school_yr, 2) AS fy
  FROM opportunities
  WHERE district_lea_id IS NOT NULL AND school_yr IS NOT NULL
  GROUP BY district_lea_id, school_yr
),
recent_reparents AS (
  SELECT DISTINCT s.district_lea_id AS leaid,
                  'FY' || RIGHT(s.school_yr, 2) AS fy
  FROM opportunity_snapshots s
  JOIN opportunities o ON o.id = s.opportunity_id
  WHERE s.district_lea_id IS NOT NULL
    AND s.district_lea_id IS DISTINCT FROM o.district_lea_id
),
deleted AS (
  DELETE FROM district_financials df
  WHERE df.vendor = 'fullmind'
    AND NOT EXISTS (
      SELECT 1 FROM live l
      WHERE l.leaid = df.leaid AND l.fy = df.fiscal_year
    )
    AND NOT EXISTS (
      SELECT 1 FROM recent_reparents r
      WHERE r.leaid = df.leaid AND r.fy = df.fiscal_year
    )
  RETURNING leaid, fiscal_year, total_revenue, closed_won_bookings, open_pipeline
)
SELECT
  COUNT(*)                                  AS deleted_rows,
  COALESCE(SUM(total_revenue), 0)           AS deleted_total_revenue,
  COALESCE(SUM(closed_won_bookings), 0)     AS deleted_closed_won,
  COALESCE(SUM(open_pipeline), 0)           AS deleted_open_pipeline
FROM deleted;

COMMIT;
