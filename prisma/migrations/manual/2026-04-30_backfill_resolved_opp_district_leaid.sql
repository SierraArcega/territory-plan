-- 2026-04-30_backfill_resolved_opp_district_leaid.sql
-- One-time backfill: opportunities that were matched in the unmatched-ops
-- admin UI before the resolution flow was fixed. The handler set
-- unmatched_opportunities.resolved_district_leaid but never propagated the
-- match to opportunities.district_lea_id, so district_financials and the
-- Low Hanging Fruit / leaderboard surfaces stayed blind to the linkage.
--
-- After this runs, the admin route's PATCH handler updates both tables
-- (src/app/api/admin/unmatched-opportunities/[id]/route.ts), so this
-- backfill should be a one-time correction, not a recurring fix.
--
-- Run order:
--   1. Apply the route patch (already done in code)
--   2. Run this DRY-RUN to see what would change
--   3. Run the APPLY block
--   4. Verify Low Hanging Fruit no longer lists the affected districts as
--      winbacks (those that have FY27 pipeline / closed-won post-link)

-- ============================================================
-- DRY RUN — counts and a sample of rows that would update.
-- Safe to run; makes no changes.
-- ============================================================

WITH candidates AS (
  SELECT o.id, o.name AS opp_name, u.resolved_district_leaid AS new_lea_id,
         u.account_name, d.name AS district_name, d.state_abbrev
  FROM opportunities o
  JOIN unmatched_opportunities u ON u.id = o.id
  LEFT JOIN districts d ON d.leaid = u.resolved_district_leaid
  WHERE u.resolved = TRUE
    AND u.resolved_district_leaid IS NOT NULL
    AND o.district_lea_id IS NULL
)
SELECT COUNT(*) AS will_update,
       COUNT(*) FILTER (WHERE district_name IS NULL) AS reject_unknown_leaid
FROM candidates;

-- Sample of the first 25 rows so you can eyeball the matches:
WITH candidates AS (
  SELECT o.id, o.name AS opp_name, u.resolved_district_leaid AS new_lea_id,
         u.account_name, d.name AS district_name, d.state_abbrev
  FROM opportunities o
  JOIN unmatched_opportunities u ON u.id = o.id
  LEFT JOIN districts d ON d.leaid = u.resolved_district_leaid
  WHERE u.resolved = TRUE
    AND u.resolved_district_leaid IS NOT NULL
    AND o.district_lea_id IS NULL
)
SELECT id, opp_name, new_lea_id, account_name, district_name, state_abbrev
FROM candidates
ORDER BY opp_name
LIMIT 25;

-- ============================================================
-- APPLY — wrapped in a transaction. Run after dry-run review.
-- ============================================================

BEGIN;

UPDATE opportunities o
   SET district_lea_id = u.resolved_district_leaid
  FROM unmatched_opportunities u
 WHERE u.id = o.id
   AND u.resolved = TRUE
   AND u.resolved_district_leaid IS NOT NULL
   AND o.district_lea_id IS NULL
   -- Guard: only update if the resolved leaid actually exists in districts.
   -- Anything else would create a dangling FK on next sync.
   AND EXISTS (
     SELECT 1 FROM districts d WHERE d.leaid = u.resolved_district_leaid
   )
   -- Exclude the "Kipp Foundation" (M000083) rows: bulk-by-account_name
   -- resolution swept ~13 distinct KIPP regions under this single CA leaid.
   -- These need per-region manual cleanup in the admin UI before backfill.
   AND u.resolved_district_leaid <> 'M000083';

COMMIT;

-- Refresh the financials so newly-linked opps flow into FY27 pipeline /
-- closed-won. district_financials is the source for the Low Hanging Fruit
-- exclusion check.
SELECT refresh_fullmind_financials();
