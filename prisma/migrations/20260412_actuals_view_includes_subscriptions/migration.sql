-- Extend district_opportunity_actuals materialized view to include
-- Elevate K12 subscription revenue AND fix a long-standing stage parser
-- gap that hid all closed-won bookings.
--
-- Background (subscription revenue):
-- After PR #109 added the subscriptions table and rolled subscription
-- revenue into vendor='fullmind' rows in district_financials, the district
-- detail panel showed correct numbers. But the leaderboard reads from a
-- different source — the district_opportunity_actuals materialized view —
-- which aggregates only from the opportunities table. EK12 opportunities
-- have $0 in their session-derived revenue columns, so EK12 reps showed
-- $0 revenue and $0 take on the leaderboard despite having $13.8M of
-- contracted subscription revenue. The new opp_subscriptions CTE pre-
-- aggregates subscriptions per opportunity (avoiding row multiplication on
-- the join), then adds sub_revenue into total_revenue and completed_revenue.
-- Take is intentionally untouched — we don't have a take rate concept for
-- subscriptions. avg_take_rate is computed against the session-only revenue
-- base (the raw column reference, not the new output column) so it stays
-- meaningful as a session-margin metric.
--
-- Background (stage parser):
-- The previous matview's stage_prefix expression only handled numeric stage
-- prefixes (e.g., "0 - Lead", "3 - Proposal"). The Salesforce LMS does NOT
-- use numeric stages for closed-won; closed-won is the text label
-- "Closed Won" (and variants like "Active", "Position Purchased",
-- "Requisition Received", "Return Position Pending"). As a result, every
-- closed-won opportunity returned NULL stage_prefix and was excluded from
-- both bookings AND open_pipeline. The matview's "bookings" column has been
-- $0 across the board since it was created. This migration fixes the parser
-- to match what refresh_fullmind_financials() already does, surfacing
-- ~$68M of previously-invisible closed-won bookings (Fullmind + EK12).
--
-- Canonical source: scripts/district-opportunity-actuals-view.sql

DROP MATERIALIZED VIEW IF EXISTS district_opportunity_actuals;

CREATE MATERIALIZED VIEW district_opportunity_actuals AS
WITH stage_weights AS (
  SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
         unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
),
opp_subscriptions AS (
  SELECT
    opportunity_id,
    COALESCE(SUM(net_total), 0) AS sub_revenue,
    COUNT(*) AS sub_count
  FROM subscriptions
  GROUP BY opportunity_id
),
categorized_opps AS (
  SELECT
    o.*,
    COALESCE(os.sub_revenue, 0) AS sub_revenue,
    COALESCE(os.sub_count, 0)   AS sub_count,
    CASE
      WHEN LOWER(o.contract_type) LIKE '%renewal%' THEN 'renewal'
      WHEN LOWER(o.contract_type) LIKE '%winback%' OR LOWER(o.contract_type) LIKE '%win back%' THEN 'winback'
      WHEN LOWER(o.contract_type) LIKE '%expansion%' THEN 'expansion'
      ELSE 'new_business'
    END AS category,
    CASE
      WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::int
      WHEN LOWER(o.stage) IN ('closed won', 'active', 'position purchased',
        'requisition received', 'return position pending') THEN 6
      WHEN LOWER(o.stage) = 'closed lost' THEN -1
      ELSE NULL
    END AS stage_prefix
  FROM opportunities o
  LEFT JOIN opp_subscriptions os ON os.opportunity_id = o.id
  WHERE o.district_lea_id IS NOT NULL
)
SELECT
  co.district_lea_id,
  co.school_yr,
  co.sales_rep_email,
  co.category,
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS open_pipeline,
  COALESCE(SUM(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS weighted_pipeline,
  COALESCE(SUM(co.total_revenue), 0)     + COALESCE(SUM(co.sub_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) + COALESCE(SUM(co.sub_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  COALESCE(SUM(co.total_take), 0) AS total_take,
  COALESCE(SUM(co.completed_take), 0) AS completed_take,
  COALESCE(SUM(co.scheduled_take), 0) AS scheduled_take,
  CASE WHEN SUM(co.total_revenue) > 0
    THEN SUM(co.total_take) / SUM(co.total_revenue)
    ELSE NULL
  END AS avg_take_rate,
  COALESCE(SUM(co.invoiced), 0) AS invoiced,
  COALESCE(SUM(co.credited), 0) AS credited,
  COUNT(*)::int AS opp_count,
  COALESCE(SUM(co.sub_count), 0)::int AS subscription_count
FROM categorized_opps co
LEFT JOIN stage_weights sw ON sw.prefix = co.stage_prefix
GROUP BY co.district_lea_id, co.school_yr, co.sales_rep_email, co.category;

CREATE INDEX idx_doa_district           ON district_opportunity_actuals (district_lea_id);
CREATE INDEX idx_doa_school_yr          ON district_opportunity_actuals (school_yr);
CREATE INDEX idx_doa_rep                ON district_opportunity_actuals (sales_rep_email);
CREATE INDEX idx_doa_category           ON district_opportunity_actuals (category);
CREATE INDEX idx_doa_district_yr        ON district_opportunity_actuals (district_lea_id, school_yr);
CREATE INDEX idx_doa_district_yr_rep    ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email);
CREATE UNIQUE INDEX idx_doa_unique      ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email, category);

ANALYZE district_opportunity_actuals;
