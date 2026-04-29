# Pipeline Hygiene Report Builder — Design

**Status:** Draft, awaiting review
**Date:** 2026-04-28
**Branch:** _not yet cut_

## Goal

Ship an in-app report module that lets sales reps and managers answer recurring
questions about pipeline health — "which open deals are stuck?", "how long do
Won deals typically spend in Proposal?", "is my book moving?" — without
dropping into SQL. Replace the current pattern where every pipeline question
becomes a one-off ad-hoc query.

The first slice is three opinionated, parameterized templates. A general-
purpose query builder is explicitly **not** in scope; we only build that if
template demand reveals real unmet need.

## Why

A 2026-04-28 exploration session walked through ~8 questions about
`opportunities.stage_history` — `is_stale` semantics, time-in-stage by
outcome, threshold derivation, currently-flagged stale deals. Three signals
came out of it:

1. **Every question composed the same five operations** (see §6). The query
   family is narrow enough to template, not general enough to need a builder.
2. **The data has live actionable signal** — 186 currently-open deals
   ($18.3M booked) sit past Won-deal-derived thresholds. Sales managers need to
   see this continuously, not when someone asks Claude.
3. **The data has known hygiene issues** that any report must surface
   responsibly: a 2025-08-18 bulk-import cluster, a legacy stage taxonomy
   coexisting with the canonical one, demo-district leakage, and 80% of closed
   deals having no transition history. A shared report module is the natural
   place to centralize those exclusions and warnings.

The full session record — questions, raw data, SQL — is preserved in
Appendix B for reviewers who want the evidence.

## Scope

### In scope (Phase 1)

- **Three templates**, each its own API route + UI card:
  - **Pipeline Hygiene** — currently-open deals past stage-aware thresholds
  - **Stage Velocity** — avg/median time per stage by outcome
  - **Won-Deal Benchmark** — distribution view used to calibrate thresholds
- A shared `excludeDemoOpps()` helper applied by every template
- A shared "migration cohort" classifier that splits results into
  `genuinely_stuck` vs `unverified_since_migration`
- A shared `legacy stages toggle` (defaulting to canonical 6 stages)
- Stable, primitive-keyed TanStack Query hooks per template

### Not in scope (explicitly deferred)

- A general-purpose query builder UI
- A "saved reports" library with shareable URLs
- Custom thresholds per rep / region / school year
- Cross-tab analytics that go beyond `opportunities` + `stage_history`
- Automated alerting (Slack pings when a deal newly crosses threshold) — this
  is a separate spec; reports surface state, alerts surface transitions

### Out of scope upstream

- Fixing the duplicate stage taxonomy. We surface it; we don't rewrite it.
  Resolution belongs to whoever owns the upstream sync.
- Backfilling real `changed_at` for the migration cohort. Same reason.

## Data foundation

### `opportunities.stage_history` element shape (empirically validated)

```jsonc
{
  "tx":            13194273163023,           // upstream txn id (monotonic)
  "stage":         "2 - Presentation",       // pipeline stage label
  "changed_at":    "2026-04-22T17:57:05Z",   // entered this stage
  "end_time":      "2026-04-28T17:07:03Z",   // left this stage; null if current
  "is_stale":      false,                    // see rule below
  "duration_ms":   515398071,
  "duration_days": 6,
  "duration_hours": 143                      // total, not within-day (143 ≈ 6×24)
}
```

### `is_stale` rule

Validated against all 3,571 segments (zero counterexamples in either
direction):

```
is_stale = false  ⇔  end_time IS NOT NULL  (segment closed; durations frozen)
is_stale = true   ⇔  end_time IS NULL      (segment is current/open; duration recomputed each refresh)
```

So `is_stale=true` does **not** mean "outdated" — it means "still ticking,
value is a snapshot from last sync." Min observed lag between
`now() - changed_at` and recorded `duration_ms` was ~28 minutes, matching
the documented 30-minute upstream refresh cadence.

**Critical gotcha** for any consumer: terminal-stage segments (Closed Won/
Lost) keep `is_stale=true` indefinitely, because the opp will never transition
out. Their `duration_ms` therefore measures *time since close*, not *time
spent in the closing stage*. Of 2,636 currently-open segments, 2,045 are in
terminal stages. Reports must clamp at `close_date` (or exclude) before
averaging.

### Refresh cadence

Per `memory/project_opportunities_sync_cadence.md`: every 30 min by external
upstream writer. This repo only reads. Cache TTL on report API routes should
match (30 min).

## Threshold model

### Derivation

Among 251 stage-dwell segments across 131 Closed Won deals (after filtering
to `is_stale=false` and the canonical 6 stages), the pooled distribution is:

| metric | days |
|---|---|
| p50 | 7.9 |
| p75 | 20.9 |
| **p90** | **40.9** |
| p95 | 55.1 |
| p99 | 112.5 |
| max | 133.4 |

Per-stage p90s diverge meaningfully — Negotiation/Commitment p90 is ~30 days,
Discovery p90 is ~55 days — so a flat threshold is conservative late-funnel
and aggressive early.

### Recommended (stage-aware) thresholds

| Stage | Flag at |
|---|---|
| 0 – Meeting Booked | 30d |
| 1 – Discovery | 60d |
| 2 – Presentation | 45d |
| 3 – Proposal | 45d |
| 4 – Negotiation | 30d |
| 5 – Commitment | 30d |

These are roughly each stage's p90 in the Won cohort (rounded to 15-day
boundaries). Approximately ~10% of Won-deal stage segments would have been
flagged at these thresholds — meaning a deal hitting them is in the top 10%
of "slow Won deals" and worth reviewing without being a false-positive flood.

A flat-threshold mode (`> 45d` everywhere) is also supported as a UI option
for users who want a single number.

### Where the thresholds are defined

**`src/features/reports/lib/thresholds.ts`** — single source of truth, exported
constant. Admin override path (`/admin/reports/thresholds`) is **deferred to
Phase 2**; for Phase 1 the constants are committed code.

### Caveats

- Small `n` at Meeting Booked (7 Won deals) and Discovery (12) — those
  thresholds need re-calibration as more data arrives. Recommend revisiting
  after 6 months.
- Some valid Won deals legitimately stay long (longest: $67k Medina CSD 1:1,
  133 days in Proposal before winning). Flags must be a *prompt to review*,
  not auto-disqualify.
- Thresholds derived from canonical-stage Won deals only. Legacy stages
  (`Position Identified`, etc.) are not flagged; they're surfaced under the
  legacy-stages toggle without staleness signals.

## Templates

### T1. Pipeline Hygiene (highest-priority, ships first)

**What it answers:** which currently-open deals have been stuck past their
stage's threshold, who owns them, how much money is sitting there.

**Inputs (knobs):**

- Threshold mode: `stage-aware` (default) | `flat 45d` | `flat custom Nd`
- Rep filter: defaults to current user; admins can pick "all" or a rep
- School year filter: defaults to current FY
- Migration-cohort toggle: `genuinely_stuck` (default) | `include unverified`
- Legacy-stages toggle: off (default) | on

**Output:**

- Top-line: count flagged, total `net_booking_amount` at risk, split by bucket
- Table: per-flagged-deal with stage, days in stage, threshold, rep, district,
  opp name, booking, close_date, "entered stage" date
- Per-rep rollup: count + dollar sum
- Always shows `n` and warns when stage `n_flagged < 3`

**Data quality affordances:**

- A persistent warning banner if ≥10% of result rows fall into the
  migration-synthesized cohort
- A "data freshness" link explaining the 30-min sync cadence

**SQL** — see Appendix A, recipes 4.1 + 4.4 + 4.5 + 4.6.

### T2. Stage Velocity

**What it answers:** how long do deals typically spend in each stage, split
by outcome (Won vs Lost), and how does that compare across reps / school
years.

**Inputs:**

- Cohort window: created in last 90d / 180d / school year / all
- Outcome filter: Won | Lost | both (default)
- Rep filter: defaults to current user
- Stat: avg | median (default) | both

**Output:**

- Per-stage table: stage × outcome × {n, avg, median, max} + `% of cohort`
  that ever touched the stage
- Cycle time row: full first-stage-to-close duration
- Optional grouped-bar chart (Won bar / Lost bar per stage)

**Caveats surfaced in UI:**

- Banner: "Based on N deals with tracked stage transitions (~X% of all closed
  deals — the rest were created directly in their final stage and have no
  lifecycle data)."

**SQL** — Appendix A, recipe 4.2.

### T3. Won-Deal Benchmark

**What it answers:** what does the distribution of dwell times look like
among deals that *did* close — used to calibrate thresholds and to back up
"is this deal slow?" judgment calls.

**Inputs:**

- Cohort window
- Rep filter

**Output:**

- Per-stage percentile table: p50 / p75 / p90 / p95 / p99 / max
- Top-10 longest Won-deal dwells (with deal name + rep + booking)

**SQL** — Appendix A, recipe 4.3.

## Architecture

### File layout

```
src/features/reports/
  components/
    PipelineHygieneCard.tsx       # T1
    StageVelocityCard.tsx          # T2
    WonDealBenchmarkCard.tsx       # T3
    DataQualityBanner.tsx          # shared
    LowSampleWarning.tsx           # shared
  lib/
    queries.ts                     # TanStack Query hooks
    thresholds.ts                  # stage-aware threshold constants
    opp-filters.ts                 # excludeDemoOpps, excludeMigrationCohort
    types.ts                       # template input/output types
src/app/api/reports/
  pipeline-hygiene/route.ts
  stage-velocity/route.ts
  won-deal-benchmark/route.ts
src/features/reports/__tests__/
  thresholds.test.ts
  opp-filters.test.ts
  queries.test.ts
```

### API conventions

- Each route accepts inputs as URL search params (primitives only — required
  for stable TanStack Query keys per `feedback_performance_smoothness.md`)
- Each route runs raw SQL via the `pg` Pool in `src/lib/db.ts` (Prisma's
  typed queries don't help with JSONB unnesting; raw is the right call)
- Each route returns `{ data, meta: { n, n_excluded_demo, n_migration_cohort,
  generated_at, freshness_warning } }` so the UI can surface data-quality
  context uniformly
- 30-min cache TTL via Next.js route segment config (`revalidate = 1800`),
  matching the upstream sync cadence

### Surface placement

Add a "Pipeline Health" section to the existing leaderboard area
(`src/features/leaderboard/`):

- Sales reps see only their own pipeline by default (rep filter = current user)
- Managers see an "all reps" toggle and per-rep rollups
- Phase 1: surfaces inline on the leaderboard route. Phase 2 (deferred):
  consider a dedicated `/reports` route if usage warrants

### Filter conventions (per CLAUDE.md)

- Rep dropdown defaults to current user via `useProfile()` (per
  `feedback_ux_defaults.md`)
- School-year dropdown shows a disabled placeholder during loading (never
  disappear)
- Query keys use serialized primitives, not raw filter objects
- Components subscribe to narrow store slices only

## Shared logic — the five operations

Every question in the source exploration composed the same operations. Phase 1
implements them as composable SQL building blocks rather than a generic engine,
but naming them up front makes future templates cheap.

| Op | What it does | Where it lives |
|---|---|---|
| **Cohort filter** | Pick opps by stage, created_at, rep, district | `cohortFilter()` in `lib/queries.ts` |
| **Unnest** | Explode `stage_history` to per-segment rows | `unnestStageHistory()` SQL fragment |
| **Segment filter** | Restrict to closed/open/non-terminal/etc. | composable WHERE clauses |
| **Per-(opp, stage) aggregate** | SUM dwell across re-entries | shared CTE |
| **Roll up** | GROUP BY stage / rep / outcome with mean/median/percentile/count/sum | template-specific |

Plus three transverse concerns, each its own helper:

- `excludeDemoOpps()` — applied by every template
- `classifyMigrationCohort()` — labels rows as `genuinely_stuck` vs
  `unverified_since_migration` based on `changed_at` falling in known clusters
- `restrictToCanonicalStages()` — toggleable per template

## Data hygiene affordances (must-have, not nice-to-have)

These are non-negotiable because the underlying data has known issues that,
unaddressed, make headline metrics misleading:

1. **Migration cohort split.** All templates classify result rows into
   `genuinely_stuck` (changed_at after migration cutover) vs
   `unverified_since_migration` (changed_at falls on/near a known migration
   date — currently 2025-08-18 and 2026-01-26, pending confirmation). Default
   view shows only `genuinely_stuck`. A toggle includes the unverified bucket
   for completeness.
2. **Demo district exclusion.** Every report excludes opps where
   `district_name LIKE 'Fullmind Demo%'`. Implemented once in
   `excludeDemoOpps()`.
3. **Canonical stages by default.** Reports default to the 6-stage canonical
   pipeline; legacy stages (`Position Identified`, `Position Purchased`,
   `Requisition Received`, `Return Position Pending`, `Complete - Full Length`,
   `Active`, `Meeting Booked` without `0 -` prefix, `Complete - Early
   Cancellation`) are off by default with a toggle to include.
4. **`n` always visible.** Every aggregated cell shows the underlying sample
   size. Cells with `n < 3` are visually de-emphasized; the entire report
   carries a "based on X deals (~Y%) with tracked transitions" caption.
5. **Terminal-stage segment handling.** Per-stage averages exclude `is_stale=
   true` segments where the parent opp's `stage IN ('Closed Won', 'Closed
   Lost')`. This is enforced in the shared SQL building blocks, not per
   template.

## Phased rollout

### PR 1 — Pipeline Hygiene template only

- All shared infrastructure: `thresholds.ts`, `opp-filters.ts`,
  `DataQualityBanner`, `LowSampleWarning`, the API route pattern
- T1 implementation end-to-end (route + component + queries + tests)
- Surface added to leaderboard area
- Documentation: this spec marked "Implemented" once shipped

Ships first because (a) it has the cleanest data slice (live opps;
post-migration `changed_at` mostly real), (b) it forces resolution of the
shared-infrastructure questions, and (c) the 8 clean late-funnel flags are
high-confidence value managers can act on day one.

### PR 2 — Stage Velocity + Won-Deal Benchmark templates

- T2 and T3 reuse the now-existing shared infrastructure
- Adds the "% of cohort that touched stage" coverage column
- Adds the per-stage percentile distribution view

Ships ~2 weeks after PR 1 to let the shared modules and data-quality
affordances soak.

### PR 3 (deferred) — admin threshold overrides

Only if Phase 1/2 reveals real demand for tunable thresholds. Until then
constants in code are simpler and easier to audit.

## Open questions

These need answers before PR 1 starts:

1. **Migration cutover dates.** The 2025-08-18 and 2026-01-26 clusters are
   inferred from data. Need confirmation from the owner of the upstream sync
   so `classifyMigrationCohort()` uses authoritative dates, not heuristics.
2. **Reopened-deal segments.** 3–13 closed deals show non-terminal `Closed
   Won` / `Closed Lost` segments mid-history (deal closed, reopened, closed
   again). Need to confirm with upstream that this is intentional (vs an
   artifact of mid-air status flips). Affects whether reports treat these as
   real history or filter them out.
3. **Threshold UX simplification.** Should Phase 1 ship with all six stage
   thresholds visible, or hide them behind an "Advanced" disclosure with a
   single global threshold as the default?
4. **Surface choice.** Pipeline Health on the leaderboard route, or a new
   `/pipeline-health` route? Leaderboard is the cheaper path; a new route is
   more discoverable for managers who don't think of this as a "leaderboard"
   concept.

## Success criteria

- T1 ships and is used by ≥3 sales reps weekly within 30 days
- ≥1 deal per week is unstuck (transitions stage) after being flagged
- The migration-cohort warning is dismissed/acknowledged, not ignored —
  i.e., data quality is visible enough to drive upstream cleanup
- Zero hand-written one-off SQL questions in the next quarter that an
  existing template could have answered

---

## Appendix A — SQL recipes

These are the parameterized SQL building blocks used by all three templates.
Each was validated against production data during the 2026-04-28 exploration.

### A.1 Latest segment (current/open) per opp

```sql
SELECT
  o.id,
  (last_seg->>'stage')::text                          AS current_stage_in_history,
  (last_seg->>'changed_at')::timestamptz              AS entered_stage_at,
  (last_seg->>'is_stale')::boolean                    AS is_stale,
  EXTRACT(EPOCH FROM (now() - (last_seg->>'changed_at')::timestamptz)) / 86400.0
                                                      AS days_in_current_stage
FROM opportunities o,
     LATERAL (
       SELECT seg AS last_seg
       FROM jsonb_array_elements(o.stage_history) WITH ORDINALITY t(seg, ord)
       ORDER BY ord DESC LIMIT 1
     ) latest
WHERE jsonb_array_length(o.stage_history) > 0;
```

### A.2 Per-stage dwell among closed deals (frozen durations only)

```sql
WITH per_opp_stage AS (
  SELECT
    o.id,
    o.stage AS outcome,
    seg->>'stage' AS pipeline_stage,
    SUM((seg->>'duration_ms')::bigint) AS ms_in_stage  -- SUM handles re-entries
  FROM opportunities o,
       jsonb_array_elements(o.stage_history) seg
  WHERE o.stage IN ('Closed Won','Closed Lost')
    AND (seg->>'is_stale')::boolean = false             -- only closed segments
  GROUP BY o.id, o.stage, seg->>'stage'
)
SELECT
  pipeline_stage,
  outcome,
  COUNT(*) AS n_opps,
  ROUND((AVG(ms_in_stage) / 86400000.0)::numeric, 1) AS avg_days,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_in_stage) / 86400000.0)::numeric, 1)
    AS median_days
FROM per_opp_stage
GROUP BY pipeline_stage, outcome
ORDER BY pipeline_stage, outcome;
```

### A.3 Won-deal percentile threshold

```sql
SELECT
  ROUND((PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ms_in_stage) / 86400000.0)::numeric, 1)
    AS p90_days
FROM per_opp_stage          -- from A.2, restricted to outcome = 'Closed Won'
WHERE outcome = 'Closed Won';
```

### A.4 Currently-flagged stale opps (stage-aware thresholds)

```sql
WITH open_active AS (
  /* A.1, restricted to non-terminal stages and non-demo districts */
  ...
)
SELECT *
FROM open_active
WHERE current_stage IN ('0 - Meeting Booked','1 - Discovery','2 - Presentation',
                        '3 - Proposal','4 - Negotiation','5 - Commitment')
  AND days_in_current_stage > CASE current_stage
    WHEN '0 - Meeting Booked' THEN 30
    WHEN '1 - Discovery'      THEN 60
    WHEN '2 - Presentation'   THEN 45
    WHEN '3 - Proposal'       THEN 45
    WHEN '4 - Negotiation'    THEN 30
    WHEN '5 - Commitment'     THEN 30
  END;
```

### A.5 Migration cohort filter

```sql
-- Drop the migration cohort entirely:
WHERE (seg->>'changed_at')::date NOT IN (DATE '2025-08-18', DATE '2026-01-26')

-- Or label into reportable buckets:
SELECT
  CASE WHEN (seg->>'changed_at')::date IN (DATE '2025-08-18', DATE '2026-01-26')
       THEN 'unverified_since_migration'
       ELSE 'genuinely_stuck'
  END AS bucket,
  ...
```

(Cutover dates above are inferred; see open question 1.)

### A.6 Demo data exclusion

```sql
WHERE COALESCE(o.district_name, '') NOT LIKE 'Fullmind Demo%'
```

---

## Appendix B — Source exploration findings (2026-04-28)

Full data from the session that motivated this spec. Reviewers can use these
to sanity-check the design assumptions; once the templates ship, this is
historical reference.

### B.1 Cohort sizing

Of all closed deals:

| outcome | total | with transitions | % |
|---|---|---|---|
| Closed Won | 989 | 131 | 13.2% |
| Closed Lost | 1,099 | 290 | 26.4% |

Only ~20% of closed deals have any transition history; the rest were created
directly in their final stage. This is the basis for the "tracked transitions"
caption that every template carries.

### B.2 Per-stage time, by outcome (canonical 6 stages)

| Stage | Won avg / med (n) | Lost avg / med (n) | Lost ÷ Won |
|---|---|---|---|
| 0 – Meeting Booked | 21.6d / 16.9d (7) | 40.0d / 19.9d (67) | 1.9× |
| 1 – Discovery | 27.7d / 23.3d (12) | 56.1d / 46.4d (78) | 2.0× |
| 2 – Presentation | 21.6d / 11.6d (36) | 60.9d / 37.7d (114) | 2.8× |
| 3 – Proposal | 17.8d / 10.8d (67) | 38.6d / 21.1d (53) | 2.2× |
| 4 – Negotiation | 12.4d / 4.2d (61) | 13.0d / 11.1d (10) | 1.0× |
| 5 – Commitment | 11.1d / 6.1d (68) | 35.2d / 33.2d (9) | 3.2× |
| **Full cycle** | 34.2d / 21.0d (131) | 72.9d / 55.9d (290) | 2.1× |

### B.3 % of cohort that touched each stage

| Stage | Won — % of 131 | Lost — % of 290 |
|---|---|---|
| 0 – Meeting Booked | **5%** | 23% |
| 1 – Discovery | **9%** | 27% |
| 2 – Presentation | 27% | 39% |
| 3 – Proposal | **51%** | 18% |
| 4 – Negotiation | **47%** | 3% |
| 5 – Commitment | **52%** | 3% |

Won and Lost are largely *different cohorts of deals*: ~50% of Won deals
first appear at Proposal/Negotiation/Commitment (warm/inbound or already-
qualified), while ~70% of Lost deals are visible early and almost never reach
late stages.

### B.4 Currently-flagged open deals (snapshot 2026-04-28)

Using the recommended stage-aware thresholds:

| Stage | threshold | flagged | avg / max days | $ at risk |
|---|---|---|---|---|
| 0 – Meeting Booked | 30d | 43 | 102 / **253** | $2.84M |
| 1 – Discovery | 60d | 64 | 126 / **253** | $7.05M |
| 2 – Presentation | 45d | 54 | 109 / **253** | $4.93M |
| 3 – Proposal | 45d | 17 | 94 / 214 | $3.25M |
| **4 – Negotiation** | **30d** | **5** | **60 / 77** | **$160k** |
| **5 – Commitment** | **30d** | **3** | **63 / 109** | **$104k** |

The "253-day" max in the first three stages is the migration-cohort artifact
(25 deals share `entered_stage_at = 2025-08-18`; next-worst dwell drops to
232 days). Negotiation and Commitment have no migration-era entries — their
8 flagged deals are the cleanest signal in the dataset.

### B.5 Data hygiene findings (worth fixing upstream)

1. Multiple stage taxonomies coexist — canonical 6-stage plus legacy/
   staffing labels.
2. Bulk-import artifacts at 2025-08-18 (~25 deals) and 2026-01-26 (Monica
   Sherwood / Tony Skauge renewal book). `changed_at` is synthesized.
3. 80% of closed deals were created directly in their final stage — no
   lifecycle data for them.
4. Terminal-stage segments keep `is_stale=true` forever with monotonically
   growing `duration_ms`. Don't interpret as time-in-stage.
5. Demo districts (`Fullmind Demo District #2`) leak into unfiltered queries.
6. Some Won/Lost deals have multiple Closed Won/Closed Lost segments with
   non-zero duration between them — implies opps were closed, reopened, and
   closed again (3–13 cases each).

---

## Appendix C — Pointers

- Schema: `prisma/schema.prisma:1198` (Opportunity model)
- Migration that added `stage_history`:
  `prisma/migrations/20260409000000_add_opensearch_sync_fields/migration.sql:6`
- Upstream sync context: `memory/project_opportunities_sync_cadence.md`
- Type alias: `src/features/shared/types/api-types.ts:944`
  (`stageHistory: unknown[]`)
- Prior opportunity-sync follow-up:
  `Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md`
- Earlier opportunity scheduler audit:
  `Docs/superpowers/briefs/2026-03-12-database-audit-findings.md`
