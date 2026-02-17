-- Multi-vendor layer materialized view
-- Replaces district_customer_categories and district_vendor_comparison
-- Exports all filter + vendor category fields for vector tiles

DROP MATERIALIZED VIEW IF EXISTS district_map_features;

CREATE MATERIALIZED VIEW district_map_features AS
WITH plan_memberships AS (
  -- Comma-separated plan IDs per district
  SELECT
    district_leaid AS leaid,
    STRING_AGG(plan_id, ',' ORDER BY plan_id) AS plan_ids
  FROM territory_plan_districts
  GROUP BY district_leaid
),
in_plan AS (
  -- Simple boolean: is this district in ANY plan?
  SELECT DISTINCT district_leaid AS leaid
  FROM territory_plan_districts
),
fullmind_cats AS (
  SELECT
    d.leaid,
    CASE
      -- Active customers (have FY26 revenue)
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'multi_year'

      WHEN COALESCE(d.fy26_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'new'

      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND NOT COALESCE(d.fy26_net_invoicing, 0) > 0
      THEN 'lapsed'

      -- Pipeline stages (no FY26 revenue yet)
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > COALESCE(d.fy25_net_invoicing, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(d.fy26_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_pipeline'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
-- Per-vendor competitor categories
vendor_cats AS (
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY26' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY26' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'churned'
      ELSE NULL
    END AS category
  FROM competitor_spend cs
  WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
  GROUP BY cs.leaid, cs.competitor
)
SELECT
  d.leaid,
  d.name,
  d.state_abbrev,
  d.sales_executive,
  pm.plan_ids,
  fc.fullmind_category,
  MAX(CASE WHEN vc.competitor = 'Proximity Learning' THEN vc.category END) AS proximity_category,
  MAX(CASE WHEN vc.competitor = 'Elevate K12' THEN vc.category END) AS elevate_category,
  MAX(CASE WHEN vc.competitor = 'Tutored By Teachers' THEN vc.category END) AS tbt_category,
  -- Signal columns: bucket trends into categories
  CASE
    WHEN d.enrollment_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.enrollment_trend_3yr >= 1  THEN 'growth'
    WHEN d.enrollment_trend_3yr >= -1 THEN 'stable'
    WHEN d.enrollment_trend_3yr >= -5 THEN 'decline'
    WHEN d.enrollment_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS enrollment_signal,
  CASE
    WHEN d.ell_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.ell_trend_3yr >= 1  THEN 'growth'
    WHEN d.ell_trend_3yr >= -1 THEN 'stable'
    WHEN d.ell_trend_3yr >= -5 THEN 'decline'
    WHEN d.ell_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS ell_signal,
  CASE
    WHEN d.swd_trend_3yr >= 5  THEN 'strong_growth'
    WHEN d.swd_trend_3yr >= 1  THEN 'growth'
    WHEN d.swd_trend_3yr >= -1 THEN 'stable'
    WHEN d.swd_trend_3yr >= -5 THEN 'decline'
    WHEN d.swd_trend_3yr < -5  THEN 'strong_decline'
    ELSE NULL
  END AS swd_signal,
  CASE
    WHEN d.urban_centric_locale IN (11, 12, 13) THEN 'city'
    WHEN d.urban_centric_locale IN (21, 22, 23) THEN 'suburb'
    WHEN d.urban_centric_locale IN (31, 32, 33) THEN 'town'
    WHEN d.urban_centric_locale IN (41, 42, 43) THEN 'rural'
    ELSE NULL
  END AS locale_signal,
  -- Per pupil expenditure signal: uses pre-computed state quartile
  d.expenditure_pp_quartile_state AS expenditure_signal,
  d.geometry,
  d.account_type,
  d.point_location,
  COALESCE(d.geometry, d.point_location) AS render_geometry
FROM districts d
LEFT JOIN plan_memberships pm ON d.leaid = pm.leaid
LEFT JOIN fullmind_cats fc ON d.leaid = fc.leaid
LEFT JOIN vendor_cats vc ON d.leaid = vc.leaid
WHERE d.geometry IS NOT NULL OR d.point_location IS NOT NULL
GROUP BY d.leaid, d.name, d.state_abbrev, d.sales_executive,
         pm.plan_ids, fc.fullmind_category, d.geometry,
         d.account_type, d.point_location;

-- Indexes
CREATE INDEX idx_dmf_leaid ON district_map_features(leaid);
CREATE INDEX idx_dmf_state ON district_map_features(state_abbrev);
CREATE INDEX idx_dmf_owner ON district_map_features(sales_executive);
CREATE INDEX idx_dmf_geometry ON district_map_features USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_dmf_render_geometry ON district_map_features USING GIST (render_geometry);
CREATE INDEX idx_dmf_has_data ON district_map_features(fullmind_category)
  WHERE fullmind_category IS NOT NULL
     OR proximity_category IS NOT NULL
     OR elevate_category IS NOT NULL
     OR tbt_category IS NOT NULL;

ANALYZE district_map_features;

-- Summary
SELECT
  'district_map_features created: ' || COUNT(*) || ' districts' AS status,
  COUNT(*) FILTER (WHERE fullmind_category IS NOT NULL) AS fullmind_districts,
  COUNT(*) FILTER (WHERE proximity_category IS NOT NULL) AS proximity_districts,
  COUNT(*) FILTER (WHERE elevate_category IS NOT NULL) AS elevate_districts,
  COUNT(*) FILTER (WHERE tbt_category IS NOT NULL) AS tbt_districts
FROM district_map_features;
