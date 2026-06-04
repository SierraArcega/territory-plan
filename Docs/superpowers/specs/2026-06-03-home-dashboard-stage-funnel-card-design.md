# Home Dashboard — Pipeline Stage Funnel Card (design)

**Date:** 2026-06-03
**Branch:** `worktree-home-dashboard`
**Status:** Approved (design); implementation pending

## Goal

Bring the Pipeline subtab closer to the prototype by replacing the current
plainer funnel + stage-health table with the prototype's consolidated
**Stage Funnel card** (`hifi-pipeline.jsx` → `StageFunnelCard`). This pass
builds the three **data-ready** sections of that card. The fourth section —
**Win rate by stage** — is **deferred** (see Out of Scope).

Prototype reference: `Docs/Dashboard.zip` →
`handoff_performance_dashboard/prototype/hifi-pipeline.jsx`
(`StageFunnelCard`, lines ~290–833). Screenshot shared 2026-06-03.

## Scope decisions (locked with user)

1. **Scope** — funnel chrome first; **defer Win rate by stage** (the
   `stage_history` data can't support faithful per-stage conversion — only
   ~20–30% of opps have multi-entry history and those are truncated, e.g. a
   won deal's history jumps `Proposal → Negotiation → Closed Won` with no
   record of earlier stages).
2. **Card layout** — **consolidate**: the new `StageFunnelCard` replaces both
   the current `FunnelCard` and the `StageHealthCard`. `CoverageCard` stays
   as-is for now. Matches the prototype (which renders no standalone
   stage-health table).
3. **Targets row** — **include** the pre-pipe Targets row at the top of the
   funnel, with the dashed / "EST." treatment from the prototype.

## Architecture

A new **`StageFunnelCard`** (`src/features/home/components/dashboard/pipeline/`)
renders four stacked sections inside one card:

- **Header** — title + `MetricLabel` tooltip + source-filter pills
  (All sources / Return / New biz / Win-back), reusing `SEGMENT_DEFS` from
  `lib/segments.ts`. Selecting a source re-groups client-side (as today's
  `FunnelCard` already does).
- **Summary strip** — 5 cells, responsive (`whitespace-nowrap` text + wrap/
  scroll fallback): **Open opps · Min commit floor · Max budget ceiling ·
  Spread (upside = max − min) · Share of team min** (with a `#r/total` rank
  chip).
- **SVG trapezoid funnel** (`StageFunnelChart`, own child component) — a
  `Targets` pre-pipe row (dashed outline, lighter fill, "EST." labels) on top,
  then the 6 open stages (Meeting Booked → Commitment). Each stage:
  - outer trapezoid (tinted accent) = **max budget**; inner solid trapezoid,
    centered, scaled `min/max` = **min commit**.
  - left label = max budget; right cluster = your min commit $ + share-of-team
    % + a mini share bar with a coral tick at your **overall** share, and an
    ↗ above / ↘ below flag.
- **Share by deal source** — 3 rows (Return / New biz / Win-back): your $ vs
  team $, % share, bar with overall-share tick, above/below flag.

**Removed:** `StageHealthCard` (superseded by the summary strip + funnel),
old `FunnelCard` + `FunnelChart` (replaced). `CoverageCard` untouched.

`PipelineSection` swaps `<FunnelCard>` + `<StageHealthCard>` for the single
`<StageFunnelCard>`.

## Data layer

### Reuses existing fetch — no new query

`fetchPipelineData` already returns **team-wide** `openOpps` (every rep's open
opps with `email`, `stagePrefix`, `minPurchase`, `maxBudget`, `category`,
`daysInStage`). All open-stage + source-share math is pure and computed in a new
**TDD'd `buildFunnel()`** in `lib/pipeline.ts`:

- **Per open stage** `{ prefix, name, count, min, max, teamMin, sharePct }`
  - `min`/`max`/`count` = caller's opps in that stage (optionally source-filtered)
  - `teamMin` = Σ `minPurchase` across **all reps'** opps in that stage
  - `sharePct` = `min / teamMin` (0 when `teamMin === 0`)
- **Overall totals** — `openCount`, `totalMin`, `totalMax`, `spread = max − min`,
  `teamMinTotal`, `overallSharePct`.
- **Rank `#/total`** — caller ranked vs all reps by Σ `minPurchase` (open),
  via existing `rankReps`.
- **Per source** `{ key, label, color, you, team, pct }` for return/new/winback
  (Σ caller vs Σ team `minPurchase` filtered by `CATEGORY_TO_SEGMENT`).

Source filtering re-runs `buildFunnel(opps, source)` client-side (same shape as
today's `groupOppsByStage`).

### New query — Targets pre-pipe row (caller + team)

The only new fetch. Added to `fetchPipelineData` (or a sibling). Targets =
districts on a plan with **no open opp** for that rep/FY:

- **count** = caller's plan districts this FY whose `leaid` has **no** open opp
  (stage prefix 0–5) for the caller.
- **max (ceiling)** = Σ of all four target columns
  (`renewal + new_business + winback + expansion`) on those districts.
- **min (floor)** = Σ **`renewal_target`** only — renewals are the
  high-confidence floor; new-biz / win-back / expansion are the upside spread.
  (Chosen to avoid inventing a conversion rate the data can't back. Shown with
  the dashed "EST." treatment so the projected nature is clear.)
- **teamMin** = same `min` Σ across **all reps'** plans, for the share figure.

Returned as `{ count, min, max, teamMin }`; folded into the funnel as the
top (`isPreOpp`) row. Excluded from the open-pipe summary totals (targets are
pre-pipe, not committed pipeline) — matches the prototype.

## Styling

Fullmind tokens only (plum ramp for stage accents — reuse `STAGE_ACCENTS`;
coral `#F37167` tick/flags; neutrals for chrome). Lucide icons, `currentColor`.
Source colors from `SEGMENT_DEFS`. SVG is `viewBox` + `preserveAspectRatio`
so it scales; text spans get `whitespace-nowrap`; summary strip wraps or
scrolls at narrow width. No raw IDs in any user-facing copy; tooltips are
plain-English via `MetricLabel`.

## Testing

- **`buildFunnel()` + targets aggregation** — test-first (Vitest), extending
  `lib/__tests__/pipeline.test.ts`: per-stage min/max/teamMin/share, overall
  totals + spread, rank, per-source shares, source filtering, empty/zero-team
  edge cases.
- **`StageFunnelChart`** — render test: correct number of stage rows incl.
  Targets row, EST. labeling on the pre-pipe row, left/right labels present.
- **`StageFunnelCard`** — render test: summary strip values, source-filter
  pill regroups, share-by-source rows.

## Out of scope (this pass)

- **Win rate by stage** — deferred; needs a data decision (sparse/truncated
  `stage_history`). Tracked separately.
- **Right-rail layout** — `AtRiskCard` / `ThisWeekCard` placement untouched.
- **Stage-deals drill modal redesign** — the existing `StageDealsModal` keeps
  working; the prototype's whole-card-click-to-drill is Phase 4 (separate).

## Files

- **New:** `components/dashboard/pipeline/StageFunnelCard.tsx`,
  `components/dashboard/pipeline/StageFunnelChart.tsx`.
- **Edit:** `lib/pipeline.ts` (`buildFunnel` + targets-row types),
  `lib/pipeline-source.ts` (targets-row query),
  `app/api/home/dashboard/pipeline/route.ts` (thread targets data),
  `components/dashboard/pipeline/PipelineSection.tsx` (swap cards),
  `lib/__tests__/pipeline.test.ts`.
- **Delete:** `components/dashboard/pipeline/StageHealthCard.tsx`,
  `FunnelCard.tsx`, `FunnelChart.tsx` (+ their tests), `groupOppsByStage` /
  `buildStageHealth` if no longer referenced.
