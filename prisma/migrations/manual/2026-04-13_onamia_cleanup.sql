-- 2026-04-13_onamia_cleanup.sql
-- Merge the ghost 'Onamia Public School District' (leaid 2721720) into the
-- canonical is_customer=true row (leaid 2725050).
--
-- Investigation (Task 9) found:
--   * 2721720 has 0 opportunities, 0 sessions, 0 subscriptions
--   * district_financials rows for 2721720 show last_updated = 2026-02-23
--     — stale from before Task 3's refresh. refresh_fullmind_financials() is
--     INSERT...ON CONFLICT DO UPDATE only; it never deletes, so the stale
--     row persists indefinitely unless cleaned up manually.
--   * The canonical 2725050 row already holds all 6 Onamia opps and its own
--     $190K FY26 revenue — nothing needs to be merged, only the ghost needs
--     to be deleted.

BEGIN;

-- Safety net: redirect any opp that might somehow still be linked to the
-- ghost before we delete its financials row. Currently this UPDATE touches
-- zero rows (verified in Task 9) but the statement makes the migration
-- idempotent and covers the case where a straggler shows up between the
-- investigation and the cleanup.
UPDATE opportunities
   SET district_lea_id  = '2725050',
       district_nces_id = '2725050'
 WHERE district_lea_id = '2721720'
    OR TRIM(district_nces_id) = '2721720';

-- Delete the stale Fullmind financials rows. Other vendors (competitor data)
-- stay in place — this cleanup is scoped to Fullmind's row only.
DELETE FROM district_financials
 WHERE leaid = '2721720'
   AND vendor = 'fullmind';

-- Re-run the refresh so 2725050 aggregates reflect the redirected opps
-- (no-op today since nothing was redirected, but required for correctness
-- if the straggler-redirect above ever fires).
SELECT refresh_fullmind_financials();

-- Verify: 2721720 should have no Fullmind rows; 2725050 should still have
-- its expected FY26 revenue.
SELECT leaid, fiscal_year, total_revenue
  FROM district_financials
 WHERE leaid IN ('2721720', '2725050')
   AND vendor = 'fullmind'
 ORDER BY leaid, fiscal_year;

COMMIT;
