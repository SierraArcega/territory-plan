# Implementation Plan: Home Dashboard — Performance + Pipeline

**Date:** 2026-05-28 · **Slug:** home-dashboard · **Branch:** worktree-home-dashboard
**Spec:** [../specs/2026-05-28-home-dashboard-spec.md](../specs/2026-05-28-home-dashboard-spec.md)
**Backend context:** [../specs/2026-05-28-home-dashboard-backend-context.md](../specs/2026-05-28-home-dashboard-backend-context.md)
**Prototype reference:** `Docs/Dashboard.zip` → `handoff_performance_dashboard/prototype/` (extracted at `/tmp/dashboard-inspect/...`)

Build order follows the spec's metric-by-metric phasing. Each phase is shippable
on its own (commit per task, per [[feedback_regular_commits]]). **Collaborative
checkpoints (CC)** = points where we resolve a deferred business-logic question with
the user *before* coding that piece — do not guess past a CC.

Commit rule for every task: plain message, **no model identifiers**
([[feedback-no-model-ids-in-commits]]); identity via `-c` flags ([[git-identity]]).

---

## Phase 0 — Scaffold & shared foundation

**B0.1 — Shared FY helper.** Extract the duplicated FY derivation
(`fetch-leaderboard.ts:49-54`, `revenue-rank/route.ts:22-25`) into
`src/lib/fiscal-year.ts`: `getCurrentFY()`, `schoolYearFor(fy)`, `fyPills(currentFY)`
→ `[{fy, schoolYr, label}]` for FY-2..FY+1. Re-point both existing call sites at it
(behavior-preserving). *Test:* unit test boundaries (June 30 vs July 1; FY26↔"2025-26").

**B0.2 — Active-rep roster helper.** `getActiveReps()` in
`src/features/leaderboard/lib/` (or `src/lib/reps.ts`): `prisma.userProfile.findMany`
where `role = 'rep'`, returns `{id, email, fullName, avatarUrl}[]`. Single source for
the dashboard's roster + the `N reps` count. *Test:* mocked prisma returns reps only.

**F0.3 — Tab scaffold.** Flip `disabled` off the `dashboard` tab in `HomeTabBar.tsx`;
add `{activeTab === "dashboard" && <DashboardTab/>}` in `HomeView.tsx`; sync to
`?tab=dashboard` URL state like the other tabs. Create
`src/features/home/components/dashboard/DashboardTab.tsx` shell with FY + segment +
sub-tab (`performance`|`pipeline`) state and a placeholder body. *Test:* renders, tab
switches, URL param round-trips.

**F0.4 — Chart primitive stubs + tokens.** Create `dashboard/charts/` with typed but
minimal `SegmentBar`, `Sparkline`, `DeltaChip`, `RankTrajectoryChart`, `FunnelChart`,
`StageBar`. Port color tokens from `prototype/tokens.css` into the component layer
(reuse `Documentation/UI Framework/tokens.md` values — Return=plum, New=coral,
Win-back=steel-blue, Expansion=golden/sage). *Test:* each primitive renders given
sample props (snapshot-light).

**F0.5 — FY selector + filter bar.** `FiscalYearPills.tsx` (from B0.1's `fyPills`),
breadcrumb + dynamic `FY26 · N reps` meta (region label dropped), `PageHead`
(title/subhead + rep selector + Me/Team pill + Export stub). *Test:* disabled pill
when FY has no data (empty-state path).

---

## Phase 1 — Topline endpoint skeleton + ranking generalization

**B1.1 — Per-metric ranking primitive.** Generalize `getRepLeaderboardRank`
(`opportunity-actuals.ts:410`) into `rankRepsByMetric(metricKey, schoolYr, segment?)`
returning **all reps'** ranks in ONE window-function query over DOA (+ session-revenue
UNION for the revenue metric). `metricKey ∈ {targets, openPipeline, bookings, revenue,
take}`. Reuse `getRepActualsBatch` for the values; rank with `RANK() OVER (ORDER BY …)`.
Never per-rep fan-out. *Test:* known fixture → correct ordering, ties, and the calling
rep's rank + `totalReps`.

**B1.2 — `GET /api/home/dashboard/topline?fy=&segment=`.** Cookie-authed,
`force-dynamic`. One batched fetch (`getRepActualsBatch(allRepEmails, [priorSY,
currentSY])`) → for the calling rep, return the 5 cards' shells:
`{ metricKey, value, rank, totalReps, deltaVsLastYear, sparkline:{current[],prior[]} }`.
Segment breakdown + sub-rows filled per-card in Phase 2. *Test:* 401 when
unauthenticated; shape correct; rep with no data → zeros + rank tail.

**F1.3 — `useTopline(fy, segment)` hook + `ToplineStatStrip`.** Hook in
`home/lib/queries.ts`, stable key `["dashboard","topline",schoolYr,segment]`. Strip
renders 5 `StatCard`s wired to the skeleton payload (value + rank chip + sparkline),
loading skeletons, error fallback. *Test:* loading→data→error transitions; 5 cards.

---

## Phase 2 — Topline cards, one metric at a time (full-stack each)

Each card: finalize its calc in B1.1/B1.2, add segment breakdown + sub-rows + deltas to
the `topline` payload, build the card's full anatomy (segment bar, legend, two deltas,
open affordance, hover). Verify the number against the leaderboard / real DB before
moving on.

**P2.1 — Open Pipeline** (DOA `open_pipeline`/`weighted_pipeline`/`opp_count`, segment
split by `category`). Simplest pure-DOA metric → do first to prove the pipeline.
**P2.2 — Closed-Won Bookings** (DOA `bookings`, `opp_count`, `min_purchase_bookings`).
**P2.3 — Sched + Delivered Take** (DOA `scheduled_take`+`completed_take`; margin via
`avg_take_rate`).
**P2.4 — Sched + Delivered Rev — `(CC-rev-blend)`** wire the **blended**
`getRepActuals` logic (DOA + `rep_session_actuals`); verify the topline reconciles with
the leaderboard's revenue exactly. Delivered-vs-scheduled split bar (solid + hatched).
**P2.5 — Targets — `(CC-targets-active)`** plan-membership count via
`sumTargetsWithPipelineDeduction` (`fetch-leaderboard.ts:154-174`); New/Win-back/
Expansion from the 4 target columns; "Converted to pipeline X/287" from the dedup;
**CC: define "Active 187/287"** (has logged activity? has open pipeline?) with the user
before coding the sub-count. Stale warning chip from `getUnmatchedCountsByRep`.
**P2.6 — `DealDetailModal` shell** — opens on card click; placeholder per-metric content
(handoff-sanctioned). *Tests per card:* value math on fixtures; segment split sums to
total; delta sign; modal opens/closes (Escape + backdrop).

---

## Phase 3 — Rank trajectory card + modal

**B3.1 — Monthly-rank aggregation — `(CC-monthly-date-basis)`.** **CC:** confirm which
date buckets each metric by month (`close_date` for bookings, `created_at` for pipeline,
`session.start_time` for revenue) and what the "Pre-FY carryover" band represents,
before building. Then `monthlyRanksByMetric(schoolYr, segment?)` → per metric, 13
columns (Pre-FY + Jul..Jun), each with the calling rep's `{rank, value}` and **all
reps'** `{email, rank, value}` for the modal's team breakdown + a team-total row.
One bucketed window-function query per metric family. *Test:* month bucketing edges;
ranks per column; projected (future months) flagged.

**F3.2 — `RankTrajectoryChart` (inline).** Port `prototype/hifi-charts.jsx`
`RankTrajectoryChart`: Y `#1..#12`, gridlines at 1/3/6/9/12, 13 X columns, one line per
metric (token colors), today marker + coral "TODAY" pill, dashed projected lines +
hatched "PROJECTED" band + hollow end dots, Pre-FY→Jul transparency. *Test:* renders
series; today marker position from `getCurrentFY` month.

**F3.3 — `RankTrajectoryCard`.** Chart + 248px legend column (per-metric rows: stroke
swatch, name, `#now→#proj`, delta chip, colored left border) + insight strip. Info
tooltip with the formula. Expand button. *Test:* legend rows sorted by projected rank;
delta chip colors.

**F3.4 — `RankTrajectoryModal` (full-screen).** Port `hifi-rank-modal.jsx`: metric
filter pills, FY pills, segment filter chips, the larger chart (ghosted teammate lines
when a metric is isolated), summary-card strip, monthly-ranks table (sticky metric col,
13 month cols, stacked rank/value/share cells), expandable team breakdown (12 reps, YOU
highlight + coral border, sorted by current-month rank), team-total Σ row, Export CSV.
Escape closes. *Test:* segment filter re-routes data; row expand toggles; Escape close;
ghosting on metric isolate.

---

## Phase 4 — Pipeline tab

**B4.1 — Stage breakdown query.** Aggregate `opportunities` for the rep/FY by `stage`:
count, `$ amount`, weighted (DOA weights `{0:.05..5:.90}`), win-prob, avg age
(`now-created_at`), stalled count (from `stage_history`), rank. *Test:* per-stage rollup
on fixtures.

**B4.2 — `pipeline/coverage` + `pipeline/funnel?source=`.** Coverage = min commit floor
/ max budget ceiling / gap-to-target, stacked by stage. Funnel = stage conversion with
you-vs-team-median (conversion rates historical, source pills re-scale via fixed ratios
per `applySourceFilter` in `hifi-pipeline.jsx`). *Test:* source filter scaling; funnel
stage math.

**B4.3 — `pipeline/opportunities` + `pipeline/stage-health` — `(CC-pipeline-health)`.**
Row-level opps (template: `getDistrictOpportunities:454`, but scope by
`sales_rep_email`+`school_yr`): account+state chip, source, stage, `$`, weighted,
close date, age, **health**, **next action**. **CC:** define health/at-risk/next-action
derivation + staleness thresholds (`stage_history` days-in-stage + `activities` last
touch) with the user. "Top targets not yet in pipeline" reuses
`GET /api/leaderboard/increase-targets` (`useLowHangingFruitList`). "This week" = Won/
Lost/Created from `close_date`/`created_at`. *Test:* age/stalled derivation; empty rows.

**B4.4 — `pipeline/forecast` — `(CC-forecast-tiers)`.** **CC:** confirm Best case /
Commit / Most likely tiers (CRM categorization vs derived from weighted pipeline + stage
bands) with the user. Right-rail: Forecast (rows vs FY target w/ progress bars), At-risk
list, Pipe-by-close-month bars (min committed + max budget, next 6 months). *Test:*
forecast rows sum; pipe-by-month bucketing.

**F4.5 — Pipeline UI.** `PipelineSection` 2-col + right rail (stacks when narrow):
`CoverageCard`, `StageHealthCard`, `FunnelCard`(→`FunnelChart`,`StageBar`),
`TopOpportunitiesTable`, `TopTargetsTable`, `ThisWeekCard`; rail `ForecastCard`,
`AtRiskCard`, `PipeByMonthCard`; `StageDealsModal` from funnel click. Tables paginate at
50 (CLAUDE.md). *Test:* renders each card from fixtures; stage modal open; pagination.

---

## Phase 5 — Polish & cross-cutting

- Responsive pass (5-card `overflow-x-auto`, `whitespace-nowrap` stat values, 2-col
  stacks, full-screen mobile modals) + **iPhone scroll verification** (CLAUDE.md).
- Animation tokens (ease-out-expo, hover 100–150ms, modal 250ms).
- Export CSV (rank modal footer + PageHead Export).
- Empty/error states audited across every surface.

---

## Dependencies & ordering

```
B0.1 ─┬─ B0.2 ─ B1.1 ─ B1.2 ─ F1.3 ─ P2.1..P2.6
      └─ F0.3 ─ F0.4 ─ F0.5 ──────────┘
B1.1 ─ B3.1(CC) ─ F3.2 ─ F3.3 ─ F3.4
B0.* ─ B4.1 ─ B4.2 ─ B4.3(CC) ─ B4.4(CC) ─ F4.5
Phase 5 last.
```
Phases 2/3/4 are independent slices once Phase 0–1 land (can interleave). CCs gate only
their own task.

## Test strategy

- **Backend:** Vitest unit tests per query helper with fixture rows asserting exact math
  (segment sums = total, rank ordering/ties, FY/month bucketing, blended-revenue
  reconciliation). Mock prisma / `$queryRaw`; for matview SQL, test the pure
  bucketing/derivation helpers separately from the query.
- **Frontend:** Testing Library — render each card/chart from sample payloads; assert
  formatted values, loading/empty/error branches, modal open/close (Escape + backdrop),
  segment-filter re-routing. Co-locate in `__tests__/`.
- **Verification gate (Stage 8):** `npx vitest run` + `npm run build` clean; manual
  in-app check on `:3005` (and iPhone scroll) before shipping.

## Out of scope (from spec)

Customer-trends + Hygiene tabs; per-metric DealDetailModal content; region column;
`sales_rep_id` re-attribution; `district_financials` (can't rank reps).
