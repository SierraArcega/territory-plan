# Handoff: Home Dashboard — Phase 3 (Rank Trajectory + Sparklines + YoY delta)

You're continuing a `/new-feature` build: a rep-facing **Performance + Pipeline
dashboard** under Home → Dashboard (`src/features/home/`). Phases 0–2 are complete
and committed. This briefs you to execute **Phase 3**. The user wants to **go
through the business-logic decisions together** — resolve the checkpoints below
with them before coding, don't guess.

## Where to work
- **Existing git worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/home-dashboard`, branch `worktree-home-dashboard`. Operate there — do **NOT** create a new worktree. If your session didn't start in it, enter it (EnterWorktree `path`) or use absolute paths.
- **Dev server:** from the worktree, `npx next dev -p 3020` (it has symlinked `.env`/`.env.local` → shared Supabase prod DB). Port 3005 is the user's main server — don't touch it. App is auth-gated; the user's browser cookie carries the session across ports. New API routes hot-reload.

## Read first
- Spec: `Docs/superpowers/specs/2026-05-28-home-dashboard-spec.md`
- Plan: `Docs/superpowers/plans/2026-05-28-home-dashboard-plan.md` (Phase 3 section)
- Backend context: `Docs/superpowers/specs/2026-05-28-home-dashboard-backend-context.md`
- Prototype (design reference): re-extract with `unzip -o /Users/sierraarcega/territory-plan/Docs/Dashboard.zip -d /tmp/dashboard-inspect`, then read `handoff_performance_dashboard/prototype/{hifi-charts.jsx (RankTrajectoryChart), hifi-rank-modal.jsx, hifi-app.jsx (RANK_SERIES shape + inline rank card)}` and `README.md` §4–5.

## What's already done (committed — do NOT redo)
Phases 0–2, all TDD'd, tests green:
- `src/lib/fiscal-year.ts` — `getCurrentFY`, `schoolYearForFY`, `fyPills`.
- `src/lib/reps.ts` — `getActiveReps()` (roster = `role='rep'`).
- `src/features/home/lib/ranking.ts` — `rankReps` / `rankForRep` (competition ranking). **REUSE for monthly ranks.**
- `src/features/home/lib/topline.ts` + `src/app/api/home/dashboard/topline/route.ts` — 4 financial cards (value + rank + per-category segments).
- `src/features/home/lib/targets.ts` + `src/app/api/home/dashboard/targets/route.ts` — Targets card (counts all plan districts; segments; converted / active·90d / untargeted sub-rows).
- `src/features/home/components/dashboard/` — `DashboardTab` (FY pills + Pipeline subtab; has a "Rank trajectory — coming in Phase 3" placeholder to replace), `ToplineStatStrip`, `StatCard`, `TargetsCard`, `charts/SegmentBar`.
- DOA matview `category` now derived from **closed-won history** (renewal/winback/new_business) — see `scripts/district-opportunity-actuals-view.sql`. Segment bars are correct.

## Locked decisions (carry forward)
- Roster = **reps only**; rank vs all active reps. Revenue = **blended** (`getRepActuals`/`getRepActualsBatch`). Charts = **custom inline SVG** (port prototype; Recharts only does pie elsewhere). API = hybrid (group endpoints by shared query; never per-rep fan-out — batch). Category source = customer history (NOT `contract_type`, which is product tier).
- **Commits:** many small focused commits; **plain messages — NO model-identifier trailer/footer**; the repo has no git identity, so commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`.
- **TDD:** pure logic test-first (Vitest, `globals:true`, tests in `__tests__/`). Presentational components get coverage tests.

## Phase 3 scope
The **monthly-derivation engine** and the things it powers:
1. **Rank-trajectory inline card** (`RankTrajectoryCard` → `RankTrajectoryChart`, SVG): 13 columns (Pre-FY band + Jul..Jun), one line per metric, Y = #1..#N (N = active reps), today marker + coral TODAY pill, dashed "PROJECTED" future band + hollow end dots, 248px legend column (per-metric now→Jun + delta chip), insight strip. README §4.
2. **Rank-trajectory full-screen modal** (`RankTrajectoryModal`): metric filter pills, FY pills, segment filter (category), per-metric summary cards, monthly-ranks table with expandable per-rep team breakdown + team-total row, Export CSV, Escape to close. README §5.
3. **Card sparklines** (current FY vs prior FY monthly series) on the topline cards — same engine.
4. **YoY "same-day" delta** ("vs FY25 same day") on the cards — cumulative-to-today vs prior-FY cumulative-to-same-calendar-day.

## Data strategy (already settled with the user — do NOT reach for snapshots)
- `opportunity_snapshots` is only **~6 weeks** old → too short for full-year series/ranks or YoY. Reserve it for the later "last 7d" WoW delta (a *separate, post-Phase-3* step).
- **Monthly series + monthly ranks + YoY are DERIVED from dated source rows:**
  - **Open pipeline** → bucket opps by `created_at`.
  - **Bookings** → bucket closed-won opps by `close_date`.
  - **Revenue / Take** → bucket `sessions` by `start_time` (`session_fy(start_time)`), blended with DOA sub-revenue per the revenue decision.
- Coverage (verified): FY25 opps 741 / FY26 1351 / FY27 593; sessions 421K back to 2019. So FY-prior YoY and full-year monthly are derivable. `school_yr` = "YYYY-YY" (FY26 = "2025-26").

## COLLABORATIVE CHECKPOINTS — bring these to the user BEFORE writing the engine
1. **Monthly date-basis** — confirm the per-metric bucket date (proposal above: created_at / close_date / session start_time).
2. **"Pre-FY carryover" band** — what it represents (e.g. pipeline/bookings carried in from before Jul 1).
3. **Projected future months** — define the projection basis, or omit projection in v1.
4. **Targets monthly/sparkline** — target $ has weak history; include or omit?

## How to build (match the existing pattern)
- Pure monthly-aggregation + ranking logic in `src/features/home/lib/` (e.g. `monthly.ts`), TDD'd over plain row inputs (no DB mocks needed for the pure layer). Reuse `rankReps` per month.
- Thin route(s) under `src/app/api/home/dashboard/` (e.g. `rank-trajectory/route.ts`): `getUser()` 401, `export const dynamic="force-dynamic"`, reuse `getActiveReps`; mirror `topline/route.ts`. Test routes by mocking `@/lib/supabase/server`, `@/lib/reps`, `@/lib/prisma` (see existing route tests).
- SVG components in `src/features/home/components/dashboard/charts/`; wire into `DashboardTab` (replace the Phase-3 placeholder) and sparklines into `StatCard`/`TargetsCard`.
- TanStack hooks in `src/features/home/lib/queries.ts`, **stable string query keys** (e.g. `["dashboard","rankTrajectory",schoolYr,segment,metric]`).
- Read-only DB diagnostics: write a temp `scripts/_tmp-*.mjs` (`new PrismaClient()`, worktree `.env` → shared prod), run, then delete it.
- Verify before claiming done: `npx vitest run <paths>` green; `npx tsc --noEmit 2>&1 | grep -E "<your files>"` clean (repo has pre-existing tsc errors elsewhere — only check your files); then user verifies in-app on :3020.

## First move
Read the prototype (§4–5 + the two chart `.jsx` files) and the plan, then ask the user the 4 checkpoint questions. Then build the monthly engine test-first, then the inline card, then the modal, then sparklines + the YoY delta — committing each slice.
