-- Seed vendor_financials from existing district + competitor_spend data
-- Run once after migration to backfill existing data

-- Fullmind FY25
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, open_pipeline, closed_won_bookings, invoicing, total_revenue, all_take)
SELECT
  d.leaid,
  'fullmind',
  'FY25',
  0,
  COALESCE(d.fy25_closed_won_net_booking, 0),
  COALESCE(d.fy25_net_invoicing, 0),
  COALESCE(d.fy25_sessions_revenue, 0),
  COALESCE(d.fy25_sessions_take, 0)
FROM districts d
WHERE COALESCE(d.fy25_sessions_revenue, 0) > 0
   OR COALESCE(d.fy25_net_invoicing, 0) > 0
   OR COALESCE(d.fy25_closed_won_net_booking, 0) > 0
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  closed_won_bookings = EXCLUDED.closed_won_bookings,
  invoicing = EXCLUDED.invoicing,
  total_revenue = EXCLUDED.total_revenue,
  all_take = EXCLUDED.all_take,
  last_updated = NOW();

-- Fullmind FY26
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, open_pipeline, closed_won_bookings, invoicing, total_revenue, all_take)
SELECT
  d.leaid,
  'fullmind',
  'FY26',
  COALESCE(d.fy26_open_pipeline, 0),
  COALESCE(d.fy26_closed_won_net_booking, 0),
  COALESCE(d.fy26_net_invoicing, 0),
  COALESCE(d.fy26_sessions_revenue, 0),
  COALESCE(d.fy26_sessions_take, 0)
FROM districts d
WHERE COALESCE(d.fy26_sessions_revenue, 0) > 0
   OR COALESCE(d.fy26_net_invoicing, 0) > 0
   OR COALESCE(d.fy26_closed_won_net_booking, 0) > 0
   OR COALESCE(d.fy26_open_pipeline, 0) > 0
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  open_pipeline = EXCLUDED.open_pipeline,
  closed_won_bookings = EXCLUDED.closed_won_bookings,
  invoicing = EXCLUDED.invoicing,
  total_revenue = EXCLUDED.total_revenue,
  all_take = EXCLUDED.all_take,
  last_updated = NOW();

-- Competitors (from competitor_spend -> total_spend maps to total_revenue)
INSERT INTO vendor_financials (leaid, vendor, fiscal_year, total_revenue)
SELECT
  cs.leaid,
  CASE cs.competitor
    WHEN 'Proximity Learning' THEN 'proximity'
    WHEN 'Elevate K12' THEN 'elevate'
    WHEN 'Tutored By Teachers' THEN 'tbt'
  END,
  cs.fiscal_year,
  cs.total_spend
FROM competitor_spend cs
WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  total_revenue = EXCLUDED.total_revenue,
  last_updated = NOW();
