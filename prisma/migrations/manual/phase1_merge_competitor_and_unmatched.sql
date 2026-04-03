-- Phase 1: Merge competitor_spend into vendor_financials
-- and migrate unmatched_accounts FY data

BEGIN;

-- =====================================================
-- 1. Copy competitor_spend → vendor_financials
-- =====================================================
-- Map competitor names to the short vendor IDs used in vendor_financials
INSERT INTO vendor_financials (
  leaid, vendor, fiscal_year,
  total_revenue, po_count
)
SELECT
  cs.leaid,
  CASE cs.competitor
    WHEN 'Proximity Learning' THEN 'proximity'
    WHEN 'Elevate K12' THEN 'elevate'
    WHEN 'Tutored By Teachers' THEN 'tbt'
    ELSE LOWER(REPLACE(cs.competitor, ' ', '_'))
  END AS vendor,
  cs.fiscal_year,
  cs.total_spend,
  cs.po_count
FROM competitor_spend cs
ON CONFLICT (leaid, vendor, fiscal_year) DO UPDATE SET
  total_revenue = GREATEST(vendor_financials.total_revenue, EXCLUDED.total_revenue),
  po_count = COALESCE(EXCLUDED.po_count, vendor_financials.po_count);

-- =====================================================
-- 2. Migrate unmatched_accounts FY data
-- =====================================================
-- FY25 invoicing
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, invoicing
)
SELECT
  ua.id, 'fullmind', 'FY25', ua.fy25_net_invoicing
FROM unmatched_accounts ua
WHERE ua.fy25_net_invoicing > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  invoicing = EXCLUDED.invoicing;

-- FY26 invoicing + pipeline
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, invoicing, open_pipeline
)
SELECT
  ua.id, 'fullmind', 'FY26', ua.fy26_net_invoicing, ua.fy26_open_pipeline
FROM unmatched_accounts ua
WHERE ua.fy26_net_invoicing > 0 OR ua.fy26_open_pipeline > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  invoicing = EXCLUDED.invoicing,
  open_pipeline = EXCLUDED.open_pipeline;

-- FY27 pipeline
INSERT INTO vendor_financials (
  unmatched_account_id, vendor, fiscal_year, open_pipeline
)
SELECT
  ua.id, 'fullmind', 'FY27', ua.fy27_open_pipeline
FROM unmatched_accounts ua
WHERE ua.fy27_open_pipeline > 0
ON CONFLICT (unmatched_account_id, vendor, fiscal_year) DO UPDATE SET
  open_pipeline = EXCLUDED.open_pipeline;

COMMIT;

-- Verify
SELECT 'Competitor + unmatched migration complete' AS status;

SELECT 'competitor_spend rows' AS source, COUNT(*) AS original FROM competitor_spend
UNION ALL
SELECT 'vendor_financials (non-fullmind)' AS source, COUNT(*) FROM vendor_financials WHERE vendor != 'fullmind'
UNION ALL
SELECT 'vendor_financials (unmatched)' AS source, COUNT(*) FROM vendor_financials WHERE unmatched_account_id IS NOT NULL;
