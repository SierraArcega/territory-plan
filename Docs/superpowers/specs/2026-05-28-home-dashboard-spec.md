# Feature Spec: Home Dashboard — Performance + Pipeline

**Date:** 2026-05-28
**Slug:** home-dashboard
**Branch:** worktree-home-dashboard
**Backend context:** [2026-05-28-home-dashboard-backend-context.md](./2026-05-28-home-dashboard-backend-context.md)
**Design handoff:** `Docs/Dashboard.zip` → `handoff_performance_dashboard/` (README + `prototype/`)

## Summary

Light up the currently-disabled **Dashboard** tab in `src/features/home/`. It is a
rep-facing performance dashboard: a fiscal-year selector, five topline stat cards,
and a rank-trajectory chart (+ full-screen modal) showing where the rep stands
**ranked against all active reps** — plus a **Pipeline** sub-tab beneath it
(coverage, stage health, funnel, top opportunities, forecast rail, deal modals).
Customer-trends + Hygiene tabs are explicitly out of scope (deferred handoff).

Visuals are **locked high-fidelity** — recreate the prototype pixel-perfectly using
the codebase's tokens/components. The work is mostly a **data-layer** lift: per-rep
attribution + per-metric ranking already exists for the Leaderboard; we re-rank that
engine per metric and add monthly-rank + pipeline aggregations.

## Requirements (from discovery)

- **Scope:** full handoff — Performance dashboard **and** Pipeline tab.
- **Sequencing:** metric-by-metric full-stack (define calc → build API → wire UI →
  verify against real numbers → next), so calculations come out correct.
- **Team definition:** rank against **all active reps**, `role = 'rep'` (managers
  excluded). No region subdivision; filter-bar shows a dynamic `FY26 · N reps`
  label, the prototype's "Northeast region" label is dropped (no region data).
- **Targets attribution:** plan membership (a district counts if it's in a
  territory plan the rep owns — leaderboard semantics, reuses
  `sumTargetsWithPipelineDeduction`), not `districts.owner_id`.
- **Revenue (card 4):** blended source of truth via `getRepActuals` /
  `getRepActualsBatch` (DOA columns + `rep_session_actuals` matview), so the number
  reconciles with the Leaderboard. Not a plain DOA sum.

## Visual Design

- Approved approach: **pixel-perfect recreation** of the prototype in
  `handoff_performance_dashboard/prototype/`. Lift exact hex/px/copy from
  `hifi-styles.css` + the `.jsx` files; structure components/state/data the
  codebase way.
- Architecture decision **C (hybrid API)**: group endpoints by shared query —
  one `topline` endpoint feeds all 5 cards (single all-reps batch fetch);
  rank-trajectory and each pipeline surface are separate slices. Rationale: the
  backend doc forbids per-rep query fan-out (pgbouncer); the 5 cards share one
  `getRepActualsBatch` call, so splitting them 5 ways would 5× the matview hit.
- Charting decision: **custom inline SVG** (port the prototype's faithful SVG) for
  rank trajectory, segment bars, funnel, stage bars, sparkline. Recharts (the
  codebase standard, currently pie-only) fights the bespoke rank-trajectory
  (today marker, hatched "projected" band, hollow end dots).

## Component Plan

New components under `src/features/home/components/dashboard/`:

| Component | Role |
|---|---|
| `DashboardTab.tsx` | Orchestrator: FY + segment + sub-tab state; mounts Performance + Pipeline |
| `PerformanceSection.tsx` | FY selector + topline strip + rank-trajectory card |
| `FiscalYearPills.tsx` | FY27/26/25/24 pill group; disables empty FYs |
| `ToplineStatStrip.tsx` → `StatCard.tsx` | 5-card grid + single card (value, segments, sub-rows, deltas, sparkline, rank, open affordance) |
| `SegmentBar.tsx`, `Sparkline.tsx`, `DeltaChip.tsx` | Shared SVG primitives |
| `RankTrajectoryCard.tsx` → `RankTrajectoryChart.tsx` | Inline chart + legend column + insight strip |
| `RankTrajectoryModal.tsx` | Full-screen: metric/segment filters, summary cards, monthly-ranks table w/ team breakdown |
| `DealDetailModal.tsx` | Per-metric drill-in (placeholder content per handoff) |
| `PipelineSection.tsx` | 2-col grid + right rail |
| `CoverageCard`, `StageHealthCard`, `FunnelCard` (→ `FunnelChart`, `StageBar`), `TopOpportunitiesTable`, `TopTargetsTable`, `ThisWeekCard` | Pipeline main column |
| `ForecastCard`, `AtRiskCard`, `PipeByMonthCard` | Pipeline right rail |
| `StageDealsModal.tsx` | Opens from funnel; deal table by stage + source |

Reuse:
- `src/features/shared/lib/format.ts` — `formatCurrency(v, compact)`, `formatNumber`,
  `formatPercent`, `formatCompactNumber`.
- Modal anatomy pattern from `src/features/tasks/components/TaskDetailModal.tsx`.
- `useProfile()` (`src/features/shared/lib/queries.ts`) for the current rep.
- Tokens from `Documentation/UI Framework/tokens.md`; docs: `stats.md`, `card.md`,
  `modal.md`, `badges.md`, `dashboard-metrics-layout.md`.

Extend:
- `HomeTabBar.tsx` — remove `disabled: true` from the `dashboard` tab (`:27`).
- `HomeView.tsx` — add `{activeTab === "dashboard" && <DashboardTab />}` branch;
  wire `?tab=dashboard` URL state like the other tabs.
- `src/features/home/lib/queries.ts` — add the dashboard TanStack Query hooks.

## Backend Design

See backend context doc for full detail. Key points:

- **Reuse the Leaderboard engine.** `fetchLeaderboardData()`
  (`src/features/leaderboard/lib/fetch-leaderboard.ts`) + `getRepActualsBatch` /
  `getRepLeaderboardRank` (`src/lib/opportunity-actuals.ts`) already enumerate reps
  and batch per-rep actuals. Generalize the per-metric ranking.
- **Single source of truth:** `district_opportunity_actuals` matview, grain
  `(district_lea_id, school_yr, sales_rep_email, category)`. Read via raw SQL
  (`prisma.$queryRaw`, wrapped in the `safeQueryRaw` 42P01 pattern). `category`
  is the segment dimension (`renewal`=Return, `new_business`=New, `winback`,
  `expansion`).
- **Metric → source** (all per-rep, segment-splittable):
  1. Targets → `territory_plan_districts` target columns via plan `ownerId/userId`
     + DOA `open_pipeline` for "converted to pipeline" dedup.
  2. Open Pipeline → DOA `open_pipeline`, `weighted_pipeline`, `opp_count`.
  3. Closed-Won Bookings → DOA `bookings`, `opp_count`, `min_purchase_bookings`.
  4. Sched + Delivered Rev → **blended** `getRepActuals` (DOA `scheduled_revenue` +
     `completed_revenue` + `rep_session_actuals.session_revenue`).
  5. Sched + Delivered Take → DOA `scheduled_take` + `completed_take`; margin via
     `avg_take_rate`.
- **New queries to build:** per-metric ranking for all 5 (window function over DOA
  + session-revenue UNION); **monthly** ranks for the trajectory (no monthly
  aggregation exists today); segment-filtered ranks; all pipeline-tab stage
  breakdowns.
- **New API routes** under `src/app/api/home/dashboard/`: `topline`,
  `rank-trajectory`, `pipeline/coverage`, `pipeline/stage-health`,
  `pipeline/funnel`, `pipeline/opportunities`, `pipeline/forecast`. All use
  `getUser()`, `force-dynamic`, return `NextResponse.json`.
- **Shared FY helper:** extract the duplicated FY derivation
  (`fetch-leaderboard.ts:49-54`, `revenue-rank/route.ts:22-25`) into one util.
  FY starts July 1; `"2025-26"` == FY26. `fiscalYearToSchoolYear` already maps
  numeric FY → school-year string.
- **Join key:** `sales_rep_email` (established; DOA aggregates by email). Noted
  rename-risk; `sales_rep_id` would require a matview change — out of scope.

## States

- **Loading:** skeleton stat cards + chart with robins-egg (`#C4E7E6`) fills; FY
  pills render disabled (never disappear) per CLAUDE.md "show loading, don't hide".
- **Empty:** zero-data rep → cards show `$0`/`0` muted, rank `—`; pipeline tables
  show an empty row; FY pills with no data render disabled (resolves the FY27
  availability question dynamically).
- **Error:** card/section-level fallback ("Couldn't load…" + retry); never blanks
  the whole tab.

## Responsive (narrow-width resilience, CLAUDE.md)

- 5-card strip → `overflow-x-auto`; `whitespace-nowrap` on every stat value.
- Rank-trajectory 2-col (chart + legend) → stacks vertically when narrow.
- Pipeline 2-col + right rail → single column when narrow.
- Modals → full-screen on mobile. Verify scroll on iPhone before completion.

## Build Phasing & Deferred Decisions

Resolved up front: roster (`role='rep'`), Targets attribution (plan membership),
revenue blend, API shape (C), charting (SVG). Deferred questions are resolved
**with the user at the phase that needs them**:

1. **Scaffold** — tab flip, `?tab=dashboard`, state, chart-primitive stubs, shared
   FY/roster helper.
2. **Topline cards (one at a time)** — Targets → Open Pipeline → Bookings →
   Rev(blended) → Take. *Resolve: precise "Active N/287" sub-count definition
   (has logged activity? has open pipeline?) at the Targets card.*
3. **Rank trajectory** — *Resolve: which date drives the monthly bucket
   (`close_date` bookings / `created_at` pipeline / `session.start_time` revenue),
   and what the "Pre-FY carryover" band represents.*
4. **Pipeline tab** — *Resolve: pipeline "health"/"at-risk"/"next-action"
   derivation + staleness thresholds (from `stage_history` + `activities`); and the
   forecast tiers (Best case / Commit / Most likely — CRM categorization vs derived
   from weighted pipeline / stage bands).*
5. **Modals** — DealDetailModal (placeholder per handoff), StageDealsModal.

## Out of Scope

- **Customer-trends tab** and **Hygiene tab** (deferred handoff; tab buttons removed
  from the prototype).
- Per-metric content of `DealDetailModal` (handoff says placeholder — treat as an
  open hook; build the shell + Targets/topline drill-ins minimally).
- Adding a `region` column / regional ranking.
- Switching DOA attribution from `sales_rep_email` to `sales_rep_id`.
- `district_financials` (per-district vendor table) — cannot rank reps; not used.
