-- 2026-04-13_backfill_opp_district_leaid.sql
-- Historical backfill for opportunities with district_lea_id IS NULL but
-- district_nces_id populated (bug a), with name-match guardrail against
-- typo'd leaids (bug b).
--
-- Candidate normalization:
--   * 7-digit NCES IDs (e.g., '4503360') are used as-is after TRIM
--   * 6-digit NCES IDs (e.g., '611110') are LPAD'd with a leading zero
--     — they're state-fips-01..09 leaids whose leading zero got stripped
--     during CRM import (California, Alabama, Arizona, Colorado, etc.)
--   * Anything else (14-digit LMS account IDs mis-stored in this column,
--     non-numeric values) is OUT OF SCOPE for this backfill.
--
-- This file is split into a DRY-RUN SELECT and an APPLY UPDATE.
-- Run the dry-run first, review the rejection list, then run the apply block.

-- ============================================================
-- DRY RUN — reports rows the apply block would touch + reject.
-- Safe to run; makes no changes.
-- ============================================================

WITH candidates AS (
  SELECT
    o.id                                                      AS opp_id,
    o.name                                                    AS opp_name,
    o.district_name                                           AS opp_district_name,
    TRIM(o.district_nces_id)                                  AS trimmed_nces_id,
    CASE
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
    END                                                       AS candidate_leaid,
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name,
    o.net_booking_amount
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = CASE
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
  END
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND (
      TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
      OR TRIM(o.district_nces_id) ~ '^[0-9]{6}$'
    )
)
SELECT
  CASE
    WHEN resolved_leaid IS NULL THEN 'REJECT: NCES does not exist in districts'
    WHEN norm_opp_name = '' OR norm_resolved_name = '' THEN 'ACCEPT: one side has no name, allowing'
    WHEN norm_opp_name = norm_resolved_name THEN 'ACCEPT: name match'
    WHEN position(norm_opp_name in norm_resolved_name) > 0
      OR position(norm_resolved_name in norm_opp_name) > 0 THEN 'ACCEPT: substring match'
    ELSE 'REJECT: name mismatch'
  END AS outcome,
  COUNT(*) AS count,
  SUM(net_booking_amount)::numeric(15,2) AS total_booking
FROM candidates
GROUP BY outcome
ORDER BY outcome;

-- Detailed REJECT list (so you can see what would be skipped):
WITH candidates AS (
  SELECT
    o.id                                                      AS opp_id,
    o.name                                                    AS opp_name,
    o.district_name                                           AS opp_district_name,
    TRIM(o.district_nces_id)                                  AS trimmed_nces_id,
    CASE
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
    END                                                       AS candidate_leaid,
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = CASE
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
  END
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND (
      TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
      OR TRIM(o.district_nces_id) ~ '^[0-9]{6}$'
    )
)
SELECT opp_id, opp_name, opp_district_name, trimmed_nces_id, candidate_leaid, resolved_district_name
FROM candidates
WHERE resolved_leaid IS NULL
   OR (norm_opp_name <> '' AND norm_resolved_name <> ''
       AND norm_opp_name <> norm_resolved_name
       AND position(norm_opp_name in norm_resolved_name) = 0
       AND position(norm_resolved_name in norm_opp_name) = 0)
ORDER BY opp_name;


-- ============================================================
-- APPLY — wrapped in a transaction. Run manually after dry-run review.
-- ============================================================
-- Because the file has multiple statements including DO-blocks, run it via
-- psql or split it into discrete statements when using the pg Node client.

BEGIN;

-- Step 1: UPDATE accepted candidates. Candidates are opps with:
--   * district_lea_id IS NULL
--   * district_nces_id is 7 digits (or 6 digits, auto-padded with leading zero)
--   * the resolved leaid exists in the districts table
--   * normalize_district_name() of the opp's district_name agrees with the
--     normalize_district_name() of the resolved district's name
WITH candidates AS (
  SELECT
    o.id,
    o.district_lea_id AS old_lea_id,
    CASE
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
      WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
    END AS new_lea_id,
    normalize_district_name(o.district_name) AS norm_opp_name,
    normalize_district_name(d.name) AS norm_resolved_name
  FROM opportunities o
  JOIN districts d ON d.leaid = CASE
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
    WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
  END
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND (TRIM(o.district_nces_id) ~ '^[0-9]{7}$' OR TRIM(o.district_nces_id) ~ '^[0-9]{6}$')
),
accepted AS (
  SELECT id, new_lea_id
  FROM candidates
  WHERE norm_opp_name = '' OR norm_resolved_name = ''
     OR norm_opp_name = norm_resolved_name
     OR position(norm_opp_name in norm_resolved_name) > 0
     OR position(norm_resolved_name in norm_opp_name) > 0
)
UPDATE opportunities o
   SET district_lea_id  = a.new_lea_id,
       district_nces_id = a.new_lea_id  -- also canonicalize the stored NCES ID (trim + zero-pad)
  FROM accepted a
 WHERE o.id = a.id;

-- Step 2: Record every rejected row into unmatched_opportunities so the
-- admin UI surfaces them for manual review. Rejects come in two flavors:
--   (a) resolved leaid doesn't exist in districts table -> "unknown NCES"
--   (b) resolved leaid exists but the names disagree    -> "name mismatch"
INSERT INTO unmatched_opportunities (
  id, name, stage, school_yr, account_name, state, net_booking_amount,
  reason, resolved, synced_at
)
SELECT
  o.id,
  o.name,
  o.stage,
  o.school_yr,
  o.district_name,
  o.state,
  o.net_booking_amount,
  CASE
    WHEN d.leaid IS NULL THEN 'NCES-only link: unknown NCES'
    ELSE 'NCES-only link: name mismatch'
  END,
  FALSE,
  NOW()
FROM opportunities o
LEFT JOIN districts d ON d.leaid = CASE
  WHEN TRIM(o.district_nces_id) ~ '^[0-9]{7}$' THEN TRIM(o.district_nces_id)
  WHEN TRIM(o.district_nces_id) ~ '^[0-9]{6}$' THEN LPAD(TRIM(o.district_nces_id), 7, '0')
END
WHERE o.district_lea_id IS NULL
  AND o.district_nces_id IS NOT NULL
  AND (TRIM(o.district_nces_id) ~ '^[0-9]{7}$' OR TRIM(o.district_nces_id) ~ '^[0-9]{6}$')
  AND (
    d.leaid IS NULL
    OR (normalize_district_name(o.district_name) <> ''
        AND normalize_district_name(d.name) <> ''
        AND normalize_district_name(o.district_name) <> normalize_district_name(d.name)
        AND position(normalize_district_name(o.district_name) in normalize_district_name(d.name)) = 0
        AND position(normalize_district_name(d.name) in normalize_district_name(o.district_name)) = 0)
  )
ON CONFLICT (id) DO UPDATE SET
  reason = EXCLUDED.reason,
  synced_at = EXCLUDED.synced_at
WHERE unmatched_opportunities.resolved = FALSE;

COMMIT;

-- Step 3: Refresh financials so the newly-linked rows flow into district_financials.
SELECT refresh_fullmind_financials();
