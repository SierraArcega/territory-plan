# NYC Charter Pseudo-Rollup Undo — Design Spec

**Date:** 2026-04-23
**Branch:** `worktree-nyc-doe-rollup` (PR #131, pre-merge)
**Supersedes (partially):** `2026-04-22-nyc-doe-map-drill-down-design.md` §"Charter split"

## Context

On 2026-04-23 a charter-split was added to PR #131 (commits `acb73b2b`
feat(data) and `edc6be0f` chore(data)) which:

- Created a synthetic pseudo-rollup row `3600000` "NYC Charter Schools".
- Set `parent_leaid = '3600000'` on 276 NYC charter leaids.
- Set `parent_leaid = NULL` on District 75 (`3600135`).
- Retro-trimmed 277 charter/D75 rows out of 1 existing plan's auto-migrated
  scope.

The rationale was to narrow NYC DOE's auto-migrate to the 32 Geographic
Community School Districts (CSDs) instead of 309 mixed entities.

The invented row `3600000` is the only fabricated LEAID in the feature. Every
other leaid (the 32 CSDs, D75, and the 276 charters) is a real NCES-assigned
Local Education Agency ID. Introducing a pseudo-LEAID conflicts with the
invariant that `districts.leaid` maps 1:1 to NCES entities.

## Goal

Realign the 276 charter leaids and District 75 with their **NCES-native**
state — each a top-level district with `parent_leaid = NULL`, and **delete
the synthetic `3600000` row entirely**. Keep every other part of PR #131
(NYC DOE → 32 CSD drill-down, rollup UI, expand-rollup API, CSD polygon
import, dashed-polygon rendering, "N child districts" search hint,
ContactsActionBar rollup toast).

Post-undo invariants:

- `districts` has no row with `leaid = '3600000'`.
- No row has `parent_leaid = '3600000'`.
- `SELECT COUNT(*) FROM districts WHERE parent_leaid = '3620580'` = **32**
  (the 32 geographic CSDs only).
- District 75 (`3600135`) has `parent_leaid = NULL`.
- Each of the 276 charter leaids has `parent_leaid = NULL`.

## Non-Goals

- Not removing the 32-CSD drill-down. NYC DOE → 32 CSDs stays.
- Not editing historical migrations. The 2026-04-22 seed migration stays
  as-is and the new migration layers on top.
- Not restoring the 277 rows that `backfill-trim-rollup-charter-expansion.ts`
  removed from the 1 dev plan — those rows still represent accidental bloat
  (charters aren't NYC DOE children anymore under this design).
- Not force-pushing or rewriting branch history. PR #131 stays open with a
  linear commit timeline that shows build → undo.

## Data Migration

**File:** `prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql`

```sql
-- Revert the 2026-04-23 NYC charter pseudo-rollup.
--
-- Restores the 276 NYC charter leaids + District 75 to their NCES-native
-- state (parent_leaid = NULL) and deletes the synthetic 3600000 row.
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
-- No-op on dev (already NULL post-split); real update on fresh envs.
UPDATE districts
SET parent_leaid = NULL, updated_at = NOW()
WHERE leaid = '3600135';

-- Delete the synthetic pseudo-rollup row.
DELETE FROM districts WHERE leaid = '3600000';

-- Refresh the map-features matview so tiles stop exposing 3600000 as a
-- feature and charter features reflect their new (absent) parentage.
REFRESH MATERIALIZED VIEW district_map_features;
```

## Code Changes

1. **Delete** `prisma/seed-nyc-charter-pseudo.ts`. The seed's purpose was
   to create the `3600000` row — keeping it after deletion would be a trap
   for anyone re-running seeds on a fresh DB.

2. **Delete** `prisma/backfill-trim-rollup-charter-expansion.ts`. One-shot
   script; already executed on dev. Prod does not need it: the 2026-04-22
   seed migration and this 2026-04-23 revert migration apply inside a
   single `prisma migrate deploy` run, so there is no 309-bloat window
   during which plan GETs could auto-expand to charter/D75 children.

3. **Bump tile cache** in `src/features/map/components/MapV2Container.tsx`:
   - Line 467: `v=9` → `v=10`
   - Line 1496: `v=9` → `v=10`

   Forces clients to drop cached tiles that still reference the `3600000`
   feature.

Nothing else is touched. All other PR #131 code paths (rollup helpers,
expand-rollup API route, rollup UI components and tests, tile route
is_rollup flag, SearchBar rollup suffix, ContactsActionBar toast,
pickDistrictFeature, etc.) continue to apply to the NYC DOE → 32 CSD
relationship, which this spec preserves.

## Verification

After `npx prisma migrate deploy` on dev:

```sql
-- Hierarchy invariants
SELECT COUNT(*) FROM districts WHERE parent_leaid = '3620580';  -- 32
SELECT COUNT(*) FROM districts WHERE parent_leaid = '3600000';  -- 0
SELECT COUNT(*) FROM districts WHERE leaid = '3600000';          -- 0
SELECT parent_leaid FROM districts WHERE leaid = '3600135';      -- NULL

-- Charter spot-check: five known charter leaids should all be NULL
SELECT leaid, parent_leaid
FROM districts
WHERE leaid IN ('3600039', '3600042', '3600045', '3600943', '3601230');

-- Matview reflects the new state (no 3600000 feature, charters unparented)
SELECT COUNT(*) FROM district_map_features WHERE leaid = '3600000';  -- 0
```

UI smoke (dev):

- **Search** "NYC Charter" → no rollup suggestion card with "276 child
  districts" suffix. Individual charters surface as normal results.
- **Map** → dashed-outline polygon for `3600000` disappears entirely. The
  32 CSDs still render dashed when NYC DOE is selected (preserved).
- **DistrictCard** for NYC DOE (`3620580`) still shows "32 child districts"
  strip with Select-all-32 CTA.
- **DistrictCard** for any individual charter shows no rollup strip (no
  children, no parent).
- **Auto-migrate** a plan that selects NYC DOE → expands to exactly 32
  rows (not 309, not 33).

## Rollback

Data-only revert, no schema changes. If needed mid-PR:

1. `git revert` the cleanup commit → restores `seed-nyc-charter-pseudo.ts`.
2. `npx tsx prisma/seed-nyc-charter-pseudo.ts` → re-creates `3600000` and
   re-parents the 276 charters.
3. `REFRESH MATERIALIZED VIEW district_map_features;`
4. Bump tile cache back to `v=9` (or forward to `v=11`).

Acceptable complexity since this work lives inside a still-open PR.

## Memory Update (post-merge)

Out of scope for the code change, tracked separately:

- Update `project_nyc_doe_rollup.md` so the final data model reads:
  "NYC DOE (`3620580`) parents exactly 32 Geographic Community School
  Districts. District 75 and all 276 NYC charter leaids are NCES-native
  top-level districts (no parent). No synthetic rollups exist."
