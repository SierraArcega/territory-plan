-- Phase 2: Rename vendor_financials → district_financials
-- Run AFTER Phase 1 migrations are complete

-- Rename physical table
ALTER TABLE vendor_financials RENAME TO district_financials;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS vendor_financials_pkey RENAME TO district_financials_pkey;
ALTER INDEX IF EXISTS vendor_financials_leaid_vendor_fiscal_year_key RENAME TO district_financials_leaid_vendor_fiscal_year_key;
ALTER INDEX IF EXISTS vendor_financials_unmatched_account_id_vendor_fiscal_year_key RENAME TO district_financials_unmatched_account_id_vendor_fiscal_year_key;
ALTER INDEX IF EXISTS idx_vf_leaid RENAME TO idx_df_leaid;
ALTER INDEX IF EXISTS idx_vf_vendor_fy RENAME TO idx_df_vendor_fy;

-- Rename sequence
ALTER SEQUENCE IF EXISTS vendor_financials_id_seq RENAME TO district_financials_id_seq;
