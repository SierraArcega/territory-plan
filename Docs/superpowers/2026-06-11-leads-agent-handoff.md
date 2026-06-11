# Agent Handoff: Leads Feature — Bug & UI Iteration

**Written:** 2026-06-11 · **Branch:** `worktree-leads` · **Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/leads`
**Status:** Feature-complete, design+code reviewed, NOT yet merged/PR'd. You are here to iterate on bugs and UI polish with Sierra.

## What this is

A BDR lead-management surface ("Leads" tab) for the Fullmind territory-plan app: accept MQLs under a 2-business-day SLA, work a pipeline (New → Working → Meeting Scheduled → Sales Qualified | Unqualified), log engagement, link opportunities, bulk-import leads/activity from marketing CSVs.

**The one architectural idea that must never break:** engagement activity is NEVER owned by a lead — it lives on durable records (contact / school / district) via `activities` + junction tables, so history survives disqualification/deletion. Only lifecycle events (`lead_events`) live on the lead and cascade-delete with it.

## Read these before changing anything

1. `/Users/sierraarcega/territory-plan/Docs/design_handoff_leads/README.md` — the high-fidelity design handoff. **Pixel-faithful is the mandate**: exact hexes, radii (8/10/12/16/full), shadows, easings (`cubic-bezier(0.16,1,0.3,1)`), type tiers, copy. Prototype JSX in `design_files/` is the pixel source of truth when the README prose is ambiguous (prototype wins — precedent: stat tiles, SegmentedControl).
2. `docs/superpowers/specs/2026-06-10-leads-spec.md` — locked spec incl. approved decisions and accepted deviations.
3. `Docs/superpowers/2026-06-10-leads-final-report.md` — code-review report (file inventory, strengths, remaining minor findings).
4. `docs/superpowers/specs/2026-06-10-leads-backend-context.md` — backend conventions discovered before the build.
5. Repo `CLAUDE.md` — all of it applies (tokens, no Tailwind grays, narrow-width resilience, mobile rules, pagination ≤50 rendered, stable query keys).

## ⚠️ Environment gotchas (read carefully)

- **`DATABASE_URL` (symlinked `.env`) points at the LIVE production Supabase DB.** The leads migration (`prisma/migrations/20260610000000_leads/`) **is already applied** and recorded in the Prisma ledger. There are 123 real leads in the table (real MQL import, split ~50/50 between Sierra Arcega and Claire Begalke). Treat all writes as production writes.
- **Never run `prisma migrate deploy` or `migrate dev`.** One pending migration (`20260604152533_drop_district_sales_executive`) is deliberately unapplied — it's a destructive column drop owned by other in-flight work. If you add schema, hand-author a new migration folder, apply only your SQL manually in a transaction, then `prisma migrate resolve --applied <name>` (see git history of this branch for the pattern).
- **Pushing can auto-merge.** In this repo, pushing a branch may auto-create AND auto-merge a PR within seconds. Do NOT push unless Sierra explicitly says to ship.
- **Git identity:** commit with `git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "..."` — plain messages, NO Co-Authored-By trailers, NO "Generated with" footers. Stage files precisely by path (never `git add -A`); other sessions may share this worktree.
- Dev server: `npx next dev -p 3005` from the worktree (`.env`/`.env.local` symlinks already in place). Tests: `npx vitest run src/features/leads src/app/api/leads src/features/shared`. Both `npm run build` and the leads-scope suite were green at handoff (~850+ leads-related tests; the only 4 full-suite failures are pre-existing on main: district-notes ×2, dashboard-pipeline ×1, query-tool schema-coverage ×1).
- `Docs/` (capital) and `docs/` (lower) are BOTH tracked — check which case a file lives under before `git rm/add`.

## Code map

**Feature:** `src/features/leads/`
- `components/LeadsView.tsx` — composition root: all UI state (`view`, `boardLayout`, `search`, `scope`, `filters[]`, `sorts[]`, `selected`, `recordStack[]`, `modal`), `#lead=<id>` deep link, stat strip, toolbar
- `components/board/` — `LeadsBoard.tsx` (columns / swimlanes / grouped layouts, HTML5 drag-to-restage), `LeadCard.tsx`
- `components/LeadsTable.tsx` — hand-built fixed-layout table (deliberately NOT shared DataGrid — header sort writes the same shared `sorts[]` as the toolbar SortDropdown; sole-sort semantics)
- `components/panels/` — `LeadDetailPanel.tsx` (640px slide-in; status-aware action zone incl. RouteZone for unassigned New leads), `RecordPanelShell.tsx` + Contact/School/District record panels (480px, stack above lead panel, breadcrumbs, Esc pops ONE layer — modal > record > lead ordering)
- `components/modals/` — AddLead, Outcome, Disqualify, LinkOpportunity, ScheduleMeeting, BulkUpload (+ shared `modal-chrome.tsx`: plum BTN_PRIMARY, outline BTN_DANGER)
- `components/LeadActivityTimeline.tsx` — merged lifecycle + engagement feed; rich activity cards (outcome pill, stars, `+N pts` from `Activity.metadata.leadPoints`, Mixmax stats when present); linkage chips (District-wide steel / other-contact purple / own contact unlabeled); renders 50 + Show more
- `lib/` — `types.ts`, `status-config.ts` (STATUS_CONFIG/OPP_STAGES/LEAD_TRANSITIONS — **single source for client AND server**, server re-exports), `sla.ts` (business-day SLA, injectable `now`), `filter-columns.ts`, `queries.ts` (TanStack hooks; optimistic status mutations w/ rollback+toast; client-side filtering over a scope-fetched list ≤200, render-paginated at 50), `import.ts` (CSV header alias mapping, warning/error copy)
- `lib/server/` — `lead-service.ts` (createLead / transitionLead / logEngagement / linkOpportunity; ALL lifecycle side-effects live here), `lead-import.ts` (single dry/wet resolution path), `timeline-items.ts`, `record-helpers.ts`, `route-auth.ts`

**API:** `src/app/api/leads/` — `route.ts` (GET list w/ owner scoping `?ownerId=` default current user / `all`; POST), `[id]/route.ts` (PATCH transitions+edits, DELETE), `[id]/timeline`, `[id]/engagement`, `[id]/opportunity`, `import` + `import/activities` (≤500 rows, `?dryRun=1` returns the resolution plan from the same code path as the wet run), `records/{contact,school,district}/[id]` aggregates.

**Shared primitives built for this feature** (`src/features/shared/`): `Toast.tsx` (plum card, bottom-center, ~3.2s, `useToast()`; provider mounted in `src/app/providers.tsx`), `InfoTip.tsx`, `SegmentedControl.tsx` (recessed prototype style), `filters/FilterBuilder.tsx` + `SortDropdown.tsx` + `filter-builder-utils.ts` (typed column config; pure `buildFilterPredicate`/`buildComparator`), `lib/district-name-match.ts` (org/school name matching — **also consumed by the rfps feature; its 89 tests must stay green**), `fmtDate`/`fmtRel` in `lib/date-utils.ts`, `parseCsv` in `lib/csv.ts`.

**Schema** (applied): `leads` (uuid PK, contact/school/district FKs, status, score, SLA timestamps `assigned_at`/`accepted_at`, `meeting_at`, `opportunity_id`, `assigned_bdr_id`), `lead_events` (cascade), `activity_schools` junction, `contacts.school_ncessch`. Nav registered in `src/app/page.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, TabId in `shared/lib/app-store.ts`.

## Domain rules you must not regress

- **Transitions:** `new→{working,unqualified}`, `working→{meeting_scheduled,unqualified}`, `meeting_scheduled→{working,sales_qualified,unqualified}`; terminals terminal; validated server-side (422). UI choices derive from `LEAD_TRANSITIONS` — never hardcode status lists.
- **Opportunities are REAL rows:** entering Meeting Scheduled creates a native opp (uuid id, stage exactly `"0 - Meeting Booked"`, `lead_source = "Lead Pipeline"`); sales-qualify advances it to `"1 - Discovery"` (never "won"). Safe because the LMS sync is upsert-only. These flow into live pipeline metrics — don't create test opps casually. Never show raw opp/lead uuids to users (reps-not-engineers rule).
- **Disqualify requires a reason** and must touch zero engagement data.
- **Import resolution** (single dry/wet path in `lead-import.ts`): contact by email (no unique constraint — most-recent wins + warning) → mixed `NCES ID` column disambiguated by digit length (≤7 = district leaid, 8–12 = school ncessch→district) → **NCES-vs-name cross-check** (`schoolNameSimilarity ≥ 0.8`; conflict → re-resolve by name, scoped first to the **email-domain-implied district** — domain dominant when one leaid holds ≥80% of that domain's contacts, min 2) → name+state fallback (`matchByName`, ambiguous = fail, never guess). **District stubs may only ever be created from a valid 7-digit leaid** (hard guard — synthetic junk districts are a known historical pain in this repo).
- Score lives on `leads.score`; per-activity points ride `Activity.metadata.leadPoints` (no schema column).

## Known open items (the likely iteration backlog)

1. **Mobile real-device smoke owed** (CLAUDE.md rule): board pan-x rail, full-width panel sheets, BottomNav addition, map-tab gesture smoke after the AppShell change. Safari RDM first, then device.
2. Remaining **minor** code-review findings (see final report §Issues): district-record `stats.schools` counts engaged-only while siblings count all; mirrored client/server constants (MAX_IMPORT_ROWS, CLOSED_OPP_STAGES) could converge; 500-row bulk preview renders uncapped (bounded).
3. "Ave"/"Avenue" not in the school-name abbreviation map — one real row ("Speedway Ave Elementary") gets a false `nces_name_mismatch` flag (imports to the correct district anyway).
4. SortDropdown drag-to-reorder has no jsdom coverage — verify by hand when touching it.
5. Swimlane cells cap at 50 with "+N more" (fine); columns/grouped/table have full Show-more buttons.
6. Pipeline stages 8b–8d not done yet: context-doc updates (`docs/architecture.md` feature map, TECHSTACK API routes/schema, prompting-guide key terms), Slack notification (channel `C07AEK4HR7U`), and Sierra's merge/PR decision. **Out of scope for bug/UI iteration unless asked.**
7. Out of scope by spec: lead↔LMS opp reconciliation tooling, notifications/watchers, external lead feeds, ETL school backfill management (schools table already has 102K rows).

## Recent bug-fix history (don't reintroduce)

- Esc must pop exactly one layer: modal → record panel → lead panel (`escDisabled={recordStack.length > 0 || modal !== null}`).
- Swimlanes scroller needs `touchAction: "pan-x pan-y"` (bare `pan-x` killed vertical touch scroll).
- Bulk-preview table is `table-fixed` + colgroup + truncate-with-title; warning chips truncate and sit under the district cell — never let a nowrap chip dictate column widths.
- The "Assign all to BDR" select must not render until `profile` is loaded — an empty controlled value made the browser display the first user alphabetically and a real import went to the wrong BDR (cause of the Sierra/Claire 50/50 split now in prod data).
- AddLeadModal: explicit score 0 is preserved (`Number.isNaN` check, not `|| 100`).

## Working agreement with Sierra

- She reviews on localhost:3005 and sends screenshots; fix → commit → she refreshes (dev server hot-reloads).
- Prefer dropdowns/selects over free-text inputs. Default owner/assignee to current user. Fewest clicks possible.
- Small focused commits as you go, not one big one. Run `npx vitest run` on touched scopes before claiming done; `npm run build` before any ship conversation.
- Use AskUserQuestion for genuine product judgment calls (she answers fast); proceed without asking for reversible code changes that follow from a reported bug.
