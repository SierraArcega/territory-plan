-- Revert the 2026-04-23 NYC charter pseudo-rollup.
--
-- Restores the 276 NYC charter leaids + District 75 to their NCES-native
-- state (parent_leaid = NULL) and deletes the synthetic 3600000 row
-- created by prisma/seed-nyc-charter-pseudo.ts (now removed).
--
-- Deterministic across environments:
--   Fresh DB: charters at parent_leaid='3620580' from the 2026-04-22 seed
--             → matched via the 3620580 branch of the IN(...) clause.
--   Dev DB:   charters at parent_leaid='3600000' from the 2026-04-23 split
--             → matched via the 3600000 branch of the IN(...) clause.
--
-- The charter identification rule ("under one of these parents, not named
-- GEOGRAPHIC DISTRICT, not D75") mirrors seed-nyc-charter-pseudo.ts so the
-- same 276 leaids are targeted.

UPDATE districts
SET parent_leaid = NULL, updated_at = NOW()
WHERE parent_leaid IN ('3620580', '3600000')
  AND name NOT ILIKE '%GEOGRAPHIC DISTRICT%'
  AND leaid <> '3600135';

-- D75 back to NCES-native top-level.
-- No-op on dev (already NULL post-split); actual update on fresh envs.
UPDATE districts
SET parent_leaid = NULL, updated_at = NOW()
WHERE leaid = '3600135';

-- Delete the synthetic pseudo-rollup row.
DELETE FROM districts WHERE leaid = '3600000';
