# Plan: Remove the Engage (Email Sequencer) Tool

**Date:** 2026-05-26
**Branch:** `chore/remove-engage-tool` (off `main`)

## Context

The "Engage" email sequencer was specced on 2026-04-03 but **never built into the
app**: there is no `src/features/engage/`, no `/api/engage` route, no Prisma model,
no UI, no nav entry, and no test. The only real artifacts are:

- Two planning docs (`specs/2026-04-03-engage-email-sequencer-spec.md`,
  `plans/2026-04-03-engage-email-sequencer.md`).
- Four orphaned database tables, prototyped directly in Postgres and never wired to
  Prisma or the app: `sequences` (2 rows), `sequence_steps` (1 row),
  `sequence_executions` (0), `step_executions` (0).
- Three references in the `handle_new_auth_user()` auth-sync trigger:
  `engage_templates`, `sequence_executions`, `sequences`.

`engage_templates` **does not exist** in the database, so its `UPDATE` in the trigger
throws on every drifted signup and the `EXCEPTION WHEN OTHERS` rolls back the entire
stub-profile re-key block. Removing the three engage lines fixes that latent bug.

### Explicitly out of scope (coincidental "engagement", left untouched)

Map `fullmindEngagement` / `competitorEngagement` filters and `colorBy: "engagement"`;
the `PlanEngagement` health metric; the `speaking_engagement` activity type and
`SpeakingEngagementFields`; the `attendees_engaged` outcome type; the
`contact_engagement_view` DB view; the `mixmax_sequence_*` activity columns. None are
the Engage tool.

## Steps

1. **Delete planning docs**
   - `docs/superpowers/specs/2026-04-03-engage-email-sequencer-spec.md`
   - `docs/superpowers/plans/2026-04-03-engage-email-sequencer.md`

2. **New migration** `prisma/migrations/20260526000000_remove_engage_sequencer/migration.sql`
   - `DROP TABLE IF EXISTS public.step_executions, sequence_executions, sequence_steps,
     sequences CASCADE` (drop order respects intra-set FKs; nothing external references
     them).
   - `CREATE OR REPLACE FUNCTION public.handle_new_auth_user()` — the current function
     body minus every `UPDATE` line that targets a now-nonexistent table:
     `engage_templates`, `sequences`, `sequence_executions` (engage), plus
     `initiative_scores` and `user_goals` (dropped by earlier deprecation work).
     A reference to any missing table makes the whole re-key block throw under
     `EXCEPTION WHEN OTHERS` and roll back, so this is required for the re-key to
     work at all. Stripping the two non-engage stale lines was approved as in-scope.

3. **Apply to production** via Supabase `apply_migration`, then verify the four tables
   are gone and the trigger no longer names the dropped tables.

4. **Commit** in two focused commits (doc deletions; migration).

No `schema.prisma` change is needed — these tables were never modeled in Prisma.
