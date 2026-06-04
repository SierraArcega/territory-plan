# Benchmark-driven Deal Staleness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded per-stage staleness thresholds feeding the home dashboard's "At risk" card with data-driven benchmarks (median win/loss stage durations), surfacing a 4-tier severity gradient plus an overdue-close overlay.

**Architecture:** A new pure `classifyTier()` in `pipeline.ts` buckets each open deal into `on`/`watch`/`concerning`/`stale` from a `BenchmarkMap` computed in SQL (`pipeline-source.ts`, ported from the "Stale 2.0" saved report). `OppView` carries `tier` + `overdue` (replacing the old single `health`). The route filters/sorts the at-risk subset; `AtRiskCard` and `TopOpportunitiesTable` render the tier via `TIER_STYLE` with an overdue badge.

**Tech Stack:** TypeScript, Next.js App Router route handler, Prisma `$queryRaw` (Postgres `PERCENTILE_CONT`), Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-06-03-stale-deal-benchmarks-design.md`

---

## File Structure

- `src/features/home/lib/pipeline.ts` — add `AgeTier`, `StageBenchmark`, `BenchmarkMap`, `TIER_RANK`, `classifyTier()`; migrate `OppView` + `buildOppViews()`; remove dead `DealHealth`/`classifyHealth`/`isStalled`.
- `src/features/home/lib/pipeline-source.ts` — add the benchmark SQL query; expose `benchmarks: BenchmarkMap` on `PipelineData`.
- `src/app/api/home/dashboard/pipeline/route.ts` — thread `benchmarks` into `buildOppViews`; new at-risk filter + severity sort.
- `src/features/home/components/dashboard/pipeline/health.ts` — rename `HEALTH_STYLE` → `TIER_STYLE`, 4 tiers.
- `src/features/home/components/dashboard/pipeline/AtRiskCard.tsx` — tier label + overdue badge in `reason()`.
- `src/features/home/components/dashboard/pipeline/TopOpportunitiesTable.tsx` — tier badge + overdue pill.
- `src/features/home/lib/__tests__/pipeline.test.ts` — `classifyTier` tests; migrate `buildOppViews` test; remove `classifyHealth` block.

---

### Task 1: Pure `classifyTier()` + benchmark types

**Files:**
- Modify: `src/features/home/lib/pipeline.ts` (after `HEALTHY_MAX_BY_PREFIX`, line ~24)
- Test: `src/features/home/lib/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `pipeline.test.ts` (place it just above the existing `describe("classifyHealth", ...)` block — that block is removed in Task 3). Also add `classifyTier`, `type AgeTier`, `type StageBenchmark` to the existing top-of-file import from `../pipeline`.

```ts
describe("classifyTier", () => {
  const bench: StageBenchmark = { wonMedian: 30, lostMedian: 60, lostP75: 90 };

  it("returns 'on' at or below the won median", () => {
    expect(classifyTier(20, 3, bench)).toBe("on");
    expect(classifyTier(30, 3, bench)).toBe("on");
  });

  it("returns 'watch' past the won median up to the lost median", () => {
    expect(classifyTier(45, 3, bench)).toBe("watch");
    expect(classifyTier(60, 3, bench)).toBe("watch");
  });

  it("returns 'concerning' past the lost median up to the lost p75", () => {
    expect(classifyTier(75, 3, bench)).toBe("concerning");
    expect(classifyTier(90, 3, bench)).toBe("concerning");
  });

  it("returns 'stale' past the lost p75", () => {
    expect(classifyTier(120, 3, bench)).toBe("stale");
  });

  it("treats null lost benchmarks as escalating straight to 'stale' past the won median", () => {
    const wonOnly: StageBenchmark = { wonMedian: 30, lostMedian: null, lostP75: null };
    expect(classifyTier(20, 3, wonOnly)).toBe("on");
    expect(classifyTier(50, 3, wonOnly)).toBe("stale");
  });

  it("falls back to the hardcoded healthy age when a stage has no benchmark", () => {
    // stagePrefix 0 -> healthyMax 14
    expect(classifyTier(10, 0, undefined)).toBe("on");
    expect(classifyTier(20, 0, undefined)).toBe("stale");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t classifyTier`
Expected: FAIL — `classifyTier is not a function` / `StageBenchmark` not exported.

- [ ] **Step 3: Add the types + implementation**

In `pipeline.ts`, immediately after the `HEALTHY_MAX_BY_PREFIX` definition (line ~24), add:

```ts
// Empirical staleness tiers (see the "Stale 2.0" saved report). Each open stage's
// age is graded against how long deals that eventually closed spent in that stage.
export type AgeTier = "on" | "watch" | "concerning" | "stale";

export interface StageBenchmark {
  wonMedian: number; // median days a Closed-Won deal spent in this stage
  lostMedian: number | null; // median for Closed Lost (null when no lost history)
  lostP75: number | null; // 75th percentile for Closed Lost
}

export type BenchmarkMap = Map<number, StageBenchmark>; // keyed by stage prefix 0-5

// Lower rank = more urgent; used to sort the at-risk list by severity.
export const TIER_RANK: Record<AgeTier, number> = { stale: 0, concerning: 1, watch: 2, on: 3 };

// Grades an open deal's days-in-stage against its stage benchmark. Cascades
// on -> watch -> concerning -> stale. Null lost thresholds are skipped (a deal
// past the won median in a stage with no lost history escalates to stale).
// Falls back to the hardcoded healthy age when the stage has no benchmark at all.
export function classifyTier(
  daysInStage: number,
  stagePrefix: number,
  benchmark: StageBenchmark | undefined,
): AgeTier {
  if (!benchmark) {
    const max = HEALTHY_MAX_BY_PREFIX.get(stagePrefix) ?? Infinity;
    return daysInStage > max ? "stale" : "on";
  }
  if (daysInStage <= benchmark.wonMedian) return "on";
  if (benchmark.lostMedian != null && daysInStage <= benchmark.lostMedian) return "watch";
  if (benchmark.lostP75 != null && daysInStage <= benchmark.lostP75) return "concerning";
  return "stale";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t classifyTier`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(home): add classifyTier staleness benchmarks (pure)"
```

---

### Task 2: Benchmark SQL query in the fetch layer

**Files:**
- Modify: `src/features/home/lib/pipeline-source.ts`

No unit test — this file is DB-bound and verified live (see its header comment); the pure grading it feeds is covered in Task 1. Verification is via typecheck + the live app.

- [ ] **Step 1: Import the benchmark type**

In `pipeline-source.ts`, extend the existing type import (line ~11):

```ts
import type { PipelineOpp, TargetRepAgg, BenchmarkMap } from "./pipeline";
```

- [ ] **Step 2: Add `benchmarks` to the `PipelineData` interface**

Add this field to the `PipelineData` interface (after `targetsByRep`, line ~24):

```ts
  benchmarks: BenchmarkMap; // per-stage win/loss duration benchmarks (all-time)
```

- [ ] **Step 3: Add the benchmark query to the `Promise.all`**

Add this as a new element of the destructured `Promise.all` in `fetchPipelineData` (add `benchmarkRows` to the destructure list and append the query as the last array entry):

```ts
    // Per-stage staleness benchmarks (all-time, all reps): median days Closed-Won
    // deals spent in each open stage, plus median + p75 for Closed Lost. Ported
    // from the "Stale 2.0" saved report. duration_days is the stored per-entry
    // dwell time in each historical stage_history element.
    prisma.$queryRaw<{ stagePrefix: number | null; wonMedian: number | null; lostMedian: number | null; lostP75: number | null }[]>`
      SELECT
        LEFT(sh ->> 'stage', 1)::int AS "stagePrefix",
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (sh ->> 'duration_days')::numeric)
          FILTER (WHERE o.stage = 'Closed Won'))::float AS "wonMedian",
        (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (sh ->> 'duration_days')::numeric)
          FILTER (WHERE o.stage = 'Closed Lost'))::float AS "lostMedian",
        (PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (sh ->> 'duration_days')::numeric)
          FILTER (WHERE o.stage = 'Closed Lost'))::float AS "lostP75"
      FROM opportunities o
      CROSS JOIN LATERAL jsonb_array_elements(o.stage_history) AS sh
      WHERE o.stage IN ('Closed Won','Closed Lost')
        AND o.stage_history IS NOT NULL
        AND jsonb_typeof(o.stage_history) = 'array'
        AND (sh ->> 'stage') SIMILAR TO '[0-5]%'
        AND (sh ->> 'duration_days') IS NOT NULL
      GROUP BY LEFT(sh ->> 'stage', 1)`,
```

The destructure line becomes:

```ts
  const [openOpps, won, target, week, targetsByRep, benchmarkRows] = await Promise.all([
```

- [ ] **Step 4: Build the `BenchmarkMap` and return it**

Just before the `return {` at the end of `fetchPipelineData`, add:

```ts
  // Only stages with a Closed-Won median are usable benchmarks; the rest fall
  // back to the hardcoded healthy age in classifyTier.
  const benchmarks: BenchmarkMap = new Map(
    benchmarkRows
      .filter((r) => r.stagePrefix != null && r.wonMedian != null)
      .map((r) => [
        r.stagePrefix as number,
        { wonMedian: r.wonMedian as number, lostMedian: r.lostMedian, lostP75: r.lostP75 },
      ]),
  );
```

And add `benchmarks` to the returned object:

```ts
  return {
    openOpps,
    wonBookings: won[0]?.won ?? 0,
    fyTarget: target[0]?.target ?? 0,
    thisWeek: { won: week[0]?.won ?? 0, lost: week[0]?.lost ?? 0, created: week[0]?.created ?? 0 },
    targetsByRep,
    benchmarks,
  };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors in `pipeline-source.ts`; `pipeline.ts`/route still compile because `OppView` is unchanged so far).

- [ ] **Step 6: Commit**

```bash
git add src/features/home/lib/pipeline-source.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(home): fetch per-stage staleness benchmarks from closed deals"
```

---

### Task 3: Flip the model — `tier` + `overdue` through view, route, and UI

This is the cohesive model change: `OppView.health` → `tier` + `overdue`, with all consumers updated in the same commit so the tree stays green.

**Files:**
- Modify: `src/features/home/lib/pipeline.ts`
- Modify: `src/features/home/lib/__tests__/pipeline.test.ts`
- Modify: `src/app/api/home/dashboard/pipeline/route.ts`
- Modify: `src/features/home/components/dashboard/pipeline/health.ts`
- Modify: `src/features/home/components/dashboard/pipeline/AtRiskCard.tsx`
- Modify: `src/features/home/components/dashboard/pipeline/TopOpportunitiesTable.tsx`

- [ ] **Step 1: Migrate the `buildOppViews` test (write the failing test first)**

In `pipeline.test.ts`, replace the existing `buildOppViews` "sorts ... and labels stage/source/health" test body with the version below, and **delete the entire `describe("classifyHealth", ...)` block**. Update the top-of-file import to drop `classifyHealth` and add `classifyTier`, `type AgeTier`, `type StageBenchmark`, `type BenchmarkMap`.

```ts
  it("sorts the caller's open opps by weighted $ and grades tier + overdue", () => {
    const benchmarks: BenchmarkMap = new Map([
      [4, { wonMedian: 20, lostMedian: 35, lostP75: 50 }],
      [5, { wonMedian: 7, lostMedian: 14, lostP75: 21 }],
    ]);
    const views = buildOppViews(
      [
        pipeOpp({ account: "B", category: "new_business", stagePrefix: 5, netBooking: 50, daysInStage: 5, overdueClose: true }), // weighted 45, on but overdue
        pipeOpp({ account: "A", category: "renewal", stagePrefix: 4, netBooking: 100, daysInStage: 40 }), // weighted 75, concerning (35<40<=50)
      ],
      benchmarks,
    );
    expect(views.map((v) => v.account)).toEqual(["A", "B"]); // 75 before 45
    expect(views[0]).toMatchObject({ stageName: "Negotiation", source: "return", tier: "concerning", overdue: false });
    expect(views[1]).toMatchObject({ stageName: "Commitment", source: "new", tier: "on", overdue: true });
  });
```

The other two `buildOppViews` tests ("leaves source null", "threads the LMS detailsLink") call `buildOppViews([...])` with one arg — update both to pass an empty benchmark map as the second arg: `buildOppViews([...], new Map())`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts -t buildOppViews`
Expected: FAIL — `buildOppViews` expects 1 arg / `tier` undefined.

- [ ] **Step 3: Update `pipeline.ts` — `OppView`, `buildOppViews`, remove dead code**

In `OppView`, replace the `health: DealHealth;` line with:

```ts
  tier: AgeTier;
  overdue: boolean; // close date already passed (overlay on the tier)
```

Change `buildOppViews` to take the benchmark map and grade each opp:

```ts
// Maps the caller's open opps to display rows (stage name, source segment, age
// tier, overdue), sorted by weighted $ (highest-value first).
export function buildOppViews(opps: PipelineOpp[], benchmarks: BenchmarkMap): OppView[] {
  return opps
    .map((o) => ({
      account: o.account,
      state: o.state,
      source: o.category ? CATEGORY_TO_SEGMENT[o.category] ?? null : null,
      stageName: STAGE_NAME_BY_PREFIX.get(o.stagePrefix) ?? "—",
      stagePrefix: o.stagePrefix,
      netBooking: o.netBooking,
      minPurchase: o.minPurchase,
      maxBudget: o.maxBudget,
      weighted: o.netBooking * (WEIGHT_BY_PREFIX.get(o.stagePrefix) ?? 0),
      closeDate: o.closeDate,
      daysInStage: o.daysInStage,
      tier: classifyTier(o.daysInStage, o.stagePrefix, benchmarks.get(o.stagePrefix)),
      overdue: o.overdueClose,
      detailsLink: o.detailsLink,
    }))
    .sort((a, b) => b.weighted - a.weighted);
}
```

Delete the now-dead `export type DealHealth = ...`, the `classifyHealth` function and its leading comment, and the `isStalled` function and its leading comment. Keep `HEALTHY_MAX_BY_PREFIX` (used by `classifyTier`), `STAGE_NAME_BY_PREFIX`, and `WEIGHT_BY_PREFIX`.

- [ ] **Step 4: Update the route**

In `src/app/api/home/dashboard/pipeline/route.ts`:

Add `TIER_RANK` to the import from `pipeline`:

```ts
import { buildFunnel, buildTargetsRow, buildCoverage, buildOppViews, TIER_RANK } from "@/features/home/lib/pipeline";
```

Destructure `benchmarks` from `fetchPipelineData`:

```ts
  const { openOpps, wonBookings, fyTarget, thisWeek, targetsByRep, benchmarks } = await fetchPipelineData(schoolYr, fy, callerEmail);
```

Pass `benchmarks` into `buildOppViews` and replace the `atRisk` line:

```ts
  const views = buildOppViews(callerOpps, benchmarks);
  const opps = views.slice(0, 50); // paginate the displayed table per CLAUDE.md
  // At risk = any non-on-track tier OR an overdue close date, worst tier first,
  // then by weighted $.
  const atRisk = views
    .filter((o) => o.tier !== "on" || o.overdue)
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.weighted - a.weighted);
```

- [ ] **Step 5: Update `health.ts` — 4-tier `TIER_STYLE`**

Replace the `HEALTH_STYLE` declaration (and the `DealHealth` import) with:

```ts
import type { AgeTier } from "@/features/home/lib/pipeline";
```

```ts
export const TIER_STYLE: Record<AgeTier, { label: string; color: string; bg: string }> = {
  on: { label: "On track", color: "#2E7D5B", bg: "rgba(46,125,91,0.10)" },
  watch: { label: "Watch", color: "#C7A02E", bg: "rgba(199,160,46,0.12)" },
  concerning: { label: "Concerning", color: "#C77C2E", bg: "rgba(199,124,46,0.12)" },
  stale: { label: "Stale", color: "#F37167", bg: "rgba(243,113,103,0.12)" },
};
```

Leave `sourceLabel`, `sourceColor`, `fmtCloseDate` unchanged.

- [ ] **Step 6: Update `AtRiskCard.tsx`**

Change the import `import { HEALTH_STYLE } from "./health";` to `import { TIER_STYLE } from "./health";`. Replace the `reason()` function and the `const h = HEALTH_STYLE[o.health];` line:

```ts
function reason(o: OppView): string {
  const base = `${TIER_STYLE[o.tier].label} · ${Math.round(o.daysInStage)}d in ${o.stageName}`;
  return o.overdue ? `${base} · close date passed` : base;
}
```

```ts
            const h = TIER_STYLE[o.tier];
```

- [ ] **Step 7: Update `TopOpportunitiesTable.tsx`**

Change the import to `import { TIER_STYLE, sourceLabel, sourceColor, fmtCloseDate } from "./health";`. Replace `const h = HEALTH_STYLE[o.health];` with `const h = TIER_STYLE[o.tier];`. Replace the Health `<td>` (lines ~70-74) with a tier badge plus an overdue pill:

```tsx
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: h.color, background: h.bg }}>
                          {h.label}
                        </span>
                        {o.overdue && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#F37167]" style={{ background: "rgba(243,113,103,0.12)" }}>
                            Overdue
                          </span>
                        )}
                      </span>
                    </td>
```

- [ ] **Step 8: Run the pure tests + typecheck**

Run: `npx vitest run src/features/home/lib/__tests__/pipeline.test.ts`
Expected: PASS (all tests, including the migrated `buildOppViews` and `classifyTier`).

Run: `npx tsc --noEmit`
Expected: PASS — no remaining references to `health`/`HEALTH_STYLE`/`classifyHealth`/`DealHealth`.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/lib/pipeline.ts src/features/home/lib/__tests__/pipeline.test.ts \
  src/app/api/home/dashboard/pipeline/route.ts \
  src/features/home/components/dashboard/pipeline/health.ts \
  src/features/home/components/dashboard/pipeline/AtRiskCard.tsx \
  src/features/home/components/dashboard/pipeline/TopOpportunitiesTable.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(home): 4-tier benchmark staleness in at-risk card + opps table"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full home-dashboard test suite**

Run: `npx vitest run src/features/home`
Expected: PASS — including `src/app/api/home/dashboard/pipeline/__tests__/route.test.ts` and `PipelineSection.test.tsx`. If the route test asserts on the old `health` field or `atRisk` shape, update those assertions to `tier`/`overdue` (use the same boundary logic as Task 3 Step 1) and re-run.

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npx tsc --noEmit && npx next lint --dir src/features/home --dir src/app/api/home`
Expected: PASS, no errors.

- [ ] **Step 3: Live smoke test**

Run `npm run dev` (port 3005), open the home dashboard Pipeline tab. Confirm the "At risk" card lists Watch/Concerning/Stale deals color-coded with "<Tier> · Nd in <Stage>" reasons, overdue deals show "· close date passed", and the Top opportunities table Health column shows the tier badge + Overdue pill. Cross-check a couple of deals against the "Stale 2.0" saved report (saved_reports id 4) to confirm tiers line up.

- [ ] **Step 4: Final commit (only if route test or lint required edits)**

```bash
git add -p   # stage only the verification fixes
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "test(home): align pipeline route test with tier/overdue model"
```

---

## Self-Review Notes

- **Spec coverage:** 4-tier severity (Task 1/3), all-non-on-track in card (Task 3 route filter), all-time benchmark pool (Task 2 SQL — no FY filter), overdue overlay (Task 3 UI), thin-stage fallback (Task 1 `classifyTier`). All covered.
- **Type consistency:** `AgeTier`, `StageBenchmark`, `BenchmarkMap`, `TIER_RANK`, `TIER_STYLE`, `classifyTier`, `buildOppViews(opps, benchmarks)` names used identically across tasks.
- **Dead code:** `DealHealth`, `classifyHealth`, `isStalled`, `HEALTH_STYLE` all removed in Task 3; `HEALTHY_MAX_BY_PREFIX` retained for the fallback.
