-- Refresh Fullmind district_financials from opportunities + sessions
-- Called after each Railway sync cycle
--
-- Revenue/take/bookings/pipeline: from opportunities (Railway pre-computed)
-- Session counts: from sessions table (actual count by start_time school year)
-- Only includes opps that join to a valid district in the districts table
--
-- Stage mapping:
--   Numeric prefix (0-5): open pipeline, with weighted probability
--   Numeric prefix (6+): closed won
--   "Closed Won", "Active", "Position Purchased", etc.: treated as closed won (6)
--   "Closed Lost": excluded from bookings/pipeline

CREATE OR REPLACE FUNCTION refresh_fullmind_financials()
RETURNS void AS $$
BEGIN

  CREATE TEMP TABLE _opp_agg AS
  WITH stage_weights AS (
    SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
           unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
  ),
  opps_with_stage AS (
    SELECT o.*,
      CASE
        WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::int
        WHEN LOWER(o.stage) IN ('closed won', 'active', 'position purchased',
          'requisition received', 'return position pending') THEN 6
        WHEN LOWER(o.stage) = 'closed lost' THEN -1
        ELSE NULL
      END AS stage_num
    FROM opportunities o
    JOIN districts d ON d.leaid = o.district_lea_id
    WHERE o.district_lea_id IS NOT NULL
      AND o.school_yr IS NOT NULL
  )
  SELECT
    ows.district_lea_id AS leaid,
    'FY' || RIGHT(ows.school_yr, 2) AS fiscal_year,
    COALESCE(SUM(ows.completed_revenue), 0) AS completed_revenue,
    COALESCE(SUM(ows.scheduled_revenue), 0) AS scheduled_revenue,
    COALESCE(SUM(ows.total_revenue), 0) AS total_revenue,
    COALESCE(SUM(ows.completed_take), 0) AS completed_take,
    COALESCE(SUM(ows.scheduled_take), 0) AS scheduled_take,
    COALESCE(SUM(ows.total_take), 0) AS total_take,
    COALESCE(SUM(ows.invoiced), 0) AS invoicing,
    COALESCE(SUM(ows.net_booking_amount) FILTER (
      WHERE ows.stage_num >= 6
    ), 0) AS closed_won_bookings,
    COALESCE(SUM(ows.net_booking_amount) FILTER (
      WHERE ows.stage_num BETWEEN 0 AND 5
    ), 0) AS open_pipeline,
    COALESCE(SUM(ows.net_booking_amount * sw.weight) FILTER (
      WHERE ows.stage_num BETWEEN 0 AND 5
    ), 0) AS weighted_pipeline,
    COUNT(*) FILTER (WHERE ows.stage_num >= 6) AS closed_won_opp_count,
    COUNT(*) FILTER (WHERE ows.stage_num BETWEEN 0 AND 5) AS open_pipeline_opp_count
  FROM opps_with_stage ows
  LEFT JOIN stage_weights sw ON sw.prefix = ows.stage_num
  WHERE ows.stage_num IS NOT NULL AND ows.stage_num >= 0
  GROUP BY ows.district_lea_id, ows.school_yr;

  -- Session counts by district + school year (derived from start_time)
  CREATE TEMP TABLE _session_counts AS
  SELECT
    o.district_lea_id AS leaid,
    'FY' || CASE
      WHEN EXTRACT(MONTH FROM s.start_time) >= 7
      THEN RIGHT((EXTRACT(YEAR FROM s.start_time)::int + 1)::text, 2)
      ELSE RIGHT(EXTRACT(YEAR FROM s.start_time)::int::text, 2)
    END AS fiscal_year,
    COUNT(*) AS session_count
  FROM sessions s
  JOIN opportunities o ON o.id = s.opportunity_id
  JOIN districts d ON d.leaid = o.district_lea_id
  WHERE o.district_lea_id IS NOT NULL
    AND s.start_time IS NOT NULL
  GROUP BY o.district_lea_id, fiscal_year;

  -- Upsert combined results into district_financials
  INSERT INTO district_financials (
    leaid, vendor, fiscal_year,
    completed_revenue, scheduled_revenue, total_revenue,
    completed_take, scheduled_take, total_take,
    session_count,
    closed_won_bookings, open_pipeline, weighted_pipeline,
    invoicing, closed_won_opp_count, open_pipeline_opp_count,
    last_updated
  )
  SELECT
    COALESCE(oa.leaid, sc.leaid),
    'fullmind',
    COALESCE(oa.fiscal_year, sc.fiscal_year),
    COALESCE(oa.completed_revenue, 0),
    COALESCE(oa.scheduled_revenue, 0),
    COALESCE(oa.total_revenue, 0),
    COALESCE(oa.completed_take, 0),
    COALESCE(oa.scheduled_take, 0),
    COALESCE(oa.total_take, 0),
    COALESCE(sc.session_count, 0)::int,
    COALESCE(oa.closed_won_bookings, 0),
    COALESCE(oa.open_pipeline, 0),
    COALESCE(oa.weighted_pipeline, 0),
    COALESCE(oa.invoicing, 0),
    COALESCE(oa.closed_won_opp_count, 0)::int,
    COALESCE(oa.open_pipeline_opp_count, 0)::int,
    NOW()
  FROM _opp_agg oa
  FULL OUTER JOIN _session_counts sc ON oa.leaid = sc.leaid AND oa.fiscal_year = sc.fiscal_year
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

  DROP TABLE _opp_agg;
  DROP TABLE _session_counts;

END;
$$ LANGUAGE plpgsql;
