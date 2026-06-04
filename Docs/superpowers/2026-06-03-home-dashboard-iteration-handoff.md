# Handoff: Home Dashboard — Iteration (card-redesign P1 + Velocity + tooltips shipped on-branch)

You're continuing a **rep-facing Performance + Pipeline dashboard** under Home →
Dashboard (`src/features/home/`). Phases 0–4 plus, this session, **card-redesign
Phase 1**, the **Velocity** card, and a real **tooltip** component are all built,
tested, and committed on the branch (NOT pushed). This brief is self-contained:
read it + the files it points at and you can keep iterating safely. Supersedes
`Docs/superpowers/2026-06-02-home-dashboard-iteration-handoff.md` (still accurate for
Phases 0–4 background).

## Where to work
- **Existing git worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/home-dashboard`, branch `worktree-home-dashboard`. Operate there (EnterWorktree or absolute paths). Do **not** create a new worktree.
- **Shared prod DB:** the worktree `.env`/`.env.local` are symlinked to the same Supabase **prod** DB. Reads are live. Verify any SQL with a temp `scripts/_tmp-*.mjs` (`new PrismaClient()`) diagnostic, then delete it. **Never run writes/migrations.**
- **Dev server:** `npx next dev -p 3020`. Auth-gated; the user's browser cookie carries the session. Routes return **307** (auth redirect) when curled without a cookie — that's the "it compiles + loads" signal. Port 3005 is the user's main server — don't touch it.

## Status (2026-06-03)
- **Phases 0–4** (prior sessions): FY helper, active-rep roster, topline cards, rank trajectory (chart + modal), Pipeline subtab (coverage, stage health, funnel + stage-deals modal, top opps/targets, this-week, at-risk). All code-reviewed.
- **This session (all committed on-branch, NOT pushed):**
  - **Open Pipeline card** — min commit (Σ `minimum_purchase_amount`) / max budget (Σ `maximum_budget`) + open-opp & distinct-account counts. (`b16134e6`)
  - **Targets card** — targeted-vs-pipeline **$ bar**: Σ all-four target columns (incl. renewal) vs open + closed-won $ on those same worked accounts, with coverage %. (`3ae7ff7f`)
  - **Card-redesign Phase 1** — shared `StatCardShell` chrome + `RankPill` (`#r/total · top X%`) + vertical `SegmentLegend` + `rankPercentile`; `StatCard` & `TargetsCard` refactored onto the shell; dead `SegmentBar` deleted, `Segment` type moved to `lib/segments.ts`. Cards equal-height; topline order Targets → Open Pipeline → Bookings → **Rev → Take**. (`68444d73`…`857eea44`, `facb4191`, `7d79237c`, `eeea3741`)
  - **Velocity card** (top of Pipeline tab) — 4 ranked metrics: **close rate, avg deal size, gross margin (as-is), deals won**, each with value, prior-FY delta, team median, rank. (`78860666`…`e2560b52`)
  - **Tooltips** — `MetricLabel` component: a real hover/focus popover (portal to `document.body` + viewport-clamped so it escapes the dashboard's overflow clipping and never runs off edge cards). Wired into the 5 topline cards + 4 velocity cells. Replaced native `title`. (`50288920`, `29d1d524`, `75f44126`, `b84ac1b1`)
- **188 tests green**, `tsc` clean on home files. **80 commits ahead of `origin/main`.**

## Run / verify
- Tests: `npx vitest run src/features/home src/app/api/home src/lib/__tests__/fiscal-year.test.ts src/lib/__tests__/reps.test.ts` (188 green).
- Types (only your files — repo has pre-existing tsc errors elsewhere): `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"`.
- In-app: user verifies on :3020 (Home → Dashboard; Pipeline subtab for Velocity). **Impersonate a rep** — the default admin (sierra) is not in the rep roster, so her own cards read $0 / "Not ranked". **FY26 (`2025-26`) is the data-rich year**; FY27 is thin.

## Conventions (follow these)
- **TDD**: pure logic test-first (Vitest, tests in `__tests__/`). Presentational components get render tests. Route tests mock `@/lib/supabase/server`, `@/lib/reps`, and the feature's source module.
- **Commits**: many small focused commits; **plain messages, NO model-identifier trailer/footer**. Repo has no git identity → commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`.
- **Subagent-driven execution**: the card-redesign and Velocity were built via spec → plan → subagent-driven-development (fresh implementer per task + spec-then-quality review). Keep that rhythm for multi-task work.
- **Styling**: Fullmind tokens (plum `#403770`, neutrals `#5C5378`/`#8A80A8`/`#A69DC0`/`#C2BBD4`/`#EFEDF5`/`#D4CFE2`, coral `#F37167`, steel `#6EA3BE`, golden `#FFCF70`; never Tailwind grays). Lucide icons, `currentColor`. **Narrow-width**: `whitespace-nowrap` on text spans + a planned overflow. `/frontend-design` skill + `Documentation/UI Framework/` are the source of truth (e.g. `Components/Display/tooltips.md`).
- **No raw IDs in user-facing copy** (reps, not engineers) — tooltips/labels are plain-English, no formulas/column names.

## Architecture — what this session added (`src/features/home/`)
- **`lib/velocity.ts`** — `median`, `buildVelocity` (4 metrics, rank via `rankReps`, team median, prior-FY delta per unit). `lib/velocity-source.ts` — `fetchVelocity` (per-rep FY aggregates: opps won/lost/booking FULL OUTER JOIN DOA take/rev; reuses `stagePrefixSql`). `app/api/home/dashboard/velocity/route.ts`. `useVelocity` in `lib/queries.ts`.
- **`components/dashboard/StatCardShell.tsx`** — shared topline card chrome (label + `MetricLabel` tooltip + expand affordance, value + YoY chip, secondary `vs FY · last 7d` line, min/max slot, body, footer = sparkline + rank pill). `RankPill.tsx`, `MetricLabel.tsx`, `charts/SegmentLegend.tsx`, `lib/rank-percentile.ts`.
- **`components/dashboard/pipeline/VelocityCard.tsx`** (owns `useVelocity`) + `VelocityCell.tsx`; wired into `DashboardTab` above `PipelineSection`.
- `StatCard.tsx` / `TargetsCard.tsx` now render through `StatCardShell`.

## Locked decisions (don't re-litigate — see the committed specs)
- **Card redesign** (`Docs/superpowers/specs/2026-06-02-home-dashboard-topline-card-redesign-design.md`): headline = the **floor** value on every card (Open Pipeline = min commit, etc.) — the rank pill keeps measuring the locked ranked metric, so headline ≠ ranked metric on Open Pipeline/Rev/Take (intentional). Rev/Take detail modal uses **won opps only** for per-account min/max; `deferred = max(0, minCommit − delivered revenue)`, `utilPct = delivered rev / maxBudget`. Targets keeps the targeted-vs-pipeline $ bar; "capacity" dropped.
- **Velocity** (`Docs/superpowers/specs/2026-06-03-home-dashboard-velocity-design.md`): close rate = won÷(won+lost); avg deal = Σ net-booking(won)÷won; gross margin = Σ take÷Σ rev **as-is** (zero-take reps included in median/rank, per user); deals won = count. Δ units: close rate/margin = pts, deal size = %, deals won = count. **Sales cycle dropped** — no real SFDC creation date exists (`opportunities.created_at` is the DB import time; `close_date < created_at` for ~69% of won deals). No sparklines in v1.
- **Tooltips**: portal-to-body + viewport-clamp is deliberate (in-card absolute popovers get clipped by the dashboard's overflow containers). Native `title` is not acceptable (slow/unstyled). `MetricLabel` is the canonical component now — reuse it for any new tooltip.

## Data realities / gotchas
- **Velocity is rich on FY26, thin on FY27** (FY27 = 23 won team-wide). The card respects the FY pill.
- **Default admin is not ranked** (role='admin'); cards show $0 / "Not ranked" / "—" until impersonating a real rep.
- **DOA `take` is sparse** — some reps show 0% gross margin despite real revenue (e.g. a rep with $8.8M rev / $0 take). Shown as-is by decision.
- **Category is constant per (district, school_yr)** — the `SELECT DISTINCT … category` joins don't fan out; don't "fix" them.

## What's left / good iteration targets
- **Card-redesign Phases 2–4** — spec + Phase-1 plan committed; P2–4 are a roadmap in the plan (`Docs/superpowers/plans/2026-06-03-home-dashboard-topline-card-redesign.md` § Roadmap):
  - **P2** — new card data: Open Pipeline **min-commit headline**, **bookings ceiling** (= bookings + Σ open-opp max budget), **Rev/Take delivered-vs-scheduled `StatusBar`** (DOA `completed_*`/`scheduled_*`) + delivered headlines.
  - **P3** — the richer `MetricLabel` popover is effectively **already done** this session (portal tooltip); P3 is otherwise satisfied.
  - **P4** — extract a shared `Modal` primitive (+ refactor `RankTrajectoryModal` + pipeline `StageDealsModal` onto it); new `GET /api/home/dashboard/deals?fy=&metric=` (caller-scoped: pipeline open opps, bookings closed-won, rev/take won-only utilization with `deferred`/`utilPct`); `DealDetailModal` (filter pills + totals + CSV export reusing the rank-modal helper); wire the expand affordance + whole-card click.
- **Tooltips on the Pipeline-subtab cards** (Coverage, Funnel, Stage health, At-risk, This-week, Top targets) — not yet done; the prototype shows `(i)` on a few. Reuse `MetricLabel`.
- **Phase 5 polish** (from the prior handoff): responsive/mobile pass + iPhone scroll verify, animation tokens, PageHead "Export" stub.
- **Out of plan**: Customer Trends tab, Hygiene tab, full conversion funnel (win-rate-by-stage).

## Shipping
Push `worktree-home-dashboard` + open a PR to `main`. ⚠️ **Per repo automation, pushing may auto-create AND merge the PR within seconds — treat push as shipping to prod.** The branch is **80 commits = the whole dashboard**; P1 is self-contained and shippable, but the user may prefer to hold for P2. **Only push on the user's explicit go.** (As of this handoff the user chose to hold.)

## Reference material
- **Prototype** (design source of truth): `unzip -o Docs/Dashboard.zip -d /tmp/dashboard-inspect`; topline cards in `handoff_performance_dashboard/prototype/hifi-app.jsx` (`StatCard`/`TargetsCard`), Velocity in `hifi-perf.jsx` (`VelocityCard`), detail modal in `hifi-modal.jsx`.
- **Specs/plans** (all committed under `Docs/superpowers/`): card-redesign `specs/2026-06-02-home-dashboard-topline-card-redesign-design.md` + `plans/2026-06-02-home-dashboard-topline-card-redesign.md`; velocity `specs/2026-06-03-home-dashboard-velocity-design.md` + `plans/2026-06-03-home-dashboard-velocity.md`. Original `specs/2026-05-28-home-dashboard-spec.md` + backend context.
- **User memory** (auto-loaded): `project_home_dashboard_card_redesign`, `project_home_dashboard_phase3/4` capture locked decisions; `feedback_*` capture working style (small commits, no model-id trailers, dropdowns over typing, no IDs in output).

## First move for the new agent
Read this doc, skim `StatCardShell.tsx` + `velocity.ts` + `MetricLabel.tsx` + `DashboardTab.tsx` to orient, start `:3020`, and ask the user what to iterate on (or pick from card-redesign P2 / P4, or pipeline-card tooltips). Keep TDD + small plain commits + the subagent-driven rhythm for multi-task work. Verify SQL against the shared DB with a temp diagnostic before trusting it. Do not push without explicit go.
