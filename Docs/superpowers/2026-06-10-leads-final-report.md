# Feature Report: Leads — BDR Lead Management & Pipeline

**Date:** 2026-06-10
**Status:** Ready for Review

## Summary

Full BDR lead-management surface: a Leads tab with a 3-layout pipeline board, table, lead detail panel, stacked Contact/School/District record panels, six modals, and dual bulk import (leads + engagement activity) with a server-driven dry-run preview. Backend adds `leads`, `lead_events`, `activity_schools`, and `contacts.school_ncessch` (migration authored, deliberately not applied), a transition-validated lead service that creates/advances native Stage 0 opportunities, and ten new API routes. The core invariant — engagement is never owned by a lead, it lives on durable records — is enforced by construction throughout.

## Changes

| File | Action | Lines |
|---|---|---|
| **Schema & migration** | | |
| `prisma/migrations/20260610000000_leads/migration.sql` | Added | 107 |
| `prisma/schema.prisma` | Modified | +81 |
| **Server lib** (`src/features/leads/lib/server/`) | | |
| `lead-service.ts` (transitions, opp side-effects, engagement, link-opp) | Added | 657 |
| `lead-import.ts` (shared dry/wet resolution + apply) | Added | 676 |
| `timeline-items.ts`, `record-helpers.ts`, `route-auth.ts` | Added | 254 |
| **API routes** (`src/app/api/leads/`) | | |
| `route.ts`, `[id]/route.ts` (list/create, edit/transition/delete) | Added | 333 |
| `[id]/timeline`, `[id]/engagement`, `[id]/opportunity` | Added | 169 |
| `import/`, `import/activities/` (dryRun + wet) | Added | 132 |
| `records/contact|school|district/` aggregates | Added | 411 |
| `src/app/api/activities/route.ts` (extract `readMulti`) | Modified | ±12 |
| **Client lib** (`src/features/leads/lib/`) | | |
| `queries.ts`, `types.ts`, `status-config.ts`, `filter-columns.ts`, `sla.ts`, `import.ts`, `opp-draft.ts` | Added | 1,484 |
| **Leads UI** (`src/features/leads/components/`) | | |
| `LeadsView.tsx`, `LeadsTable.tsx`, `LeadActivityTimeline.tsx` | Added | 1,106 |
| `board/` (LeadsBoard 3 layouts, LeadCard) | Added | 682 |
| `panels/` (detail, record shell + 3 record panels, chrome, bits) | Added | 1,883 |
| `modals/` (Add, Bulk upload, Outcome, Disqualify, LinkOpp, ScheduleMeeting, OppFields, chrome) | Added | 2,101 |
| `bits/` (Status/LeadType/Sla badges, ScorePill, StatTile, LinkageChip, MicroLabel) | Added | 272 |
| **Shared primitives** (`src/features/shared/`) | | |
| `Toast.tsx`, `InfoTip.tsx`, `SegmentedControl.tsx` | Added | 309 |
| `filters/` (FilterBuilder, SortDropdown, filter-builder-utils) | Added | 1,075 |
| `lib/csv.ts` (`parseCsv`), `lib/date-utils.ts` (`fmtDate`/`fmtRel`), `lib/query-params.ts` (`readMulti`) | Added/Modified | +137 |
| **Nav & app shell** | | |
| `page.tsx`, `providers.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `app-store.ts` | Modified | +22 |
| `src/lib/district-column-metadata.ts` (exclude new tables from query tool) | Modified | +6 |
| **Tests** | | |
| `src/app/api/leads/**/__tests__/` (8 files) | Added | 1,524 |
| `src/features/leads/**/__tests__/` (18 files incl. fixtures) | Added | 3,718 |
| `src/features/shared/**/__tests__/` (6 files + csv/date-utils extensions) | Added/Modified | 1,147 |

Total: 107 files, +18,439 / −20 lines.

## Test Results

- New tests: **302** in 34 new test files (plus extended `csv`/`date-utils` coverage)
- Leads-scope (features/leads + api/leads + features/shared): **792 passed, 0 failed**
- Full suite: **4,125 passed, 4 failed, 1 skipped** — all 4 failures pre-existing on main and unrelated to this branch (query-tool registry missing `district_collaborators`/`district_watchers`/`copilot_turn`/`copilot_action_log`; district-notes route test ×2; dashboard pipeline at-risk test). The new leads tables are correctly excluded from the registry, so this branch adds no failures.
- `npm run build` clean; `npx prisma validate` / `generate` clean.

## Design Review

Two blockers were found and fixed during the design-review pass (both independently verified): Esc-key layering (each open layer — modal, record stack, panel — pops exactly one level per press) and swimlane touch-action breaking vertical scroll. The fix pass also landed: plum toast restyle (tones via icon tint), plum modal CTAs with outline danger variant, RouteZone for unassigned new leads with an `assigned_at` SLA-clock reset on first routing, panel shadow unification, swimlane/grouped pagination at 50, and enriched timeline cards (outcome pill, stars, Mixmax stats, `+N pts` via `Activity.metadata.leadPoints` — no schema change).

Accepted deviations (documented in code comments): hand-built `LeadsTable` instead of shared DataGrid (sole-sort header model and §4 pixels don't match the grid's machinery); SegmentedControl recessed restyle; opportunity uuids hidden from the UI; status choices derived from the shared transition table; honest 500-row import copy; AddLeadModal district combobox replacing the prototype's free-text fields; bulk preview rendered from the server's dryRun plan; board-layout switcher. Verdict after fixes: **pass**.

## Code Review Findings

### Strengths

- **Single-sourcing where it matters most:** the transition table (`LEAD_TRANSITIONS`) and the opp-advanced toast copy live in client-safe `status-config.ts` and are imported by the server service — UI choices and server validation cannot drift (verified: OutcomeModal derives its status pills from the same table the server 422s against). Dry-run and wet-run imports share one resolution code path (`resolveLeadRows`/`resolveActivityRows` feed both), and `pickMostRecentContact` is shared between manual create and bulk import.
- **Spec edge cases all handled and tested:** duplicate emails → most-recent contact + `duplicate_email` warning; unresolvable school NCES degrades gracefully (warning, row kept); illegal transitions → 422; disqualify without reason → 400; one-active-lead-per-contact → 409 on create and `contact_has_active_lead` on import; district stub creation mirrors the schools ETL (`stateFips = leaid[:2]`).
- **Security:** every route checks `getUser()`; all `[id]` mutations go through a shared owner-or-admin guard (`route-auth.ts`); imports are capped at 500 rows with array/type validation; all data access is parameterized Prisma (no raw SQL anywhere in the feature); no `dangerouslySetInnerHTML`; app-generated opp uuids cannot collide with LMS numeric-text ids; `parseCsv` builds plain string-valued row objects (a `__proto__` header cannot pollute — assignment of a string is a silent no-op).
- **Performance:** import resolution is fully batched (5 lookups per batch, no N+1); record routes cap lists and timelines at 50; board columns, swimlane cells, grouped sections, and the table all render-paginate at 50 with Show-more; query keys are serialized primitives; LeadsView memoizes filter/sort/stat derivations; optimistic restage with snapshot rollback + alert toast.
- **No production `any`/`@ts-ignore`/`eslint-disable`** (the only `as any` usages are in route-test mocks, matching the established repo test idiom).
- **Migration quality:** additive-only, correct FK actions (contact/district RESTRICT, school/BDR/opp SET NULL, lead_events CASCADE), all spec'd indexes present, self-documenting header, no TODOs.

### Issues

| Severity | Description | File | Recommendation |
|---|---|---|---|
| Important | The lead timeline is the one unbounded list in the feature: the activities query has no `take`, and `TimelineList` renders every item with no 50-row cap. The `OR` includes all district-linked activities, so a lead in a high-activity district (e.g. a customer account with auto-linked activities) can pull and render hundreds of rows in the detail panel. Every sibling surface (record routes, board, table) caps at 50. | `src/app/api/leads/[id]/timeline/route.ts` (activities `findMany`), `src/features/leads/components/LeadActivityTimeline.tsx` (`TimelineList`) | Add `take` (e.g. 200) to the activities query and a 50-row render page with Show-more in `TimelineList`. Note: `DisqualifyModal` derives its preserved-event count from this response, so cap the count display or keep a separate count query. |
| Minor | District record `stats.schools` reports `schools.length`, which is both filtered (engaged-only) and capped at 50 — while `contacts`/`leads` stats use true `count()` queries. A district with >50 engaged schools shows "50". | `src/app/api/leads/records/district/[leaid]/route.ts` | Add a `school.count` query with the same engaged-only `where`, or label the stat "engaged schools shown". |
| Minor | `LogEngagementResponse.activityId` is typed `number`, but the server returns `activity.id` (a uuid string). Currently unused by callers, so no runtime impact — but the first consumer will trip on it. | `src/features/leads/lib/queries.ts:296` | Change to `string`. |
| Minor | `score: parseInt(score, 10) \|\| 100` maps an explicitly typed `0` to 100 (falsy fallthrough). | `src/features/leads/components/modals/AddLeadModal.tsx:199` | `Number.isFinite(parsed) ? parsed : 100`. |
| Minor | A few mirrored constants are duplicated across the client/server boundary even though the server already imports client-safe modules: `MAX_IMPORT_ROWS` (`lib/import.ts` + `lib/server/lead-import.ts`), `LEAD_STATUSES` (`lib/types.ts` + `lead-service.ts`), `CLOSED_OPP_STAGES` (`lib/queries.ts` + `lead-service.ts`), `LEAD_TYPES` array vs `LEAD_TYPE_ORDER`. | `src/features/leads/lib/*` | Have the server import these from the client-safe modules (same pattern already used for `LEAD_TRANSITIONS`/`OPP_ADVANCED_MESSAGE`). |
| Minor | OutcomeModal's "How did it go?" pills toggle multi-select (`picks[]`, `aria-pressed`) but only `picks[0]` is persisted as `outcomeType` — selecting two pills silently drops the second. | `src/features/leads/components/modals/OutcomeModal.tsx` | Make the pills single-select (radio behavior), or persist the extras into notes/metadata. |
| Minor | Import apply loops surface raw `error.message` (potentially Prisma internals) in `failed[].reason` to the client. Internal tool, low risk, but inconsistent with the snake_case error codes used elsewhere. | `src/features/leads/lib/server/lead-import.ts:530-534, 662-666` | Map known Prisma error codes to short reason codes; log the full error server-side only. |
| Minor | Bulk-upload preview renders the full plan (≤500 rows) in one scroll container — bounded by the row cap but above the 50-row render guideline. | `src/features/leads/components/modals/BulkUploadModal.tsx` | Paginate the preview list at 50 with Show-more if large files become routine. |

No Critical issues found; nothing required a fix-and-commit pass.

## Deployment Notes

- **Migration must be applied with the merge:** `npx prisma migrate deploy` for `20260610000000_leads`. It is strictly additive (two new tables, one junction, one nullable column + indexes) — no destructive statements, safe on the live DB. It was deliberately **not** applied from this worktree.
- **Schools backfill:** lead/import school resolution depends on the `schools` table being populated. Production already carries the ETL `--all-schools` load (~100K rows); any environment missing it should run `python scripts/etl/run_etl.py --all-schools`. The UI degrades gracefully (warning, district fallback) when an NCES id doesn't resolve.
- **Lead-created opportunities are native pipeline rows:** stage `"0 - Meeting Booked"` (advancing to `"1 - Discovery"` on sales-qualify), `lead_source = "Lead Pipeline"`, app-generated uuid, NULL `net_booking_amount`/`synced_at`. They will appear in the opps kanban, pipeline aggregates, and `has_open_pipeline` flags after the next scheduler refresh — expected and desired, but kanban cards will show "—" amounts until edited. LMS duplicate-entry reconciliation is explicitly out of scope (documented in the spec).
- **Query tool:** the three new tables are excluded from the copilot schema registry; register them in `TABLE_REGISTRY` (metadata authored with Sierra, per the collaborative-metadata convention) before exposing leads to copilot queries.

## Recommendation

**READY FOR REVIEW** — All spec requirements are implemented and tested (302 new tests; 792 passing across the leads scope), the build and schema validate cleanly, the full suite's 4 failures are verified pre-existing and unrelated, and both design-review blockers are fixed. One Important finding (unbounded lead timeline query/render) should be addressed in a fast-follow before the feature meets a high-activity district, plus eight Minor cleanups — none block merge. Remember to run `prisma migrate deploy` as part of shipping.
