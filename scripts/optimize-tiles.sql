-- Optimization script for faster tile loading
-- Run this in your PostgreSQL database

-- 1. Create a materialized view that pre-computes customer categories
-- This avoids expensive JOINs on every tile request
DROP MATERIALIZED VIEW IF EXISTS district_customer_categories;

CREATE MATERIALIZED VIEW district_customer_categories AS
WITH customer_categories AS (
  SELECT
    f.leaid,
    CASE
      WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
        AND (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
      THEN 'multi_year'
      WHEN (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
        AND NOT (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
      THEN 'new'
      WHEN (f.fy25_net_invoicing > 0 OR f.fy25_sessions_revenue > 0)
        AND NOT (f.fy26_net_invoicing > 0 OR f.fy26_sessions_revenue > 0)
      THEN 'lapsed'
      WHEN f.has_open_pipeline = true
      THEN 'pipeline'
      ELSE NULL
    END as category
  FROM fullmind_data f
  WHERE f.is_customer = true OR f.has_open_pipeline = true
),
target_districts AS (
  SELECT DISTINCT tpd.district_leaid as leaid
  FROM territory_plan_districts tpd
  LEFT JOIN fullmind_data f ON tpd.district_leaid = f.leaid
  WHERE f.leaid IS NULL OR (
    f.is_customer = false
    AND f.has_open_pipeline = false
  )
)
SELECT
  d.leaid,
  d.name,
  d.state_abbrev,
  d.geometry,
  COALESCE(cc.category, CASE WHEN td.leaid IS NOT NULL THEN 'target' ELSE NULL END) AS customer_category
FROM districts d
LEFT JOIN customer_categories cc ON d.leaid = cc.leaid
LEFT JOIN target_districts td ON d.leaid = td.leaid;

-- 2. Add indexes to the materialized view
CREATE INDEX idx_dcc_leaid ON district_customer_categories(leaid);
CREATE INDEX idx_dcc_state ON district_customer_categories(state_abbrev);
CREATE INDEX idx_dcc_category ON district_customer_categories(customer_category);
CREATE INDEX idx_dcc_geometry ON district_customer_categories USING GIST(geometry);

-- Index for only customer districts (used at national zoom)
CREATE INDEX idx_dcc_has_category ON district_customer_categories(customer_category)
  WHERE customer_category IS NOT NULL;

-- 3. Ensure districts table has proper spatial index
CREATE INDEX IF NOT EXISTS idx_districts_geometry ON districts USING GIST(geometry);

-- 4. Analyze tables to update query planner statistics
ANALYZE district_customer_categories;
ANALYZE districts;

-- To refresh the materialized view after data changes, run:
-- REFRESH MATERIALIZED VIEW district_customer_categories;

SELECT 'Optimization complete! Materialized view created with ' ||
       COUNT(*) || ' districts (' ||
       COUNT(*) FILTER (WHERE customer_category IS NOT NULL) || ' with customer category)'
FROM district_customer_categories;
