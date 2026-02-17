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
-- FY26 Fullmind categories: FY25→FY26 comparison
fullmind_fy26 AS (
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
    END AS fy26_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
-- FY25 Fullmind categories: FY24→FY25 comparison
-- multi_year and lapsed require fy24_net_invoicing, which does not exist yet.
-- All revenue districts show as 'new'. Pipeline categories omitted (no fy25_open_pipeline).
fullmind_fy25 AS (
  SELECT
    d.leaid,
    CASE
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
      THEN 'new'

      WHEN ip.leaid IS NOT NULL
        AND COALESCE(d.fy25_net_invoicing, 0) = 0
      THEN 'target'

      ELSE NULL
    END AS fy25_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
-- Per-vendor competitor categories: FY26 (FY25→FY26 spend)
vendor_fy26 AS (
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
),
-- Per-vendor competitor categories: FY25 (FY24→FY25 spend)
vendor_fy25 AS (
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
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
  f26.fy26_fullmind_category,
  f25.fy25_fullmind_category,
  MAX(CASE WHEN v26.competitor = 'Proximity Learning' THEN v26.category END) AS fy26_proximity_category,
  MAX(CASE WHEN v26.competitor = 'Elevate K12' THEN v26.category END) AS fy26_elevate_category,
  MAX(CASE WHEN v26.competitor = 'Tutored By Teachers' THEN v26.category END) AS fy26_tbt_category,
  MAX(CASE WHEN v25.competitor = 'Proximity Learning' THEN v25.category END) AS fy25_proximity_category,
  MAX(CASE WHEN v25.competitor = 'Elevate K12' THEN v25.category END) AS fy25_elevate_category,
  MAX(CASE WHEN v25.competitor = 'Tutored By Teachers' THEN v25.category END) AS fy25_tbt_category,
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
LEFT JOIN fullmind_fy26 f26 ON d.leaid = f26.leaid
LEFT JOIN fullmind_fy25 f25 ON d.leaid = f25.leaid
LEFT JOIN vendor_fy26 v26 ON d.leaid = v26.leaid
LEFT JOIN vendor_fy25 v25 ON d.leaid = v25.leaid
WHERE d.geometry IS NOT NULL OR d.point_location IS NOT NULL
GROUP BY d.leaid, d.name, d.state_abbrev, d.sales_executive,
         pm.plan_ids, f26.fy26_fullmind_category, f25.fy25_fullmind_category,
         d.geometry, d.account_type, d.point_location;

-- Indexes
CREATE INDEX idx_dmf_leaid ON district_map_features(leaid);
CREATE INDEX idx_dmf_state ON district_map_features(state_abbrev);
CREATE INDEX idx_dmf_owner ON district_map_features(sales_executive);
CREATE INDEX idx_dmf_geometry ON district_map_features USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_dmf_render_geometry ON district_map_features USING GIST (render_geometry);
CREATE INDEX idx_dmf_has_data_fy26 ON district_map_features(fy26_fullmind_category)
  WHERE fy26_fullmind_category IS NOT NULL
     OR fy26_proximity_category IS NOT NULL
     OR fy26_elevate_category IS NOT NULL
     OR fy26_tbt_category IS NOT NULL;

CREATE INDEX idx_dmf_has_data_fy25 ON district_map_features(fy25_fullmind_category)
  WHERE fy25_fullmind_category IS NOT NULL
     OR fy25_proximity_category IS NOT NULL
     OR fy25_elevate_category IS NOT NULL
     OR fy25_tbt_category IS NOT NULL;

ANALYZE district_map_features;

-- Summary
SELECT
  'district_map_features created: ' || COUNT(*) || ' districts' AS status,
  COUNT(*) FILTER (WHERE fy26_fullmind_category IS NOT NULL) AS fy26_fullmind,
  COUNT(*) FILTER (WHERE fy25_fullmind_category IS NOT NULL) AS fy25_fullmind,
  COUNT(*) FILTER (WHERE fy26_proximity_category IS NOT NULL) AS fy26_proximity,
  COUNT(*) FILTER (WHERE fy25_proximity_category IS NOT NULL) AS fy25_proximity,
  COUNT(*) FILTER (WHERE fy26_elevate_category IS NOT NULL) AS fy26_elevate,
  COUNT(*) FILTER (WHERE fy25_elevate_category IS NOT NULL) AS fy25_elevate,
  COUNT(*) FILTER (WHERE fy26_tbt_category IS NOT NULL) AS fy26_tbt,
  COUNT(*) FILTER (WHERE fy25_tbt_category IS NOT NULL) AS fy25_tbt
FROM district_map_features;
