-- scripts/district-opportunity-actuals-view.sql
-- Materialized view: district_opportunity_actuals
-- Aggregates opportunities by district, school year, sales rep, and category.
-- Refreshed after each scheduler sync cycle (hourly).

DROP MATERIALIZED VIEW IF EXISTS district_opportunity_actuals;

CREATE MATERIALIZED VIEW district_opportunity_actuals AS
WITH stage_weights AS (
  SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
         unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
),
categorized_opps AS (
  SELECT
    o.*,
    CASE
      WHEN LOWER(o.contract_type) LIKE '%renewal%' THEN 'renewal'
      WHEN LOWER(o.contract_type) LIKE '%winback%' OR LOWER(o.contract_type) LIKE '%win back%' THEN 'winback'
      WHEN LOWER(o.contract_type) LIKE '%expansion%' THEN 'expansion'
      ELSE 'new_business'
    END AS category,
    -- Extract numeric stage prefix (first character(s) before space or dash)
    CASE
      WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::int
      ELSE NULL
    END AS stage_prefix
  FROM opportunities o
  WHERE o.district_lea_id IS NOT NULL
)
SELECT
  co.district_lea_id,
  co.school_yr,
  co.sales_rep_email,
  co.category,
  -- Bookings: closed-won (stage prefix >= 6)
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
  -- Open pipeline: stages 0-5, unweighted
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS open_pipeline,
  -- Weighted pipeline
  COALESCE(SUM(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS weighted_pipeline,
  -- Revenue
  COALESCE(SUM(co.total_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  -- Take
  COALESCE(SUM(co.total_take), 0) AS total_take,
  COALESCE(SUM(co.completed_take), 0) AS completed_take,
  COALESCE(SUM(co.scheduled_take), 0) AS scheduled_take,
  -- Take rate (per-row, do NOT SUM across rows)
  CASE WHEN SUM(co.total_revenue) > 0
    THEN SUM(co.total_take) / SUM(co.total_revenue)
    ELSE NULL
  END AS avg_take_rate,
  -- Financial
  COALESCE(SUM(co.invoiced), 0) AS invoiced,
  COALESCE(SUM(co.credited), 0) AS credited,
  -- Count
  COUNT(*)::int AS opp_count
FROM categorized_opps co
LEFT JOIN stage_weights sw ON sw.prefix = co.stage_prefix
GROUP BY co.district_lea_id, co.school_yr, co.sales_rep_email, co.category;

-- Indexes for query patterns
CREATE INDEX idx_doa_district ON district_opportunity_actuals (district_lea_id);
CREATE INDEX idx_doa_school_yr ON district_opportunity_actuals (school_yr);
CREATE INDEX idx_doa_rep ON district_opportunity_actuals (sales_rep_email);
CREATE INDEX idx_doa_category ON district_opportunity_actuals (category);
CREATE INDEX idx_doa_district_yr ON district_opportunity_actuals (district_lea_id, school_yr);
CREATE INDEX idx_doa_district_yr_rep ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email);

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_doa_unique ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email, category);

ANALYZE district_opportunity_actuals;

-- Verify
SELECT COUNT(*) AS row_count,
       COUNT(DISTINCT district_lea_id) AS district_count,
       COUNT(DISTINCT school_yr) AS fy_count
FROM district_opportunity_actuals;
