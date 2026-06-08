# Sched + Delivered Range Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the "Sched + Delivered Rev." and "Sched + Delivered Take" topline cards into one "Sched + Delivered" card with a floor → revenue → ceiling range bar, take shown as the leading slice, and a revenue+take-by-motion tooltip.

**Architecture:** The API keeps emitting the `revenue` and `take` cards unchanged (their per-metric rank + sparkline stay intact) and gains a won-contract floor/ceiling detail attached to the `revenue` card. The merge happens in the UI: a new `SchedDeliveredCard` consumes both cards plus the detail and renders one range bar. All range math lives in a pure, unit-tested helper.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma raw SQL, Tailwind 4, Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-06-08-sched-delivered-range-card-design.md`

---

## File Structure

- **Create** `src/features/home/lib/sched-delivered.ts` — pure range geometry + take-rate + motion-row merge helpers (no React, fully unit-tested).
- **Create** `src/features/home/lib/__tests__/sched-delivered.test.ts` — tests for the above.
- **Create** `src/features/home/components/dashboard/SchedDeliveredCard.tsx` — the merged card (range bar + motion popover) rendered through `StatCardShell`.
- **Create** `src/features/home/components/dashboard/__tests__/SchedDeliveredCard.test.tsx` — render test.
- **Modify** `src/features/home/lib/topline.ts` — add `WonContractDetail` type, `wonDetail` field on `ToplineCard`, attach it in `buildToplineCards`.
- **Modify** `src/features/home/lib/__tests__/topline.test.ts` — update call signatures + add a `wonDetail` case.
- **Modify** `src/app/api/home/dashboard/topline/route.ts` — add the won-contract detail query, pass it through.
- **Modify** `src/features/home/components/dashboard/ToplineStatStrip.tsx` — render the merged card in place of the two standalone cards; fix grid/skeleton counts.
- **Modify** `src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx` — update skeleton count + add a merged-card render assertion.

---

## Task 1: Pure range geometry + take rate

**Files:**
- Create: `src/features/home/lib/sched-delivered.ts`
- Test: `src/features/home/lib/__tests__/sched-delivered.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeRange, takeRate } from "../sched-delivered";

describe("computeRange", () => {
  it("scales revenue/take/floor as a percent of the ceiling", () => {
    const g = computeRange({ revenue: 748, take: 224, floor: 650, ceiling: 1100 });
    expect(g.hasRange).toBe(true);
    expect(g.revenuePct).toBeCloseTo(68, 0);
    expect(g.takePct).toBeCloseTo(20.36, 1);
    expect(g.floorPct).toBeCloseTo(59.09, 1);
    expect(g.overage).toBe(false);
  });

  it("flags overage and clamps the fill at 100% when revenue exceeds the ceiling", () => {
    const g = computeRange({ revenue: 1300, take: 400, floor: 600, ceiling: 1100 });
    expect(g.revenuePct).toBe(100);
    expect(g.overage).toBe(true);
  });

  it("reports no range when the ceiling is zero (no won contracts)", () => {
    const g = computeRange({ revenue: 0, take: 0, floor: 0, ceiling: 0 });
    expect(g).toEqual({ hasRange: false, revenuePct: 0, takePct: 0, floorPct: 0, overage: false });
  });

  it("clamps a floor that exceeds the ceiling (data anomaly) to 100%", () => {
    const g = computeRange({ revenue: 200, take: 50, floor: 1500, ceiling: 1100 });
    expect(g.floorPct).toBe(100);
  });
});

describe("takeRate", () => {
  it("returns take / revenue", () => {
    expect(takeRate(1000, 300)).toBeCloseTo(0.3, 5);
  });
  it("returns null when revenue is zero or negative", () => {
    expect(takeRate(0, 0)).toBeNull();
    expect(takeRate(-5, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/sched-delivered.test.ts`
Expected: FAIL — `Failed to resolve import "../sched-delivered"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/home/lib/sched-delivered.ts
// Pure presentation math for the merged "Sched + Delivered" range card. No React
// here so the geometry (clamping, overage) and the take rate are unit-tested in
// isolation. The bar is scaled $0 → ceiling with the floor as a marker (locked
// 2026-06-08), so an early-year revenue below the floor reads as "not yet at the
// commitment" rather than a full bar.

export interface RangeInput {
  revenue: number;
  take: number;
  floor: number;   // Σ minimum_purchase_amount across won contracts
  ceiling: number; // Σ maximum_budget across won contracts
}

export interface RangeGeometry {
  hasRange: boolean; // ceiling > 0
  revenuePct: number; // 0–100, clamped
  takePct: number;    // 0–100, clamped
  floorPct: number;   // 0–100, clamped
  overage: boolean;   // revenue exceeds the ceiling
}

export function computeRange({ revenue, take, floor, ceiling }: RangeInput): RangeGeometry {
  if (!(ceiling > 0)) {
    return { hasRange: false, revenuePct: 0, takePct: 0, floorPct: 0, overage: false };
  }
  const pct = (v: number) => Math.max(0, Math.min(100, (v / ceiling) * 100));
  return {
    hasRange: true,
    revenuePct: pct(revenue),
    takePct: pct(take),
    floorPct: pct(floor),
    overage: revenue > ceiling,
  };
}

// Take is a function of revenue (margin / revenue). Null when there's no revenue
// to divide by, so the UI can hide the rate instead of printing NaN%.
export function takeRate(revenue: number, take: number): number | null {
  if (!(revenue > 0)) return null;
  return take / revenue;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/home/lib/__tests__/sched-delivered.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/sched-delivered.ts src/features/home/lib/__tests__/sched-delivered.test.ts
git commit -m "feat(dashboard): range geometry + take-rate helpers for Sched+Delivered card"
```

---

## Task 2: Motion-row merge helper

Zips the revenue segments with the take segments by motion key, in `SEGMENT_DEFS`
order, dropping motions with no revenue and no take. Feeds the tooltip.

**Files:**
- Modify: `src/features/home/lib/sched-delivered.ts`
- Test: `src/features/home/lib/__tests__/sched-delivered.test.ts:end`

- [ ] **Step 1: Add the failing test**

Append to `sched-delivered.test.ts`:

```ts
import { mergeMotionRows } from "../sched-delivered";

describe("mergeMotionRows", () => {
  it("zips revenue + take by motion in segment order, with per-row take rate", () => {
    const rows = mergeMotionRows(
      [
        { key: "return", label: "Return", value: 600 },
        { key: "new", label: "New biz", value: 100 },
      ],
      [
        { key: "return", label: "Return", value: 180 },
        { key: "new", label: "New biz", value: 30 },
      ],
    );
    expect(rows).toEqual([
      { key: "return", label: "Return", revenue: 600, take: 180, rate: 0.3 },
      { key: "new", label: "New biz", revenue: 100, take: 30, rate: 0.3 },
    ]);
  });

  it("includes a motion present in only one of the two inputs", () => {
    const rows = mergeMotionRows(
      [{ key: "winback", label: "Win-back", value: 50 }],
      [],
    );
    expect(rows).toEqual([{ key: "winback", label: "Win-back", revenue: 50, take: 0, rate: 0 }]);
  });

  it("drops motions with neither revenue nor take", () => {
    const rows = mergeMotionRows([], []);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/sched-delivered.test.ts`
Expected: FAIL — `mergeMotionRows is not a function`.

- [ ] **Step 3: Implement**

Append to `src/features/home/lib/sched-delivered.ts`:

```ts
import { SEGMENT_DEFS } from "./segments";
import type { ToplineSegment } from "./topline";

export interface MotionRow {
  key: string;
  label: string;
  revenue: number;
  take: number;
  rate: number | null;
}

// Merge the two per-motion breakdowns the API already returns (revenue card's
// segments + take card's segments) into one row set for the tooltip. Order and
// labels come from SEGMENT_DEFS so this can't drift from the rest of the dashboard.
export function mergeMotionRows(
  revenueSegments: ToplineSegment[],
  takeSegments: ToplineSegment[],
): MotionRow[] {
  const revByKey = new Map(revenueSegments.map((s) => [s.key, s.value]));
  const takeByKey = new Map(takeSegments.map((s) => [s.key, s.value]));
  return SEGMENT_DEFS.map(({ key, label }) => {
    const revenue = revByKey.get(key) ?? 0;
    const take = takeByKey.get(key) ?? 0;
    return { key, label, revenue, take, rate: takeRate(revenue, take) };
  }).filter((r) => r.revenue > 0 || r.take > 0);
}
```

Note: `takeRate(50, 0)` returns `0` (revenue > 0), matching the win-back test's `rate: 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/home/lib/__tests__/sched-delivered.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/sched-delivered.ts src/features/home/lib/__tests__/sched-delivered.test.ts
git commit -m "feat(dashboard): merge revenue+take by motion for the Sched+Delivered tooltip"
```

---

## Task 3: `WonContractDetail` type + attach in `buildToplineCards`

**Files:**
- Modify: `src/features/home/lib/topline.ts:20-25` (add type), `:27-38` (card field), `:87-122` (signature + attach)
- Test: `src/features/home/lib/__tests__/topline.test.ts`

- [ ] **Step 1: Update the existing tests (signature change + new case)**

The signature gains a `wonContractDetail` param **before** `mode`. Update the two
team-mode calls and add a new assertion.

In `topline.test.ts`, change the two team-mode calls (currently `..., [], null, "team")` and `..., [], null, "rep")`) to insert a `null` for the new param:

```ts
// was: buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, "team");
const cards = buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, null, "team");
// ...
// was: buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, "rep");
const cards = buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, null, "rep");
```

Add this test inside the first `describe("buildToplineCards", ...)` block:

```ts
it("attaches won-contract detail (floor/ceiling/counts) to the revenue card only", () => {
  const won = { floor: 650000, ceiling: 1100000, oppCount: 8, accountCount: 6 };
  const cards = buildToplineCards(reps, batch({ "me@x": { totalRevenue: 748000 } }), SY, "me", [], null, won);
  const rev = cards.find((c) => c.metricKey === "revenue")!;
  expect(rev.wonDetail).toEqual(won);
  for (const c of cards.filter((c) => c.metricKey !== "revenue")) {
    expect(c.wonDetail).toBeUndefined();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/lib/__tests__/topline.test.ts`
Expected: FAIL — too many arguments / `wonDetail` does not exist on type / wrong value.

- [ ] **Step 3: Implement in `topline.ts`**

Add the interface after `OpenPipelineDetail` (around line 25):

```ts
// Won-contract envelope for the merged Sched + Delivered card: the floor
// (Σ minimum_purchase_amount) and budget ceiling (Σ maximum_budget) across the
// CLOSED-WON opps revenue is delivered against — the range revenue lands within.
export interface WonContractDetail {
  floor: number;
  ceiling: number;
  oppCount: number;
  accountCount: number;
}
```

Add the field to `ToplineCard` (after `pipelineDetail?`):

```ts
  // Open-pipeline card only: commit/budget totals + opp/account counts.
  pipelineDetail?: OpenPipelineDetail;
  // Revenue card only: won-contract floor/ceiling, consumed by the merged card.
  wonDetail?: WonContractDetail;
```

Change the `buildToplineCards` signature to insert `wonContractDetail` before `mode`:

```ts
export function buildToplineCards(
  reps: { id: string; email: string }[],
  actualsByEmail: Map<string, Map<string, RepActuals>>,
  schoolYr: string,
  subjectId: string,
  subjectCategories: CategoryActuals[],
  openPipelineDetail: OpenPipelineDetail | null = null,
  wonContractDetail: WonContractDetail | null = null,
  mode: "rep" | "team" = "rep",
): ToplineCard[] {
```

In the returned object, add the spread next to the existing `pipelineDetail` spread:

```ts
      ...(key === "openPipeline" && openPipelineDetail ? { pipelineDetail: openPipelineDetail } : {}),
      ...(key === "revenue" && wonContractDetail ? { wonDetail: wonContractDetail } : {}),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/home/lib/__tests__/topline.test.ts`
Expected: PASS (all cases, including the new won-detail case).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/topline.ts src/features/home/lib/__tests__/topline.test.ts
git commit -m "feat(dashboard): WonContractDetail on the revenue topline card"
```

---

## Task 4: Won-contract floor/ceiling query in the API route

No unit test — the dashboard's raw SQL is verified live (matches the existing
open-pipeline detail query convention in `trajectory-source.ts`). Verification is
a manual `npm run dev` check.

**Files:**
- Modify: `src/app/api/home/dashboard/topline/route.ts:8` (import), `:57-74` (query + call)

- [ ] **Step 1: Add the won-contract detail query**

In `route.ts`, update the topline import to include the new type:

```ts
import { buildToplineCards, type CategoryActuals, type OpenPipelineDetail, type WonContractDetail } from "@/features/home/lib/topline";
```

After the existing `detailRows` / `openPipelineDetail` block (ends ~line 72), add:

```ts
  // Subject's WON-contract envelope: commit floor (Σ minimum_purchase_amount)
  // and budget ceiling (Σ maximum_budget) across closed-won opps (stage prefix
  // ≥ 6, mirroring the DOA matview + trajectory bucketing). This is the set
  // revenue is delivered against, so the range card's floor/ceiling come from here.
  const wonRows = await prisma.$queryRaw<{ floor: number; ceiling: number; oppCount: number; accountCount: number }[]>`
      SELECT
        COALESCE(SUM(COALESCE(o.minimum_purchase_amount, 0)), 0)::float AS "floor",
        COALESCE(SUM(COALESCE(o.maximum_budget, 0)), 0)::float AS "ceiling",
        COUNT(*)::int AS "oppCount",
        COUNT(DISTINCT o.district_name)::int AS "accountCount"
      FROM opportunities o
      WHERE o.school_yr = ${schoolYr}
        ${emailFilterSql(scope, Prisma.sql`o.sales_rep_email`)}
        AND o.net_booking_amount IS NOT NULL
        AND ${stagePrefixSql(Prisma.sql`o.stage`)} >= 6
    `;
  const wonContractDetail: WonContractDetail | null = wonRows[0] ?? null;
```

- [ ] **Step 2: Pass it into `buildToplineCards`**

Change the call (line ~74) to insert `wonContractDetail` before `scope.mode`:

```ts
  const cards = buildToplineCards(reps, actualsByEmail, schoolYr, subjectId, subjectCategories, openPipelineDetail, wonContractDetail, scope.mode);
```

- [ ] **Step 3: Type-check + verify live**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` (port 3005), open the dashboard, and in the browser devtools network tab inspect `GET /api/home/dashboard/topline?...`. Confirm the `revenue` card now carries a `wonDetail` object with non-negative `floor`/`ceiling`/`oppCount`/`accountCount`.
Expected: `wonDetail` present on the revenue card; floor/ceiling roughly match known won-contract totals for the FY.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/home/dashboard/topline/route.ts
git commit -m "feat(dashboard): query won-contract floor/ceiling for the range card"
```

---

## Task 5: `SchedDeliveredCard` component (range bar + motion popover)

**Files:**
- Create: `src/features/home/components/dashboard/SchedDeliveredCard.tsx`
- Test: `src/features/home/components/dashboard/__tests__/SchedDeliveredCard.test.tsx`

- [ ] **Step 1: Write the failing render test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SchedDeliveredCard from "../SchedDeliveredCard";

const base = {
  label: "Sched + Delivered",
  revenue: 748000,
  take: 224000,
  rank: 2,
  totalReps: 12,
  inRoster: true,
  revenueSegments: [{ key: "return" as const, label: "Return", value: 601000 }],
  takeSegments: [{ key: "return" as const, label: "Return", value: 180000 }],
  detail: { floor: 650000, ceiling: 1100000, oppCount: 8, accountCount: 6 },
  priorFyLabel: "FY26",
  currentFyLabel: "FY27",
};

describe("SchedDeliveredCard", () => {
  it("shows the revenue headline, the take + take-rate line, and the ceiling", () => {
    render(<SchedDeliveredCard {...base} />);
    expect(screen.getByText("$748K")).toBeInTheDocument();
    expect(screen.getByText("$224K")).toBeInTheDocument();
    expect(screen.getByText(/30% take rate/)).toBeInTheDocument();
    expect(screen.getByText(/Budget \$1\.1M/)).toBeInTheDocument();
  });

  it("renders an empty-range note when there are no won contracts", () => {
    render(<SchedDeliveredCard {...base} detail={{ floor: 0, ceiling: 0, oppCount: 0, accountCount: 0 }} />);
    expect(screen.getByText(/no won contracts/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/components/dashboard/__tests__/SchedDeliveredCard.test.tsx`
Expected: FAIL — cannot resolve `../SchedDeliveredCard`.

- [ ] **Step 3: Implement the component**

```tsx
// src/features/home/components/dashboard/SchedDeliveredCard.tsx
"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency, formatPercent } from "@/features/shared/lib/format";
import { computeRange, takeRate, mergeMotionRows, type MotionRow } from "@/features/home/lib/sched-delivered";
import type { ToplineSegment, WonContractDetail } from "@/features/home/lib/topline";
import { SEGMENT_COLORS, type SegmentKey } from "@/features/home/lib/segments";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import Sparkline from "./charts/Sparkline";
import SparklineLegend from "./charts/SparklineLegend";

// Range-bar palette (locked 2026-06-08). Take is a deeper plum slice that sits at
// the left of the revenue fill, since take ⊂ revenue.
const TRACK = "#EFEDF5";
const REV = "#6E5FB0";
const TAKE = "#3A2E73";
const FLOOR_MARK = "#1F1A33";
const OVERAGE = "#F37167";
const POP_WIDTH = 248;

interface SchedDeliveredCardProps {
  label: string;
  labelTooltip?: string;
  revenue: number;
  take: number;
  rank: number | null;
  totalReps: number;
  inRoster: boolean;
  revenueSegments: ToplineSegment[];
  takeSegments: ToplineSegment[];
  detail: WonContractDetail | null;
  sparkline?: SparklineData;
  priorFyLabel?: string;
  currentFyLabel?: string;
}

// The merged Sched + Delivered card: revenue headline, take + take-rate sub-line,
// a $0 → ceiling range bar (revenue fill, take slice, floor marker), the revenue
// sparkline, the revenue rank pill, and a hover/tap popover breaking revenue+take
// down by sales motion.
export default function SchedDeliveredCard({
  label, labelTooltip, revenue, take, rank, totalReps, inRoster,
  revenueSegments, takeSegments, detail, sparkline, priorFyLabel, currentFyLabel,
}: SchedDeliveredCardProps) {
  const yoyPct = sparkline?.yoy != null ? Math.round(sparkline.yoy * 100) : null;
  const rate = takeRate(revenue, take);
  const geo = computeRange({ revenue, take, floor: detail?.floor ?? 0, ceiling: detail?.ceiling ?? 0 });
  const motions = mergeMotionRows(revenueSegments, takeSegments);

  const hasSparkline = !!sparkline && sparkline.current.length >= 2;
  const hasPrior = !!sparkline?.prior.some((v) => v !== 0);
  const showLegend = hasSparkline && !!currentFyLabel;
  const sparklineTip = hasPrior
    ? `Your running revenue through the fiscal year — ${currentFyLabel} so far (solid, dot = today) vs the full ${priorFyLabel} for comparison (dashed).`
    : `Your running revenue through ${currentFyLabel} (the dot marks today).`;

  const takeLine = (
    <span className="whitespace-nowrap text-[11px] text-[#5C5378]">
      <span className="font-semibold text-[#403770]">{formatCurrency(take, true)}</span> take
      {rate != null && <span className="text-[#8A80A8]"> · {formatPercent(rate, 0)} take rate</span>}
    </span>
  );

  return (
    <StatCardShell
      label={label}
      labelTooltip={labelTooltip}
      value={formatCurrency(revenue, true)}
      deltaPct={yoyPct}
      priorFyLabel={priorFyLabel}
      minMaxLine={takeLine}
      footerLeft={hasSparkline ? (
        <>
          <Sparkline data={sparkline!.current} priorData={sparkline!.prior} todayIndex={sparkline!.todayIndex} width={140} height={32} />
          {showLegend && (
            <SparklineLegend currentFyLabel={currentFyLabel!} priorFyLabel={hasPrior ? priorFyLabel : undefined} tip={sparklineTip} />
          )}
        </>
      ) : null}
      footerRight={<RankPill rank={rank} totalReps={totalReps} inRoster={inRoster} />}
    >
      {geo.hasRange ? (
        <RangeBar geo={geo} ceiling={detail!.ceiling} floor={detail!.floor} motions={motions} totalRevenue={revenue} totalTake={take} />
      ) : (
        <p className="whitespace-nowrap text-[11px] text-[#8A80A8]">No won contracts yet this year.</p>
      )}
    </StatCardShell>
  );
}

// The $0 → ceiling bar plus the motion popover. Hover (mouse) / focus (keyboard) /
// tap (touch — CLAUDE.md: no hover on iOS) all reveal the breakdown, rendered in a
// portal so the dashboard's scroll/overflow containers don't clip it (same pattern
// as MetricLabel).
function RangeBar({
  geo, ceiling, floor, motions, totalRevenue, totalTake,
}: {
  geo: ReturnType<typeof computeRange>;
  ceiling: number;
  floor: number;
  motions: MotionRow[];
  totalRevenue: number;
  totalTake: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const show = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const center = r.left + r.width / 2;
      const left = Math.max(8, Math.min(center - POP_WIDTH / 2, window.innerWidth - POP_WIDTH - 8));
      setPos({ top: r.bottom + 8, left });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="Revenue and take by sales motion"
        aria-describedby={open ? tipId : undefined}
        className="relative mt-1 cursor-pointer focus:outline-none"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
      >
        <div className="relative h-[14px] rounded-full" style={{ background: TRACK }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${geo.revenuePct}%`, background: REV }} />
          <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${geo.takePct}%`, background: TAKE }} />
          <div className="absolute -inset-y-1 w-[2px]" style={{ left: `${geo.floorPct}%`, background: FLOOR_MARK }} />
          {geo.overage && <div className="absolute -inset-y-0.5 right-0 w-[3px] rounded" style={{ background: OVERAGE }} />}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-[#8A80A8]">
        <span className="whitespace-nowrap">$0</span>
        <span className="whitespace-nowrap">Budget {formatCurrency(ceiling, true)}</span>
      </div>
      <div className="whitespace-nowrap text-[10px] text-[#8A80A8]">
        Floor <span className="font-semibold text-[#403770]">{formatCurrency(floor, true)}</span>
      </div>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          id={tipId}
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: POP_WIDTH }}
          className="tooltip-enter z-30 rounded-lg bg-[#403770] p-3 text-white shadow-lg"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#C9C1E0]">By sales motion</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase text-[#A99FD0]">
                <th className="pb-1 text-left font-semibold">Motion</th>
                <th className="pb-1 text-right font-semibold">Rev</th>
                <th className="pb-1 text-right font-semibold">Take</th>
              </tr>
            </thead>
            <tbody>
              {motions.map((m) => (
                <tr key={m.key}>
                  <td className="py-0.5 text-left">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: SEGMENT_COLORS[m.key as SegmentKey] ?? "#fff" }} />
                    {m.label}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{formatCurrency(m.revenue, true)}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatCurrency(m.take, true)}
                    {m.rate != null && <span className="ml-1 text-[#A99FD0]">{formatPercent(m.rate, 0)}</span>}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#5A4F8A]">
                <td className="pt-1.5 text-left font-semibold">Total</td>
                <td className="pt-1.5 text-right font-semibold tabular-nums">{formatCurrency(totalRevenue, true)}</td>
                <td className="pt-1.5 text-right font-semibold tabular-nums">{formatCurrency(totalTake, true)}</td>
              </tr>
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/home/components/dashboard/__tests__/SchedDeliveredCard.test.tsx`
Expected: PASS (2 tests). If `$748K`/`$224K` assertions fail, confirm `formatCurrency(748000, true)` → `"$748K"` (it does per `format.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/SchedDeliveredCard.tsx src/features/home/components/dashboard/__tests__/SchedDeliveredCard.test.tsx
git commit -m "feat(dashboard): SchedDeliveredCard with floor→revenue→ceiling range bar"
```

---

## Task 6: Wire the merged card into `ToplineStatStrip`

Replace the two standalone `revenue` + `take` StatCards with one `SchedDeliveredCard`.
Final order: Targets · Bookings · Sched + Delivered · Open Pipeline.

**Files:**
- Modify: `src/features/home/components/dashboard/ToplineStatStrip.tsx`
- Test: `src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx`

- [ ] **Step 1: Update the test (skeleton count + merged-card render)**

In `ToplineStatStrip.test.tsx`:

Change the skeleton test from 4 to 3:

```ts
  it("shows three skeleton cards while loading", () => {
    mockUseTopline.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<ToplineStatStrip fy={2026} repScope="me" />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
```

Add a merged-card test:

```ts
  it("renders the merged Sched + Delivered card from the revenue + take cards", () => {
    mockUseTopline.mockReturnValue({
      data: {
        fy: 2026, schoolYr: "2025-26",
        cards: [
          { metricKey: "openPipeline", label: "Open Pipeline", value: 480000, rank: 3, totalReps: 12, inRoster: true, segments: [] },
          { metricKey: "bookings", label: "Closed Won Bookings", value: 612000, rank: 1, totalReps: 12, inRoster: true, segments: [] },
          { metricKey: "revenue", label: "Sched + Delivered Rev.", value: 748000, rank: 2, totalReps: 12, inRoster: true, segments: [{ key: "return", label: "Return", value: 601000 }], wonDetail: { floor: 650000, ceiling: 1100000, oppCount: 8, accountCount: 6 } },
          { metricKey: "take", label: "Sched + Delivered Take", value: 224000, rank: 4, totalReps: 12, inRoster: true, segments: [{ key: "return", label: "Return", value: 180000 }] },
        ],
      },
      isLoading: false, isError: false,
    });
    render(<ToplineStatStrip fy={2026} repScope="me" />);
    expect(screen.getByText("Sched + Delivered")).toBeInTheDocument();
    expect(screen.getByText("$748K")).toBeInTheDocument();
    expect(screen.getByText(/30% take rate/)).toBeInTheDocument();
    // The two standalone labels are gone.
    expect(screen.queryByText("Sched + Delivered Rev.")).not.toBeInTheDocument();
    expect(screen.queryByText("Sched + Delivered Take")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx`
Expected: FAIL — skeleton count is 4; "Sched + Delivered" not found; standalone labels still present.

- [ ] **Step 3: Rewrite `ToplineStatStrip.tsx`**

Replace the whole file with:

```tsx
"use client";

import { useTopline, useSparklines } from "@/features/home/lib/queries";
import type { ToplineCard, ToplineMetricKey } from "@/features/home/lib/topline";
import StatCard from "./StatCard";
import SchedDeliveredCard from "./SchedDeliveredCard";
import TargetsCard from "./TargetsCard";

// Plain-English metric definitions for the (i) tooltip — no formulas/IDs (reps,
// not engineers).
const METRIC_TOOLTIPS: Record<ToplineMetricKey, string> = {
  openPipeline:
    "Open opportunities you're actively working, by net booking value. Min commit and max budget are the contractual floor and ceiling across those deals.",
  bookings: "Closed-won bookings you've landed this fiscal year.",
  revenue: "Recognized revenue — delivered as customers use their sessions, plus what's scheduled but not yet delivered.",
  take: "Your margin contribution — the share of revenue left after delivery cost, delivered plus scheduled.",
};

const SCHED_DELIVERED_TOOLTIP =
  "Revenue delivered + scheduled against your won contracts, shown between the contracts' floor (min commitment) and budget ceiling. Take is your margin on that revenue. Headline revenue blends sessions + subscriptions, so the fill is approximate against the contract range.";

interface ToplineStatStripProps {
  fy: number;
  repScope: string;
}

export default function ToplineStatStrip({ fy, repScope }: ToplineStatStripProps) {
  const { data, isLoading, isError, refetch } = useTopline(fy, repScope);
  const { data: sparkData } = useSparklines(fy, repScope);
  const priorFyLabel = `FY${String(fy - 1).slice(-2)}`;
  const currentFyLabel = `FY${String(fy).slice(-2)}`;

  const byKey: Partial<Record<ToplineMetricKey, ToplineCard>> = data
    ? Object.fromEntries(data.cards.map((c) => [c.metricKey, c]))
    : {};

  // A plain financial card (bookings, open pipeline) wired to its sparkline/WoW.
  const financialCard = (card: ToplineCard) => (
    <StatCard
      key={card.metricKey}
      label={card.label}
      labelTooltip={METRIC_TOOLTIPS[card.metricKey]}
      value={card.value}
      rank={card.rank}
      totalReps={card.totalReps}
      inRoster={card.inRoster}
      segments={card.segments}
      sparkline={sparkData?.sparklines[card.metricKey]}
      priorFyLabel={priorFyLabel}
      currentFyLabel={currentFyLabel}
      wow={card.metricKey === "openPipeline" || card.metricKey === "bookings" ? sparkData?.wow?.[card.metricKey] : null}
      pipelineDetail={card.pipelineDetail}
    />
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Targets (card 1) owns its own query + loading/error state */}
      <TargetsCard fy={fy} repScope={repScope} />

      {isError ? (
        <div className="col-span-2 md:col-span-3 rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
          <p className="text-sm text-[#5C5378]">Couldn&apos;t load your topline metrics.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-[#F37167] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />
        ))
      ) : (
        <>
          {byKey.bookings && financialCard(byKey.bookings)}
          {byKey.revenue && byKey.take && (
            <SchedDeliveredCard
              label="Sched + Delivered"
              labelTooltip={SCHED_DELIVERED_TOOLTIP}
              revenue={byKey.revenue.value}
              take={byKey.take.value}
              rank={byKey.revenue.rank}
              totalReps={byKey.revenue.totalReps}
              inRoster={byKey.revenue.inRoster}
              revenueSegments={byKey.revenue.segments}
              takeSegments={byKey.take.segments}
              detail={byKey.revenue.wonDetail ?? null}
              sparkline={sparkData?.sparklines.revenue}
              priorFyLabel={priorFyLabel}
              currentFyLabel={currentFyLabel}
            />
          )}
          {byKey.openPipeline && financialCard(byKey.openPipeline)}
        </>
      )}
    </div>
  );
}
```

Note: the first existing test ("renders a card per metric…") passes only
`openPipeline` + `bookings` cards — with this guard the merged card simply doesn't
render there, and that test still asserts the two labels + `#3/12`, so it stays green.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx`
Expected: PASS (all cases, including the new merged-card test).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/features/home/components/dashboard/ToplineStatStrip.tsx src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx
git commit -m "feat(dashboard): render merged Sched + Delivered card in the topline strip"
```

---

## Task 7: Full-suite check + mobile / live verification

No new code — verify the whole feature end to end.

- [ ] **Step 1: Run the full dashboard test suite**

Run: `npm test -- src/features/home`
Expected: all green (new + existing).

- [ ] **Step 2: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Live desktop check**

Run `npm run dev` (port 3005). On the dashboard:
- Confirm the strip shows Targets · Bookings · **Sched + Delivered** · Open Pipeline.
- The range bar renders; floor marker sits between $0 and the ceiling; take slice is the darker leading portion.
- Hover the bar → the motion popover shows Rev + Take per motion and a Total.
- Toggle FY27/FY26 and Team/rep scope — values update and the bar re-scales.
- Force the empty state by selecting an FY/scope with no won contracts → "No won contracts yet this year." shows instead of the bar.

- [ ] **Step 4: Mobile check (CLAUDE.md requirement)**

In Safari Responsive Design Mode (then a real iPhone if available, `http://a-arcega.local:3005`):
- **Tap** the bar reveals the popover (no hover on touch); tapping again hides it.
- At narrow widths the card doesn't overflow — figures wrap/stay on one line via `whitespace-nowrap`, the bar stays full-width, and the popover clamps within the viewport (8px gutters).
- Smoke-test the Map tab once (shared touch-gesture system) after this layout change.

- [ ] **Step 5: Final commit (if any verification tweaks were needed)**

```bash
git add -A
git commit -m "fix(dashboard): Sched + Delivered card verification tweaks"
```

(Skip if Steps 1–4 needed no changes.)

---

## Self-Review Notes

- **Spec coverage:** won-contract floor/ceiling source (Task 4) ✓; range-fill $0→ceiling visual (Tasks 1, 5) ✓; merge Rev+Take into one card (Tasks 5, 6) ✓; revenue+take by motion tooltip (Tasks 2, 5) ✓; all five edge states — under-floor/mid/overage/zero-ceiling/floor>ceiling (Task 1 tests + Task 5 empty state) ✓; blended-revenue caveat (tooltip copy, Task 6) ✓; mobile tap tooltip + narrow width (Tasks 5, 7) ✓.
- **Type consistency:** `WonContractDetail` (`floor`/`ceiling`/`oppCount`/`accountCount`) is used identically in topline.ts, the route query alias, and the card props. `MotionRow`, `computeRange`, `takeRate`, `mergeMotionRows` signatures match across Tasks 1, 2, 5. `byKey.revenue.wonDetail` matches the field added in Task 3.
- **No placeholders:** every code/test step is complete and runnable.
