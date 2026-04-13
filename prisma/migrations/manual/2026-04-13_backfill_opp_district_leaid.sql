-- 2026-04-13_backfill_opp_district_leaid.sql
-- Historical backfill for opportunities with district_lea_id IS NULL but
-- district_nces_id populated (bug a), with name-match guardrail against
-- typo'd leaids (bug b).
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
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
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
FROM candidates c
LEFT JOIN opportunities o2 ON o2.id = c.opp_id
GROUP BY outcome
ORDER BY outcome;

-- Detailed REJECT list (so you can see what would be skipped):
WITH candidates AS (
  SELECT
    o.id                                                      AS opp_id,
    o.name                                                    AS opp_name,
    o.district_name                                           AS opp_district_name,
    TRIM(o.district_nces_id)                                  AS trimmed_nces_id,
    d.leaid                                                   AS resolved_leaid,
    d.name                                                    AS resolved_district_name,
    normalize_district_name(o.district_name)                  AS norm_opp_name,
    normalize_district_name(d.name)                           AS norm_resolved_name
  FROM opportunities o
  LEFT JOIN districts d ON d.leaid = TRIM(o.district_nces_id)
  WHERE o.district_lea_id IS NULL
    AND o.district_nces_id IS NOT NULL
    AND TRIM(o.district_nces_id) ~ '^[0-9]{7}$'
)
SELECT opp_id, opp_name, opp_district_name, trimmed_nces_id, resolved_district_name
FROM candidates
WHERE resolved_leaid IS NULL
   OR (norm_opp_name <> '' AND norm_resolved_name <> ''
       AND norm_opp_name <> norm_resolved_name
       AND position(norm_opp_name in norm_resolved_name) = 0
       AND position(norm_resolved_name in norm_opp_name) = 0)
ORDER BY opp_name;
