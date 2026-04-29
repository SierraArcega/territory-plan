# Feature Report: Existing-Contacts Options Modal

**Date:** 2026-04-22
**Slug:** find-contacts-existing-options
**Branch:** feat/find-contacts-principals (worktree: find-contacts-existing-options)
**Status:** Ready for Review

## Summary

Replaces the dead-end "Nothing to enrich" toast on the Find Contacts action with
a split-action modal offering two recovery paths: refresh the current plan's
Contacts tab, or jump to another plan that already has contacts on the shared
districts. Adds a team-wide read-only endpoint, a TanStack hook, and a new
modal component; also surfaces the same modal after partial enrichment
completion (queued>0 skipped>0). Plan was followed closely with a few
reasonable deviations called out below — none blocking.

## Changes

| File | Action | Lines |
|------|--------|-------|
| `src/app/api/territory-plans/[id]/contact-sources/route.ts` | added | +162 |
| `src/app/api/territory-plans/[id]/contact-sources/__tests__/route.test.ts` | added | +304 |
| `src/features/plans/components/ExistingContactsModal.tsx` | added | +247 |
| `src/features/plans/components/__tests__/ExistingContactsModal.test.tsx` | added | +182 |
| `src/features/plans/components/ContactsActionBar.tsx` | modified | +27 / -2 |
| `src/features/plans/components/__tests__/ContactsActionBar.test.tsx` | modified | +127 / -1 |
| `src/features/plans/lib/queries.ts` | modified | +21 / 0 |
| `Docs/superpowers/specs/2026-04-22-find-contacts-existing-options-spec.md` | added | +186 |
| `Docs/superpowers/plans/2026-04-22-find-contacts-existing-options-plan.md` | added | +370 |
| `Docs/superpowers/specs/2026-04-22-find-contacts-existing-options-backend-context.md` | added | +406 |

## Test Results

- New tests: 26 passing (9 backend route + 10 modal + 7 ActionBar — the
  implementer's count of 17 appears to have undercounted the 4 pre-existing
  ActionBar cases that were left intact)
- Re-verified locally: `npx vitest run` scoped to the three modified/new test
  files → all 26 pass
- Full suite: not run — Stage 8 responsibility per instructions
- `npm run build`: not run — Stage 8 responsibility
- Coverage: hits spec-required cases (401, 404, empty-district short-circuit,
  no-overlap, overlap-without-contacts, happy path, ranking w/ tiebreak,
  limit 10, null owner; modal variants + loading + empty + error + dismiss +
  anchor semantics; action-bar all three trigger branches)

## Design Review

Pending (running in parallel). See design-review report in conversation.

## Code Review Findings

### Strengths

- Backend `ownerUser` join matches the exact precedent at
  `src/app/api/territory-plans/route.ts:48-49,90-92` (`UserProfile.fullName`
  via the `PlanOwner` relation). No schema guessing.
- Auth scope (team-wide, no `ownerId` filter) correctly mirrors the plan-list
  endpoint per the spec and carries a clear comment pointing at the precedent.
- Query layout is efficient: `findUnique` + `findMany` + `groupBy` — exactly
  three DB round-trips, no N+1. The `groupBy` aggregates over the current
  plan's leaids (a small set) rather than per-candidate, so cost scales with
  leaid count, not candidate count.
- Ranking logic is correct: `contactCount DESC`, `lastEnrichedAt DESC NULLS
  LAST` (via `-Infinity` sentinel), `name ASC` tiebreaker. Matches plan.
- Self-exclusion via `id: { not: id }` + short-circuits for empty districts
  and zero candidates avoid unnecessary queries.
- Query key `["planContactSources", planId]` is a stable primitive per
  CLAUDE.md perf rules. `ContactSourcePlan` interface is exported from
  `queries.ts` and reused by the modal and its tests (no duplication).
- The `setToast("Nothing to enrich")` dead-end is fully **replaced** (not left
  as a fallback), exactly as the spec requires. Confirmed via `git diff`.
- `pendingPartialRef` logic is sound: set only after `setIsEnriching(true)` in
  the success path; consumed once on completion; cleared immediately to prevent
  double-fire; not populated on the page-refresh auto-detect path (so reload
  mid-enrichment won't incorrectly open the partial modal).
- Focus trap is a clean inline implementation that correctly focuses the
  primary button on mount (intentional deviation from a generic
  `useFocusTrap` — the implementer documented this choice in their report and
  the spec explicitly calls for "focus the Show them here primary button").
- Plan rows use native `<a href="/plans/{id}">` preserving middle-click and
  new-tab behavior (explicit spec requirement satisfied).
- Partial-variant status message correctly uses `CheckCircle2` in `#69B34A`
  plum-family green (not a Tailwind gray), and all color tokens in the modal
  are plum-derived (`#403770`, `#6E6390`, `#E2DEEC`, `#F7F5FA`, `#EFEDF5`,
  `#8A80A8`) per Fullmind brand rules.

### Issues

| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| Minor | Partial-variant copy deviates slightly from spec: spec's Variant B says "Found {queued} new contacts for {newCount} district{s}" (queued drives the contact count, newCount drives the district count — and in the spec "newCount" means "count of districts that got new contacts", distinct from `queued` which counts contacts). The implementation passes a single `newCount` prop and reuses it for both numbers (`Found {newCount} new contacts for {newCount} districts`). In practice `queued === newCount` only when exactly one contact is returned per district. For the common case (Superintendent: 1 contact per district) this is correct; for multi-contact enrichment the district count will visually equal the contact count. Low risk because the trigger logic currently enriches 1 contact per district, but worth flagging. | `src/features/plans/components/ExistingContactsModal.tsx:140-143`, `ContactsActionBar.tsx:131-149` | Either (a) clarify in a comment that `newCount` represents both values in the 1-contact-per-district model, or (b) pass `newContactCount` and `newDistrictCount` as two props. Safe to punt unless roadmap adds per-district multi-enrichment. |
| Minor | The stretch goal "scroll first populated district group into view" after `handleShowHere` was skipped (implementer flagged it as intentional). Spec listed it as a requirement under Left column action, but the plan demoted it to "Optional: stretch goal" in `handleShowHere`. The skip matches the plan, not the spec — a small scope slip worth surfacing for maintainer sign-off. | `ExistingContactsModal.tsx:85-93` | Acceptable as-is; user can manually scroll and the invalidate+refetch is the actual functional requirement. Follow-up ticket if the maintainer wants it. |
| Minor | `relativeDate` in the modal uses `new Date(iso).toLocaleDateString()` for dates older than 30 days, which produces locale-dependent output (US: `4/1/2026`) instead of an ISO-style or "Mar 1" format. Inconsistent with how other date displays in the app handle this, though there's no strict project standard I found. | `ExistingContactsModal.tsx:29` | Consider `{ month: "short", day: "numeric", year: "numeric" }` for consistency if other date displays use that format. Not blocking. |
| Minor | No archive-status filter on candidate plans — archived plans still appear in the "other plans" list if they share districts and have contacts. The backend agent flagged this as an open question. Spec and plan don't require the filter, so this is spec-compliant, but in practice an archived plan is a confusing destination. | `src/app/api/territory-plans/[id]/contact-sources/route.ts:56-70` | Either (a) ship as-is and add an archive-exclusion ticket, or (b) add `status: { not: "archived" }` to the `findMany` where-clause. Low risk either way; confirm preference with maintainer. |
| Minor | The `mockPrisma` type uses `as any` in the route test. Standard pattern in this codebase (matches the bulk-enrich test at `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts:40`), so it's consistent, but the eslint-disable comment is worth noting. | `src/app/api/territory-plans/[id]/contact-sources/__tests__/route.test.ts:24-25` | No action needed; matches precedent. |
| Minor | `act(...)` warnings emitted by the pre-existing ActionBar test cases (not the new ones) — these are pre-existing noise in `ContactsActionBar.test.tsx` unrelated to this change. | Pre-existing | Out of scope. |

**No Critical or Important issues.**

### Spec/Plan Compliance Matrix

- Backend route behavior: matches steps 1-13 of plan B1 exactly.
- Backend tests: covers all 9 cases B2 called for.
- `useContactSources` hook: query key, staleTime, enabled flag — all match F1.
- Modal variants, columns, dismiss behavior, plan row anchor, See-all toggle:
  all match F2.
- ActionBar wiring: state, ref, completion-effect trigger, JSX placement — all
  match F3. The dead-end toast is fully replaced (not left as fallback).
- Test coverage: F4's 10 cases and F5's 3 cases all present and passing.

## Recommendation

**READY FOR REVIEW** — Implementation tracks the spec and plan closely, all
26 new tests pass, the dead-end toast is correctly replaced, auth/ranking/
query-key patterns follow established precedent, and no N+1 or subscription
pitfalls were introduced. The four minor issues (partial-variant copy nuance,
skipped scroll stretch goal, `toLocaleDateString` format, archive-filter open
question) are all safe to address post-merge if the maintainer wants — none
are blocking. Design review and Stage 8 (full suite + `npm run build`) remain.
