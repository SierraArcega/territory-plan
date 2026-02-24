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
-- FY27 Fullmind categories: FY26→FY27 comparison
-- No fy27 revenue data yet, only fy27_open_pipeline.
-- Prior-year revenue from vendor_financials FY26.
fullmind_fy27 AS (
  SELECT
    d.leaid,
    CASE
      -- Pipeline stages using fy27_open_pipeline vs FY26 total_revenue
      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND COALESCE(d.fy27_open_pipeline, 0) > COALESCE(vf26.total_revenue, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND COALESCE(d.fy27_open_pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(d.fy27_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM vendor_financials vf
          WHERE vf.leaid = d.leaid AND vf.vendor = 'fullmind' AND vf.total_revenue > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(d.fy27_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_business_pipeline'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fy27_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
  LEFT JOIN vendor_financials vf26 ON d.leaid = vf26.leaid
    AND vf26.vendor = 'fullmind' AND vf26.fiscal_year = 'FY26'
),
-- FY26 Fullmind categories: FY25→FY26 comparison (revenue-based via vendor_financials)
fullmind_fy26 AS (
  SELECT
    d.leaid,
    CASE
      -- Multi-year customers: total_revenue in both FY25 and FY26
      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
        AND vf26.total_revenue > vf25.total_revenue
      THEN 'multi_year_growing'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
        AND vf26.total_revenue < vf25.total_revenue
      THEN 'multi_year_shrinking'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(vf26.total_revenue, 0) > 0
      THEN 'multi_year_flat'

      -- New customer: FY26 revenue but no FY25 revenue
      WHEN COALESCE(vf26.total_revenue, 0) > 0
        AND NOT COALESCE(vf25.total_revenue, 0) > 0
      THEN 'new'

      -- Pipeline (checked BEFORE lapsed — active pipeline trumps churn)
      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > COALESCE(vf25.total_revenue, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND COALESCE(d.fy26_open_pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(d.fy26_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM vendor_financials vf
          WHERE vf.leaid = d.leaid AND vf.vendor = 'fullmind' AND vf.total_revenue > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(d.fy26_open_pipeline, 0) > 0
        AND ip.leaid IS NOT NULL
      THEN 'new_business_pipeline'

      -- Lapsed: had FY25 revenue, no FY26 revenue, no active pipeline
      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND NOT COALESCE(vf26.total_revenue, 0) > 0
      THEN 'lapsed'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fy26_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
  LEFT JOIN vendor_financials vf25 ON d.leaid = vf25.leaid
    AND vf25.vendor = 'fullmind' AND vf25.fiscal_year = 'FY25'
  LEFT JOIN vendor_financials vf26 ON d.leaid = vf26.leaid
    AND vf26.vendor = 'fullmind' AND vf26.fiscal_year = 'FY26'
),
-- FY25 Fullmind categories: FY24→FY25 comparison (revenue-based via vendor_financials)
-- No fy25_open_pipeline column exists, so pipeline categories are omitted.
fullmind_fy25 AS (
  SELECT
    d.leaid,
    CASE
      -- Multi-year: total_revenue in both FY24 and FY25
      WHEN COALESCE(vf24.total_revenue, 0) > 0
        AND COALESCE(vf25.total_revenue, 0) > 0
        AND vf25.total_revenue > vf24.total_revenue
      THEN 'multi_year_growing'

      WHEN COALESCE(vf24.total_revenue, 0) > 0
        AND COALESCE(vf25.total_revenue, 0) > 0
        AND vf25.total_revenue < vf24.total_revenue
      THEN 'multi_year_shrinking'

      WHEN COALESCE(vf24.total_revenue, 0) > 0
        AND COALESCE(vf25.total_revenue, 0) > 0
      THEN 'multi_year_flat'

      -- New customer: FY25 revenue but no FY24 revenue
      WHEN COALESCE(vf25.total_revenue, 0) > 0
        AND NOT COALESCE(vf24.total_revenue, 0) > 0
      THEN 'new'

      -- Lapsed: FY24 revenue but no FY25 revenue (no pipeline data for FY25)
      WHEN COALESCE(vf24.total_revenue, 0) > 0
        AND NOT COALESCE(vf25.total_revenue, 0) > 0
      THEN 'lapsed'

      WHEN ip.leaid IS NOT NULL
      THEN 'target'

      ELSE NULL
    END AS fy25_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
  LEFT JOIN vendor_financials vf24 ON d.leaid = vf24.leaid
    AND vf24.vendor = 'fullmind' AND vf24.fiscal_year = 'FY24'
  LEFT JOIN vendor_financials vf25 ON d.leaid = vf25.leaid
    AND vf25.vendor = 'fullmind' AND vf25.fiscal_year = 'FY25'
),
-- FY24 Fullmind categories: degraded — no fy24 revenue columns exist at all.
-- All plan districts are 'target', nothing else.
fullmind_fy24 AS (
  SELECT
    d.leaid,
    CASE
      WHEN ip.leaid IS NOT NULL THEN 'target'
      ELSE NULL
    END AS fy24_fullmind_category
  FROM districts d
  LEFT JOIN in_plan ip ON d.leaid = ip.leaid
),
-- Per-vendor competitor categories: FY27 (FY26→FY27 spend + pipeline)
vendor_fy27 AS (
  SELECT
    COALESCE(cs_agg.leaid, vp.leaid) AS leaid,
    COALESCE(cs_agg.competitor, vp.competitor) AS competitor,
    CASE
      -- Spend-based categories: FY26→FY27 comparison
      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
        AND COALESCE(cs_agg.fy27_spend, 0) > 0
        AND cs_agg.fy27_spend > cs_agg.fy26_spend
      THEN 'multi_year_growing'

      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
        AND COALESCE(cs_agg.fy27_spend, 0) > 0
        AND cs_agg.fy27_spend < cs_agg.fy26_spend
      THEN 'multi_year_shrinking'

      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
        AND COALESCE(cs_agg.fy27_spend, 0) > 0
      THEN 'multi_year_flat'

      WHEN COALESCE(cs_agg.fy27_spend, 0) > 0
      THEN 'new'

      -- Pipeline categories: prior spend + FY27 pipeline (no FY27 spend yet)
      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
        AND COALESCE(vp.pipeline, 0) > COALESCE(cs_agg.fy26_spend, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
        AND COALESCE(vp.pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(vp.pipeline, 0) > 0
        AND EXISTS (
          SELECT 1 FROM competitor_spend cs2
          WHERE cs2.leaid = COALESCE(cs_agg.leaid, vp.leaid)
            AND cs2.competitor = COALESCE(cs_agg.competitor, vp.competitor)
            AND cs2.total_spend > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(vp.pipeline, 0) > 0
      THEN 'new_business_pipeline'

      -- Churned: had FY26 spend but nothing in FY27
      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
      THEN 'churned'

      ELSE NULL
    END AS category
  FROM (
    SELECT leaid, competitor,
      SUM(CASE WHEN fiscal_year = 'FY26' THEN total_spend ELSE 0 END) AS fy26_spend,
      SUM(CASE WHEN fiscal_year = 'FY27' THEN total_spend ELSE 0 END) AS fy27_spend
    FROM competitor_spend
    WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
    GROUP BY leaid, competitor
  ) cs_agg
  FULL OUTER JOIN (
    SELECT leaid,
      CASE vendor
        WHEN 'proximity' THEN 'Proximity Learning'
        WHEN 'elevate' THEN 'Elevate K12'
        WHEN 'tbt' THEN 'Tutored By Teachers'
      END AS competitor,
      open_pipeline AS pipeline
    FROM vendor_financials
    WHERE vendor IN ('proximity', 'elevate', 'tbt')
      AND fiscal_year = 'FY27'
      AND open_pipeline > 0
  ) vp ON cs_agg.leaid = vp.leaid AND cs_agg.competitor = vp.competitor
),
-- Per-vendor competitor categories: FY26 (FY25→FY26 spend + pipeline)
vendor_fy26 AS (
  SELECT
    COALESCE(cs_agg.leaid, vp.leaid) AS leaid,
    COALESCE(cs_agg.competitor, vp.competitor) AS competitor,
    CASE
      -- Spend-based categories: FY25→FY26 comparison
      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
        AND COALESCE(cs_agg.fy26_spend, 0) > 0
        AND cs_agg.fy26_spend > cs_agg.fy25_spend
      THEN 'multi_year_growing'

      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
        AND COALESCE(cs_agg.fy26_spend, 0) > 0
        AND cs_agg.fy26_spend < cs_agg.fy25_spend
      THEN 'multi_year_shrinking'

      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
        AND COALESCE(cs_agg.fy26_spend, 0) > 0
      THEN 'multi_year_flat'

      WHEN COALESCE(cs_agg.fy26_spend, 0) > 0
      THEN 'new'

      -- Pipeline categories: prior spend + FY26 pipeline (no FY26 spend yet)
      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
        AND COALESCE(vp.pipeline, 0) > COALESCE(cs_agg.fy25_spend, 0)
      THEN 'expansion_pipeline'

      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
        AND COALESCE(vp.pipeline, 0) > 0
      THEN 'renewal_pipeline'

      WHEN COALESCE(vp.pipeline, 0) > 0
        AND EXISTS (
          SELECT 1 FROM competitor_spend cs2
          WHERE cs2.leaid = COALESCE(cs_agg.leaid, vp.leaid)
            AND cs2.competitor = COALESCE(cs_agg.competitor, vp.competitor)
            AND cs2.total_spend > 0
        )
      THEN 'winback_pipeline'

      WHEN COALESCE(vp.pipeline, 0) > 0
      THEN 'new_business_pipeline'

      -- Churned: had FY25 spend but nothing in FY26
      WHEN COALESCE(cs_agg.fy25_spend, 0) > 0
      THEN 'churned'

      ELSE NULL
    END AS category
  FROM (
    SELECT leaid, competitor,
      SUM(CASE WHEN fiscal_year = 'FY25' THEN total_spend ELSE 0 END) AS fy25_spend,
      SUM(CASE WHEN fiscal_year = 'FY26' THEN total_spend ELSE 0 END) AS fy26_spend
    FROM competitor_spend
    WHERE competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
    GROUP BY leaid, competitor
  ) cs_agg
  FULL OUTER JOIN (
    SELECT leaid,
      CASE vendor
        WHEN 'proximity' THEN 'Proximity Learning'
        WHEN 'elevate' THEN 'Elevate K12'
        WHEN 'tbt' THEN 'Tutored By Teachers'
      END AS competitor,
      open_pipeline AS pipeline
    FROM vendor_financials
    WHERE vendor IN ('proximity', 'elevate', 'tbt')
      AND fiscal_year = 'FY26'
      AND open_pipeline > 0
  ) vp ON cs_agg.leaid = vp.leaid AND cs_agg.competitor = vp.competitor
),
-- Per-vendor competitor categories: FY25 (FY24→FY25 spend)
vendor_fy25 AS (
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END)
          > SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END)
      THEN 'multi_year_growing'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END)
          < SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END)
      THEN 'multi_year_shrinking'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year_flat'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY25' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'churned'
      ELSE NULL
    END AS category
  FROM competitor_spend cs
  WHERE cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
  GROUP BY cs.leaid, cs.competitor
),
-- Per-vendor competitor categories: FY24 (FY23→FY24 spend)
vendor_fy24 AS (
  SELECT
    cs.leaid,
    cs.competitor,
    CASE
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END)
          > SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END)
      THEN 'multi_year_growing'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END)
          < SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END)
      THEN 'multi_year_shrinking'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END) > 0
        AND SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'multi_year_flat'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY24' THEN cs.total_spend ELSE 0 END) > 0
      THEN 'new'
      WHEN SUM(CASE WHEN cs.fiscal_year = 'FY23' THEN cs.total_spend ELSE 0 END) > 0
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
  f27.fy27_fullmind_category,
  f26.fy26_fullmind_category,
  f25.fy25_fullmind_category,
  f24.fy24_fullmind_category,
  MAX(CASE WHEN v27.competitor = 'Proximity Learning' THEN v27.category END) AS fy27_proximity_category,
  MAX(CASE WHEN v27.competitor = 'Elevate K12' THEN v27.category END) AS fy27_elevate_category,
  MAX(CASE WHEN v27.competitor = 'Tutored By Teachers' THEN v27.category END) AS fy27_tbt_category,
  MAX(CASE WHEN v26.competitor = 'Proximity Learning' THEN v26.category END) AS fy26_proximity_category,
  MAX(CASE WHEN v26.competitor = 'Elevate K12' THEN v26.category END) AS fy26_elevate_category,
  MAX(CASE WHEN v26.competitor = 'Tutored By Teachers' THEN v26.category END) AS fy26_tbt_category,
  MAX(CASE WHEN v25.competitor = 'Proximity Learning' THEN v25.category END) AS fy25_proximity_category,
  MAX(CASE WHEN v25.competitor = 'Elevate K12' THEN v25.category END) AS fy25_elevate_category,
  MAX(CASE WHEN v25.competitor = 'Tutored By Teachers' THEN v25.category END) AS fy25_tbt_category,
  MAX(CASE WHEN v24.competitor = 'Proximity Learning' THEN v24.category END) AS fy24_proximity_category,
  MAX(CASE WHEN v24.competitor = 'Elevate K12' THEN v24.category END) AS fy24_elevate_category,
  MAX(CASE WHEN v24.competitor = 'Tutored By Teachers' THEN v24.category END) AS fy24_tbt_category,
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
LEFT JOIN fullmind_fy27 f27 ON d.leaid = f27.leaid
LEFT JOIN fullmind_fy26 f26 ON d.leaid = f26.leaid
LEFT JOIN fullmind_fy25 f25 ON d.leaid = f25.leaid
LEFT JOIN fullmind_fy24 f24 ON d.leaid = f24.leaid
LEFT JOIN vendor_fy27 v27 ON d.leaid = v27.leaid
LEFT JOIN vendor_fy26 v26 ON d.leaid = v26.leaid
LEFT JOIN vendor_fy25 v25 ON d.leaid = v25.leaid
LEFT JOIN vendor_fy24 v24 ON d.leaid = v24.leaid
WHERE d.geometry IS NOT NULL OR d.point_location IS NOT NULL
GROUP BY d.leaid, d.name, d.state_abbrev, d.sales_executive,
         pm.plan_ids, f27.fy27_fullmind_category, f26.fy26_fullmind_category,
         f25.fy25_fullmind_category, f24.fy24_fullmind_category,
         d.geometry, d.account_type, d.point_location;

-- Indexes
CREATE INDEX idx_dmf_leaid ON district_map_features(leaid);
CREATE INDEX idx_dmf_state ON district_map_features(state_abbrev);
CREATE INDEX idx_dmf_owner ON district_map_features(sales_executive);
CREATE INDEX idx_dmf_geometry ON district_map_features USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_dmf_render_geometry ON district_map_features USING GIST (render_geometry);
CREATE INDEX idx_dmf_has_data_fy27 ON district_map_features(fy27_fullmind_category)
  WHERE fy27_fullmind_category IS NOT NULL
     OR fy27_proximity_category IS NOT NULL
     OR fy27_elevate_category IS NOT NULL
     OR fy27_tbt_category IS NOT NULL;

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

CREATE INDEX idx_dmf_has_data_fy24 ON district_map_features(fy24_fullmind_category)
  WHERE fy24_fullmind_category IS NOT NULL
     OR fy24_proximity_category IS NOT NULL
     OR fy24_elevate_category IS NOT NULL
     OR fy24_tbt_category IS NOT NULL;

ANALYZE district_map_features;

-- Summary
SELECT
  'district_map_features created: ' || COUNT(*) || ' districts' AS status,
  COUNT(*) FILTER (WHERE fy27_fullmind_category IS NOT NULL) AS fy27_fullmind,
  COUNT(*) FILTER (WHERE fy26_fullmind_category IS NOT NULL) AS fy26_fullmind,
  COUNT(*) FILTER (WHERE fy25_fullmind_category IS NOT NULL) AS fy25_fullmind,
  COUNT(*) FILTER (WHERE fy24_fullmind_category IS NOT NULL) AS fy24_fullmind,
  COUNT(*) FILTER (WHERE fy27_proximity_category IS NOT NULL) AS fy27_proximity,
  COUNT(*) FILTER (WHERE fy26_proximity_category IS NOT NULL) AS fy26_proximity,
  COUNT(*) FILTER (WHERE fy25_proximity_category IS NOT NULL) AS fy25_proximity,
  COUNT(*) FILTER (WHERE fy24_proximity_category IS NOT NULL) AS fy24_proximity,
  COUNT(*) FILTER (WHERE fy27_elevate_category IS NOT NULL) AS fy27_elevate,
  COUNT(*) FILTER (WHERE fy26_elevate_category IS NOT NULL) AS fy26_elevate,
  COUNT(*) FILTER (WHERE fy25_elevate_category IS NOT NULL) AS fy25_elevate,
  COUNT(*) FILTER (WHERE fy24_elevate_category IS NOT NULL) AS fy24_elevate,
  COUNT(*) FILTER (WHERE fy27_tbt_category IS NOT NULL) AS fy27_tbt,
  COUNT(*) FILTER (WHERE fy26_tbt_category IS NOT NULL) AS fy26_tbt,
  COUNT(*) FILTER (WHERE fy25_tbt_category IS NOT NULL) AS fy25_tbt,
  COUNT(*) FILTER (WHERE fy24_tbt_category IS NOT NULL) AS fy24_tbt
FROM district_map_features;
