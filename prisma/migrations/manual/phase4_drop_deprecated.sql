-- Phase 4: Drop deprecated columns and tables
-- Run AFTER verifying:
--   1. ETL (fullmind.py) no longer writes to these columns
--   2. App code reads exclusively from district_financials + UUID FK columns
--   3. district_map_features view does not reference any of these columns

BEGIN;

-- =====================================================
-- 1. Drop deprecated FY columns from districts
-- =====================================================
ALTER TABLE districts
  DROP COLUMN IF EXISTS fy25_sessions_revenue,
  DROP COLUMN IF EXISTS fy25_sessions_take,
  DROP COLUMN IF EXISTS fy25_sessions_count,
  DROP COLUMN IF EXISTS fy25_closed_won_opp_count,
  DROP COLUMN IF EXISTS fy25_closed_won_net_booking,
  DROP COLUMN IF EXISTS fy25_net_invoicing,
  DROP COLUMN IF EXISTS fy26_sessions_revenue,
  DROP COLUMN IF EXISTS fy26_sessions_take,
  DROP COLUMN IF EXISTS fy26_sessions_count,
  DROP COLUMN IF EXISTS fy26_closed_won_opp_count,
  DROP COLUMN IF EXISTS fy26_closed_won_net_booking,
  DROP COLUMN IF EXISTS fy26_net_invoicing,
  DROP COLUMN IF EXISTS fy26_open_pipeline_opp_count,
  DROP COLUMN IF EXISTS fy26_open_pipeline,
  DROP COLUMN IF EXISTS fy26_open_pipeline_weighted,
  DROP COLUMN IF EXISTS fy27_open_pipeline_opp_count,
  DROP COLUMN IF EXISTS fy27_open_pipeline,
  DROP COLUMN IF EXISTS fy27_open_pipeline_weighted;

-- =====================================================
-- 2. Drop deprecated person string columns from districts
-- =====================================================
ALTER TABLE districts
  DROP COLUMN IF EXISTS sales_executive,
  DROP COLUMN IF EXISTS owner,
  DROP COLUMN IF EXISTS state_location;

-- =====================================================
-- 3. Drop deprecated columns from unmatched_accounts
-- =====================================================
ALTER TABLE unmatched_accounts
  DROP COLUMN IF EXISTS sales_executive,
  DROP COLUMN IF EXISTS fy25_net_invoicing,
  DROP COLUMN IF EXISTS fy26_net_invoicing,
  DROP COLUMN IF EXISTS fy26_open_pipeline,
  DROP COLUMN IF EXISTS fy27_open_pipeline;

-- =====================================================
-- 4. Drop deprecated person string columns from states
-- =====================================================
ALTER TABLE states
  DROP COLUMN IF EXISTS territory_owner;

-- =====================================================
-- 5. Drop deprecated owner string column from schools
-- =====================================================
ALTER TABLE schools
  DROP COLUMN IF EXISTS owner;

-- =====================================================
-- 6. Drop competitor_spend table
-- =====================================================
DROP TABLE IF EXISTS competitor_spend CASCADE;

COMMIT;

-- Verify
SELECT 'Phase 4 drop migration complete' AS status;

-- Confirm competitor_spend is gone
SELECT COUNT(*) AS competitor_spend_exists
FROM information_schema.tables
WHERE table_name = 'competitor_spend';

-- Confirm deprecated columns are gone from districts
SELECT column_name FROM information_schema.columns
WHERE table_name = 'districts'
  AND column_name IN (
    'fy25_sessions_revenue', 'fy26_open_pipeline', 'fy27_open_pipeline',
    'sales_executive', 'owner', 'state_location'
  );
