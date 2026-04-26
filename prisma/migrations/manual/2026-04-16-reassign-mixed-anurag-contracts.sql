-- 2026-04-16-reassign-mixed-anurag-contracts.sql
-- One-off data normalization. Applied via Supabase MCP on 2026-04-16.
--
-- Problem: Salesforce historical data attributes many add-on opportunities to
-- anurag.baranwal@fullmindlearning.com (the orphan-revenue catch-all admin)
-- while the parent/initial contract opps were owned by a real sales rep.
-- This split attribution makes per-rep leaderboard rollups wrong for
-- tier-1 renewals with add-ons: each rep gets credit only for "their" add-ons.
--
-- Fix: for each (district_lea_id, school_yr, contract_type) group where
-- Anurag AND another rep both have opportunities, reassign all of Anurag's
-- opps to the non-Anurag rep with the highest net_booking_amount sum in
-- that group.
--
-- Scope: all stages (closed-won, open, closed-lost) — we want the whole
-- contract family attributed consistently.
-- Groups where ONLY Anurag has opps remain unchanged (genuine orphan revenue).
--
-- This UPDATE writes to both sales_rep_email AND sales_rep_name so the
-- scheduler-sourced denormalized name stays consistent.
--
-- Known caveat: the scheduler (scheduler/sync/compute.py) reads sales_rep
-- from OpenSearch on every sync and will overwrite these assignments on the
-- next run. Persistent fix requires either (a) upstream Salesforce changes,
-- or (b) adding this same reassignment logic into compute.py. Deferred.
--
-- Affected rows at time of authorship: 51 opportunities across 17 groups,
-- reassigning ~$19M of min_purchase_amount from anurag to real reps.

WITH mixed_groups AS (
  SELECT district_lea_id, school_yr, COALESCE(contract_type, '__null__') AS ct
  FROM opportunities
  WHERE district_lea_id IS NOT NULL AND school_yr IS NOT NULL
  GROUP BY district_lea_id, school_yr, COALESCE(contract_type, '__null__')
  HAVING COUNT(*) FILTER (WHERE sales_rep_email = 'anurag.baranwal@fullmindlearning.com') > 0
     AND COUNT(*) FILTER (WHERE sales_rep_email <> 'anurag.baranwal@fullmindlearning.com'
                                AND sales_rep_email IS NOT NULL) > 0
),
chosen AS (
  SELECT mg.district_lea_id, mg.school_yr, mg.ct,
         (SELECT o.sales_rep_email
          FROM opportunities o
          WHERE o.district_lea_id = mg.district_lea_id
            AND o.school_yr = mg.school_yr
            AND COALESCE(o.contract_type, '__null__') = mg.ct
            AND o.sales_rep_email <> 'anurag.baranwal@fullmindlearning.com'
            AND o.sales_rep_email IS NOT NULL
          GROUP BY o.sales_rep_email
          ORDER BY SUM(COALESCE(o.net_booking_amount, 0)) DESC, o.sales_rep_email
          LIMIT 1) AS chosen_rep
  FROM mixed_groups mg
)
UPDATE opportunities o
SET sales_rep_email = c.chosen_rep,
    sales_rep_name = (SELECT up.full_name FROM user_profiles up WHERE up.email = c.chosen_rep LIMIT 1)
FROM chosen c
WHERE o.district_lea_id = c.district_lea_id
  AND o.school_yr = c.school_yr
  AND COALESCE(o.contract_type, '__null__') = c.ct
  AND o.sales_rep_email = 'anurag.baranwal@fullmindlearning.com'
  AND c.chosen_rep IS NOT NULL;
