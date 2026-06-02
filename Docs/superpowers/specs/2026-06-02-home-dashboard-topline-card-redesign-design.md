# Home Dashboard — Topline Card Redesign (spec-parity unified `stat-card`)

**Date:** 2026-06-02 · **Branch:** `worktree-home-dashboard` · **Status:** design (awaiting review)

## Goal

Convert the five topline cards (Targets + Open Pipeline + Bookings + Rev + Take)
to the prototype's unified `stat-card` layout
(`Docs/Dashboard.zip → handoff_performance_dashboard/prototype/hifi-app.jsx`,
`StatCard`/`TargetsCard`; detail modal in `hifi-modal.jsx`). Today the cards are a
simpler `StatCard`/`TargetsCard`. The redesign brings: a richer header (info
tooltip + expand affordance), an inline YoY delta chip, a "vs FY · last 7d"
secondary-delta line, a min/max (or delivered/scheduled) line, a vertical segment
legend, a rank percentile pill, and a click-to-open per-metric **detail modal**.

This is a rep-facing surface. Per project rules: no raw IDs/column names in
user-facing copy; Fullmind tokens only; narrow-width resilience; TDD; small plain
commits (no model-id trailer).

## The unified layout (top → bottom)

1. **Header** — metric label + `(i)` tooltip (plain-English definition) + an
   expand affordance (top-right). Whole card is a button → opens the detail modal.
2. **Value row** — big headline number + inline YoY **delta chip**
   (▲/▼/→ + signed %).
3. **Secondary-delta line** — `vs {priorFY} same day  ↑ +X% · last 7d`.
4. **Min/max line** *(or status, per card)* — left sub-label, right `max budget $Y`.
5. **Body** — segment bar + **vertical legend** (`● name · value · %`); OR, for
   Rev/Take, a **delivered-vs-scheduled status bar**; the Targets card keeps its
   Targeted-vs-pipeline $ bar + Converted/Active mini-rows + stale warning.
6. **Footer** — sparkline (current FY solid, prior FY dashed) + FY legend on the
   left; **rank pill** (`#3/12 · top 25%`) on the right.

## Component architecture (new shared pieces)

All under `src/features/home/components/dashboard/`:

- **`StatCardShell.tsx`** — the chrome shared by every card: header (label +
  tooltip + expand), value + delta chip, secondary-delta line, an optional
  min/max-or-status line, a `children` body slot, and a footer slot
  (sparkline + rank pill). Owns the click-to-open behavior. `StatCard` and
  `TargetsCard` render their specifics into it.
- **`MetricLabel.tsx`** — `(i)` tooltip trigger; hover/focus/tap shows a
  plain-English definition. **No formulas, no column names.**
- **`charts/SegmentLegend.tsx`** — vertical `● name · value · %` list. Takes the
  existing `ToplineSegment[]` and a `format` fn. (Distinct from `SegmentBar`,
  which stays for the inline bar.)
- **`RankPill.tsx`** — `#{rank}/{totalReps} · top {pct}%` where
  `pct = Math.round(rank / totalReps * 100)`; leader (`rank===1`) styled
  distinctly; renders a muted "Not ranked" when `inRoster` is false.
- **`charts/StatusBar.tsx`** — two-tone delivered (solid) vs scheduled (lighter)
  bar + labels, for Rev/Take.
- **`Modal.tsx`** — extract the backdrop / Escape / click-outside / scroll-lock /
  focus primitive currently hand-rolled in `RankTrajectoryModal` (and pipeline's
  `StageDealsModal`). Refactor both onto it (the handoff's deferred follow-up), and
  build the new `DealDetailModal` on it.
- **`DealDetailModal.tsx`** — per-metric deal table (filter pills, totals footer),
  fed by a new `/deals` route.

Pure helpers live in `lib/` and are unit-tested (percentile, status fractions,
bookings-ceiling, utilization/deferred derivation).

## Per-card data mapping

Headline = the **floor** value (prototype convention; confirmed for Open Pipeline).
"Ranked metric" is what the rank pill measures — **unchanged** from today's locked
decisions, so for some cards the headline and the ranked metric differ (flagged as
an open item below).

| Card | Headline (floor) | Sub-label (left) | Right of min/max line | Body | Ranked metric (pill) |
|---|---|---|---|---|---|
| **Targets** | worked-district count | "districts being worked" | *(capacity dropped — no figure)* | segment **counts** legend + Targeted-vs-pipeline $ bar + Converted/Active mini-rows + stale | target $ (new+winback+expansion) |
| **Open Pipeline** | **min commit** = Σ `minimum_purchase_amount` (open) | "min commit · contractual floor" | `max budget` = Σ `maximum_budget` (open) | Return/New/Win-back $ (open pipeline by category) | net-booking open pipeline *(≠ headline)* |
| **Bookings** | signed bookings = Σ net booking (closed-won) | "min · signed bookings" | `max budget` = signed bookings + Σ open-opp `maximum_budget` | Return/New/Win-back $ (bookings by category) | bookings |
| **Rev** | delivered revenue (DOA `completed_revenue`) | "min · delivered YTD" | **status bar** (delivered vs scheduled) | Return/New/Win-back $ (delivered rev by category) | blended `totalRevenue` *(≠ headline)* |
| **Take** | delivered take (DOA `completed_take`) | "min · delivered take" | **status bar** (delivered vs scheduled) | Return/New/Win-back $ (delivered take by category) | completed + scheduled take *(≠ headline)* |

Min commit / max budget already computed for Open Pipeline (`OpenPipelineDetail`).
Bookings ceiling and Rev/Take delivered-vs-scheduled come from data already on
`RepActuals` / DOA (`completed_*` / `scheduled_*`, `maximum_budget`).

## Detail modal + `/deals` route

`GET /api/home/dashboard/deals?fy=&metric=pipeline|bookings|rev|take` — cookie-auth,
`force-dynamic`, **caller-scoped**, mirrors the existing routes. Returns
`{ rows, totals }`. `DealDetailModal` renders a table with filter pills + a totals
footer (prototype `hifi-modal.jsx`).

- **pipeline** → caller's open opps (reuse `pipeline-source` open-opp query,
  filtered to the caller): Account · Stage · Source (segment) · Committed
  (net booking) · Budget (max) · Close date. Filter pills by source.
- **bookings** → caller's closed-won opps: Account · Product (`contract_type`
  tier) · Source · Amount · Closed date. Filter pills by source.
- **rev / take** → per-account **utilization** rows, derived (per user): for each
  account the caller works, `minCommit` = Σ `minimum_purchase_amount`,
  `maxBudget` = Σ `maximum_budget`, `revenue` = DOA delivered revenue,
  `take` = DOA delivered take, **`deferred` = max(0, minCommit − revenue)** (the
  unconsumed floor — churn risk), **`utilPct` = revenue / maxBudget**,
  `underMin` = revenue < minCommit. Filter pills: All / Under min / <40% / 40–80% /
  >80% util. Take = revenue × margin (same rows, take column emphasized).

Modal "Export" reuses the CSV helper already built for the rank-trajectory modal.

## Tooltips (plain-English, no IDs)

Draft copy (refined during build):
- **Targets** — "Districts you're actively working this year — your target list."
- **Open Pipeline** — "Open opps you're working. The headline is the contractual
  floor (the least these deals bring if each closes at minimum scope); max budget
  is the ceiling if each closes at full budget."
- **Bookings** — "Closed-won bookings landed this year. Max budget is the ceiling
  if every still-open opp converts at full budget."
- **Rev** — "Recognized revenue. Delivered = earned as customers use sessions;
  scheduled = contracted but not yet consumed."
- **Take** — "Your margin contribution — revenue minus delivery cost. Delivered vs
  scheduled split like revenue."

## Testing

- **Pure (test-first):** `rankPercentile(rank,total)`; status fractions;
  `bookingsCeiling`; utilization/deferred derivation (`buildUtilizationRows`).
- **Components:** render tests for `StatCardShell`, `RankPill`, `SegmentLegend`,
  `StatusBar`, `MetricLabel` (tooltip open/close), `DealDetailModal` (filter pills,
  totals, empty state), and the refactored `Modal` (Escape/click-outside/focus).
- **Routes:** `/deals` per metric — mock `@/lib/supabase/server`, `@/lib/reps`,
  `@/lib/prisma`; 401 / 400 / happy path per metric.
- Gate: `npx vitest run src/features/home src/app/api/home` green; `tsc` clean on
  touched files; routes 307 on :3020 (compiles); SQL verified via temp diagnostic.

## Phasing (each ships independently, own commits)

- **P1 — Shell + restyle (no new data).** `StatCardShell`, `RankPill`,
  `SegmentLegend`; move existing cards onto the shell (YoY chip, secondary-delta
  line, vertical legend, rank pill, sparkline footer). Open Pipeline min/max
  already present. Targets keeps its $ bar + mini-rows. Expand affordance rendered
  but inert until P4.
- **P2 — New data on cards.** Open Pipeline min-commit headline; bookings ceiling;
  Rev/Take `StatusBar` + delivered headlines (new fields on the topline payload).
- **P3 — Tooltips.** `MetricLabel` + copy on all five cards.
- **P4 — Modal.** Extract `Modal` primitive (+ refactor RankTrajectory/StageDeals
  onto it); `/deals` route; `DealDetailModal`; wire the expand affordance.

## Open items for review

1. **Headline ≠ ranked metric** on Open Pipeline, Rev, Take (headline = floor,
   pill = locked ranked metric). Confirmed for Open Pipeline; confirm acceptable
   for Rev/Take (alternative: keep ranked-metric headline on those two).
2. **Bookings "max budget"** = signed bookings + Σ open-opp `maximum_budget`.
   Confirm definition.
3. **Utilization denominator** — which opps define an account's min/max for the
   Rev/Take modal: open + won, or won only? (Affects `utilPct`/`deferred`.)
4. **Modal Export** — wire CSV now (P4) or stub.
5. **Empty states** — the default admin user shows $0 for pipeline/rev/take and is
   "Not ranked"; each new surface needs its empty/`Not ranked` state.

## Out of scope

Velocity / Close-rate / LTV / Hygiene panels; Customer-Trends & Hygiene tabs; the
full conversion funnel (win-rate-by-stage). These remain deferred per the prior
handoff.
