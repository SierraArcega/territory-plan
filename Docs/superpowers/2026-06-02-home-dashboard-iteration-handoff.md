# Handoff: Home Dashboard — Iteration (Phases 3 & 4 complete)

You're picking up a **rep-facing Performance + Pipeline dashboard** under
Home → Dashboard (`src/features/home/`). Phases 0–4 are **built, code-reviewed, and
fixed**. This brief is self-contained: read it plus the files it points at and you
can iterate safely. The user wants to **iterate on the existing surface** — polish,
tweaks, new ideas — not necessarily march through the remaining plan in order.

## Where to work
- **Existing git worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/home-dashboard`, branch `worktree-home-dashboard`. Operate there. Do **not** create a new worktree.
- **Shared prod DB:** the worktree's `.env`/`.env.local` are symlinked to the same Supabase **prod** DB. Reads are live. The DOA category fix is applied. Be careful: never run writes/migrations from diagnostics.
- **Dev server:** `npx next dev -p 3020` (auth-gated; the user's browser cookie carries the session). Port 3005 is the user's main server — don't touch it. API routes hot-reload. Routes return **307** (redirect to auth) when curled without a cookie — that's the expected "it compiles + loads" signal.

## Status (2026-06-02)
- **Phases 0–2** (pre-existing): FY helper, active-rep roster, topline cards (Targets + 4 financial), `targets`/`topline` routes.
- **Phase 3** (rank trajectory): monthly engine, `rank-trajectory` + `sparklines` routes, SVG chart, inline card, full-screen modal, card sparklines, YoY + "last 7d" WoW deltas. **Code-reviewed; all findings fixed.**
- **Phase 4** (pipeline tab): coverage, stage health, structural funnel + stage-deals modal, top opportunities, top targets, this-week, at-risk. **Code-reviewed; all findings fixed.**
- **145 tests green, `tsc` clean, compiles on :3020.** ~35 commits this cycle on the branch.
- **Not yet done:** Phase 5 polish (responsive/mobile pass, animations), a few deferred review follow-ups, the out-of-plan future tabs, and shipping (push → PR).

## Run / verify
- Tests: `npx vitest run src/features/home src/app/api/home src/lib/__tests__/fiscal-year.test.ts src/lib/__tests__/reps.test.ts` (currently 145 green).
- Types (only check your files — repo has pre-existing tsc errors elsewhere): `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"`.
- Live DB diagnostics: write a temp `scripts/_tmp-*.mjs` (`new PrismaClient()`), run with `node`, then **delete it**. Pattern is used throughout this cycle to verify SQL.
- In-app: the user verifies visually on :3020 (Home → Dashboard, and the Pipeline subtab).

## Conventions (follow these)
- **TDD**: pure logic test-first (Vitest, `globals:true`, tests co-located in `__tests__/`). Presentational components get render/coverage tests. Route tests mock `@/lib/supabase/server`, `@/lib/reps`, and the feature's source module.
- **Commits**: many small focused commits; **plain messages, NO model-identifier trailer/footer**. Repo has no git identity → commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`.
- **Styling**: Fullmind tokens (plum `#403770`, coral `#F37167`, steel `#6EA3BE`, golden `#FFCF70`, sage `#8AA891`; plum-derived neutrals, never Tailwind grays). Lucide icons. **Narrow-width resilience**: `whitespace-nowrap` on text spans + a planned overflow (`overflow-x-auto`/stack). See `Documentation/UI Framework/tokens.md`.
- **Perf** (CLAUDE.md): stable string TanStack query keys; memoize derived render values; never per-rep DB fan-out (batch).

## Architecture — the file map

### Backend lib (`src/features/home/lib/`)
- `monthly.ts` — pure monthly engine: `fyMonthIndex` (13 FY columns: Pre-FY + Jul..Jun), `cumulativeColumns`, `todayColumnIndex`, `flatCarry` (projection), `buildMetricTrajectory` (ranks reps per column via `rankReps`), `buildSegmentedTrajectory`.
- `rank-trajectory.ts` — `buildRankTrajectoryPayload` (5 metric lines + per-segment sub-series) + `TRAJECTORY_METRICS`.
- `sparkline.ts` — `buildSparklines` (caller current/prior-FY cumulative + YoY; financial metrics only, Targets excluded). `wow.ts` — `buildWowDeltas` (last-7d delta). `delta.ts` — shared `deltaColor` + `pctChange`.
- `pipeline.ts` — pure pipeline aggregation: `PIPELINE_STAGES` (6 open stages, DOA weights, healthy ages), `STAGE_ACCENTS`, `buildStageHealth` (per-stage rollup + rank), `buildCoverage` (floor/ceiling/most-likely + gap), `classifyHealth`/`isStalled`, `buildOppViews`, `groupOppsByStage`.
- `segments.ts` — **single source of truth** for source segments (DOA `category` ↔ design key ↔ color ↔ label). Always import `SEGMENT_DEFS`/`SEGMENT_COLORS`/`CATEGORY_TO_SEGMENT` from here — do not redefine.
- `trajectory-source.ts` — raw SQL for the trajectory/sparklines + the **shared `stagePrefixSql(stage)` and `categoryJoin(sy)`** SQL helpers (reuse these so stage/category bucketing never drifts). `pipeline-source.ts` — raw SQL for the pipeline tab (open opps w/ days-in-stage from `stage_history`, won, target, this-week).
- `queries.ts` — all TanStack hooks (`useTopline`, `useTargets`, `useRankTrajectory`, `useSparklines`, `usePipeline`) + response types. `ranking.ts` — `rankReps`/`rankForRep` (competition ranking; reuse everywhere ranking is needed).

### Routes (`src/app/api/home/dashboard/`)
`topline`, `targets`, `rank-trajectory`, `sparklines`, `pipeline` — all cookie-authed, `force-dynamic`, mirror each other. Each: `getUser()` 401 → validate `fy` 400 → `getActiveReps` → fetch (batched) → pure builder → JSON.

### Components (`src/features/home/components/dashboard/`)
- `DashboardTab.tsx` — FY pills + Performance section (`ToplineStatStrip`, `RankTrajectoryCard`) + Pipeline subtab (`pipeline/PipelineSection`).
- `StatCard`, `TargetsCard`, `ToplineStatStrip`, `RankTrajectoryCard` (+ modal), `charts/{RankTrajectoryChart,Sparkline,SegmentBar}`.
- `pipeline/` — `PipelineSection` (owns `usePipeline`, main col + right rail), `CoverageCard`, `FunnelCard`+`FunnelChart`, `StageHealthCard`, `TopOpportunitiesTable`, `TopTargetsCard`, `ThisWeekCard`, `AtRiskCard`, `StageDealsModal`, `health.ts` (HEALTH_STYLE, sourceLabel/Color, fmtCloseDate).

## Locked business-logic decisions (don't re-litigate)
**Trajectory/topline:** roster = `role='rep'` (`getActiveReps`); rank vs all active reps; revenue = **blended** (`getRepActuals` session+sub, not plain DOA); category/segment from **DOA `category`** (closed-won-history derived), never `contract_type`. Monthly series **derived from dated rows** (snapshots too short): open pipeline by `created_at`, bookings by `close_date`, rev/take by `session.start_time` + subs by parent-opp `close_date`, targets by `territory_plan_districts.added_at`. 13 columns Pre-FY + Jul..Jun (Pre-FY = same-FY rows dated before Jul 1). Projection = **flat-carry** (no pipeline-close modeling). Take ≈ `session_price × DOA avg_take_rate`. YoY + WoW gated to current FY only (WoW from `opportunity_snapshots`, Open Pipeline + Bookings only — the only snapshot-backed metrics).

**Pipeline:** open stages = prefix 0–5. **"stalled" = days-in-stage > per-stage healthy age** (14/28/32/35/28/14) — NOT the `stage_history.is_stale` flag (that flag is `true` for every open opp; degenerate). "slip" = `close_date < now` while open; precedence slip > stall > on. **No** next-action column (no per-opp source). Forecast = **2 numbers** (weighted "most likely" + open total) + gap-to-target; no 3-tier rail. Funnel width is **positional** (always narrows) by user request — not proportional to stage $. Top targets reuses the **team-wide** `useLowHangingFruitList` (labeled team-wide). FY bookings target = Σ plan-district target columns (**a proxy** — no real bookings quota exists; documented).

## Data realities / gotchas (will surprise you on :3020)
- **FY26 is nearly over → thin pipeline** (~33 open opps team-wide, ~1/rep). Switch the FY pill to **FY27** to see a fuller pipeline/funnel. This is real, not a bug.
- **The default user (sierra) is `role='admin'`** → not in the rep roster. The trajectory card and pipeline tab show explicit **"not ranked / impersonate a rep"** states for this. She normally views via impersonation (then she's a real rep).
- **Category is constant per `(district, school_yr)`** (verified: 0 districts have >1 category) — so the `SELECT DISTINCT district_lea_id, category` joins do NOT fan out. Don't "fix" them.
- `opportunities.stage_history` is a JSON array of `{stage, changed_at, is_stale, duration_days, ...}`; days-in-stage = `now − most-recent-by-changed_at entry` (with `created_at` fallback). 33/33 open opps have usable history.

## What's left / good iteration targets
**Phase 5 — polish (the last planned phase):**
- **Responsive / mobile pass + iPhone scroll verify** — *the main remaining required work before ship* (CLAUDE.md). Pipeline tables use `overflow-x-auto` and the rail stacks, but the new cards/funnel/modals haven't had a dedicated narrow-width + real-device pass like the topline strip got.
- **Animation tokens** (ease-out-expo, hover 100–150ms, modal 250ms) — not applied.
- **PageHead "Export"** button is still a stub (the rank-trajectory modal's Export CSV is done).
- Final **empty/error-state** sweep (most surfaces already covered).

**Deferred code-review follow-ups (lower value, noted):**
- Extract a shared `OppRow` (table + StageDealsModal duplicate it), a shared **modal primitive** (StageDealsModal + RankTrajectoryModal hand-roll backdrop/Escape/close), and a shared **SegmentPills** (FunnelCard + RankTrajectoryModal). Cross-Phase-3+4 refactor.
- Carry a **stable opp id** through `OppView` for React keys (currently `account`+index; nullable/non-unique).
- A small **UI hedge** that "gap to target" uses plan targets as a bookings-quota proxy.

**Out of plan (separate future handoff, NOT started):** Customer Trends tab, Hygiene tab. Also the **full conversion funnel** (win-rate-by-stage, you-vs-team) was deliberately skipped — it needs trailing stage-transition derivation on thin data.

**Shipping:** push `worktree-home-dashboard` + open a PR to `main`. ⚠️ Per repo automation, pushing a branch may auto-create AND merge the PR within seconds — treat push as **shipping to prod**. Only push on the user's explicit go.

## Reference material
- Prototype (design source of truth): `unzip -o Docs/Dashboard.zip -d /tmp/dashboard-inspect`, then `handoff_performance_dashboard/{README.md, prototype/hifi-*.jsx}`. The funnel/pipeline visuals are in `hifi-pipeline.jsx`; the rank chart/modal in `hifi-charts.jsx`/`hifi-rank-modal.jsx`/`hifi-app.jsx`.
- Spec: `Docs/superpowers/specs/2026-05-28-home-dashboard-spec.md` · Plan: `Docs/superpowers/plans/2026-05-28-home-dashboard-plan.md` (Phase 5 = §"Phase 5") · Backend context: `Docs/superpowers/specs/2026-05-28-home-dashboard-backend-context.md`.
- Prior handoff (Phase 3 kickoff): `Docs/superpowers/2026-05-29-home-dashboard-phase3-handoff.md`.
- User memory (auto-loaded for this project): `project_home_dashboard_phase3` + `project_home_dashboard_phase4` capture every locked decision and the review outcomes; `feedback_*` memories capture working style (small commits, no model-id trailers, dropdowns over typing, etc.).

## First move for the new agent
Read this doc, skim `pipeline.ts` + `monthly.ts` + `DashboardTab.tsx` to orient, start the dev server on :3020, and ask the user what they want to iterate on (or pick from Phase 5 / the follow-ups above). Keep TDD + small plain commits. When touching SQL, verify against the shared DB with a temp diagnostic before trusting it.
