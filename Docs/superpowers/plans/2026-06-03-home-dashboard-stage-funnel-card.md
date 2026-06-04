# Stage Funnel Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pipeline subtab's plainer funnel + stage-health table with the prototype's consolidated Stage Funnel card (summary strip + SVG trapezoid funnel with a pre-pipe Targets row + share-by-deal-source), deferring the win-rate-by-stage section.

**Architecture:** A new pure `buildFunnel()` in `lib/pipeline.ts` derives the open-stage geometry, per-stage/overall team-share, rank, and source shares from the already-fetched team-wide open opps. A new per-rep targets query feeds a pure `buildTargetsRow()` for the pre-pipe row. Two new presentational components (`StageFunnelChart` SVG + `StageFunnelCard` shell) render it; `PipelineSection` swaps the old cards out.

**Tech Stack:** Next.js App Router route, Prisma `$queryRaw`, React 19 client components, Vitest + Testing Library, Fullmind design tokens.

**Spec:** `Docs/superpowers/specs/2026-06-03-home-dashboard-stage-funnel-card-design.md`

---

## File Structure

- **New:**
  - `src/features/home/components/dashboard/pipeline/StageFunnelChart.tsx` — the SVG trapezoid funnel (Targets row + 6 open stages, left max / right min+share labels).
  - `src/features/home/components/dashboard/pipeline/StageFunnelCard.tsx` — card shell: header + source pills + summary strip + chart + share-by-source + drill modal.
- **Modify:**
  - `src/features/home/lib/pipeline.ts` — add `buildFunnel`, `buildTargetsRow`, and their types.
  - `src/features/home/lib/pipeline-source.ts` — add per-rep pre-pipe targets query; thread through `PipelineData`.
  - `src/app/api/home/dashboard/pipeline/route.ts` — compute funnel + targets, add to response; drop `stageHealth`.
  - `src/features/home/lib/queries.ts` — extend `PipelineResponse`.
  - `src/features/home/components/dashboard/pipeline/PipelineSection.tsx` — swap `FunnelCard`+`StageHealthCard` for `StageFunnelCard`.
  - `src/features/home/lib/__tests__/pipeline.test.ts` — add `buildFunnel`/`buildTargetsRow` tests.
- **Delete:**
  - `src/features/home/components/dashboard/pipeline/StageHealthCard.tsx`
  - `src/features/home/components/dashboard/pipeline/FunnelCard.tsx`
  - `src/features/home/components/dashboard/pipeline/FunnelChart.tsx`
  - any `__tests__` for the deleted components; `buildStageHealth`/`groupOppsByStage` (+ their tests) once unreferenced.

**Conventions:** TDD (pure logic test-first), Fullmind tokens only (no Tailwind grays), Lucide icons, `whitespace-nowrap` on text spans, no raw IDs in copy, `MetricLabel` for tooltips. Commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`, plain messages, no model trailer. Stage files precisely (never `git add -A` — concurrent sessions share this worktree).

**Verify after each task:**
- Tests: `npx vitest run src/features/home`
- Types (home files only — repo has pre-existing tsc errors elsewhere): `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"` (expect no output)

---

## Task 1: `buildFunnel` — open-stage geometry, team share, rank, source shares

**Files:**
- Modify: `src/features/home/lib/pipeline.ts`
- Test: `src/features/home/lib/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/home/lib/__tests__/pipeline.test.ts` (extend the existing import line to include `buildFunnel`):

```ts
import { buildFunnel } from "../pipeline";

describe("buildFunnel", () => {
  const reps = [
    { id: "me", email: "me@x" },
    { id: "u2", email: "u2@x" },
  ];
  // me: Meeting(min30/max100, return), Negotiation(min80/max200, new)
  // u2: Meeting(min10/max40, return)
  const teamOpps: OpenOppRow[] = [
    { email: "me@x", stagePrefix: 0, netBooking: 0, minPurchase: 30, maxBudget: 100, daysInStage: 5, overdueClose: false, category: "renewal" },
    { email: "me@x", stagePrefix: 4, netBooking: 0, minPurchase: 80, maxBudget: 200, daysInStage: 5, overdueClose: false, category: "new_business" },
    { email: "u2@x", stagePrefix: 0, netBooking: 0, minPurchase: 10, maxBudget: 40, daysInStage: 5, overdueClose: false, category: "renewal" },
  ];

  it("returns the six open stages in order with caller min/max/count and team min", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    expect(f.stages.map((s) => s.name)).toEqual([
      "Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment",
    ]);
    const meeting = f.stages[0];
    expect(meeting).toMatchObject({ count: 1, min: 30, max: 100, teamMin: 40 }); // me 30 + u2 10
    expect(meeting.sharePct).toBe(75); // 30 / 40
    expect(f.stages[4]).toMatchObject({ count: 1, min: 80, max: 200, teamMin: 80, sharePct: 100 });
  });

  it("rolls up caller totals, spread, overall team share and rank", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    expect(f.openCount).toBe(2);
    expect(f.totalMin).toBe(110); // 30 + 80
    expect(f.totalMax).toBe(300); // 100 + 200
    expect(f.spread).toBe(190);
    expect(f.teamMinTotal).toBe(120); // me 110 + u2 10
    expect(f.overallSharePct).toBe(92); // round(110/120*100)
    expect(f.rank).toBe(1); // me 110 > u2 10
    expect(f.totalReps).toBe(2);
  });

  it("splits the caller-vs-team min commit by deal source", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    const ret = f.sources.find((s) => s.key === "return")!;
    expect(ret).toMatchObject({ you: 30, team: 40, pct: 75 });
    const neu = f.sources.find((s) => s.key === "new")!;
    expect(neu).toMatchObject({ you: 80, team: 80, pct: 100 });
  });

  it("source filter scopes both caller and team to that source", () => {
    const f = buildFunnel(teamOpps, reps, "me", "return");
    expect(f.totalMin).toBe(30); // only the return opp
    expect(f.stages[0]).toMatchObject({ min: 30, teamMin: 40, sharePct: 75 });
    expect(f.stages[4]).toMatchObject({ min: 0, teamMin: 0, sharePct: 0 }); // new-biz opp excluded
  });

  it("reports 0% share when the team has no min commit in a stage", () => {
    const f = buildFunnel([], reps, "me", "all");
    expect(f.stages[0]).toMatchObject({ min: 0, teamMin: 0, sharePct: 0 });
    expect(f.overallSharePct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t buildFunnel`
Expected: FAIL — `buildFunnel is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

First extend the **existing** segments import at the top of `src/features/home/lib/pipeline.ts` (currently `import { CATEGORY_TO_SEGMENT, type SegmentKey } from "./segments";`) to add `SEGMENT_DEFS` — do **not** add a second import line:

```ts
import { SEGMENT_DEFS, CATEGORY_TO_SEGMENT, type SegmentKey } from "./segments";
```

Then append to `src/features/home/lib/pipeline.ts` (after `buildCoverage`):

```ts
export interface FunnelStage {
  prefix: number; // 0-5
  name: string;
  count: number; // caller's opps in this stage
  min: number; // caller Σ minPurchase
  max: number; // caller Σ maxBudget
  teamMin: number; // Σ minPurchase across all reps in this stage
  sharePct: number; // round(min / teamMin × 100); 0 when teamMin is 0
}

export interface SourceShare {
  key: SegmentKey;
  label: string;
  color: string;
  you: number; // caller Σ minPurchase for this source
  team: number; // team Σ minPurchase for this source
  pct: number; // round(you / team × 100); 0 when team is 0
}

export interface FunnelData {
  stages: FunnelStage[];
  sources: SourceShare[];
  openCount: number;
  totalMin: number;
  totalMax: number;
  spread: number; // totalMax − totalMin (upside)
  teamMinTotal: number;
  overallSharePct: number;
  rank: number;
  totalReps: number;
  targets: TargetsRow; // attached by the route via buildTargetsRow; see Task 2
}

const pct = (you: number, team: number) => (team > 0 ? Math.round((you / team) * 100) : 0);
const sourceOf = (o: OpenOppRow): SegmentKey | null => (o.category ? CATEGORY_TO_SEGMENT[o.category] ?? null : null);

// Builds the Stage Funnel payload for one caller from the team-wide open book.
// `source` ("all" or a segment) scopes BOTH the caller and the team aggregates so
// every share figure stays within-source. Targets row is attached separately.
export function buildFunnel(
  teamOpps: OpenOppRow[],
  reps: { id: string; email: string }[],
  callerId: string,
  source: SegmentKey | "all",
): Omit<FunnelData, "targets"> {
  const callerEmail = reps.find((r) => r.id === callerId)?.email ?? null;
  const scoped = source === "all" ? teamOpps : teamOpps.filter((o) => sourceOf(o) === source);
  const callerScoped = callerEmail ? scoped.filter((o) => o.email === callerEmail) : [];

  const stages: FunnelStage[] = PIPELINE_STAGES.map(({ prefix, name }) => {
    const teamIn = scoped.filter((o) => o.stagePrefix === prefix);
    const meIn = callerScoped.filter((o) => o.stagePrefix === prefix);
    const min = meIn.reduce((s, o) => s + o.minPurchase, 0);
    const teamMin = teamIn.reduce((s, o) => s + o.minPurchase, 0);
    return {
      prefix,
      name,
      count: meIn.length,
      min,
      max: meIn.reduce((s, o) => s + o.maxBudget, 0),
      teamMin,
      sharePct: pct(min, teamMin),
    };
  });

  const totalMin = stages.reduce((s, x) => s + x.min, 0);
  const totalMax = stages.reduce((s, x) => s + x.max, 0);
  const teamMinTotal = stages.reduce((s, x) => s + x.teamMin, 0);

  // Rank reps by their (source-scoped) total min commit.
  const minByEmail = new Map<string, number>();
  for (const o of scoped) minByEmail.set(o.email, (minByEmail.get(o.email) ?? 0) + o.minPurchase);
  const ranking = rankReps(reps.map((r) => ({ id: r.id, email: r.email, value: minByEmail.get(r.email) ?? 0 })));
  const rank = ranking.ranked.find((r) => r.id === callerId)?.rank ?? ranking.totalReps + 1;

  const sources: SourceShare[] = SEGMENT_DEFS.map((d) => {
    const you = callerScoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    const team = scoped.filter((o) => sourceOf(o) === d.key).reduce((s, o) => s + o.minPurchase, 0);
    return { key: d.key, label: d.label, color: d.color, you, team, pct: pct(you, team) };
  });

  return {
    stages,
    sources,
    openCount: callerScoped.length,
    totalMin,
    totalMax,
    spread: totalMax - totalMin,
    teamMinTotal,
    overallSharePct: pct(totalMin, teamMinTotal),
    rank,
    totalReps: ranking.totalReps,
  };
}
```

Note: `TargetsRow` is referenced in `FunnelData` but defined in Task 2 — add Task 2's type before running tsc on the whole file. The Task 1 unit test only touches `buildFunnel`'s return (no `targets`), so it passes independently.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t buildFunnel`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): buildFunnel — open-stage geometry, team share, rank, source shares"
```

---

## Task 2: `buildTargetsRow` — pre-pipe Targets row

**Files:**
- Modify: `src/features/home/lib/pipeline.ts`
- Test: `src/features/home/lib/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `pipeline.test.ts` (extend import to include `buildTargetsRow, type TargetRepAgg`):

```ts
describe("buildTargetsRow", () => {
  // floorMin = Σ renewal (high-confidence floor); ceilMax = Σ all four target cols.
  const byRep: TargetRepAgg[] = [
    { email: "me@x", count: 3, floorMin: 120, ceilMax: 500 },
    { email: "u2@x", count: 2, floorMin: 80, ceilMax: 300 },
  ];

  it("returns the caller's pre-pipe targets with team-floor share", () => {
    const t = buildTargetsRow(byRep, "me@x");
    expect(t).toMatchObject({ count: 3, min: 120, max: 500, teamMin: 200 }); // team floor 120+80
    expect(t.sharePct).toBe(60); // 120 / 200
  });

  it("zeros out a caller with no plan targets but still reports team floor", () => {
    const t = buildTargetsRow(byRep, "ghost@x");
    expect(t).toMatchObject({ count: 0, min: 0, max: 0, teamMin: 200, sharePct: 0 });
  });

  it("handles an empty roster", () => {
    expect(buildTargetsRow([], "me@x")).toMatchObject({ count: 0, min: 0, max: 0, teamMin: 0, sharePct: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t buildTargetsRow`
Expected: FAIL — `buildTargetsRow is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/features/home/lib/pipeline.ts`:

```ts
// Per-rep pre-pipe target aggregate (districts on the plan with NO open opp).
// floorMin = Σ renewal_target (the high-confidence floor); ceilMax = Σ all four
// target columns (full upside). Produced by the targets query in pipeline-source.
export interface TargetRepAgg {
  email: string;
  count: number;
  floorMin: number;
  ceilMax: number;
}

export interface TargetsRow {
  count: number;
  min: number; // caller floor (Σ renewal)
  max: number; // caller ceiling (Σ all targets)
  teamMin: number; // Σ floor across all reps
  sharePct: number;
}

// The caller's pre-pipe Targets row plus their share of the team's target floor.
export function buildTargetsRow(byRep: TargetRepAgg[], callerEmail: string): TargetsRow {
  const mine = byRep.find((r) => r.email === callerEmail);
  const teamMin = byRep.reduce((s, r) => s + r.floorMin, 0);
  const min = mine?.floorMin ?? 0;
  return {
    count: mine?.count ?? 0,
    min,
    max: mine?.ceilMax ?? 0,
    teamMin,
    sharePct: teamMin > 0 ? Math.round((min / teamMin) * 100) : 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t buildTargetsRow`
Expected: PASS (3 tests). Also run the full file: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts` — all green.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): buildTargetsRow — pre-pipe targets floor/ceiling + team share"
```

---

## Task 3: Per-rep pre-pipe targets query

**Files:**
- Modify: `src/features/home/lib/pipeline-source.ts`

DB-bound (not unit-tested per the file's convention); verified live in Task 8.

- [ ] **Step 1: Add the query and thread it through `PipelineData`**

In `src/features/home/lib/pipeline-source.ts`:

1. Extend the import from `./pipeline` to include the new type:

```ts
import type { PipelineOpp, TargetRepAgg } from "./pipeline";
```

2. Add `targetsByRep` to the `PipelineData` interface:

```ts
export interface PipelineData {
  openOpps: PipelineOpp[];
  wonBookings: number;
  fyTarget: number;
  thisWeek: ThisWeek;
  targetsByRep: TargetRepAgg[]; // per-rep pre-pipe targets (no open opp) for the funnel Targets row
}
```

3. Add a fifth query to the `Promise.all([...])` (after the `week` query). It sums each rep's plan-district targets for districts with NO open opp for that rep this FY:

```ts
    // Per-rep pre-pipe targets: plan districts (this FY) with NO open opp for that
    // rep, with floor = Σ renewal_target and ceiling = Σ all four target columns.
    // Aggregated per rep so the pure buildTargetsRow can pick the caller + sum team.
    prisma.$queryRaw<TargetRepAgg[]>`
      SELECT u.email AS email,
             COUNT(*)::int AS count,
             COALESCE(SUM(COALESCE(tpd.renewal_target, 0)), 0)::float AS "floorMin",
             COALESCE(SUM(
               COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.new_business_target, 0) +
               COALESCE(tpd.winback_target, 0) + COALESCE(tpd.expansion_target, 0)
             ), 0)::float AS "ceilMax"
      FROM territory_plan_districts tpd
      JOIN territory_plans p ON p.id = tpd.plan_id
      JOIN user_profiles u ON u.id = COALESCE(p.owner_id, p.user_id)
      WHERE p.fiscal_year = ${fy}
        AND NOT EXISTS (
          SELECT 1 FROM opportunities o
          WHERE o.district_lea_id = tpd.district_leaid
            AND o.sales_rep_email = u.email
            AND o.school_yr = ${sy}
            AND ${stagePrefixSql(Prisma.sql`o.stage`)} BETWEEN 0 AND 5
        )
      GROUP BY u.email`,
```

4. Update the destructuring and the return:

```ts
  const [openOpps, won, target, week, targetsByRep] = await Promise.all([
```

```ts
  return {
    openOpps,
    wonBookings: won[0]?.won ?? 0,
    fyTarget: target[0]?.target ?? 0,
    thisWeek: { won: week[0]?.won ?? 0, lost: week[0]?.lost ?? 0, created: week[0]?.created ?? 0 },
    targetsByRep,
  };
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/home"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/features/home/lib/pipeline-source.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): fetch per-rep pre-pipe targets for the funnel Targets row"
```

---

## Task 4: Wire funnel + targets into the route and response type

**Files:**
- Modify: `src/app/api/home/dashboard/pipeline/route.ts`
- Modify: `src/features/home/lib/queries.ts`
- Test: `src/app/api/home/dashboard/__tests__/pipeline.test.ts` (if present — update mocks)

- [ ] **Step 1: Update the route**

In `src/app/api/home/dashboard/pipeline/route.ts`:

1. Replace the `buildStageHealth` import with the funnel builders:

```ts
import { buildFunnel, buildTargetsRow, buildCoverage, buildOppViews } from "@/features/home/lib/pipeline";
```

2. Destructure `targetsByRep`:

```ts
  const { openOpps, wonBookings, fyTarget, thisWeek, targetsByRep } = await fetchPipelineData(schoolYr, fy, callerEmail);
```

3. Replace the `stageHealth` line and assemble the funnel (the route bolts the targets row onto the funnel payload):

```ts
  const funnel = { ...buildFunnel(openOpps, reps, user.id, "all"), targets: buildTargetsRow(targetsByRep, callerEmail) };
```

4. In the `NextResponse.json({...})`, remove `stageHealth` and add `funnel`:

```ts
  return NextResponse.json({
    fy,
    schoolYr,
    inRoster,
    coverage: { ...coverage, wonBookings, fyTarget },
    funnel,
    opps,
    atRisk,
    thisWeek: fy === getCurrentFY() ? thisWeek : null,
  });
```

Note: source filtering is done client-side in the card (re-running the grouping on the full `openOpps` is not available to the client, so the card filters the caller's `opps`/uses the `funnel` for "all" and recomputes per-source shares from the segment data the route returns). The route always returns the `"all"` funnel; the card's source pills filter the **displayed** caller stages from `opps` and read per-source totals from `funnel.sources`. (Team-scoped per-source stage shares beyond "all" are out of scope — see spec.)

- [ ] **Step 2: Update the response type**

In `src/features/home/lib/queries.ts`:

1. Extend the type import:

```ts
import type { Coverage, OppView, FunnelData } from "./pipeline";
```

(Remove `StageHealth` from the import.)

2. Replace `stageHealth: StageHealth[];` with `funnel: FunnelData;` in `PipelineResponse`:

```ts
export interface PipelineResponse {
  fy: number;
  schoolYr: string;
  inRoster: boolean;
  coverage: Coverage & { wonBookings: number; fyTarget: number };
  funnel: FunnelData;
  opps: OppView[];
  atRisk: OppView[];
  thisWeek: ThisWeek | null;
}
```

- [ ] **Step 3: Update any route test mocks**

If `src/app/api/home/dashboard/__tests__/pipeline.test.ts` exists and asserts on `stageHealth`, replace those assertions with `funnel` shape checks (e.g. `expect(body.funnel.stages).toHaveLength(6)`), and ensure the mocked `fetchPipelineData` returns `targetsByRep: []`.

Run: `npx vitest run src/app/api/home/dashboard`
Expected: PASS.

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"`
Expected: no output. (`StageHealthCard.tsx` still imports `StageHealth` — that file is deleted in Task 7; if tsc flags it now, that's expected and resolved there. To keep this task green, leave `StageHealth`/`buildStageHealth` exported in `pipeline.ts` until Task 7.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/home/dashboard/pipeline/route.ts src/features/home/lib/queries.ts src/app/api/home/dashboard/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): serve funnel + targets payload from the pipeline route"
```

---

## Task 5: `StageFunnelChart` SVG component

**Files:**
- Create: `src/features/home/components/dashboard/pipeline/StageFunnelChart.tsx`
- Test: `src/features/home/components/dashboard/pipeline/__tests__/StageFunnelChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StageFunnelChart from "../StageFunnelChart";
import type { FunnelStage, TargetsRow } from "@/features/home/lib/pipeline";

const stage = (p: Partial<FunnelStage>): FunnelStage => ({
  prefix: 0, name: "Meeting Booked", count: 2, min: 30000, max: 100000, teamMin: 40000, sharePct: 75, ...p,
});
const targets: TargetsRow = { count: 5, min: 120000, max: 500000, teamMin: 200000, sharePct: 60 };

describe("StageFunnelChart", () => {
  it("renders a row per active stage plus the Targets pre-pipe row", () => {
    const stages = [stage({}), stage({ prefix: 4, name: "Negotiation", count: 1 })];
    render(<StageFunnelChart stages={stages} targets={targets} overallSharePct={50} onStageClick={() => {}} />);
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.getByText("Meeting Booked")).toBeInTheDocument();
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText(/pre-pipe/i)).toBeInTheDocument();
  });

  it("fires onStageClick with the stage prefix", () => {
    const onStageClick = vi.fn();
    render(<StageFunnelChart stages={[stage({})]} targets={targets} overallSharePct={50} onStageClick={onStageClick} />);
    screen.getByRole("button", { name: /Meeting Booked deals/i }).click();
    expect(onStageClick).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/StageFunnelChart.test.tsx`
Expected: FAIL — cannot find `../StageFunnelChart`.

- [ ] **Step 3: Write the component**

Create `src/features/home/components/dashboard/pipeline/StageFunnelChart.tsx`:

```tsx
"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { STAGE_ACCENTS, type FunnelStage, type TargetsRow } from "@/features/home/lib/pipeline";

const fmt = (v: number) => formatCurrency(v, true);
const TARGETS_ACCENT = "#8AA891"; // sage — distinct from the plum stage ramp (pre-pipe)

interface Row {
  key: string;
  name: string;
  count: number;
  min: number;
  max: number;
  sharePct: number;
  teamMin: number;
  accent: string;
  prefix: number | null; // null = Targets pre-pipe row (not clickable to a stage)
  isPreOpp: boolean;
}

// SVG trapezoid funnel: a continuous taper from the Targets pre-pipe row down through
// the active open stages. Each row's OUTER trapezoid (tinted accent) = max budget; the
// centered INNER trapezoid (solid) = min commit. Left label = max; right cluster = your
// min commit + share-of-team % with a mini bar ticked at your overall share.
export default function StageFunnelChart({
  stages,
  targets,
  overallSharePct,
  onStageClick,
}: {
  stages: FunnelStage[];
  targets: TargetsRow;
  overallSharePct: number;
  onStageClick: (prefix: number) => void;
}) {
  const activeStages = stages.filter((s) => s.count > 0);
  const rows: Row[] = [
    { key: "targets", name: "Targets", count: targets.count, min: targets.min, max: targets.max, sharePct: targets.sharePct, teamMin: targets.teamMin, accent: TARGETS_ACCENT, prefix: null, isPreOpp: true },
    ...activeStages.map((s) => ({ key: String(s.prefix), name: s.name, count: s.count, min: s.min, max: s.max, sharePct: s.sharePct, teamMin: s.teamMin, accent: STAGE_ACCENTS[s.prefix], prefix: s.prefix, isPreOpp: false })),
  ].filter((r) => r.isPreOpp ? r.count > 0 : true);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[#8A80A8]">No open deals to chart.</p>;
  }

  const W = 1080, padL = 140, padR = 240, padY = 10, stageH = 82;
  const H = padY * 2 + rows.length * stageH;
  const usableW = W - padL - padR;
  const cx = padL + usableW / 2;
  const maxAll = Math.max(...rows.map((r) => r.max), 1);
  const topW = rows.map((r) => (r.max / maxAll) * usableW);
  const botW = topW.slice(1).concat([topW[topW.length - 1] * 0.55]);
  const maxBarPct = Math.max(40, ...rows.map((r) => r.sharePct));
  const barW = 168;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }}>
      {rows.map((r, i) => {
        const y1 = padY + i * stageH;
        const y2 = y1 + stageH;
        const tW = topW[i], bW = botW[i];
        const ratio = r.max > 0 ? r.min / r.max : 0;
        const iT = tW * ratio, iB = bW * ratio;
        const midY = (y1 + y2) / 2;
        const outer = `M ${cx - tW / 2} ${y1} L ${cx + tW / 2} ${y1} L ${cx + bW / 2} ${y2} L ${cx - bW / 2} ${y2} Z`;
        const inner = ratio > 0 ? `M ${cx - iT / 2} ${y1} L ${cx + iT / 2} ${y1} L ${cx + iB / 2} ${y2} L ${cx - iB / 2} ${y2} Z` : null;
        const showInverse = ratio > 0.18;
        const leftWall = cx - tW / 2, rightWall = cx + tW / 2;
        const rx = rightWall + 16;
        const above = r.sharePct > overallSharePct + 2;
        const below = r.sharePct < overallSharePct - 4;
        const shareColor = above ? "#4B8B6B" : below ? "#F37167" : "#8A80A8";
        const fillW = (r.sharePct / maxBarPct) * barW;
        const tickX = rx + (overallSharePct / maxBarPct) * barW;
        const clickable = r.prefix != null;

        return (
          <g
            key={r.key}
            onClick={clickable ? () => onStageClick(r.prefix as number) : undefined}
            style={{ cursor: clickable ? "pointer" : "default" }}
            role={clickable ? "button" : undefined}
            aria-label={clickable ? `${r.name} deals` : undefined}
          >
            <path d={outer} fill={r.accent} fillOpacity={r.isPreOpp ? 0.14 : 0.22} stroke={r.isPreOpp ? r.accent : "none"} strokeWidth={r.isPreOpp ? 1.5 : 0} strokeDasharray={r.isPreOpp ? "6 4" : undefined} strokeOpacity={r.isPreOpp ? 0.55 : 1} />
            {i > 0 && <line x1={cx - tW / 2} y1={y1} x2={cx + tW / 2} y2={y1} stroke="#FFFFFF" strokeWidth="2" />}
            {inner && <path d={inner} fill={r.accent} fillOpacity={r.isPreOpp ? 0.55 : 1} />}

            <text x={cx} y={midY - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill={showInverse ? "#FFFFFF" : "#403770"} style={{ paintOrder: "stroke", stroke: showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>{r.name}</text>
            <text x={cx} y={midY + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill={showInverse ? "rgba(255,255,255,0.92)" : "#5C5378"} style={{ paintOrder: "stroke", stroke: showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>
              {r.isPreOpp ? `${r.count} accts · pre-pipe` : `${r.count} ${r.count === 1 ? "opp" : "opps"}`}
            </text>

            <text x={leftWall - 12} y={midY - 2} textAnchor="end" fontSize="11" fontWeight="600" fill="#8A80A8" style={{ letterSpacing: "0.06em" }}>{r.isPreOpp ? "EST. REV POTENTIAL" : "MAX BUDGET"}</text>
            <text x={leftWall - 12} y={midY + 13} textAnchor="end" fontSize="14" fontWeight="700" fill="#544A78" style={{ letterSpacing: "-0.01em" }}>{fmt(r.max)}</text>

            <text x={rx} y={midY - 18} textAnchor="start" fontSize="10.5" fontWeight="700" fill={r.accent} style={{ letterSpacing: "0.08em" }}>{r.isPreOpp ? "EST. VALUE · YOUR SHARE" : "MIN COMMIT · YOUR SHARE"}</text>
            <text x={rx} y={midY} textAnchor="start" fontSize="15" fontWeight="700" fill={r.accent} style={{ letterSpacing: "-0.01em" }}>{fmt(r.min)}</text>
            <text x={rx + 64} y={midY} textAnchor="start" fontSize="13" fontWeight="700" fill={shareColor}>{r.sharePct}%</text>
            {(above || below) && <text x={rx + 100} y={midY} textAnchor="start" fontSize="10.5" fontWeight="600" fill={shareColor}>{above ? "↗ above" : "↘ below"}</text>}
            <rect x={rx} y={midY + 8} width={barW} height="5" rx="2.5" fill="#D4CFE2" />
            <rect x={rx} y={midY + 8} width={fillW} height="5" rx="2.5" fill={r.accent} />
            <line x1={tickX} y1={midY + 5.5} x2={tickX} y2={midY + 15.5} stroke="#F37167" strokeWidth="1.5" strokeLinecap="round" />
            <text x={rx} y={midY + 28} textAnchor="start" fontSize="10.5" fontWeight="500" fill="#8A80A8">of {fmt(r.teamMin)} team</text>
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/StageFunnelChart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/StageFunnelChart.tsx src/features/home/components/dashboard/pipeline/__tests__/StageFunnelChart.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): StageFunnelChart — trapezoid funnel with pre-pipe Targets row"
```

---

## Task 6: `StageFunnelCard` shell

**Files:**
- Create: `src/features/home/components/dashboard/pipeline/StageFunnelCard.tsx`
- Test: `src/features/home/components/dashboard/pipeline/__tests__/StageFunnelCard.test.tsx`

The card owns: header + `MetricLabel`, source-filter pills, the 5-cell summary strip, the chart, the share-by-source strip, and the drill `StageDealsModal`. Source pills filter the displayed caller stages (from `opps`) and read per-source totals from `funnel.sources`; the team-scoped funnel stays the `"all"` payload (per spec).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StageFunnelCard from "../StageFunnelCard";
import type { FunnelData } from "@/features/home/lib/pipeline";
import type { OppView } from "@/features/home/lib/pipeline";

const funnel: FunnelData = {
  stages: [
    { prefix: 0, name: "Meeting Booked", count: 2, min: 30000, max: 100000, teamMin: 40000, sharePct: 75 },
    { prefix: 4, name: "Negotiation", count: 1, min: 80000, max: 200000, teamMin: 80000, sharePct: 100 },
  ].concat([1, 2, 3, 5].map((p) => ({ prefix: p, name: `S${p}`, count: 0, min: 0, max: 0, teamMin: 0, sharePct: 0 }))) as FunnelData["stages"],
  sources: [
    { key: "return", label: "Return", color: "#403770", you: 30000, team: 40000, pct: 75 },
    { key: "new", label: "New biz", color: "#F37167", you: 80000, team: 80000, pct: 100 },
    { key: "winback", label: "Win-back", color: "#6EA3BE", you: 0, team: 0, pct: 0 },
    { key: "expansion", label: "Expansion", color: "#FFCF70", you: 0, team: 0, pct: 0 },
  ],
  openCount: 3, totalMin: 110000, totalMax: 300000, spread: 190000,
  teamMinTotal: 120000, overallSharePct: 92, rank: 1, totalReps: 12,
  targets: { count: 5, min: 120000, max: 500000, teamMin: 200000, sharePct: 60 },
};
const opps: OppView[] = [];

describe("StageFunnelCard", () => {
  it("renders the summary strip, rank, funnel and source shares", () => {
    render(<StageFunnelCard funnel={funnel} opps={opps} />);
    expect(screen.getByText("Stage funnel")).toBeInTheDocument();
    expect(screen.getByText("Open opps")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // open opps count
    expect(screen.getByText(/#1\/12/)).toBeInTheDocument(); // rank chip
    expect(screen.getByText("Targets")).toBeInTheDocument(); // funnel pre-pipe row
    expect(screen.getByText("Share by deal source")).toBeInTheDocument();
    expect(screen.getByText("Return")).toBeInTheDocument();
  });

  it("renders a source-filter pill per segment plus All", () => {
    render(<StageFunnelCard funnel={funnel} opps={opps} />);
    expect(screen.getByRole("button", { name: "All sources" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New biz" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/StageFunnelCard.test.tsx`
Expected: FAIL — cannot find `../StageFunnelCard`.

- [ ] **Step 3: Write the component**

Create `src/features/home/components/dashboard/pipeline/StageFunnelCard.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import { SEGMENT_DEFS, type SegmentKey } from "@/features/home/lib/segments";
import { type FunnelData, type FunnelStage, type OppView } from "@/features/home/lib/pipeline";
import MetricLabel from "../MetricLabel";
import RankPill from "../RankPill";
import StageFunnelChart from "./StageFunnelChart";
import StageDealsModal from "./StageDealsModal";

type SourceFilter = "all" | SegmentKey;
const fmt = (v: number) => formatCurrency(v, true);

const FUNNEL_TIP =
  "Open pipeline by stage, with pre-pipe targets on top. Each stage shows the customer's max budget (outer band) with the contractual minimum commit (solid inner band) nested inside. The Targets row is accounts on your plan that haven't booked a meeting yet — its values are projected.";
const SHARE_TIP =
  "Your committed minimum as a share of the whole team's, by deal source. Return = existing customers, New biz = cold, Win-back = lapsed.";

// Consolidated Stage Funnel card: summary strip + trapezoid funnel (with the pre-pipe
// Targets row) + share-by-deal-source. Source pills filter the displayed caller stages
// and read per-source totals from the payload; the funnel geometry stays the all-sources
// view (team-scoped per-source stage shares are out of scope this pass).
export default function StageFunnelCard({ funnel, opps }: { funnel: FunnelData; opps: OppView[] }) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [stage, setStage] = useState<number | null>(null);

  // Caller stages, re-scoped to the chosen source from the displayed opps (team share
  // unchanged — the route serves the all-sources funnel).
  const stages: FunnelStage[] = useMemo(() => {
    if (source === "all") return funnel.stages;
    return funnel.stages.map((s) => {
      const inStage = opps.filter((o) => o.stagePrefix === s.prefix && o.source === source);
      const min = inStage.reduce((a, o) => a + o.minPurchase, 0);
      return {
        ...s,
        count: inStage.length,
        min,
        max: inStage.reduce((a, o) => a + o.maxBudget, 0),
        sharePct: s.teamMin > 0 ? Math.round((min / s.teamMin) * 100) : 0,
      };
    });
  }, [funnel.stages, opps, source]);

  const filteredOpps = useMemo(() => (source === "all" ? opps : opps.filter((o) => o.source === source)), [opps, source]);
  const totalMin = source === "all" ? funnel.totalMin : stages.reduce((a, s) => a + s.min, 0);
  const totalMax = source === "all" ? funnel.totalMax : stages.reduce((a, s) => a + s.max, 0);
  const openCount = source === "all" ? funnel.openCount : filteredOpps.length;
  const maxBarPct = Math.max(40, ...funnel.sources.map((s) => s.pct));

  const pills: { key: SourceFilter; label: string; color?: string }[] = [
    { key: "all", label: "All sources" },
    ...SEGMENT_DEFS.map((d) => ({ key: d.key, label: d.label, color: d.color })),
  ];

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">
            <MetricLabel tip={FUNNEL_TIP}>Stage funnel</MetricLabel>
          </h3>
          <p className="text-xs text-[#8A80A8]">Targets and open pipe · min commit floor and max budget ceiling. Click a stage to drill in.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((p) => {
            const active = source === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSource(p.key)}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
                style={active ? { borderColor: p.color ?? "#403770", color: p.color ?? "#403770", background: "#F7F5FA" } : { borderColor: "#D4CFE2", color: "#5C5378" }}
              >
                {p.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-stretch gap-x-5 gap-y-3 rounded-md border border-[#EFEDF5] bg-[#F7F5FA] px-4 py-3">
        <SummaryCell label="Open opps" value={String(openCount)} />
        <SummaryCell label="Min commit · floor" value={fmt(totalMin)} />
        <SummaryCell label="Max budget · ceiling" value={fmt(totalMax)} muted />
        <SummaryCell label="Spread · upside" value={fmt(totalMax - totalMin)} />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">Share of team min</span>
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#403770] tabular-nums">{funnel.overallSharePct}%</span>
            <RankPill rank={funnel.rank} totalReps={funnel.totalReps} inRoster />
          </span>
        </div>
      </div>

      <StageFunnelChart stages={stages} targets={funnel.targets} overallSharePct={funnel.overallSharePct} onStageClick={setStage} />

      {/* Share by deal source */}
      <div className="flex flex-col gap-2 border-t border-[#EFEDF5] pt-3">
        <h4 className="text-xs font-bold text-[#403770] whitespace-nowrap">
          <MetricLabel tip={SHARE_TIP}>Share by deal source</MetricLabel>
        </h4>
        <div className="flex flex-col gap-2">
          {funnel.sources.map((s) => {
            const above = s.pct > funnel.overallSharePct + 2;
            const below = s.pct < funnel.overallSharePct - 4;
            return (
              <div key={s.key} className="grid grid-cols-[110px_1fr_auto_auto] items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[#5C5378] whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="relative h-1.5 rounded-full bg-[#EFEDF5]">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (s.pct / maxBarPct) * 100)}%`, background: s.color }} />
                  <span className="absolute inset-y-[-2px] w-px bg-[#F37167]" style={{ left: `${Math.min(100, (funnel.overallSharePct / maxBarPct) * 100)}%` }} />
                </span>
                <span className="font-bold tabular-nums text-[#403770] whitespace-nowrap">{s.pct}%</span>
                <span className="tabular-nums text-[#8A80A8] whitespace-nowrap">{fmt(s.you)}<span className="text-[#C2BBD4]">/{fmt(s.team)}</span></span>
              </div>
            );
          })}
        </div>
      </div>

      <StageDealsModal stagePrefix={stage} opps={filteredOpps} onClose={() => setStage(null)} />
    </div>
  );
}

function SummaryCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">{label}</span>
      <span className={`text-lg font-bold tabular-nums whitespace-nowrap ${muted ? "text-[#8A80A8]" : "text-[#403770]"}`}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/pipeline/__tests__/StageFunnelCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/StageFunnelCard.tsx src/features/home/components/dashboard/pipeline/__tests__/StageFunnelCard.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): StageFunnelCard — summary strip + funnel + share-by-source"
```

---

## Task 7: Swap into `PipelineSection`; delete superseded cards + dead helpers

**Files:**
- Modify: `src/features/home/components/dashboard/pipeline/PipelineSection.tsx`
- Delete: `StageHealthCard.tsx`, `FunnelCard.tsx`, `FunnelChart.tsx` + their tests
- Modify: `src/features/home/lib/pipeline.ts` (remove now-dead `buildStageHealth`, `groupOppsByStage`, `StageHealth`, `StageGroup`, `StageHealthCard`-only types if unreferenced)
- Modify: `src/features/home/lib/__tests__/pipeline.test.ts` (drop tests for removed helpers)

- [ ] **Step 1: Swap the card in `PipelineSection`**

Replace the `FunnelCard`/`StageHealthCard` imports and usage:

```ts
import StageFunnelCard from "./StageFunnelCard";
```

Remove the `CoverageCard`? No — keep it. Replace the two lines in the main column:

```tsx
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <CoverageCard coverage={data.coverage} />
        <StageFunnelCard funnel={data.funnel} opps={data.opps} />
        <TopOpportunitiesTable opps={data.opps} />
        <TopTargetsCard />
      </div>
```

Remove the `FunnelCard` and `StageHealthCard` imports.

- [ ] **Step 2: Delete superseded components and their tests**

```bash
git rm src/features/home/components/dashboard/pipeline/StageHealthCard.tsx \
       src/features/home/components/dashboard/pipeline/FunnelCard.tsx \
       src/features/home/components/dashboard/pipeline/FunnelChart.tsx
# delete any matching test files if present:
git rm src/features/home/components/dashboard/pipeline/__tests__/FunnelCard.test.tsx 2>/dev/null || true
git rm src/features/home/components/dashboard/pipeline/__tests__/StageHealthCard.test.tsx 2>/dev/null || true
git rm src/features/home/components/dashboard/pipeline/__tests__/FunnelChart.test.tsx 2>/dev/null || true
```

- [ ] **Step 3: Remove dead helpers from `pipeline.ts`**

Confirm nothing references them: `grep -rn "buildStageHealth\|groupOppsByStage\|StageGroup\|StageHealth" src/features/home --include="*.ts" --include="*.tsx" | grep -v "lib/pipeline.ts" | grep -v __tests__` → expect no output. Then delete `buildStageHealth`, `groupOppsByStage`, and the `StageHealth`/`StageGroup` interfaces from `src/features/home/lib/pipeline.ts`, and remove their `describe` blocks + now-unused imports from `pipeline.test.ts` (`buildStageHealth`, `groupOppsByStage` from the import). Keep `OppView`, `buildOppViews`, `buildCoverage`, `Coverage`, `PIPELINE_STAGES`, `STAGE_ACCENTS`, `isStalled`, `classifyHealth` (still used).

- [ ] **Step 4: Full verify**

Run: `npx vitest run src/features/home src/app/api/home`
Expected: all green.
Run: `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/pipeline/PipelineSection.tsx src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): swap StageFunnelCard into Pipeline; drop superseded funnel + stage-health cards"
```

---

## Task 8: Live verification on :3020

**No code — manual verification (shared prod DB).**

- [ ] **Step 1: Start the worktree dev server**

Run: `npx next dev -p 3020` (background). Expect it to compile clean.

- [ ] **Step 2: Sanity-check the targets query against live data**

Write a temp `scripts/_tmp-funnel-check.mjs` (`new PrismaClient()`) that runs the Task-3 targets SQL for FY26 (`sy = '2025-26'`, `fy = 2026`) and prints a few rows; confirm counts/floors look plausible (non-negative, reps with plans appear). Delete the temp file after.

- [ ] **Step 3: In-app check (user-driven)**

Home → Dashboard → Pipeline subtab, **impersonating a real rep** on FY26. Confirm: summary strip numbers, the funnel renders with the Targets row on top + 6 stages, left max / right min+share labels, the share-by-source strip, source pills re-scope the caller stages, and a stage click opens the deals modal. Verify narrow-width (the summary strip wraps; funnel scales).

- [ ] **Step 4: Final full test + type sweep**

Run: `npx vitest run src/features/home src/app/api/home src/lib/__tests__/fiscal-year.test.ts src/lib/__tests__/reps.test.ts`
Expected: all green (≥ prior 188).
Run: `npx tsc --noEmit 2>&1 | grep -E "features/home|api/home/dashboard"` → no output.

Do **not** push — the user ships on explicit go (push may auto-merge to prod).

---

## Self-Review notes

- **Spec coverage:** summary strip (T6), SVG funnel + Targets row (T5), per-stage team share (T1), share-by-source (T1+T6), rank (T1), consolidation/deletes (T7), new targets query (T3), win-rate deferred (not built — by design). ✓
- **Type consistency:** `FunnelData`/`FunnelStage`/`SourceShare`/`TargetsRow`/`TargetRepAgg` defined in T1–T2, consumed identically in T3 (`TargetRepAgg`), T4 (`FunnelData`), T5/T6 (all). `buildFunnel` returns `Omit<FunnelData,"targets">`; the route attaches `targets` (T4). ✓
- **Known caveat (intentional):** source filtering re-scopes only the caller's displayed stages, not the team-scoped funnel geometry; documented in the card comment + spec.
