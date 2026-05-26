# Remove the legacy Initiative leaderboard system

**Date:** 2026-05-26
**Branch:** `worktree-remove-initiative-leaderboard` (off `main`)

## Goal

Delete the dead "Initiative" gamification system — its database tables and all
referencing code — while leaving the **active** revenue/pipeline/take leaderboard
(the Revenue and Low-Hanging-Fruit tabs reps use today) completely untouched.

## Context

The leaderboard feature evolved. `fetch-leaderboard.ts` and the live API routes
now compute everything from `district_opportunity_actuals` and
`territory_plan_districts` targets — they do **not** read the Initiative tables.
A guard test (`fetch-leaderboard.test.ts`) even asserts the payload contains no
initiative fields. The Initiative tables are a legacy point/tier system with only
one real code consumer left (a seed script).

## Scope

### Database — 5 tables dropped (permanent, includes real per-user point/tier data)

- `initiatives`
- `initiative_metrics`
- `initiative_scores`
- `initiative_tier_thresholds`
- `metric_registry` (action→label→category lookup that fed the old point system; no FK, unused in app code)

### New Prisma migration

`prisma/migrations/<timestamp>_remove_initiative_leaderboard/migration.sql`, run in
this order (both statements are transaction-safe):

1. `CREATE OR REPLACE FUNCTION public.handle_new_auth_user()` — re-emit the existing
   auth→profile sync trigger function **with the one `UPDATE public.initiative_scores ...`
   line removed**. Required: that function's drift-merge branch references
   `initiative_scores`, and it's wrapped in `EXCEPTION WHEN OTHERS`, so dropping the
   table without patching it would make the stub-merge path fail *silently* mid-way.
   The full function body is copied verbatim from
   `prisma/migrations/20260429120000_add_auth_user_profile_sync_trigger/migration.sql`
   minus that line.
2. `DROP TABLE IF EXISTS public.initiative_metrics, public.initiative_scores,
   public.initiative_tier_thresholds, public.initiatives, public.metric_registry CASCADE;`

**Apply:** `npx prisma migrate deploy` (uses `DIRECT_URL`). Confirm `prisma migrate
status` shows only this migration pending first, to avoid applying unrelated drift.
Then `npx prisma generate`.

### Code edits

- `prisma/schema.prisma` — remove the 4 Initiative models, the `MetricRegistry`
  model, the `initiativeScores InitiativeScore[]` relation line on `UserProfile`,
  and the `// ===== Initiative Leaderboard =====` section comment.
- `scripts/seed-initiative-0.ts` and `prisma/seed-metric-registry.ts` — delete (the
  only real consumers of the Prisma models; both are standalone seeders not wired into
  `prisma/seed.ts`).
- `src/features/leaderboard/lib/types.ts` — remove the vestigial `| "initiative"`
  member from the `LeaderboardView` union (no other code references it).
- `src/lib/district-column-metadata.ts` — remove the 5 table names from `excludedTables`.
- `prisma/migrations/manual/create-readonly-role.sql` — remove the 5 names from the
  symbolic `REVOKE` list so that hand-run file stays runnable after the drop.

## Intentionally kept

- The entire active leaderboard: `fetch-leaderboard.ts`, `/api/leaderboard*` routes,
  Revenue/LHF components and their tests.
- The guard test in `fetch-leaderboard.test.ts` ("payload without initiative fields") —
  negative assertions that stay true and document the boundary.
- `RankTicker.tsx` — generic ticker, imported nowhere, not initiative-specific (out of scope).
- The unrelated "competing initiative" English prose in `DealQualifyingPage.tsx`.

## Verification

- `npx prisma validate` — schema valid after model removal.
- `npm test` — leaderboard suite green; full suite has no new failures.
- `grep -ri initiative src scripts` — no remaining references except the intentional
  guard test and the unrelated prose above.
- After deploy: `prisma migrate status` clean; the 5 tables gone; a test signup still
  succeeds (trigger function intact).

## Rollback

The migration is destructive (table data is not recoverable from the migration).
Rollback = restore from a DB backup. The code changes revert via git.
