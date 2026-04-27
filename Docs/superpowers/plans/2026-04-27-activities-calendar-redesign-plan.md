# Plan: Activities + Calendar Redesign

**Spec:** `Docs/superpowers/specs/2026-04-27-activities-calendar-redesign-spec.md`
**Backend context:** `Docs/superpowers/specs/2026-04-27-activities-calendar-redesign-backend-context.md`
**Date:** 2026-04-27

## Strategy

7 waves. Wave 1 unblocks everything else. Waves 2 + 3 + 5 (shared primitives) can start in parallel after Wave 1. Waves 4 (per-view) are pure-frontend and parallel after Wave 2 + shared primitives. Wave 6 (deals) needs Wave 1 routes + Wave 4 view shells. Wave 7 is polish and can interleave anywhere late.

Each wave dispatches one or more implementer subagents. Each subagent gets a self-contained task, a list of files to read, and a list of files to write/edit. They report back with files changed + tests added + outstanding issues.

Parallelism is governed by file ownership — agents in the same wave never edit the same files.

## Pre-flight (parent agent does these directly)

- **P1.** Read `prisma/schema.prisma` Activity/ActivityNote/ActivityExpense/ActivityAttachment models in full to confirm the exact column names and types.
- **P2.** Read `src/lib/supabase/server.ts` for the `getUser`/`isAdmin`/`getRealUser`/`getAdminUser` signatures.
- **P3.** Read `src/features/shared/lib/queries.ts` for the `useProfile()` hook signature.
- **P4.** Read `src/features/shared/lib/format.ts` for date/currency helpers.
- **P5.** Read `src/features/activities/components/page/ActivityDetailDrawer.tsx` once, in full, so I can author precise edit briefs for the drawer subagent.

## Wave 1 — Backend foundations (1 agent, sequential)

**Owner:** `backend-1`
**Files written:**
- `prisma/migrations/20260427_add_activity_outcome_fields/migration.sql`
- `prisma/migrations/20260427_add_activity_expense_fields/migration.sql`
- `prisma/schema.prisma` (add columns to `Activity` + `ActivityExpense`)
- `src/app/api/activities/[id]/expenses/route.ts` (new)
- `src/app/api/activities/[id]/expenses/[expenseId]/route.ts` (new)
- `src/app/api/activities/[id]/expenses/[expenseId]/receipt/route.ts` (new)
- `src/app/api/activities/[id]/expenses/__tests__/route.test.ts` (new)
- `src/app/api/activities/[id]/route.ts` (extend PATCH to accept new outcome fields)
- `src/app/api/activities/route.ts` (parse CSV multi-value; fix `stateAbbrev` mismatch)
- `src/app/api/activities/__tests__/route.test.ts` (extend for new fields + multi-value)
- `src/app/api/deals/events/route.ts` (new — GET, returns OPP_EVENTS shape)
- `src/app/api/deals/open/route.ts` (new — GET, returns OPEN_DEALS shape)
- `src/app/api/deals/events/__tests__/route.test.ts`
- `src/features/activities/types.ts` (add `VALID_ACTIVITY_OUTCOMES`, `VALID_ACTIVITY_SENTIMENTS`, `VALID_DEAL_IMPACTS`, `VALID_EXPENSE_CATEGORIES` constant arrays + types)
- `src/features/shared/types/api-types.ts` (extend `Activity`, `ActivityExpense`, `ActivitiesParams` types; add `OppEvent`, `OpenDeal` types)
- `src/features/activities/lib/queries.ts` (fix query-key stability bug; fix `stateCode`/`stateAbbrev`; add multi-value support; add `useDealEvents`, `useOpenDeals`)

**Acceptance:**
- `npm run build` passes
- All new and extended `__tests__` pass
- `prisma generate` succeeds
- Migration files runnable via `npm run prisma:migrate` (ask user to run separately if DB credentials needed)

## Wave 2 — Shared primitives + Page shell + Sync hook (1 agent)

**Owner:** `frontend-shell`
**Depends on:** none (can run in parallel with Wave 1)
**Files written:**
- `src/features/shared/components/EditableText.tsx`
- `src/features/shared/components/EditableSelect.tsx`
- `src/features/shared/components/TabBar.tsx`
- `src/features/shared/components/FieldLabel.tsx`
- `src/features/shared/components/__tests__/EditableText.test.tsx`
- `src/features/shared/components/__tests__/EditableSelect.test.tsx`
- `src/features/calendar/lib/useCalendarSyncState.ts` (new shared hook)
- `src/features/calendar/lib/__tests__/useCalendarSyncState.test.ts`
- `src/app/activities/page.tsx` (new — top-level route)
- `src/app/activities/layout.tsx` (if app uses (authenticated) groups; check pattern in adjacent routes)
- `src/features/activities/components/page/ActivitiesPageShell.tsx` (composes header + saved tabs + filter shell + view body + upcoming rail + drawer)
- `src/features/activities/components/page/ScopeToggle.tsx` (new)
- Extend: `src/features/activities/components/page/ActivitiesPageHeader.tsx` (embed DateRange + ScopeToggle, fix typography)
- Extend: `src/features/activities/components/page/ActivitiesDateRange.tsx` (one bordered pill)
- Extend: `src/features/activities/components/page/CalendarSyncBadge.tsx` (use useCalendarSyncState)
- Extend: `src/features/calendar/components/CalendarSyncBadge.tsx` (use useCalendarSyncState)

**Acceptance:**
- Visiting `/activities` renders the shell with header + tabs + filter + Schedule view (still old visuals) + upcoming rail
- Sync badge correctly emits `stale` when `lastSyncAt > 30min ago` or `pendingCount > 0`
- All shared primitives have ≥1 test each
- `npm run build` passes

## Wave 3 — Filter system (1 agent)

**Owner:** `frontend-filters`
**Depends on:** Wave 2 (uses shell + shared primitives)
**Files written:**
- `src/features/activities/components/page/ActivitiesFilterBar.tsx` (variant 2)
- `src/features/activities/components/page/ActivitiesFilterChips.tsx` (variant 3)
- `src/features/activities/components/page/FilterVariantSwitcher.tsx`
- `src/features/activities/components/page/CommandBar.tsx` (⌘K overlay)
- Extend: `src/features/activities/components/page/ActivitiesFilterRail.tsx` (Deals group, States/Territories/Tags, partial counts, double-click-solo, ⌘K hint, Reset button)
- Extend: `src/features/activities/components/page/SavedViewTabs.tsx` (preset list match `ct-meetings`/`renewals`/`conferences`, leading icons, coral underline)
- Extend: `src/features/activities/lib/saved-views.ts` (preset definitions match handoff IDs)
- Extend: `src/features/activities/lib/filters-store.ts` (default-owner-seeding hook with ref guard)
- Extend: `src/features/activities/lib/__tests__/filters-store.test.ts` (cover default-owner hydration)

**Acceptance:**
- VariantSwitcher toggles between Rail/Bar/Chips with persistence
- ⌘K opens CommandBar; Esc closes
- Saved view tabs preset list matches handoff
- Default owner seeded from `useProfile().id` once on mount
- Tests pass

## Wave 4 — Views (4 agents in parallel)

**Depends on:** Wave 1 routes (for filter params) + Wave 2 shell + Wave 3 filter store changes (for default owners)
**Note:** Each agent owns ONE file. No overlap.

### Wave 4a — Schedule view (`frontend-schedule`)
- Rewrite: `src/features/activities/components/page/ScheduleView.tsx`
- Rewrite: `src/features/activities/components/page/WeekStrip.tsx` (deal dots, opp totals, vertical separator)
- Reference: `reference/components/WeekView.jsx:392-595` for week-strip + selected-day card + activity rows
- Behavior: click a day in week strip → focus that day → render bordered selected-day card with type-pill, time, duration, district, attendees; Pipeline events section if `dealDisplay !== 'overlay'`; empty state with icon

### Wave 4b — Month view (`frontend-month`)
- Rewrite: `src/features/activities/components/page/MonthView.tsx`
- Reference: `reference/components/MonthView.jsx`
- Behavior: black/coral squared today + Today eyebrow; full weekday names; weekend tinting; bordered grid (no gaps); category-filled chips with time prefix; OppDayBar slot at top of cell; legend strip below grid

### Wave 4c — Week grid view (`frontend-week`)
- Rewrite: `src/features/activities/components/page/WeekGridView.tsx`
- Reference: `reference/components/WeekView.jsx:73-595`
- Behavior: 7am–9pm at 52px/hr; round 30px today date pill; 2px coral now-line + bullet; category-filled blocks with district line when block height > 55; today-column robins-egg tint; pinned Pipeline + Deals overlay rows above grid

### Wave 4d — Map-over-time view (`frontend-map`)
- Rewrite: `src/features/activities/components/page/MapTimeView.tsx`
- New: `src/features/activities/components/page/MapTimeView/OffMapPanel.tsx`
- New: `src/features/activities/components/page/MapTimeView/TimeRuler.tsx`
- New: `src/features/activities/components/page/MapTimeView/PinCluster.tsx`
- Reference: `reference/components/MapTimeView.jsx`
- Behavior: real MapLibre using existing layer config patterns from `src/features/map/lib/layers.ts`; pin clustering by district lat/lng; horizontal time ruler responding to grain; OffMapPanel sidebar with Off-region/Virtual tabs; pin hover tooltip; team-avatar stacks under pins

## Wave 5 — Drawer panels (5 agents in parallel)

**Depends on:** Wave 1 (PATCH outcome fields, expense routes) + Wave 2 (shared primitives)
**Note:** Each agent owns ONE file.

### Wave 5a — Drawer shell (`drawer-shell`)
- Edit: `src/features/activities/components/page/ActivityDetailDrawer.tsx`
- Reference: `reference/components/ActivityDetail.jsx:115-310`
- Changes: editable title/type via EditableText/Select in header; "More" button; "Read-only · team activity" pill when `!mine`; coral tab underlines via TabBar primitive; tab counts; remove Save buttons (auto-save model); custom `flashIn` keyframes for "Saved"; preserve focus trap + Esc

### Wave 5b — Overview panel (`drawer-overview`)
- Edit: `src/features/activities/components/page/drawer/OverviewPanel.tsx`
- Reference: `reference/components/ActivityDetail.jsx:325-450`
- Changes: switch end-time to duration-min `<input type="number">`; EditableText/Select for type/title/where/attendees; `key={activity.updatedAt}` on description textarea

### Wave 5c — Outcome panel (`drawer-outcome`)
- Rewrite: `src/features/activities/components/page/drawer/OutcomePanel.tsx`
- Reference: `reference/components/ActivityDetailBits.jsx:222-333`
- Changes: 2x2 outcome cards (Completed/No-show/Rescheduled/Cancelled); 3 sentiment buttons (Positive/Neutral/Negative); nextStep multiline; followUp date picker; dealImpact select; remove legacy OutcomesTab wrap

### Wave 5d — Notes + Files panels (`drawer-notes-files`)
- Edit: `src/features/activities/components/page/drawer/NotesPanel.tsx` (composer above notes; bordered card per note; rounded composer)
- Edit: `src/features/activities/components/page/drawer/FilesPanel.tsx` (Download button; uploadedAt relative-time; 32x32 hover-bg file tile)

### Wave 5e — Expenses panel (`drawer-expenses`)
- Edit: `src/features/activities/components/page/drawer/ExpensesPanel.tsx`
- New: `src/features/activities/components/page/drawer/ExpenseEditor.tsx`
- New: `src/features/activities/components/page/drawer/MissingReceiptPill.tsx`
- Reference: `reference/components/ActivityDetailPanels.jsx:137-352`
- Changes: category pill column, missing-receipt pill, ExpenseEditor with file pick; per-line date + receipt path; uses new POST/DELETE routes from Wave 1

## Wave 6 — Deal layer (1 agent)

**Depends on:** Wave 1 (deal routes) + Wave 4 (view shells)
**Owner:** `frontend-deals`
**Files written:**
- `src/features/activities/components/page/deals/DealChip.tsx`
- `src/features/activities/components/page/deals/OppDayBar.tsx`
- `src/features/activities/components/page/deals/OppSummaryStrip.tsx`
- `src/features/activities/components/page/deals/OppDrawer.tsx`
- `src/features/activities/components/page/deals/OverdueDealRow.tsx`
- `src/features/activities/components/page/deals/ColdDistrictRow.tsx`
- `src/features/activities/components/page/deals/OppRibbon.tsx`
- `src/features/activities/components/page/deals/DealDisplayToggle.tsx`
- Edit: each view's component to consume `dealDisplay` and render deal data accordingly

## Wave 7 — Polish (1 agent)

**Depends on:** Waves 1-6
**Owner:** `polish`
**Files written:**
- Extend: `src/features/activities/components/page/UpcomingRail.tsx` (coral "Log activity" button; sticky day headers; rich activity rows with 3px border-left, eyebrow+time, title, district+teammate; correct collapsed strip rotation)
- A11y pass across drawer, filter menus, tabs, sync popover; add `.fm-focus-ring` utility to `src/styles/globals.css`
- Mobile pass: drawer bottom-sheet animation on `<md`; filter rail collapse to `<Filter/>` button; upcoming rail hide
- Animation polish: `flashIn` keyframes, sync pulse, hover 120ms

## Parent agent's role during implementation

Per `subagent-driven-development` skill:
1. Pre-flight reads (P1-P5) so I have ground truth for brief authoring
2. Dispatch each wave's agents with self-contained briefs
3. After each wave, verify the agent's work: spot-check files, run `npm run build`, sanity-check tests
4. Track progress in TaskList
5. If a wave hits a blocker, debug or re-dispatch

## Test strategy

Per wave:
- Wave 1: route handler tests for new + extended routes
- Wave 2: primitive component tests, sync hook test
- Wave 3: filter store hydration test
- Wave 4: view component snapshot tests for empty/loading/populated states
- Wave 5: panel-level interaction tests
- Wave 6: deal chip rendering test
- Wave 7: a11y axe test on drawer + page shell

Final verification: `npx vitest run && npm run build`

## Risk register

1. **Real MapLibre integration** complexity — fallback: stub with state-grouped list + banner saying "Map embed coming soon" if blocked
2. **Filter API multi-value** changes the API contract — verify `Documentation/.md Files/TECHSTACK.md` API Layer doesn't need updating
3. **Drawer auto-save model** — must handle in-flight requests on tab switch (debounce; cancel-on-unmount)
4. **Page route conflict** — `src/app/activities/page.tsx` may need an authenticated layout group; check adjacent routes
5. **Supabase Storage bucket** — `supabase/storage-activity-attachments.sql` must run manually in Supabase SQL editor before file uploads work; flag in final report

## Definition of done

- All 7 waves complete with tests passing
- `npm run build` clean
- `/activities` route renders all 4 views with real data
- Drawer auto-saves; "Saved" flash visible
- Sync badge derives `stale` correctly
- Filter rail/bar/chips switchable
- Mobile drawer + filter behaviors working
- A11y: axe-clean drawer + page
- Architecture.md and TECHSTACK.md updated for new routes/components
- Single PR ready for review
