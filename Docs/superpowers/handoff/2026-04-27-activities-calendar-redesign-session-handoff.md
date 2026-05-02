# Session Handoff: Activities + Calendar Redesign

**Created:** 2026-04-27
**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/activities-calendar-redesign`
**Branch:** `worktree-activities-calendar-redesign` (based on `feat/db-readiness-query-tool`)
**Strategy:** **One wave per session** — each future session executes one wave, commits, and ends. Avoids subagent permission issues.

## Required reading per session

Every wave session should start by reading these four docs (in order, all in the worktree):

1. **`Docs/superpowers/specs/2026-04-27-activities-calendar-redesign-spec.md`** — what we're building, all locked decisions
2. **`Docs/superpowers/specs/2026-04-27-activities-calendar-redesign-backend-context.md`** — schema deltas, route inventory, sync wiring, risks
3. **`Docs/superpowers/specs/2026-04-27-activities-calendar-redesign-gap-audit.md`** — 30+ gaps with file:line refs, severity-tagged, mapped to waves
4. **`Docs/superpowers/plans/2026-04-27-activities-calendar-redesign-plan.md`** — the 7 waves with file ownership

Plus the design handoff: **`design_handoff_activities_calendar/`** (vendored in worktree — README + reference JSX + tokens CSS).

## Locked decisions (don't re-litigate)

| Decision | Choice |
|---|---|
| Map-over-time | Real MapLibre embed |
| Drawer save model | Auto-save per field + transient "Saved" flash. No Save buttons. |
| Schedule view | Click-day-to-focus (per reference JSX) — week strip, big bordered selected-day card |
| Filter API | Server-side CSV multi-value (Wave 1 extends API) |
| Status set | Keep 7 in DB; render only 5 handoff statuses in drawer |
| `Activity.outcome` | Keep as free-text "outcome notes"; new `outcome_disposition` enum-style column |
| Expense amount | Keep `Decimal(10,2)`; expose `amountCents` in API |
| Prisma enums | NO. Use String columns + constant arrays (project convention). |
| Icons | Lucide only (replace any emoji from reference JSX) |
| Inline `style={}` → Tailwind | Always — reference uses inline-style; we don't |
| Page route | **Replace body of `src/features/shared/components/views/ActivitiesView.tsx`** to render `<ActivitiesPageShell />`. App is SPA via `?tab=activities` — do NOT create `src/app/activities/page.tsx`. |
| Expense auth | Owner-or-admin (POST/DELETE/receipt) — stricter than notes/attachments |
| New activity button | In header AND Upcoming rail |

## Wave order & dependencies

```
W1 (backend) ─┬─→ W3 (filters need multi-value) ─┬─→ W4 (views, 4 parallel-able)
              │                                   ├─→ W5 (drawer panels, 5 parallel-able)
              └─→ W2 (shell uses no W1 types directly) ────→ W3
                  W2 ─→ W4 (views mount inside shell)
                  W2 ─→ W5 (drawer uses shared primitives)
                  W4+W1 ─→ W6 (deals)
                  ALL ─→ W7 (polish)
```

In practice for one-wave-per-session:
- W1 first (sequential, blocks others)
- W2 next (after W1 commits — primitives + ActivitiesView replacement)
- W3 next (after W2 — extends rail, adds Bar/Chips, VariantSwitcher, default-owner hydration)
- W4 next (after W3 — views in any order: Schedule recommended first since it's default)
- W5 next (after W2; can run alongside W4 — drawer panels in any order)
- W6 next (after W1 + W4)
- W7 last (polish, a11y, mobile)

## Per-wave session prompt template

```
Read the four docs in Docs/superpowers/{specs,plans}/2026-04-27-activities-calendar-redesign-* and the
session handoff at Docs/superpowers/handoff/2026-04-27-activities-calendar-redesign-session-handoff.md.

I want to execute Wave <N> in this session. The plan doc lists the file ownership for this wave.
Stick exactly to those files — don't touch other waves' files. When done, commit and stop.
```

## What's already committed

- `6633a63a` — backend context + spec
- `b6c15a4b` — implementation plan
- (about-to-add) — gap audit + this handoff doc
- Settings.local.json was extended with subagent permissions — NOTE: those didn't actually take effect for subagents in the original session. Future sessions may want to revert if the permission grants aren't needed.

## What's NOT yet implemented

Everything in the waves. Scaffold from commit `8b0c9371` (already on this branch) is the starting state. The scaffold files are real but visually mismatched and missing several features per the gap audit.

## Key gotchas

1. **Bug: `useActivities` query key uses raw object** — Wave 1 fixes (CLAUDE.md violation, causes phantom refetches)
2. **Bug: `ActivitiesParams.stateCode` vs route's `stateAbbrev`** — Wave 1 unifies on `state`
3. **Bug: `CalendarSyncBadge` page version never emits `stale`** — Wave 2 fixes via shared `useCalendarSyncState` hook
4. **Calendar hook is named `useCalendarConnection()`, NOT `useCalendarStatus`** — the spec says both interchangeably; the actual hook lives at `src/features/calendar/lib/queries.ts:14`
5. **`deriveActivitiesParams` already exists** — found in `src/features/activities/lib/filters-store.ts`. Don't re-author.
6. **Supabase Storage bucket SQL is NOT auto-run by `prisma migrate`** — `supabase/storage-activity-attachments.sql` must be run manually in Supabase SQL Editor before file uploads work. Flag this in Wave 1's report.
7. **Branch base is `feat/db-readiness-query-tool`** — that branch has unrelated query-tool work. The PR will need to either rebase onto main after that branch ships, or include those commits as part of the PR.
