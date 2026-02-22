-- Verification queries for vendor_financials data integrity
-- Run against Supabase after ETL to confirm EK12 + Fullmind data loaded correctly.
--
-- Usage: psql $DATABASE_URL -f scripts/verify-vendor-financials.sql

-- 1. Row counts per vendor per FY
SELECT
  vendor,
  fiscal_year,
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE open_pipeline > 0) AS has_pipeline,
  COUNT(*) FILTER (WHERE closed_won_bookings > 0) AS has_bookings,
  COUNT(*) FILTER (WHERE total_revenue > 0) AS has_revenue,
  COUNT(*) FILTER (WHERE delivered_revenue > 0) AS has_delivered,
  COUNT(*) FILTER (WHERE scheduled_revenue > 0) AS has_scheduled,
  COUNT(*) FILTER (WHERE deferred_revenue > 0) AS has_deferred
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;

-- 2. Financial totals per vendor per FY (ground truth for MapSummaryBar)
SELECT
  vendor,
  fiscal_year,
  SUM(open_pipeline)::numeric(15,2) AS pipeline,
  SUM(closed_won_bookings)::numeric(15,2) AS bookings,
  SUM(invoicing)::numeric(15,2) AS invoicing,
  SUM(scheduled_revenue)::numeric(15,2) AS sched_rev,
  SUM(delivered_revenue)::numeric(15,2) AS deliv_rev,
  SUM(deferred_revenue)::numeric(15,2) AS def_rev,
  SUM(total_revenue)::numeric(15,2) AS total_rev,
  SUM(all_take)::numeric(15,2) AS all_take
FROM vendor_financials
GROUP BY vendor, fiscal_year
ORDER BY vendor, fiscal_year;

-- 3. Spot check: Fullmind FY26 vs EK12 FY26 (should both have data)
SELECT
  vendor,
  COUNT(*) AS districts,
  SUM(total_revenue)::numeric(15,2) AS total_revenue,
  SUM(open_pipeline)::numeric(15,2) AS pipeline
FROM vendor_financials
WHERE fiscal_year = 'FY26'
  AND vendor IN ('fullmind', 'elevate')
GROUP BY vendor;

-- 4. Check for FY24 and FY27 data (should be non-empty after ETL fix)
SELECT
  fiscal_year,
  COUNT(*) AS rows,
  COUNT(DISTINCT vendor) AS vendors
FROM vendor_financials
WHERE fiscal_year IN ('FY24', 'FY27')
GROUP BY fiscal_year
ORDER BY fiscal_year;
