# Home Dashboard — Velocity Stats (design)

**Date:** 2026-06-03 · **Branch:** `worktree-home-dashboard` · **Status:** design (awaiting review)

## Goal

Add a **Velocity** card to the top of the Pipeline tab — four ranked "how fast and
how cleanly you're closing" metrics, each with the caller's value, a delta vs the
prior fiscal year, the team median, and the caller's rank vs the team. Modeled on
the prototype `Docs/Dashboard.zip → handoff_performance_dashboard/prototype/hifi-perf.jsx`
(`VelocityCard`), adapted to the data we actually have.

Rep-facing surface: no raw IDs/column names in copy; Fullmind tokens only;
narrow-width resilience; TDD; small plain commits (no model-id trailer).

## The four metrics

FY-scoped by the dashboard's FY pill (`school_yr = schoolYearForFY(fy)`). "Δ" is
vs the prior FY (`fy − 1`), computed as the caller's prior-FY value of the same
metric. All four are **higher-is-better**, so `rankReps` (descending) applies
directly. Stage buckets use the shared prefix convention: closed-won = prefix 6
(`stagePrefixSql`), closed-lost = prefix −1.

| Metric | Per-rep value | Display | Δ unit | Notes |
|---|---|---|---|---|
| **Close rate** | won ÷ (won + lost) | `%` (0 decimals) | percentage **pts** | won/lost counted by `school_yr`; reps with 0 closed → value 0 |
| **Avg deal size** | Σ `net_booking_amount` (won) ÷ won count | `$` compact | **%** change | won count 0 → value 0 |
| **Gross margin** | Σ(`completed_take`+`scheduled_take`) ÷ Σ(`completed_revenue`+`scheduled_revenue`) from DOA | `%` (1 decimal) | percentage **pts** | **as-is**: zero-take reps included in median/rank (per decision); rev 0 → value 0 |
| **Deals won** | count of closed-won opps | integer | absolute **count** | — |

Data realities (verified live, FY26 = `2025-26`): close rate, deal size, deals-won
compute cleanly (544 won / 777 lost team-wide). Gross-margin take is sparse — some
reps show 0% despite real revenue; shown as-is by decision. **Sales cycle was
considered and dropped**: `opportunities` has no real SFDC creation date
(`created_at` is the DB import time; `close_date < created_at` for ~69% of won
deals), so a sales-cycle metric can't be computed honestly. FY27 (`2026-27`) is
thin (23 won) — velocity will look sparse there; FY26 is the rich year.

## Per-cell layout

Each of the four cells (prototype `vel-cell`): metric label (uppercase) + a small
`(i)` tooltip showing a **plain-English** definition via a native `title` attribute
(no formulas/column names; the full hover popover is deferred to the card-redesign
P3 `MetricLabel`); the value; a colored delta chip (`↗ +5 pts` / `↘ −3%` / `→ 0`,
color via existing `deltaColor`, unit suffix per metric); and a foot line
`team median {median} · #{rank}/{total}`. **No sparkline** (v1). When the caller is
not in the rep roster (the admin viewing her own dashboard), the value renders `—`
and the foot shows "Not ranked" — same convention as the topline cards.

Tooltip copy (plain-English, refined during build):
- **Close rate** — "Share of your closed opportunities that were won (won ÷ won + lost) this year."
- **Avg deal size** — "Average booking value of the deals you won this year."
- **Gross margin** — "Your margin contribution — take divided by revenue on scheduled + delivered work."
- **Deals won** — "How many opportunities you closed-won this year."

## Placement

A full-width card at the **top of the Pipeline tab**, above `PipelineSection`.
Header: title "Velocity" + subtitle "How fast and how cleanly you're closing." Body:
a responsive grid — 4-up on `lg`, 2-up on `md`, 1-up on narrow. It mounts/unmounts
with the Pipeline tab and owns its own query (conditional rendering per CLAUDE.md
perf rules).

## Architecture (mirrors the existing home routes)

- **`lib/velocity.ts`** (pure, unit-tested) — types (`VelocityMetricKey`,
  `VelocityCell`, `VelocityResponse`); `median(values: number[])`; `buildVelocity(
  reps, currentByEmail, priorCallerAgg, callerId)` → 4 cells. Per-rep raw aggregate
  shape `{ wonCount, closedCount, wonBookingSum, takeSum, revSum }`; the builder
  derives each metric value per rep, ranks via `rankReps` (reuse `ranking.ts`),
  computes the median across all active reps, the caller's standing
  (`rankForRep`), and the delta from the caller's prior-FY aggregate.
- **`lib/velocity-source.ts`** — `fetchVelocity(sy, priorSy, callerEmail)`:
  (1) per-rep current-FY aggregates over `opportunities` (won/lost counts via
  `stagePrefixSql`, Σ net booking for won) for all reps; (2) per-rep current-FY
  take/rev over `district_opportunity_actuals`; (3) caller's prior-FY aggregates
  (same two sources) for the deltas. Reuse `stagePrefixSql` from `trajectory-source`.
- **`app/api/home/dashboard/velocity/route.ts`** — cookie-auth (`getUser` 401),
  validate `fy` (400), `getActiveReps`, fetch (batched), `buildVelocity`, JSON.
  `export const dynamic = "force-dynamic"`.
- **`lib/queries.ts`** — `useVelocity(fy)` + `VelocityResponse` type (stable string
  query key `["home","velocity",fy]`).
- **`components/dashboard/pipeline/VelocityCard.tsx`** (owns `useVelocity`, loading/
  error states) + **`VelocityCell.tsx`** (presentational). Wired into `DashboardTab`
  inside the `tab === "pipeline"` section, above `<PipelineSection />`.

## Delta computation

For the caller, prior-FY aggregate → prior metric value. Δ:
- close rate / gross margin: `(current − prior) × 100` rounded → **pts**.
- avg deal size: `(current − prior) / prior` rounded → **%** (null/"—" if prior 0).
- deals won: `current − prior` → **count**.
Delta shown only when the caller is in roster and a prior value exists.

## Testing

- **Pure (test-first):** `median` (even/odd/empty); `buildVelocity` — metric
  derivation (close rate, deal size, margin, deals won), zero-denominator guards,
  ranking (higher-better, ties), median across reps, caller standing, prior-FY
  deltas in each unit, not-in-roster path.
- **Route:** mock `@/lib/supabase/server`, `@/lib/reps`, `@/lib/prisma`; 401 / 400 /
  happy path; not-in-roster caller.
- **Components:** `VelocityCell` (value, delta chip sign/color/unit, median/rank
  foot, not-ranked state); `VelocityCard` (loading skeleton, error+retry, renders 4
  cells).
- Gate: `npx vitest run src/features/home src/app/api/home` green; `tsc` clean on
  touched files; route 307 on :3020; SQL verified with a temp diagnostic.

## Out of scope (v1)

Sparklines/monthly trend per metric; sales cycle (no valid creation date); the
prototype's other Performance-tab panels (Close-rate-by-stage funnel, Top-10 LTV,
Pipeline-hygiene). The `(i)` tooltip is a native `title` only — the richer
`MetricLabel` popover arrives with the card-redesign P3.
