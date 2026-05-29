-- Re-create district_opportunity_actuals deriving `category` (sales motion) from
-- the district's CLOSED-WON HISTORY instead of keyword-matching contract_type.
--
-- Why: opportunities have no sales-motion field. contract_type encodes the
-- product tier ("Tier 1", "Hybrid Staffing", "Mixed", …), so the old CASE matched
-- none of renewal/winback/expansion and dumped ~100% of opps into new_business
-- (e.g. Jenn Russart FY27 showed 100% new biz though Rockdale etc. are returning
-- customers). Verified read-only before applying: with this logic Jenn FY27 splits
-- renewal 23 / new 11, Rockdale FY27 → renewal, FY27 overall renewal 253 / new 159
-- / winback 21.
--
-- New derivation, per (district, school_yr) — closed-won = stage_prefix >= 6:
--   renewal      → district had closed-won in the PRIOR school year (Return)
--   winback      → closed-won in an older year but NOT the prior year (lapsed)
--   new_business → no prior closed-won
-- Expansion folds into renewal (no signal separates incremental-vs-renewal).
--
-- Totals (bookings/pipeline/revenue/take) are unchanged — this only relabels the
-- category each row sums into. Category-agnostic consumers (leaderboard) are
-- unaffected. Source of truth: scripts/district-opportunity-actuals-view.sql.
-- Apply, then REFRESH MATERIALIZED VIEW district_opportunity_actuals.

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
base_opps AS (
  SELECT
    o.*,
    COALESCE(os.sub_revenue, 0) AS sub_revenue,
    COALESCE(os.sub_count, 0)   AS sub_count,
    COALESCE(
      regexp_replace(
        regexp_replace(o.name, '^[^_]*_', ''),
        '[\s_]+Add[-_ ]?On[s]?(\s*\d+)?', '', 'gi'
      ),
      o.id
    ) AS chain_key,
    CASE
      WHEN o.stage ~ '^\d' THEN (regexp_match(o.stage, '^(\d+)'))[1]::int
      WHEN LOWER(o.stage) IN ('closed won', 'active', 'position purchased',
        'requisition received', 'return position pending') THEN 6
      WHEN LOWER(o.stage) = 'closed lost' THEN -1
      ELSE NULL
    END AS stage_prefix
  FROM opportunities o
  LEFT JOIN opp_subscriptions os ON os.opportunity_id = o.id
),
won_years AS (
  SELECT DISTINCT
    COALESCE(district_lea_id, '_NOMAP') AS district_lea_id,
    LEFT(school_yr, 4)::int AS start_year
  FROM base_opps
  WHERE stage_prefix >= 6 AND school_yr ~ '^\d{4}-'
),
categorized_opps AS (
  SELECT
    b.*,
    CASE
      WHEN b.school_yr !~ '^\d{4}-' THEN 'new_business'
      WHEN EXISTS (
        SELECT 1 FROM won_years w
        WHERE w.district_lea_id = COALESCE(b.district_lea_id, '_NOMAP')
          AND w.start_year = LEFT(b.school_yr, 4)::int - 1
      ) THEN 'renewal'
      WHEN EXISTS (
        SELECT 1 FROM won_years w
        WHERE w.district_lea_id = COALESCE(b.district_lea_id, '_NOMAP')
          AND w.start_year < LEFT(b.school_yr, 4)::int
      ) THEN 'winback'
      ELSE 'new_business'
    END AS category
  FROM base_opps b
),
chain_floors AS (
  SELECT
    COALESCE(district_lea_id, '_NOMAP') AS district_lea_id,
    school_yr,
    sales_rep_email,
    category,
    chain_key,
    MAX(minimum_purchase_amount) FILTER (WHERE stage_prefix >= 6) AS chain_floor
  FROM categorized_opps
  GROUP BY COALESCE(district_lea_id, '_NOMAP'), school_yr, sales_rep_email, category, chain_key
),
bucket_min_purchase AS (
  SELECT
    district_lea_id,
    school_yr,
    sales_rep_email,
    category,
    COALESCE(SUM(chain_floor), 0) AS min_purchase_bookings
  FROM chain_floors
  GROUP BY district_lea_id, school_yr, sales_rep_email, category
)
SELECT
  COALESCE(co.district_lea_id, '_NOMAP') AS district_lea_id,
  co.school_yr,
  co.sales_rep_email,
  co.category,
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
  COALESCE(MAX(bmp.min_purchase_bookings), 0) AS min_purchase_bookings,
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS open_pipeline,
  COALESCE(SUM(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS weighted_pipeline,
  COALESCE(SUM(co.total_revenue), 0)     + COALESCE(SUM(co.sub_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) + COALESCE(SUM(co.sub_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  COALESCE(SUM(co.sub_revenue), 0) AS sub_revenue,
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
LEFT JOIN bucket_min_purchase bmp
  ON bmp.district_lea_id = COALESCE(co.district_lea_id, '_NOMAP')
 AND bmp.school_yr = co.school_yr
 AND (bmp.sales_rep_email IS NOT DISTINCT FROM co.sales_rep_email)
 AND bmp.category = co.category
GROUP BY COALESCE(co.district_lea_id, '_NOMAP'), co.school_yr, co.sales_rep_email, co.category;

CREATE INDEX idx_doa_district ON district_opportunity_actuals (district_lea_id);
CREATE INDEX idx_doa_school_yr ON district_opportunity_actuals (school_yr);
CREATE INDEX idx_doa_rep ON district_opportunity_actuals (sales_rep_email);
CREATE INDEX idx_doa_category ON district_opportunity_actuals (category);
CREATE INDEX idx_doa_district_yr ON district_opportunity_actuals (district_lea_id, school_yr);
CREATE INDEX idx_doa_district_yr_rep ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email);
CREATE UNIQUE INDEX idx_doa_unique ON district_opportunity_actuals (district_lea_id, school_yr, sales_rep_email, category);

ANALYZE district_opportunity_actuals;
