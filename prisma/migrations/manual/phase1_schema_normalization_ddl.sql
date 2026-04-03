-- Phase 1: Schema Normalization — DDL Changes
-- Run this BEFORE deploying the updated Prisma schema.
-- All changes are additive (new columns, renamed columns). No drops.

BEGIN;

-- =====================================================
-- 1. Add new columns to vendor_financials
-- =====================================================
ALTER TABLE vendor_financials
  ADD COLUMN IF NOT EXISTS session_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_won_opp_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_pipeline_opp_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weighted_pipeline DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_count INT,
  ADD COLUMN IF NOT EXISTS unmatched_account_id INT REFERENCES unmatched_accounts(id);

-- Make leaid nullable (for unmatched account rows)
ALTER TABLE vendor_financials ALTER COLUMN leaid DROP NOT NULL;

-- Add unique constraint for unmatched account financials
-- (NULLs are distinct in PostgreSQL unique indexes, so this won't conflict
-- with district rows where unmatched_account_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vf_unmatched_vendor_fy
  ON vendor_financials (unmatched_account_id, vendor, fiscal_year);

-- Check constraint: exactly one of leaid/unmatched_account_id must be set
ALTER TABLE vendor_financials
  ADD CONSTRAINT chk_vf_leaid_or_unmatched
  CHECK (
    (leaid IS NOT NULL AND unmatched_account_id IS NULL) OR
    (leaid IS NULL AND unmatched_account_id IS NOT NULL)
  );

-- =====================================================
-- 2. Add crm_name to user_profiles
-- =====================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS crm_name VARCHAR(100);

-- =====================================================
-- 3. Add person UUID FK columns
-- =====================================================

-- Districts
ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS sales_executive_id UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_districts_owner_id ON districts(owner_id);
CREATE INDEX IF NOT EXISTS idx_districts_sales_exec_id ON districts(sales_executive_id);

-- States
ALTER TABLE states
  ADD COLUMN IF NOT EXISTS territory_owner_id UUID REFERENCES user_profiles(id);

-- Schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id);

-- Unmatched accounts
ALTER TABLE unmatched_accounts
  ADD COLUMN IF NOT EXISTS sales_executive_id UUID REFERENCES user_profiles(id);

-- Opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES user_profiles(id);

-- =====================================================
-- 4. Add state_fips FK columns
-- =====================================================

-- Schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

-- Unmatched accounts
ALTER TABLE unmatched_accounts
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

CREATE INDEX IF NOT EXISTS idx_unmatched_state_fips ON unmatched_accounts(state_fips);

-- Opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS state_fips VARCHAR(2) REFERENCES states(fips);

CREATE INDEX IF NOT EXISTS idx_opportunities_state_fips ON opportunities(state_fips);

-- =====================================================
-- 5. Rename district_data_history columns
-- =====================================================
ALTER TABLE district_data_history
  RENAME COLUMN expenditure_pp TO expenditure_per_pupil;

ALTER TABLE district_data_history
  RENAME COLUMN sped_expenditure TO sped_expenditure_total;

ALTER TABLE district_data_history
  RENAME COLUMN poverty_pct TO poverty_percent;

ALTER TABLE district_data_history
  RENAME COLUMN math_proficiency TO math_proficiency_pct;

ALTER TABLE district_data_history
  RENAME COLUMN read_proficiency TO read_proficiency_pct;

-- =====================================================
-- 6. Rename graduation_rate_total on districts
-- =====================================================
ALTER TABLE districts
  RENAME COLUMN graduation_rate_total TO graduation_rate;

COMMIT;

-- Verify
SELECT 'DDL migration complete' AS status;
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'vendor_financials'
  AND column_name IN ('session_count', 'closed_won_opp_count', 'open_pipeline_opp_count',
                       'weighted_pipeline', 'po_count', 'unmatched_account_id')
  ORDER BY column_name;
