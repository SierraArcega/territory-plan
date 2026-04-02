-- Phase 1: Migrate FY columns from districts → vendor_financials
-- Only inserts rows that don't already exist (ON CONFLICT DO NOTHING)
-- Existing vendor_financials data from the CSV ETL takes precedence.

BEGIN;

-- FY25 data
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, all_take, session_count,
  closed_won_opp_count, closed_won_bookings, invoicing
)
SELECT
  d.leaid, 'fullmind', 'FY25',
  COALESCE(d.fy25_sessions_revenue, 0),
  COALESCE(d.fy25_sessions_take, 0),
  COALESCE(d.fy25_sessions_count, 0),
  COALESCE(d.fy25_closed_won_opp_count, 0),
  COALESCE(d.fy25_closed_won_net_booking, 0),
  COALESCE(d.fy25_net_invoicing, 0)
FROM districts d
WHERE d.fy25_sessions_revenue IS NOT NULL
   OR d.fy25_sessions_take IS NOT NULL
   OR d.fy25_sessions_count IS NOT NULL
   OR d.fy25_closed_won_opp_count IS NOT NULL
   OR d.fy25_closed_won_net_booking IS NOT NULL
   OR d.fy25_net_invoicing IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  session_count = COALESCE(EXCLUDED.session_count, vendor_financials.session_count),
  closed_won_opp_count = COALESCE(EXCLUDED.closed_won_opp_count, vendor_financials.closed_won_opp_count);

-- FY26 data (sessions + bookings + pipeline)
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, all_take, session_count,
  closed_won_opp_count, closed_won_bookings, invoicing,
  open_pipeline_opp_count, open_pipeline, weighted_pipeline
)
SELECT
  d.leaid, 'fullmind', 'FY26',
  COALESCE(d.fy26_sessions_revenue, 0),
  COALESCE(d.fy26_sessions_take, 0),
  COALESCE(d.fy26_sessions_count, 0),
  COALESCE(d.fy26_closed_won_opp_count, 0),
  COALESCE(d.fy26_closed_won_net_booking, 0),
  COALESCE(d.fy26_net_invoicing, 0),
  COALESCE(d.fy26_open_pipeline_opp_count, 0),
  COALESCE(d.fy26_open_pipeline, 0),
  COALESCE(d.fy26_open_pipeline_weighted, 0)
FROM districts d
WHERE d.fy26_sessions_revenue IS NOT NULL
   OR d.fy26_closed_won_opp_count IS NOT NULL
   OR d.fy26_open_pipeline IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  session_count = COALESCE(EXCLUDED.session_count, vendor_financials.session_count),
  closed_won_opp_count = COALESCE(EXCLUDED.closed_won_opp_count, vendor_financials.closed_won_opp_count),
  open_pipeline_opp_count = COALESCE(EXCLUDED.open_pipeline_opp_count, vendor_financials.open_pipeline_opp_count),
  weighted_pipeline = COALESCE(EXCLUDED.weighted_pipeline, vendor_financials.weighted_pipeline);

-- FY27 data (pipeline only)
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  open_pipeline_opp_count, open_pipeline, weighted_pipeline
)
SELECT
  d.leaid, 'fullmind', 'FY27',
  COALESCE(d.fy27_open_pipeline_opp_count, 0),
  COALESCE(d.fy27_open_pipeline, 0),
  COALESCE(d.fy27_open_pipeline_weighted, 0)
FROM districts d
WHERE d.fy27_open_pipeline IS NOT NULL
   OR d.fy27_open_pipeline_opp_count IS NOT NULL
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  open_pipeline_opp_count = COALESCE(EXCLUDED.open_pipeline_opp_count, vendor_financials.open_pipeline_opp_count),
  weighted_pipeline = COALESCE(EXCLUDED.weighted_pipeline, vendor_financials.weighted_pipeline);

COMMIT;

-- Verify: compare row counts
SELECT 'FY data migration complete' AS status;
SELECT fiscal_year, COUNT(*) AS rows
FROM vendor_financials
WHERE vendor = 'fullmind'
GROUP BY fiscal_year
ORDER BY fiscal_year;
