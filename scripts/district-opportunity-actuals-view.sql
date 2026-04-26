-- scripts/district-opportunity-actuals-view.sql
-- Materialized view: district_opportunity_actuals
-- Aggregates opportunities by district, school year, sales rep, and category.
-- Refreshed after each scheduler sync cycle (hourly).
--
-- Subscription handling: Elevate K12 contracts (acquired post-merger) live in
-- the opportunities table but their session-derived revenue columns are zero
-- because EK12 uses subscriptions, not sessions. The opp_subscriptions CTE
-- pre-aggregates subscription net_total per opportunity (signed sums so
-- credits offset positives), and that revenue is added into total_revenue
-- and completed_revenue at the final SELECT level. Take is intentionally
-- left untouched — we don't have an educator-cost / take rate concept for
-- subscriptions, so adding sub revenue to take would be invented data.

DROP MATERIALIZED VIEW IF EXISTS district_opportunity_actuals;

CREATE MATERIALIZED VIEW district_opportunity_actuals AS
WITH stage_weights AS (
  SELECT unnest(ARRAY[0, 1, 2, 3, 4, 5]) AS prefix,
         unnest(ARRAY[0.05, 0.10, 0.25, 0.50, 0.75, 0.90]) AS weight
),
opp_subscriptions AS (
  -- Pre-aggregate subscriptions per opportunity. Done in a separate CTE so
  -- the LEFT JOIN below contributes one row per opportunity (avoiding the
  -- row multiplication that would happen if we joined the raw subscriptions
  -- table directly into categorized_opps).
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
    -- Contract chain key for min-purchase aggregation. Add-on opportunities
    -- share a chain_key with their parent contract so we can MAX their
    -- cumulative min_purchase per chain, then SUM across chains in a bucket.
    --
    -- Two normalizations, applied in order:
    --   1. Strip the district-name prefix (everything up to and including the
    --      first underscore). Names like "Douglas County Schools_Tier 1_..."
    --      and "Douglas County_Tier 1_..." then collapse to "Tier 1_..." so
    --      inconsistent district names within the same district_lea_id don't
    --      split a single contract into two chains. Safe because the
    --      chain_key is scoped to a single (district, rep, year, category)
    --      bucket in the outer aggregation.
    --   2. Strip " Add-On [N]" / "_AddOn" / " Add On" (case-insensitive) so
    --      add-ons collapse into their parent chain.
    --
    -- Falls back to the opp id when name is NULL so orphan opps become their
    -- own singleton chains.
    COALESCE(
      regexp_replace(
        regexp_replace(o.name, '^[^_]*_', ''),
        '[\s_]+Add[-_ ]?On[s]?(\s*\d+)?', '', 'gi'
      ),
      o.id
    ) AS chain_key,
    -- Stage prefix bucket (matches the logic in refresh_fullmind_financials).
    -- Numeric prefix 0-5 → open pipeline
    -- Numeric prefix 6+ → closed-won
    -- Text "Closed Won" / "Active" / "Position Purchased" / etc → closed-won (6)
    -- Text "Closed Lost" → -1 (excluded from both bookings and pipeline)
    -- LMS doesn't actually emit numeric 6+ stages; closed-won is text-only,
    -- so the text branch is required for any closed-won bookings to show up.
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
),
-- Per-chain closed-won contract floor. Salesforce stores each add-on's
-- minimum_purchase_amount as the CUMULATIVE contract value at that point
-- (each add-on = prior contract total + its own net_booking_amount). MAX
-- per chain picks the final cumulative value = true contract floor. Summing
-- chain floors across a bucket then correctly handles the case where a
-- district+rep+year+category has multiple independent contracts (e.g. a
-- Tier 1 Renewal chain and a separate Tier 1 New Business chain).
chain_floors AS (
  SELECT
    district_lea_id,
    school_yr,
    sales_rep_email,
    category,
    chain_key,
    MAX(minimum_purchase_amount) FILTER (WHERE stage_prefix >= 6) AS chain_floor
  FROM categorized_opps
  GROUP BY district_lea_id, school_yr, sales_rep_email, category, chain_key
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
  co.district_lea_id,
  co.school_yr,
  co.sales_rep_email,
  co.category,
  -- Bookings: closed-won (stage prefix >= 6)
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix >= 6), 0) AS bookings,
  -- Min-purchase bookings: SUM over chains, MAX within each chain (see chain_floors CTE).
  -- Historical opps were backfilled from invoiced + credited — see
  -- prisma/migrations/manual/2026-04-15-backfill-min-purchase-from-net-billings.sql.
  -- Used by the leaderboard's "Min Purchases" column.
  COALESCE(MAX(bmp.min_purchase_bookings), 0) AS min_purchase_bookings,
  -- Open pipeline: stages 0-5, unweighted
  COALESCE(SUM(co.net_booking_amount) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS open_pipeline,
  -- Weighted pipeline
  COALESCE(SUM(co.net_booking_amount * sw.weight) FILTER (WHERE co.stage_prefix BETWEEN 0 AND 5), 0) AS weighted_pipeline,
  -- Revenue: Fullmind session-derived totals + Elevate K12 subscription revenue
  -- (sub_revenue is signed so credits/cancellations offset positives)
  COALESCE(SUM(co.total_revenue), 0)     + COALESCE(SUM(co.sub_revenue), 0) AS total_revenue,
  COALESCE(SUM(co.completed_revenue), 0) + COALESCE(SUM(co.sub_revenue), 0) AS completed_revenue,
  COALESCE(SUM(co.scheduled_revenue), 0) AS scheduled_revenue,
  -- Take (unchanged — no take rate concept for subscriptions)
  COALESCE(SUM(co.total_take), 0) AS total_take,
  COALESCE(SUM(co.completed_take), 0) AS completed_take,
  COALESCE(SUM(co.scheduled_take), 0) AS scheduled_take,
  -- Take rate computed against session-only revenue base (the raw column,
  -- not the output column that now includes sub_revenue). Keeps the rate
  -- meaningful as a session-margin metric instead of getting diluted to 0
  -- by EK12 subscription revenue.
  CASE WHEN SUM(co.total_revenue) > 0
    THEN SUM(co.total_take) / SUM(co.total_revenue)
    ELSE NULL
  END AS avg_take_rate,
  -- Financial
  COALESCE(SUM(co.invoiced), 0) AS invoiced,
  COALESCE(SUM(co.credited), 0) AS credited,
  -- Counts
  COUNT(*)::int AS opp_count,
  COALESCE(SUM(co.sub_count), 0)::int AS subscription_count
FROM categorized_opps co
LEFT JOIN stage_weights sw ON sw.prefix = co.stage_prefix
LEFT JOIN bucket_min_purchase bmp
  ON bmp.district_lea_id = co.district_lea_id
 AND bmp.school_yr = co.school_yr
 AND (bmp.sales_rep_email IS NOT DISTINCT FROM co.sales_rep_email)
 AND bmp.category = co.category
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
