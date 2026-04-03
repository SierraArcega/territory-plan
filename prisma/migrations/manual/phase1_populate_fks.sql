-- Phase 1: Populate new FK columns from existing string data
-- Run AFTER seeding crm_name on user_profiles.

BEGIN;

-- =====================================================
-- 1. Populate state_fips from state_abbrev lookups
-- =====================================================

-- Schools: state_abbrev → state_fips via states table
UPDATE schools s
SET state_fips = st.fips
FROM states st
WHERE UPPER(s.state_abbrev) = st.abbrev
  AND s.state_fips IS NULL;

-- Unmatched accounts: state_abbrev → state_fips
UPDATE unmatched_accounts ua
SET state_fips = st.fips
FROM states st
WHERE UPPER(ua.state_abbrev) = st.abbrev
  AND ua.state_fips IS NULL;

-- Opportunities: free-text state → state_fips
-- state column may contain full name ("California") or abbrev ("CA")
UPDATE opportunities o
SET state_fips = st.fips
FROM states st
WHERE (UPPER(o.state) = st.abbrev OR LOWER(o.state) = LOWER(st.name))
  AND o.state_fips IS NULL;

-- =====================================================
-- 2. Populate person UUID FKs from crm_name matching
-- =====================================================
-- Requires crm_name to be seeded on user_profiles first.
-- Match is case-insensitive on trimmed names.

-- Districts: sales_executive → sales_executive_id
UPDATE districts d
SET sales_executive_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(d.sales_executive)) = LOWER(TRIM(up.crm_name))
  AND d.sales_executive IS NOT NULL
  AND d.sales_executive_id IS NULL;

-- Districts: owner → owner_id
UPDATE districts d
SET owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(d.owner)) = LOWER(TRIM(up.crm_name))
  AND d.owner IS NOT NULL
  AND d.owner_id IS NULL;

-- States: territory_owner → territory_owner_id
UPDATE states s
SET territory_owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(s.territory_owner)) = LOWER(TRIM(up.crm_name))
  AND s.territory_owner IS NOT NULL
  AND s.territory_owner_id IS NULL;

-- Schools: owner → owner_id
UPDATE schools sc
SET owner_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(sc.owner)) = LOWER(TRIM(up.crm_name))
  AND sc.owner IS NOT NULL
  AND sc.owner_id IS NULL;

-- Unmatched accounts: sales_executive → sales_executive_id
UPDATE unmatched_accounts ua
SET sales_executive_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(ua.sales_executive)) = LOWER(TRIM(up.crm_name))
  AND ua.sales_executive IS NOT NULL
  AND ua.sales_executive_id IS NULL;

-- Opportunities: sales_rep_email → sales_rep_id (match on email, more reliable)
UPDATE opportunities o
SET sales_rep_id = up.id
FROM user_profiles up
WHERE LOWER(TRIM(o.sales_rep_email)) = LOWER(TRIM(up.email))
  AND o.sales_rep_email IS NOT NULL
  AND o.sales_rep_id IS NULL;

COMMIT;

-- =====================================================
-- Verify: show match rates
-- =====================================================
SELECT 'state_fips population' AS metric,
  (SELECT COUNT(*) FROM schools WHERE state_fips IS NOT NULL) AS schools_matched,
  (SELECT COUNT(*) FROM schools WHERE state_abbrev IS NOT NULL) AS schools_total,
  (SELECT COUNT(*) FROM unmatched_accounts WHERE state_fips IS NOT NULL) AS ua_matched,
  (SELECT COUNT(*) FROM unmatched_accounts) AS ua_total,
  (SELECT COUNT(*) FROM opportunities WHERE state_fips IS NOT NULL) AS opps_matched,
  (SELECT COUNT(*) FROM opportunities WHERE state IS NOT NULL) AS opps_total;

SELECT 'person UUID population' AS metric,
  (SELECT COUNT(*) FROM districts WHERE sales_executive_id IS NOT NULL) AS districts_se_matched,
  (SELECT COUNT(*) FROM districts WHERE sales_executive IS NOT NULL) AS districts_se_total,
  (SELECT COUNT(*) FROM districts WHERE owner_id IS NOT NULL) AS districts_owner_matched,
  (SELECT COUNT(*) FROM districts WHERE owner IS NOT NULL) AS districts_owner_total,
  (SELECT COUNT(*) FROM opportunities WHERE sales_rep_id IS NOT NULL) AS opps_matched,
  (SELECT COUNT(*) FROM opportunities WHERE sales_rep_email IS NOT NULL) AS opps_total;
