-- Vendor Comparison Materialized View
-- Creates a view showing the dominant vendor (Fullmind or competitor) for each district
-- Priority: Most recent fiscal year, then highest spend amount

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS district_vendor_comparison;

CREATE MATERIALIZED VIEW district_vendor_comparison AS
WITH fullmind_spend AS (
  -- Get Fullmind spend with most recent FY (from districts table after schema consolidation)
  SELECT
    d.leaid,
    'Fullmind' as vendor,
    CASE
      WHEN COALESCE(d.fy26_net_invoicing, 0) > 0 THEN 'FY26'
      WHEN COALESCE(d.fy25_net_invoicing, 0) > 0 THEN 'FY25'
      ELSE NULL
    END as most_recent_fy,
    COALESCE(d.fy26_net_invoicing, 0) + COALESCE(d.fy25_net_invoicing, 0) as total_spend,
    COALESCE(d.fy26_net_invoicing, 0) as fy26_spend,
    COALESCE(d.fy25_net_invoicing, 0) as fy25_spend
  FROM districts d
  WHERE d.is_customer = true
    AND (COALESCE(d.fy26_net_invoicing, 0) > 0 OR COALESCE(d.fy25_net_invoicing, 0) > 0)
),
competitor_spend_ranked AS (
  -- Get competitor spend, ranked by FY and amount per district
  SELECT
    cs.leaid,
    cs.competitor as vendor,
    cs.fiscal_year as most_recent_fy,
    cs.total_spend,
    ROW_NUMBER() OVER (
      PARTITION BY cs.leaid
      ORDER BY cs.fiscal_year DESC, cs.total_spend DESC
    ) as rn
  FROM competitor_spend cs
  WHERE cs.total_spend > 0
    -- Only include the three specified competitors
    AND cs.competitor IN ('Proximity Learning', 'Elevate K12', 'Tutored By Teachers')
),
top_competitor AS (
  -- Get the top competitor per district (most recent FY, highest spend)
  SELECT leaid, vendor, most_recent_fy, total_spend
  FROM competitor_spend_ranked
  WHERE rn = 1
),
combined AS (
  -- Combine Fullmind and top competitor spend
  SELECT leaid, vendor, most_recent_fy, total_spend
  FROM fullmind_spend
  WHERE most_recent_fy IS NOT NULL
  UNION ALL
  SELECT leaid, vendor, most_recent_fy, total_spend
  FROM top_competitor
),
ranked AS (
  -- Rank combined vendors by FY (desc) then spend (desc) per district
  -- This determines the "dominant" vendor for districts with both Fullmind and competitor spend
  SELECT
    leaid,
    vendor,
    most_recent_fy,
    total_spend,
    ROW_NUMBER() OVER (
      PARTITION BY leaid
      ORDER BY most_recent_fy DESC, total_spend DESC
    ) as rn
  FROM combined
)
SELECT
  d.leaid,
  d.name,
  d.state_abbrev,
  d.geometry,
  r.vendor as dominant_vendor
FROM districts d
LEFT JOIN ranked r ON d.leaid = r.leaid AND r.rn = 1;

-- Create indexes for efficient queries
CREATE INDEX idx_dvc_leaid ON district_vendor_comparison(leaid);
CREATE INDEX idx_dvc_state ON district_vendor_comparison(state_abbrev);
CREATE INDEX idx_dvc_vendor ON district_vendor_comparison(dominant_vendor);
CREATE INDEX idx_dvc_geometry ON district_vendor_comparison USING GIST(geometry);

-- Index for districts with vendor data (used at national zoom for faster queries)
CREATE INDEX idx_dvc_has_vendor ON district_vendor_comparison(dominant_vendor)
  WHERE dominant_vendor IS NOT NULL;

-- Update statistics for query planner
ANALYZE district_vendor_comparison;

-- Print summary
SELECT 'Vendor comparison view created!' as status;
SELECT dominant_vendor, COUNT(*) as district_count
FROM district_vendor_comparison
WHERE dominant_vendor IS NOT NULL
GROUP BY dominant_vendor
ORDER BY district_count DESC;

-- To refresh the materialized view after data changes, run:
-- REFRESH MATERIALIZED VIEW district_vendor_comparison;
