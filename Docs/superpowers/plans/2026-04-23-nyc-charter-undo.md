# NYC Charter Pseudo-Rollup Undo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert the synthetic NYC Charter Schools pseudo-rollup (`3600000`); return the 276 charter leaids and District 75 to NCES-native top-level state (`parent_leaid = NULL`); keep every other part of PR #131.

**Architecture:** One additive Prisma migration applies the data undo (sets charter/D75 `parent_leaid` to NULL, deletes the synthetic `3600000` row, refreshes `district_map_features` matview). Code-side cleanup deletes the now-dead seed and backfill scripts and bumps the map tile cache version so clients drop tiles containing the `3600000` feature. No schema changes.

**Tech Stack:** Prisma + PostgreSQL/PostGIS, Next.js 16 App Router, MapLibre, TypeScript, Vitest.

**Spec:** `Docs/superpowers/specs/2026-04-23-nyc-charter-undo-design.md`

**Working directory (IMPORTANT):** all work happens in the worktree, not the main checkout:

```
/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/nyc-doe-rollup/
```

Branch: `worktree-nyc-doe-rollup` (PR #131).

**DB verification tooling:** this plan uses `psql "$DATABASE_URL"`. `DATABASE_URL` is defined in `.env.local`. If `psql` is unavailable, substitute `npx tsx` with inline Prisma `$queryRaw` calls (the pattern used in `prisma/seed-nyc-charter-pseudo.ts`).

---

## File Structure

**Create:**
- `prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql` — the revert SQL

**Modify:**
- `src/features/map/components/MapV2Container.tsx` lines `467` and `1496` — bump tile cache `v=9` → `v=10`

**Delete:**
- `prisma/seed-nyc-charter-pseudo.ts` — one-shot seed that created the `3600000` row
- `prisma/backfill-trim-rollup-charter-expansion.ts` — one-shot backfill that already ran on dev

No tests added or modified. The existing Vitest suite must still pass after all changes (regression check in Task 6).

---

### Task 1: Capture pre-migration DB baseline

**Files:** none modified; read-only verification

- [ ] **Step 1: `cd` into the worktree and confirm branch**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/nyc-doe-rollup"
git status
```

Expected output includes: `On branch worktree-nyc-doe-rollup` and a clean working tree (no staged/unstaged changes).

- [ ] **Step 2: Load DATABASE_URL from `.env.local`**

```bash
set -a; source .env.local; set +a
echo "$DATABASE_URL" | head -c 40
```

Expected: prints the first 40 chars of the Postgres connection string (starts with `postgresql://` or `postgres://`).

- [ ] **Step 3: Snapshot current charter/rollup state for comparison**

```bash
psql "$DATABASE_URL" -c "
  SELECT 'pseudo_row'      AS metric, COUNT(*)::int AS n FROM districts WHERE leaid = '3600000'
  UNION ALL
  SELECT 'children_of_3600000', COUNT(*)::int FROM districts WHERE parent_leaid = '3600000'
  UNION ALL
  SELECT 'children_of_3620580', COUNT(*)::int FROM districts WHERE parent_leaid = '3620580'
  UNION ALL
  SELECT 'd75_parent',          COALESCE(MAX(CASE WHEN parent_leaid IS NULL THEN 0 ELSE 1 END), 0)
                                FROM districts WHERE leaid = '3600135';
"
```

Expected on dev (post-split): `pseudo_row=1`, `children_of_3600000=276`, `children_of_3620580=32`, `d75_parent=0`.
If any value differs, STOP and investigate before writing the migration — the migration assumes this starting state or the fresh-DB equivalent.

- [ ] **Step 4: No commit — verification only**

---

### Task 2: Create the revert migration file

**Files:**
- Create: `prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql`

- [ ] **Step 1: Create the migration directory**

```bash
mkdir -p prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup
```

- [ ] **Step 2: Write the migration SQL**

File: `prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql`

```sql
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

-- Refresh the map-features matview so tiles stop exposing 3600000 as a
-- feature and charter features reflect their new (absent) parentage.
REFRESH MATERIALIZED VIEW district_map_features;
```

- [ ] **Step 3: Verify file contents**

```bash
cat prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql | wc -l
```

Expected: 34 lines (33 content + trailing newline, give or take a line).

- [ ] **Step 4: Stage and commit (migration file only; do NOT apply yet)**

```bash
git add prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/migration.sql
git commit -m "$(cat <<'EOF'
feat(data): revert NYC charter pseudo-rollup; restore NCES-native parentage

Un-parents the 276 NYC charter leaids and District 75 back to parent_leaid = NULL
(their NCES-native state) and deletes the synthetic 3600000 "NYC Charter
Schools" row. Deterministic on both fresh DBs (charters at 3620580) and dev
(charters at 3600000) via a single UPDATE keyed on parent_leaid IN
('3620580', '3600000') + name-based exclusion for the 32 Geographic Districts
and D75.

Refreshes district_map_features matview in the same transaction so tiles stop
exposing 3600000 as a feature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Confirm commit**

```bash
git log -1 --stat
```

Expected: the new migration.sql file appears under `prisma/migrations/20260423_revert_nyc_charter_pseudo_rollup/`.

---

### Task 3: Apply the migration to dev and verify invariants

**Files:** no file changes; runs the migration committed in Task 2 against the dev database.

- [ ] **Step 1: Ensure DATABASE_URL is loaded**

```bash
set -a; source .env.local; set +a
```

- [ ] **Step 2: Apply pending migrations**

```bash
npx prisma migrate deploy
```

Expected output includes:
```
Applying migration `20260423_revert_nyc_charter_pseudo_rollup`
All migrations have been successfully applied.
```

The migration only runs DML (UPDATE/UPDATE/DELETE). The matview refresh is a separate step (Step 3) to match the repo's existing pattern (see `scripts/import-customer-book.ts:490`, `scripts/etl/utils/refresh_views.py:19`) — REFRESH MATERIALIZED VIEW takes ~30s and this repo runs it outside Prisma migrations.

- [ ] **Step 3: Refresh the map-features matview**

```bash
npx tsx -e "import('@/lib/prisma').then(m => m.default.\$executeRawUnsafe('REFRESH MATERIALIZED VIEW district_map_features').then(() => { console.log('refreshed'); return m.default.\$disconnect(); }))"
```

Expected: prints `refreshed` after ~30 seconds.

- [ ] **Step 4: Verify invariant — NYC DOE children = 32**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*)::int AS n FROM districts WHERE parent_leaid = '3620580';"
```

Expected: `n = 32`. If not, STOP.

- [ ] **Step 5: Verify invariant — 3600000 row deleted**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*)::int AS n FROM districts WHERE leaid = '3600000';"
```

Expected: `n = 0`. If not, STOP.

- [ ] **Step 6: Verify invariant — no rows reference 3600000 as parent**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*)::int AS n FROM districts WHERE parent_leaid = '3600000';"
```

Expected: `n = 0`. If not, STOP — the pseudo-rollup still has children.

- [ ] **Step 7: Verify invariant — D75 is top-level**

```bash
psql "$DATABASE_URL" -c "SELECT leaid, parent_leaid, name FROM districts WHERE leaid = '3600135';"
```

Expected: `parent_leaid` is NULL (shown as empty in psql default output).

- [ ] **Step 8: Charter spot-check — five known charter leaids should all be NULL**

```bash
psql "$DATABASE_URL" -c "
  SELECT leaid, parent_leaid
  FROM districts
  WHERE leaid IN ('3600039','3600042','3600045','3600943','3601230')
  ORDER BY leaid;
"
```

Expected: five rows returned, all with `parent_leaid` NULL.

- [ ] **Step 9: Verify matview refreshed — no 3600000 feature**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*)::int AS n FROM district_map_features WHERE leaid = '3600000';"
```

Expected: `n = 0`. If not, the matview refresh didn't run or didn't include the delete — STOP.

- [ ] **Step 10: No commit required**

`prisma migrate deploy` records the applied migration in `_prisma_migrations` inside the database. No files change in the working tree.

---

### Task 4: Bump map tile cache version

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx:467`
- Modify: `src/features/map/components/MapV2Container.tsx:1496`

- [ ] **Step 1: Read the current lines**

```bash
grep -n "v=9" src/features/map/components/MapV2Container.tsx
```

Expected: two matches, at lines `467` and `1496`, both containing `?v=9&fy=`.

- [ ] **Step 2: Replace both occurrences of `?v=9&fy=` with `?v=10&fy=`**

The substring `?v=9&fy=` is unique to these two lines. One replace-all flip covers both.

Using the `Edit` tool: pass `replace_all: true`, `old_string: "?v=9&fy="`, `new_string: "?v=10&fy="`.

Using sed (macOS):

```bash
sed -i '' 's|?v=9&fy=|?v=10\&fy=|g' src/features/map/components/MapV2Container.tsx
```

On Linux: `sed -i 's|?v=9&fy=|?v=10\&fy=|g' src/features/map/components/MapV2Container.tsx`

- [ ] **Step 3: Verify both edits applied**

```bash
grep -n "v=9" src/features/map/components/MapV2Container.tsx
grep -n "v=10" src/features/map/components/MapV2Container.tsx
```

Expected: first command prints nothing; second prints two matches at lines `467` and `1496`.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors in `MapV2Container.tsx`. There may be pre-existing errors elsewhere (per `memory/project_compilation_warnings.md`) — those are not introduced by this change and are OK.

- [ ] **Step 5: Run component tests that touch the map layer**

```bash
npm test -- src/features/map
```

Expected: all tests pass. The tile version bump does not affect the tested units.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "$(cat <<'EOF'
feat(map): bump tile cache v=9 → v=10 after charter pseudo-rollup revert

Clients with cached tiles from v=9 still reference the deleted 3600000
feature. Bumping the version string forces MapLibre to drop cached tiles
and fetch fresh ones from /api/tiles, which now excludes 3600000.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Delete obsolete one-shot scripts

**Files:**
- Delete: `prisma/seed-nyc-charter-pseudo.ts`
- Delete: `prisma/backfill-trim-rollup-charter-expansion.ts`

- [ ] **Step 1: Confirm both files exist before deletion**

```bash
ls prisma/seed-nyc-charter-pseudo.ts prisma/backfill-trim-rollup-charter-expansion.ts
```

Expected: both listed with no "No such file" error.

- [ ] **Step 2: Confirm no other code references these scripts**

```bash
grep -rn "seed-nyc-charter-pseudo\|backfill-trim-rollup-charter-expansion" src/ prisma/ package.json 2>/dev/null
```

Expected: only matches inside the two files themselves (self-references in comments or the filename). If any `src/` file imports either script, STOP and report.

- [ ] **Step 3: Delete both files**

```bash
git rm prisma/seed-nyc-charter-pseudo.ts prisma/backfill-trim-rollup-charter-expansion.ts
```

- [ ] **Step 4: Verify the deletion is staged**

```bash
git status
```

Expected: both files listed under `Changes to be committed` with `deleted:` prefix.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(data): delete obsolete NYC charter pseudo-rollup scripts

Both scripts were one-shot operations that served PR #131's charter-split
work, now reverted by migration 20260423_revert_nyc_charter_pseudo_rollup:

- seed-nyc-charter-pseudo.ts created the 3600000 pseudo-rollup row, which
  the revert migration deletes. Keeping the seed would be a trap for
  anyone re-running seeds on a fresh DB.

- backfill-trim-rollup-charter-expansion.ts trimmed 277 accidentally
  auto-migrated rows from 1 dev plan. It already ran (idempotent, matches
  nothing now). Prod does not need it: the Apr 22 seed migration and the
  Apr 23 revert migration apply inside a single prisma migrate deploy, so
  plans can't auto-expand through a 309-bloat window.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full regression check and PR update

**Files:** no changes; verification only.

- [ ] **Step 1: Run the full Vitest suite**

```bash
npm test -- --run
```

Expected: all tests pass. If any test fails, check whether it's flake (re-run) or real regression. No test in this repo depends on the `3600000` row existing (confirmed in spec §"Code Changes" — we don't modify any test code), so any failure here means something unexpected.

- [ ] **Step 2: Type check the whole project**

```bash
npx tsc --noEmit
```

Expected: same count of pre-existing errors as before the change (per `memory/project_compilation_warnings.md`). No new errors.

- [ ] **Step 3: Manual dev-server smoke test**

```bash
npm run dev
```

Wait for `Local: http://localhost:3005`, then in a browser:

1. Go to the Map view (`/map` or whatever the current route is).
2. Search "NYC Charter" in the SearchBar — confirm no rollup-suggestion card appears with "276 child districts" suffix. Individual charters may appear as normal search results, but no synthetic group.
3. Click a NYC area on the map — confirm a CSD (e.g. "NYC GEOGRAPHIC DISTRICT #1") selects, not a `3600000` feature.
4. Open DistrictCard for NYC DOE (`3620580`) — confirm the rollup strip still reads "32 child districts" with a Select-all-32 CTA.
5. Open DistrictCard for a charter (e.g. leaid `3600943`) — confirm there is no rollup strip (no children, no parent).
6. Create a test plan, add NYC DOE via ContactsActionBar or the plan UI — confirm auto-migrate expands to exactly 32 districts (not 33, not 309).

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Push the branch**

```bash
git push origin worktree-nyc-doe-rollup
```

Expected: three new commits land on the remote branch; PR #131 updates automatically.

- [ ] **Step 5: Verify PR #131 picks up the new commits**

```bash
gh pr view 131 --json commits --jq '.commits[-3:] | .[] | .messageHeadline'
```

Expected: the last three headlines are:
1. `feat(data): revert NYC charter pseudo-rollup; restore NCES-native parentage`
2. `feat(map): bump tile cache v=9 → v=10 after charter pseudo-rollup revert`
3. `chore(data): delete obsolete NYC charter pseudo-rollup scripts`

- [ ] **Step 6: No commit — the push itself is the deliverable**

---

## Post-Execution Follow-Ups (out of plan scope)

After this plan merges (part of PR #131's merge), update the `project_nyc_doe_rollup.md` memory entry so the "final data model" section reads:

> NYC DOE (`3620580`) parents exactly 32 Geographic Community School Districts. District 75 and all 276 NYC charter leaids are NCES-native top-level districts (no parent). No synthetic rollups exist.

This is a memory update, not a code change, and is handled in a follow-up conversation.
