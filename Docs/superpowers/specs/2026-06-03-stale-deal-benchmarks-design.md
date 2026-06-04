# Benchmark-driven deal staleness on the home dashboard

**Date:** 2026-06-03
**Worktree/branch:** `worktree-home-dashboard`
**Status:** Approved — ready for implementation plan

## Problem

The home-dashboard "At risk" card (`AtRiskCard.tsx`, fed by `pipeline.ts`)
flags an open deal as at-risk when its days-in-stage exceeds a **hardcoded**
per-stage threshold (`PIPELINE_STAGES[].healthyMax` = 14/28/32/35/28/14 days for
stages 0–5). Those numbers are guesses.

The user previously built a saved query — **"Stale 2.0"** (`saved_reports` id 4) —
that computes staleness *empirically* from how deals actually move: per stage, the
median time Closed-Won deals spent there, the median for Closed-Lost, and the 75th
percentile for Closed-Lost. We want that data-driven logic to drive the dashboard
notification instead of the hardcoded thresholds.

## "Stale 2.0" logic (the source of truth)

For each open stage prefix (0–5), compute from closed-deal `stage_history`:

- `won_median`  — `PERCENTILE_CONT(0.5)` of `duration_days`, Closed Won
- `lost_median` — `PERCENTILE_CONT(0.5)` of `duration_days`, Closed Lost
- `lost_p75`    — `PERCENTILE_CONT(0.75)` of `duration_days`, Closed Lost

Then bucket each open deal by its days-in-current-stage:

| Tier | Condition |
|------|-----------|
| On track   | ≤ won_median |
| Watch      | ≤ lost_median |
| Concerning | ≤ lost_p75 |
| Stale      | > lost_p75 |

## Approved decisions

1. **4-tier severity** surfaced in the card (not a single stale/not-stale flag).
2. **All non-on-track tiers appear** in the card — Watch + Concerning + Stale —
   color-coded by severity, most-valuable first.
3. **Benchmark pool = all-time closed deals** (no recency window — matches Stale
   2.0 exactly).
4. **Overdue close date is an overlay badge**, not its own tier (split out from the
   old `slip` value).
5. **Fallback for thin stages:** a stage with no closed-deal history falls back to
   the existing hardcoded `healthyMax`, so the card never breaks on missing data.

## Design

### 1. Model change — `src/features/home/lib/pipeline.ts`

Replace the single 3-value `DealHealth` (`on`/`stall`/`slip`) with two orthogonal
facts on `OppView`:

- `tier: "on" | "watch" | "concerning" | "stale"` — age severity from benchmarks
- `overdue: boolean` — close date already passed (today's `overdueClose`, now an
  overlay rather than a value that swallows the age signal)

New pure classifier, replacing `classifyHealth` / `isStalled`:

```ts
export type AgeTier = "on" | "watch" | "concerning" | "stale";
export interface StageBenchmark {
  wonMedian: number;
  lostMedian: number | null;
  lostP75: number | null;
}

export function classifyTier(
  daysInStage: number,
  stagePrefix: number,
  benchmark: StageBenchmark | undefined,
): AgeTier {
  if (!benchmark) {
    // Thin stage with no closed-deal history — fall back to the hardcoded
    // healthy age so the card still works.
    const max = HEALTHY_MAX_BY_PREFIX.get(stagePrefix) ?? Infinity;
    return daysInStage > max ? "stale" : "on";
  }
  if (daysInStage <= benchmark.wonMedian) return "on";
  if (benchmark.lostMedian != null && daysInStage <= benchmark.lostMedian) return "watch";
  if (benchmark.lostP75 != null && daysInStage <= benchmark.lostP75) return "concerning";
  return "stale";
}
```

`PIPELINE_STAGES[].healthyMax` and `HEALTHY_MAX_BY_PREFIX` **stay** — demoted from
primary logic to the fallback path. `buildOppViews` takes the benchmark map and
sets `tier` + `overdue` on each `OppView` (replacing `health`), keeping the
weighted-$ sort.

### 2. Benchmark query — `src/features/home/lib/pipeline-source.ts`

Add one query to the existing `Promise.all`, ported from Stale 2.0's `benchmarks`
CTE: per stage prefix, `PERCENTILE_CONT(0.5)`/`(0.75)` of `duration_days` over
`stage_history` entries of Closed Won / Closed Lost deals, all-time (no FY filter),
restricted to open stage prefixes `[0-5]`. Shape the result into a
`Map<number, StageBenchmark>` and add it to `PipelineData`.

Open deals keep the existing `daysInStage` (live `now() − changed_at` of the most
recent stage entry) — already verified against live stage. The benchmark durations
come from the stored `duration_days` of *historical* entries; the open deal uses
live elapsed time. This is the same approximation Stale 2.0 already makes; accepted.

Performance: one extra global aggregate scan per pipeline load. Acceptable in the
existing parallel batch; can be memoized later if it shows up in traces.

### 3. Notification UI — `AtRiskCard.tsx` + `health.ts`

- `HEALTH_STYLE` re-keyed to the 4 tiers, plum-safe palette:
  On track (green) / Watch (amber) / Concerning (orange) / Stale (red).
- New small "close date passed" overlay badge for `overdue` deals (orthogonal to
  tier color).
- Route `atRisk` filter becomes `tier !== "on" || overdue`, sorted by tier severity
  (stale → watch) then weighted $.
- `reason()` renders e.g. `"Stale · 47d in Proposal"`, appending
  `" · close date passed"` when `overdue`. Count chip unchanged.
- Card caps at ~12 rows with a "show more" affordance per CLAUDE.md pagination
  rules (reps rarely exceed this, but guard against overflow).

### 4. Route — `src/app/api/home/dashboard/pipeline/route.ts`

Thread the benchmark map from `fetchPipelineData` into `buildOppViews`; update the
`atRisk` filter to the new `tier !== "on" || overdue` predicate with severity sort.

### 5. Tests — `src/features/home/lib/__tests__/pipeline.test.ts`

- Keep the `healthyMax` assertion (now documents the fallback path).
- Replace `classifyHealth` tests with `classifyTier`: on/watch/concerning/stale
  boundary cases, `null` `lostMedian`/`lostP75` handling, and the no-benchmark
  fallback.
- `buildOppViews` tests updated for `tier` + `overdue` fields; opps-table health
  dots inherit the new tier automatically.

## Out of scope

- Recency-windowed or per-rep benchmarks (using all-time, global).
- Caching the benchmark query (note left for later if perf warrants).
- Changing the underlying `daysInStage` derivation.
