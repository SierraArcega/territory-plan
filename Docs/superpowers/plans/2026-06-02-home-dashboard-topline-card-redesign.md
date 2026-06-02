# Topline Stat-Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the five topline cards onto one shared `StatCardShell` matching the prototype's unified layout, starting with the Phase-1 visual restyle (shared shell + rank pill + vertical segment legend) using only data we already fetch.

**Architecture:** Extract a presentational `StatCardShell` that owns the card chrome (header, value + delta chip, secondary-delta line, min/max slot, body slot, footer with sparkline + rank pill). Refactor the existing `StatCard` and `TargetsCard` to render their specifics into the shell. New leaf components: `RankPill`, `SegmentLegend`. New pure helper: `rankPercentile`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4, Vitest + Testing Library, Fullmind tokens (plum `#403770`, coral `#F37167`, steel `#6EA3BE`, golden `#FFCF70`; plum neutrals `#F7F5FA`/`#EFEDF5`/`#D4CFE2`), Lucide icons.

**Spec:** `Docs/superpowers/specs/2026-06-02-home-dashboard-topline-card-redesign-design.md`

**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/home-dashboard` (branch `worktree-home-dashboard`). Commit with `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`, plain messages, no model-id trailer. Verify: `npx vitest run src/features/home` and `npx tsc --noEmit 2>&1 | grep features/home`.

---

## File structure (Phase 1)

- Create `src/features/home/lib/rank-percentile.ts` — `rankPercentile(rank, totalReps)` pure helper.
- Create `src/features/home/lib/__tests__/rank-percentile.test.ts`.
- Create `src/features/home/components/dashboard/RankPill.tsx` — `#r/total · top X%` pill.
- Create `src/features/home/components/dashboard/__tests__/RankPill.test.tsx`.
- Create `src/features/home/components/dashboard/charts/SegmentLegend.tsx` — vertical `● name value %`.
- Create `src/features/home/components/dashboard/charts/__tests__/SegmentLegend.test.tsx`.
- Create `src/features/home/components/dashboard/StatCardShell.tsx` — shared chrome.
- Create `src/features/home/components/dashboard/__tests__/StatCardShell.test.tsx`.
- Modify `src/features/home/components/dashboard/StatCard.tsx` — render into the shell.
- Modify `src/features/home/components/dashboard/TargetsCard.tsx` — render into the shell.
- Tests for StatCard/TargetsCard already exist; extend, don't rewrite.

---

## Task 1: `rankPercentile` helper

**Files:**
- Create: `src/features/home/lib/rank-percentile.ts`
- Test: `src/features/home/lib/__tests__/rank-percentile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { rankPercentile } from "../rank-percentile";

describe("rankPercentile", () => {
  it("returns the rounded top percentile", () => {
    expect(rankPercentile(3, 12)).toBe(25); // 3/12 = 25%
    expect(rankPercentile(2, 39)).toBe(5);  // 2/39 = 5.1 → 5
    expect(rankPercentile(1, 39)).toBe(3);  // leader still computes (3%)
  });
  it("clamps to at least 1% and guards a zero/!finite total", () => {
    expect(rankPercentile(1, 1000)).toBe(1); // 0.1% rounds to 0 → clamp to 1
    expect(rankPercentile(5, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/lib/__tests__/rank-percentile.test.ts`
Expected: FAIL — `rankPercentile` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// Top-percentile for the rank pill: #3 of 12 → "top 25%". Rounds, but never
// shows "top 0%" for a real rank (clamps to 1). Returns 0 for an empty roster.
export function rankPercentile(rank: number, totalReps: number): number {
  if (!Number.isFinite(totalReps) || totalReps <= 0) return 0;
  const pct = Math.round((rank / totalReps) * 100);
  return Math.max(1, pct);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/lib/__tests__/rank-percentile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/lib/rank-percentile.ts src/features/home/lib/__tests__/rank-percentile.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add rankPercentile helper for the rank pill"
```

---

## Task 2: `RankPill` component

**Files:**
- Create: `src/features/home/components/dashboard/RankPill.tsx`
- Test: `src/features/home/components/dashboard/__tests__/RankPill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RankPill from "../RankPill";

describe("RankPill", () => {
  it("shows rank position and top percentile", () => {
    render(<RankPill rank={3} totalReps={12} inRoster />);
    expect(screen.getByText("#3/12")).toBeInTheDocument();
    expect(screen.getByText("top 25%")).toBeInTheDocument();
  });
  it("labels the leader instead of a percentile", () => {
    render(<RankPill rank={1} totalReps={39} inRoster />);
    expect(screen.getByText("#1/39")).toBeInTheDocument();
    expect(screen.getByText("leader")).toBeInTheDocument();
  });
  it("renders 'Not ranked' when out of roster", () => {
    render(<RankPill rank={0} totalReps={39} inRoster={false} />);
    expect(screen.getByText("Not ranked")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/RankPill.test.tsx`
Expected: FAIL — cannot find module `../RankPill`.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { rankPercentile } from "@/features/home/lib/rank-percentile";

interface RankPillProps {
  rank: number;
  totalReps: number;
  inRoster: boolean;
}

// Bottom-right standing pill: "#3/12 · top 25%". Leader (#1) gets the plum fill +
// golden accent; everyone else a subtle plum-neutral chip. Out-of-roster (the
// admin viewing her own dashboard) shows a muted "Not ranked".
export default function RankPill({ rank, totalReps, inRoster }: RankPillProps) {
  if (!inRoster) {
    return <span className="text-[11px] font-medium text-[#A69DC0] whitespace-nowrap">Not ranked</span>;
  }
  const isLeader = rank === 1;
  const pct = rankPercentile(rank, totalReps);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        isLeader ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#5C5378]"
      }`}
    >
      <span className="tabular-nums">#{rank}/{totalReps}</span>
      <span className={isLeader ? "text-[#FFCF70]" : "text-[#8A80A8]"}>
        {isLeader ? "leader" : `top ${pct}%`}
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/RankPill.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/RankPill.tsx src/features/home/components/dashboard/__tests__/RankPill.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add RankPill (#r/total · top X%) component"
```

---

## Task 3: `SegmentLegend` component

**Files:**
- Create: `src/features/home/components/dashboard/charts/SegmentLegend.tsx`
- Test: `src/features/home/components/dashboard/charts/__tests__/SegmentLegend.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SegmentLegend from "../SegmentLegend";

describe("SegmentLegend", () => {
  it("renders a row per segment with formatted value and rounded percent", () => {
    render(
      <SegmentLegend
        segments={[
          { key: "return", label: "Return", value: 280 },
          { key: "new", label: "New biz", value: 140 },
          { key: "winback", label: "Win-back", value: 60 },
        ]}
        format={(v) => `$${v}K`}
      />,
    );
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("$280K")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument(); // 280/480
    expect(screen.getByText("New biz")).toBeInTheDocument();
    expect(screen.getByText("13%")).toBeInTheDocument(); // 60/480
  });
  it("renders nothing when total is zero", () => {
    const { container } = render(<SegmentLegend segments={[]} format={(v) => `${v}`} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/charts/__tests__/SegmentLegend.test.tsx`
Expected: FAIL — cannot find module `../SegmentLegend`.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { SEGMENT_COLORS } from "@/features/home/lib/segments";
import type { Segment } from "./SegmentBar";

const colorFor = (key: string) => SEGMENT_COLORS[key as keyof typeof SEGMENT_COLORS] ?? "#8A80A8";

// Vertical source legend (● name … value %) for the unified stat cards. Pairs with
// SegmentBar (the bar stays; this replaces the bar's inline wrap legend on these
// cards). Percent is share of the segment total, rounded.
export default function SegmentLegend({
  segments,
  format,
}: {
  segments: Segment[];
  format: (value: number) => string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {segments.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-[11px] whitespace-nowrap">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: colorFor(s.key) }} />
          <span className="text-[#5C5378]">{s.label}</span>
          <span className="ml-auto font-bold text-[#403770] tabular-nums">{format(s.value)}</span>
          <span className="w-9 text-right text-[#8A80A8] tabular-nums">{Math.round((s.value / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/charts/__tests__/SegmentLegend.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/charts/SegmentLegend.tsx src/features/home/components/dashboard/charts/__tests__/SegmentLegend.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add vertical SegmentLegend for the unified cards"
```

---

## Task 4: `StatCardShell` (shared chrome)

**Files:**
- Create: `src/features/home/components/dashboard/StatCardShell.tsx`
- Test: `src/features/home/components/dashboard/__tests__/StatCardShell.test.tsx`

The shell renders: a header (label + decorative expand affordance — the `ArrowUpRight`
Lucide icon, inert until Phase 4), a value row (headline string + optional YoY delta
chip), an optional secondary-delta line (`vs {priorFyLabel} same day` + optional last-7d
mini chip), an optional `minMaxLine` node, a `children` body, and a footer (`footerLeft`
e.g. the sparkline, `footerRight` e.g. the rank pill). Delta chip color comes from the
existing `deltaColor` helper.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCardShell from "../StatCardShell";

describe("StatCardShell", () => {
  it("renders label, headline value, YoY chip, and the secondary 7d line", () => {
    render(
      <StatCardShell
        label="Open Pipeline"
        value="$840K"
        deltaPct={18}
        priorFyLabel="FY26"
        wowPct={4}
        footerRight={<span>rank</span>}
      >
        <div>body</div>
      </StatCardShell>,
    );
    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.getByText("$840K")).toBeInTheDocument();
    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByText(/vs FY26 same day/)).toBeInTheDocument();
    expect(screen.getByText(/\+4% · last 7d/)).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("rank")).toBeInTheDocument();
  });

  it("omits the delta chip and secondary line when no deltas are given", () => {
    render(<StatCardShell label="Targets" value="103"><div>b</div></StatCardShell>);
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.queryByText(/same day/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders the minMaxLine slot when provided", () => {
    render(
      <StatCardShell label="Open Pipeline" value="$840K" minMaxLine={<span>max budget $1.6M</span>}>
        <div>b</div>
      </StatCardShell>,
    );
    expect(screen.getByText("max budget $1.6M")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/StatCardShell.test.tsx`
Expected: FAIL — cannot find module `../StatCardShell`.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { deltaColor } from "@/features/home/lib/delta";

interface StatCardShellProps {
  label: string;
  value: string;                 // pre-formatted headline (currency or count)
  deltaPct?: number | null;      // YoY → chip beside the value
  priorFyLabel?: string;         // e.g. "FY26" for the secondary line
  wowPct?: number | null;        // last-7d → mini chip on the secondary line
  minMaxLine?: ReactNode;        // sub-label / max-budget (or status) line
  children?: ReactNode;          // card body (legend, bars, mini-rows)
  footerLeft?: ReactNode;        // sparkline + FY legend
  footerRight?: ReactNode;       // rank pill
}

// Shared chrome for every topline card (Targets + 4 financial). Card-specific
// content goes in the slots; the layout, spacing, and tokens live here so the five
// cards can't drift. The expand affordance is decorative in Phase 1 (wired to the
// detail modal in Phase 4).
export default function StatCardShell({
  label,
  value,
  deltaPct,
  priorFyLabel,
  wowPct,
  minMaxLine,
  children,
  footerLeft,
  footerRight,
}: StatCardShellProps) {
  const hasYoy = deltaPct != null;
  const hasWow = wowPct != null;
  // Secondary line appears whenever there's any delta. The "vs FY same day" text is
  // shown only when we know the prior-FY label; the last-7d mini stands alone otherwise.
  const showSecondary = hasYoy || hasWow;
  return (
    <div className="group relative flex min-w-[180px] flex-col gap-3 rounded-lg border border-[#D4CFE2] bg-white p-4 shadow-sm transition-colors hover:border-[#B8B0D0]">
      <span className="absolute right-3 top-3 text-[#C2BBD4]" aria-hidden="true">
        <ArrowUpRight size={15} />
      </span>

      <span className="pr-5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
        {label}
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#403770] tabular-nums whitespace-nowrap">{value}</span>
        {hasYoy && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap" style={{ color: deltaColor(deltaPct!) }}>
            {deltaPct! > 0 ? "+" : ""}{deltaPct}%
          </span>
        )}
      </div>

      {showSecondary && (
        <div className="-mt-1.5 flex items-center gap-1.5 text-[10px] text-[#A69DC0] whitespace-nowrap">
          {priorFyLabel && <span>vs {priorFyLabel} same day</span>}
          {hasWow && (
            <span className="font-semibold tabular-nums" style={{ color: deltaColor(wowPct!) }}>
              {wowPct! > 0 ? "+" : ""}{wowPct}% · last 7d
            </span>
          )}
        </div>
      )}

      {minMaxLine && (
        <div className="flex items-center justify-between gap-2 text-[10px] text-[#8A80A8] whitespace-nowrap">
          {minMaxLine}
        </div>
      )}

      {children}

      {(footerLeft || footerRight) && (
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-col gap-1">{footerLeft}</div>
          <div className="flex flex-col items-end">{footerRight}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/StatCardShell.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/dashboard/StatCardShell.tsx src/features/home/components/dashboard/__tests__/StatCardShell.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "feat(home): add StatCardShell shared card chrome"
```

---

## Task 5: Refactor `StatCard` onto the shell

`StatCard` keeps its exact props (no signature change — `ToplineStatStrip` still passes
`label, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel, wow,
pipelineDetail`). It now composes `StatCardShell` + `SegmentLegend` + `RankPill`, and
moves the open-pipeline min/max detail into the shell's `minMaxLine` slot. The headline
value stays `formatCurrency(value, true)` (Phase 1 keeps existing data; the min-commit
headline is Phase 2).

**Files:**
- Modify: `src/features/home/components/dashboard/StatCard.tsx`
- Modify: `src/features/home/components/dashboard/__tests__/StatCard.test.tsx`

- [ ] **Step 1: Update the test (add shell-driven expectations)**

Append these tests inside the existing `describe("StatCard", ...)` block in
`__tests__/StatCard.test.tsx`:

```tsx
  it("renders the rank pill via the shell", () => {
    render(<StatCard label="Open Pipeline" value={1200000} rank={3} totalReps={12} inRoster segments={[]} />);
    expect(screen.getByText("#3/12")).toBeInTheDocument();
    expect(screen.getByText("top 25%")).toBeInTheDocument();
  });

  it("renders a vertical segment legend with percents", () => {
    render(
      <StatCard
        label="Open Pipeline" value={480000} rank={3} totalReps={12} inRoster
        segments={[
          { key: "return", label: "Return", value: 280000 },
          { key: "new", label: "New biz", value: 140000 },
          { key: "winback", label: "Win-back", value: 60000 },
        ]}
      />,
    );
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
  });

  it("shows open-pipeline min commit / max budget on the min/max line", () => {
    render(
      <StatCard
        label="Open Pipeline" value={1200000} rank={3} totalReps={12} inRoster segments={[]}
        pipelineDetail={{ minCommit: 840000, maxBudget: 1600000, oppCount: 12, accountCount: 9 }}
      />,
    );
    expect(screen.getByText(/min commit/i)).toBeInTheDocument();
    expect(screen.getByText(/max budget/i)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // opp count retained
  });
```

Two existing assertions must change because the layout intentionally changed:
- The first test asserts `/of 34 reps/` — rank now renders as a pill. Replace with
  `expect(screen.getByText("#2/34")).toBeInTheDocument();`.
- The "renders the last-7d WoW chip" test asserts separate `+18%` and `7d` text. The
  shell now renders one combined span. Replace those two assertions with
  `expect(screen.getByText(/\+18% · last 7d/)).toBeInTheDocument();`. (This test passes
  no `priorFyLabel`; the secondary line still renders because `wow` is present.)

- [ ] **Step 2: Run tests to verify the new/updated ones fail**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/StatCard.test.tsx`
Expected: FAIL — `#3/12` not found / `of 34 reps` no longer rendered.

- [ ] **Step 3: Rewrite `StatCard.tsx` to compose the shell**

```tsx
"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { ToplineSegment, OpenPipelineDetail } from "@/features/home/lib/topline";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import SegmentLegend from "./charts/SegmentLegend";
import Sparkline from "./charts/Sparkline";

interface StatCardProps {
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
  sparkline?: SparklineData;
  priorFyLabel?: string;
  wow?: number | null;
  pipelineDetail?: OpenPipelineDetail;
}

// A topline financial card rendered through the shared StatCardShell: headline +
// YoY/WoW deltas, optional open-pipeline min/max line, vertical source legend,
// sparkline, and the rank pill.
export default function StatCard({
  label, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel, wow, pipelineDetail,
}: StatCardProps) {
  const yoyPct = sparkline?.yoy != null ? Math.round(sparkline.yoy * 100) : null;
  const wowPct = wow != null ? Math.round(wow * 100) : null;
  const detail = pipelineDetail && pipelineDetail.oppCount > 0 ? pipelineDetail : null;

  const minMaxLine = detail ? (
    <>
      <span>
        <span className="font-semibold text-[#5C5378]">{detail.oppCount}</span> open{" "}
        {detail.oppCount === 1 ? "opp" : "opps"}
        <span className="mx-1 text-[#D4CFE2]">·</span>
        <span className="font-semibold text-[#5C5378]">{detail.accountCount}</span>{" "}
        {detail.accountCount === 1 ? "account" : "accounts"}
      </span>
      <span>
        min commit <span className="font-semibold text-[#403770]">{formatCurrency(detail.minCommit, true)}</span>
        <span className="mx-1 text-[#D4CFE2]">·</span>
        max budget <span className="font-semibold text-[#403770]">{formatCurrency(detail.maxBudget, true)}</span>
      </span>
    </>
  ) : undefined;

  return (
    <StatCardShell
      label={label}
      value={formatCurrency(value, true)}
      deltaPct={yoyPct}
      priorFyLabel={priorFyLabel}
      wowPct={wowPct}
      minMaxLine={minMaxLine}
      footerLeft={sparkline && sparkline.current.length >= 2 ? (
        <Sparkline data={sparkline.current} priorData={sparkline.prior} width={140} height={32} />
      ) : null}
      footerRight={<RankPill rank={rank} totalReps={totalReps} inRoster={inRoster} />}
    >
      {segments.length > 0 && <SegmentLegend segments={segments} format={(v) => formatCurrency(v, true)} />}
    </StatCardShell>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/StatCard.test.tsx`
Expected: PASS. If a prior test still asserts `/vs FY25/` YoY chip text "+9%", it still
passes (chip renders `+9%`); the `/7d/` WoW test still passes (`+18% · last 7d`).

- [ ] **Step 5: Run the strip test + tsc, then commit**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/ToplineStatStrip.test.tsx`
Expected: PASS (the strip passes the same props; if it asserts "of N reps" update it to the pill text).
Run: `npx tsc --noEmit 2>&1 | grep "components/dashboard/StatCard" || echo clean`
Expected: clean.

```bash
git add src/features/home/components/dashboard/StatCard.tsx src/features/home/components/dashboard/__tests__/StatCard.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "refactor(home): render StatCard through StatCardShell + RankPill + SegmentLegend"
```

---

## Task 6: Refactor `TargetsCard` onto the shell

`TargetsCard` keeps its `fy` prop and `useTargets` query. It now renders through
`StatCardShell` with the worked-count as the headline (no deltas — the targets route
returns none), the segment **counts** via `SegmentLegend`, then keeps the
Targeted-vs-pipeline `$` bar and the Converted/Active mini-rows (`SubRow`) as the body,
and the `RankPill` in the footer-right. "capacity" is intentionally not shown.

**Files:**
- Modify: `src/features/home/components/dashboard/TargetsCard.tsx`
- Modify: `src/features/home/components/dashboard/__tests__/TargetsCard.test.tsx`

- [ ] **Step 1: Add a rank-pill expectation to the existing test**

In the first test ("renders the worked-district count…") add:

```tsx
    expect(screen.getByText("#3/12")).toBeInTheDocument();
    expect(screen.getByText("top 25%")).toBeInTheDocument();
```

(The first test's card mock already has `rank: 3, totalReps: 12, inRoster: true`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/TargetsCard.test.tsx`
Expected: FAIL — `#3/12` not found (rank pill not rendered yet).

- [ ] **Step 3: Rewrite `TargetsCard.tsx` to compose the shell**

Keep the existing `SubRow` function and the `SEGMENT_LABELS` constant unchanged. Replace
the outer card markup with the shell. Full file:

```tsx
"use client";

import { useTargets } from "@/features/home/lib/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import SegmentLegend from "./charts/SegmentLegend";
import type { Segment } from "./charts/SegmentBar";

interface TargetsCardProps {
  fy: number;
}

const SEGMENT_LABELS: { key: "new" | "winback" | "expansion"; label: string }[] = [
  { key: "new", label: "New biz" },
  { key: "winback", label: "Win-back" },
  { key: "expansion", label: "Expansion" },
];

export default function TargetsCard({ fy }: TargetsCardProps) {
  const { data, isLoading, isError } = useTargets(fy);

  if (isError) {
    return (
      <div className="rounded-lg bg-white border border-[#D4CFE2] shadow-sm p-4 text-sm text-[#5C5378]">
        Couldn&apos;t load targets.
      </div>
    );
  }
  if (isLoading || !data) {
    return <div className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />;
  }

  const card = data.card;
  const total = card.value;
  const convertedFrac = total > 0 ? card.convertedToPipeline / total : 0;
  const activeFrac = total > 0 ? card.active90 / total : 0;
  const untargetedFrac = total > 0 ? card.untargeted / total : 0;
  const coverageFrac = card.targetTotal > 0 ? card.pipelineOnAccounts / card.targetTotal : 0;
  const segments: Segment[] = SEGMENT_LABELS.map(({ key, label }) => ({
    key, label, value: card.segments[key],
  })).filter((s) => s.value > 0);

  return (
    <StatCardShell
      label="Targets"
      value={formatNumber(total)}
      minMaxLine={<span>districts being worked</span>}
      footerRight={<RankPill rank={card.rank} totalReps={card.totalReps} inRoster={card.inRoster} />}
    >
      {segments.length > 0 && <SegmentLegend segments={segments} format={formatNumber} />}

      {card.targetTotal > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] whitespace-nowrap">
            <span className="text-[#5C5378]">Targeted vs pipeline</span>
            <span className="text-[#8A80A8] tabular-nums">{formatPercent(coverageFrac, 0)} covered</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFEDF5]">
            <div style={{ width: `${Math.min(100, coverageFrac * 100)}%` }} className="h-full rounded-full bg-[#6EA3BE]" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#8A80A8] tabular-nums whitespace-nowrap">
            <span><span className="font-semibold text-[#403770]">{formatCurrency(card.targetTotal, true)}</span> targeted</span>
            <span><span className="font-semibold text-[#6EA3BE]">{formatCurrency(card.pipelineOnAccounts, true)}</span> pipeline</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-1">
        <SubRow label="Converted to pipeline" num={card.convertedToPipeline} total={total} frac={convertedFrac} color="#403770" />
        <SubRow label="Active · 90d" num={card.active90} total={total} frac={activeFrac} color="#6BA368" stale={card.stale} />
        <SubRow label="No targets set" num={card.untargeted} total={total} frac={untargetedFrac} color="#C2BBD4" />
      </div>
    </StatCardShell>
  );
}

function SubRow({
  label, num, total, frac, color, stale,
}: {
  label: string; num: number; total: number; frac: number; color: string; stale?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] whitespace-nowrap">
        <span className="text-[#5C5378]">{label}</span>
        <span className="text-[#8A80A8] tabular-nums">
          <span className="font-semibold text-[#403770]">{formatNumber(num)}</span> / {formatNumber(total)}{" "}
          ({formatPercent(frac, 0)})
          {stale != null && stale > 0 && (
            <span className="ml-1.5 text-[#C77] font-medium">· {formatNumber(stale)} stale</span>
          )}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#EFEDF5]">
        <div style={{ width: `${Math.min(100, frac * 100)}%`, backgroundColor: color }} className="h-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/home/components/dashboard/__tests__/TargetsCard.test.tsx`
Expected: PASS (all existing assertions + the new `#3/12` / `top 25%`). The
"districts being worked" text now lives in the min/max line — still found by getByText.

- [ ] **Step 5: Full suite + tsc, then commit**

Run: `npx vitest run src/features/home src/app/api/home`
Expected: all green.
Run: `npx tsc --noEmit 2>&1 | grep -E "features/home" || echo clean`
Expected: clean.

```bash
git add src/features/home/components/dashboard/TargetsCard.tsx src/features/home/components/dashboard/__tests__/TargetsCard.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" commit -m "refactor(home): render TargetsCard through StatCardShell"
```

---

## Phase 1 done-check

- All `src/features/home` + `src/app/api/home` Vitest green; `tsc` clean on home files.
- On :3020 (Home → Dashboard, FY27), the five cards share the new chrome: rank pill
  bottom-right, vertical segment legend, expand affordance top-right (inert), Targets
  keeps its $ bar + mini-rows. Verify narrow-width (drag the window): text spans are
  `whitespace-nowrap`; legend rows don't wrap mid-token.

---

## Roadmap: Phases 2–4 (separate plans)

Each phase gets its own bite-sized plan (own spec section already written) when reached:

- **Phase 2 — New card data.** Add to the topline route/builder: open-pipeline
  **min-commit headline** (use `OpenPipelineDetail.minCommit` as the headline; max budget
  on the min/max line), **bookings ceiling** (`bookings + Σ open-opp maximum_budget`), and
  **Rev/Take delivered headline + delivered-vs-scheduled `StatusBar`** (DOA
  `completed_*`/`scheduled_*`). New `charts/StatusBar.tsx` + pure `statusFractions` helper.
  Route + builder tests; verify sums vs blended headline caveat with a temp diagnostic.
- **Phase 3 — Tooltips.** `MetricLabel.tsx` (`(i)` trigger, hover/focus/tap popover),
  plain-English copy per metric (no formulas/IDs), wired into `StatCardShell`'s label slot.
- **Phase 4 — Detail modal.** Extract `Modal.tsx` primitive (backdrop/Escape/click-outside/
  focus/scroll-lock) and refactor `RankTrajectoryModal` + pipeline `StageDealsModal` onto it.
  New `GET /api/home/dashboard/deals?fy=&metric=` (caller-scoped: pipeline open opps,
  bookings closed-won, rev/take per-account **won-only** utilization with derived
  `deferred = max(0, minCommit − revenue)` and `utilPct = revenue / maxBudget`).
  `DealDetailModal.tsx` (filter pills + totals footer + CSV export reusing the rank-modal
  helper). Wire `StatCardShell`'s expand affordance + whole-card click to open it.
