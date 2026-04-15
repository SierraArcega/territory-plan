-- 2026-04-15-backfill-min-purchase-from-net-billings.sql
-- One-off data backfill. Run once via Supabase SQL console or MCP.
--
-- Populates minimum_purchase_amount on historical opportunities where the
-- Salesforce/OpenSearch source never provided a value. The derivation uses
-- invoiced + credited (credited is already signed negative in our schema,
-- so the sum is net billings). Matches the fallback logic in
-- scheduler/sync/compute.py so future syncs preserve these values rather
-- than clobbering them.
--
-- Scope: all stages (matches the compute.py fallback scope).
-- Idempotent: the WHERE clause skips rows that already have a value.
-- Affected rows at time of authorship: 1710 opportunities across FY18-19
-- through FY26-27 (and 41 opps with NULL school_yr).

UPDATE opportunities
SET minimum_purchase_amount = COALESCE(invoiced, 0) + COALESCE(credited, 0)
WHERE minimum_purchase_amount IS NULL;

-- Verification: no rows should remain NULL after this runs (within sync lag).
SELECT school_yr,
       COUNT(*) AS opp_count,
       COUNT(*) FILTER (WHERE minimum_purchase_amount IS NULL) AS still_null,
       ROUND(SUM(minimum_purchase_amount)::numeric, 2) AS sum_min_purchase
FROM opportunities
GROUP BY school_yr
ORDER BY school_yr;
