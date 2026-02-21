# Dynamic Focus Mode Visualization Cards — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the three focus mode overlay cards with Recharts area charts, animated counters, staggered entrance animations, and a cockpit-style corner layout — inspired by Uniswap's data-forward aesthetic, following Fullmind brand guide.

**Architecture:** Upgrade existing focus mode components in-place. Add an `AnimatedCard` wrapper for staggered entrance animations and a `useAnimatedNumber` hook for counting-up numbers. Replace `TrajectoryCard` with a new `RevenueTrendCard` featuring a Recharts AreaChart with gradient fill. Upgrade `FootprintCard` with animated counters and inline bars. Upgrade `YoYCard` with delta badges and corrected brand colors.

**Tech Stack:** React 19, Recharts 3.7.0 (existing), Tailwind CSS, CSS transitions, requestAnimationFrame

**Design doc:** `Docs/plans/2026-02-19-dynamic-focus-cards-design.md`

**Brand guide:** `Docs/fullmind-brand copy.md`

---

### Task 1: Create `useAnimatedNumber` hook

**Files:**
- Create: `src/hooks/useAnimatedNumber.ts`

**Step 1: Create the hook**

```ts
import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Starts after `delay` ms. Returns the current animated value.
 */
export function useAnimatedNumber(
  target: number,
  duration = 600,
  delay = 0
): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }

    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(Math.round(target * eased));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return current;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep useAnimatedNumber || echo "No errors"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useAnimatedNumber.ts
git commit -m "feat(focus-mode): add useAnimatedNumber hook for counting animations"
```

---

### Task 2: Create `AnimatedCard` entrance wrapper

**Files:**
- Create: `src/components/map-v2/focus-mode/AnimatedCard.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";

interface AnimatedCardProps {
  children: React.ReactNode;
  /** Delay before animation starts, in ms */
  delay?: number;
  /** Direction the card slides in from */
  from?: "left" | "right" | "bottom";
  className?: string;
}

export default function AnimatedCard({
  children,
  delay = 0,
  from = "right",
  className = "",
}: AnimatedCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const translate = {
    left: visible ? "translate-x-0" : "-translate-x-5",
    right: visible ? "translate-x-0" : "translate-x-5",
    bottom: visible ? "translate-y-0" : "translate-y-5",
  }[from];

  return (
    <div
      className={`
        transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]
        ${visible ? "opacity-100" : "opacity-0"}
        ${translate}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep AnimatedCard || echo "No errors"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/map-v2/focus-mode/AnimatedCard.tsx
git commit -m "feat(focus-mode): add AnimatedCard entrance animation wrapper"
```

---

### Task 3: Create `RevenueTrendCard` (replaces TrajectoryCard)

**Files:**
- Create: `src/components/map-v2/focus-mode/RevenueTrendCard.tsx`

This is the Uniswap-inspired card with an AreaChart gradient fill, headline number, and delta badge.

**Step 1: Create the component**

```tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import FocusCard from "./FocusCard";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface RevenueTrendCardProps {
  states: FocusModeStateData[];
  onDismiss: () => void;
  /** Delay before animated numbers start counting (ms) */
  animationDelay?: number;
}

export default function RevenueTrendCard({
  states,
  onDismiss,
  animationDelay = 0,
}: RevenueTrendCardProps) {
  // Aggregate across all plan states
  const totals = states.reduce(
    (acc, s) => ({
      fy25Invoicing: acc.fy25Invoicing + s.plan.fy25Invoicing,
      fy26Invoicing: acc.fy26Invoicing + s.plan.fy26Invoicing,
      stateFy26: acc.stateFy26 + s.state.fy26ClosedWon,
      planFy26: acc.planFy26 + s.plan.fy26ClosedWon,
      stateFy27Pipeline: acc.stateFy27Pipeline + s.state.fy27Pipeline,
      planFy27Pipeline: acc.planFy27Pipeline + s.plan.fy27Pipeline,
    }),
    {
      fy25Invoicing: 0,
      fy26Invoicing: 0,
      stateFy26: 0,
      planFy26: 0,
      stateFy27Pipeline: 0,
      planFy27Pipeline: 0,
    }
  );

  // YoY delta
  const delta =
    totals.fy25Invoicing > 0
      ? ((totals.fy26Invoicing - totals.fy25Invoicing) / totals.fy25Invoicing) * 100
      : 0;
  const isPositive = delta >= 0;

  // Animated headline number
  const animatedInvoicing = useAnimatedNumber(
    Math.round(totals.fy26Invoicing),
    600,
    animationDelay
  );

  // Chart data — one point per FY (extensible to more FYs later)
  const chartData = [
    { fy: "FY25", invoicing: totals.fy25Invoicing },
    { fy: "FY26", invoicing: totals.fy26Invoicing },
  ];

  // Bookings + pipeline ratios
  const fy26Pct =
    totals.stateFy26 > 0 ? (totals.planFy26 / totals.stateFy26) * 100 : 0;
  const fy27Pct =
    totals.stateFy27Pipeline > 0
      ? (totals.planFy27Pipeline / totals.stateFy27Pipeline) * 100
      : 0;

  return (
    <FocusCard title="Revenue Trend" onDismiss={onDismiss} className="w-[320px]">
      <div className="space-y-3">
        {/* Headline number + delta */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#403770] tabular-nums">
              {formatCurrency(animatedInvoicing)}
            </span>
            {totals.fy25Invoicing > 0 && (
              <span
                className={`
                  px-1.5 py-0.5 text-[10px] font-semibold rounded-full
                  ${isPositive
                    ? "bg-[#EDFFE3] text-[#5f665b]"
                    : "bg-[#F37167]/15 text-[#c25a52]"
                  }
                `}
              >
                {isPositive ? "+" : ""}{delta.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Net Invoicing · Plan Districts
          </div>
        </div>

        {/* Area Chart */}
        <div className="h-[120px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="plumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#403770" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#403770" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="fy"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Net Invoicing"]}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  background: "white",
                }}
              />
              <Area
                type="monotone"
                dataKey="invoicing"
                stroke="#403770"
                strokeWidth={2}
                fill="url(#plumGradient)"
                animationDuration={1000}
                animationBegin={Math.max(animationDelay, 500)}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Compact metric rows */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          {/* FY26 Bookings */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-500 w-20">FY26 Bookings</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#403770] transition-all duration-700"
                style={{ width: `${Math.min(fy26Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#403770] tabular-nums w-14 text-right">
              {formatCurrency(totals.planFy26)}
            </span>
          </div>
          {/* FY27 Pipeline */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-500 w-20">FY27 Pipeline</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#6EA3BE] transition-all duration-700"
                style={{ width: `${Math.min(fy27Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#6EA3BE] tabular-nums w-14 text-right">
              {formatCurrency(totals.planFy27Pipeline)}
            </span>
          </div>
        </div>
      </div>
    </FocusCard>
  );
}
```

**Notes:**
- Uses Steel Blue (`#6EA3BE`) for FY27 Pipeline bar instead of Coral (brand compliance — warm colors reserved for negative signals)
- AreaChart `animationBegin` delays so chart draws after card entrance
- `chartData` array is extensible — when more FY columns exist, just add entries
- Gradient fill via SVG `linearGradient` (Uniswap-style)

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep RevenueTrendCard || echo "No errors"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/map-v2/focus-mode/RevenueTrendCard.tsx
git commit -m "feat(focus-mode): add RevenueTrendCard with AreaChart and animated headline"
```

---

### Task 4: Upgrade `FootprintCard` with animated counters and inline bars

**Files:**
- Modify: `src/components/map-v2/focus-mode/FootprintCard.tsx`

**Step 1: Rewrite FootprintCard**

Replace the entire file content with:

```tsx
"use client";

import FocusCard from "./FocusCard";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface FootprintCardProps {
  states: FocusModeStateData[];
  selectedState: string;
  onSelectState: (abbrev: string) => void;
  onDismiss: () => void;
  /** Delay before animated numbers start counting (ms) */
  animationDelay?: number;
}

export default function FootprintCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
  animationDelay = 0,
}: FootprintCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  const penetration =
    data.state.totalDistricts > 0
      ? (data.state.totalCustomers / data.state.totalDistricts) * 100
      : 0;
  const pipeline = data.state.fy26Pipeline + data.state.fy27Pipeline;

  // Animated numbers
  const animatedCustomers = useAnimatedNumber(data.state.totalCustomers, 600, animationDelay);
  const animatedPipeline = useAnimatedNumber(Math.round(pipeline), 600, animationDelay + 100);

  // Max district invoicing for relative bar sizing
  const maxInvoicing = Math.max(...data.topDistricts.map((d) => d.fy26Invoicing), 1);

  return (
    <FocusCard title="Territory Footprint" onDismiss={onDismiss} className="w-[280px]">
      <div className="space-y-2.5">
        {/* State selector tabs */}
        {states.length > 1 && (
          <div className="flex gap-0.5">
            {states.map((s) => (
              <button
                key={s.abbrev}
                onClick={() => onSelectState(s.abbrev)}
                className={`
                  px-2 py-1 text-[10px] font-semibold rounded-md transition-colors
                  ${selectedState === s.abbrev
                    ? "bg-[#403770] text-white"
                    : "text-gray-400 hover:text-[#403770] hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

        {/* Customers — animated counter + penetration bar */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Customers
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#403770] tabular-nums">
              {animatedCustomers}
            </span>
            <span className="text-xs text-gray-400">
              of {data.state.totalDistricts}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#403770] transition-all duration-700"
                style={{ width: `${Math.min(penetration, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[#403770] tabular-nums">
              {penetration.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Pipeline — animated counter */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            Open Pipeline
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#403770] tabular-nums">
              {formatCurrency(animatedPipeline)}
            </span>
            <span className="text-xs text-gray-400">
              {data.state.totalWithPipeline} opps
            </span>
          </div>
        </div>

        {/* Top Districts — inline relative bars */}
        {data.topDistricts.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">
              Top Districts
            </div>
            <div className="space-y-1.5">
              {data.topDistricts.map((d, i) => (
                <div key={d.leaid}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-600 truncate flex-1 mr-2">
                      <span className="text-[10px] text-gray-300 mr-1">{i + 1}</span>
                      {d.name}
                    </span>
                    <span className="text-gray-500 font-medium tabular-nums text-[11px]">
                      {formatCurrency(d.fy26Invoicing)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#403770]/30 transition-all duration-700"
                      style={{
                        width: `${(d.fy26Invoicing / maxInvoicing) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FocusCard>
  );
}
```

**Key changes from original:**
- Added `animationDelay` prop
- Animated customer count and pipeline amount via `useAnimatedNumber`
- Penetration shown as horizontal bar fill (not just text)
- Top districts have relative-size inline bars
- Colors use hex literals for brand accuracy (Plum `#403770`)
- Larger, bolder headline numbers (`text-lg font-bold`)

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep FootprintCard || echo "No errors"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/map-v2/focus-mode/FootprintCard.tsx
git commit -m "feat(focus-mode): upgrade FootprintCard with animated counters and inline bars"
```

---

### Task 5: Upgrade `YoYCard` with delta badges and brand-correct colors

**Files:**
- Modify: `src/components/map-v2/focus-mode/YoYCard.tsx`

**Step 1: Rewrite YoYCard**

Replace the entire file content with:

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import FocusCard from "./FocusCard";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function DeltaBadge({ fy25, fy26 }: { fy25: number; fy26: number }) {
  if (fy25 === 0) return null;
  const diff = fy26 - fy25;
  const isPositive = diff >= 0;
  return (
    <span
      className={`
        px-1.5 py-0.5 text-[9px] font-semibold rounded-full
        ${isPositive
          ? "bg-[#EDFFE3] text-[#5f665b]"
          : "bg-[#F37167]/15 text-[#c25a52]"
        }
      `}
    >
      {isPositive ? "+" : ""}{formatCurrency(diff)}
    </span>
  );
}

interface YoYCardProps {
  states: FocusModeStateData[];
  selectedState: string;
  onSelectState: (abbrev: string) => void;
  onDismiss: () => void;
  /** Delay before chart animation starts (ms) */
  animationDelay?: number;
}

export default function YoYCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
  animationDelay = 0,
}: YoYCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  const chartData = [
    {
      name: "FY25",
      bookings: data.plan.fy25ClosedWon,
      invoicing: data.plan.fy25Invoicing,
    },
    {
      name: "FY26",
      bookings: data.plan.fy26ClosedWon,
      invoicing: data.plan.fy26Invoicing,
    },
  ];

  return (
    <FocusCard title="YoY Performance" onDismiss={onDismiss} className="w-[300px]">
      <div className="space-y-2.5">
        {/* State selector tabs */}
        {states.length > 1 && (
          <div className="flex gap-0.5">
            {states.map((s) => (
              <button
                key={s.abbrev}
                onClick={() => onSelectState(s.abbrev)}
                className={`
                  px-2 py-1 text-[10px] font-semibold rounded-md transition-colors
                  ${selectedState === s.abbrev
                    ? "bg-[#403770] text-white"
                    : "text-gray-400 hover:text-[#403770] hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

        {/* Delta badges */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Bookings</span>
          <DeltaBadge fy25={data.plan.fy25ClosedWon} fy26={data.plan.fy26ClosedWon} />
          <span className="text-[10px] text-gray-400 ml-1">Invoicing</span>
          <DeltaBadge fy25={data.plan.fy25Invoicing} fy26={data.plan.fy26Invoicing} />
        </div>

        {/* Recharts grouped bar chart */}
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="30%">
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(v)}
                width={45}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "bookings" ? "Closed Won" : "Net Invoicing",
                ]}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  background: "white",
                }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value: string) =>
                  value === "bookings" ? "Closed Won" : "Net Invoicing"
                }
              />
              <Bar
                dataKey="bookings"
                fill="#403770"
                radius={[3, 3, 0, 0]}
                animationDuration={800}
                animationBegin={Math.max(animationDelay, 500)}
              />
              <Bar
                dataKey="invoicing"
                fill="#6EA3BE"
                radius={[3, 3, 0, 0]}
                animationDuration={800}
                animationBegin={Math.max(animationDelay, 600)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </FocusCard>
  );
}
```

**Key changes from original:**
- `DeltaBadge` component shows `+$X` / `-$X` change between FY25 → FY26 for each series
- Invoicing bar color changed from Coral `#F37167` → Steel Blue `#6EA3BE` (brand compliance)
- Added `animationDelay` prop passed to bar `animationBegin`
- Width bumped from 280px to 300px (per design)
- `animationBegin` staggered between bars for visual cascade

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep YoYCard || echo "No errors"`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/map-v2/focus-mode/YoYCard.tsx
git commit -m "feat(focus-mode): upgrade YoYCard with delta badges and brand-correct colors"
```

---

### Task 6: Rewrite `FocusModeOverlay` with cockpit layout and AnimatedCard

**Files:**
- Modify: `src/components/map-v2/focus-mode/FocusModeOverlay.tsx`
- Delete: `src/components/map-v2/focus-mode/TrajectoryCard.tsx` (replaced by RevenueTrendCard)

**Step 1: Rewrite FocusModeOverlay**

Replace the entire file content with:

```tsx
"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useFocusModeData } from "@/lib/api";
import AnimatedCard from "./AnimatedCard";
import RevenueTrendCard from "./RevenueTrendCard";
import FootprintCard from "./FootprintCard";
import YoYCard from "./YoYCard";

export default function FocusModeOverlay() {
  const focusPlanId = useMapV2Store((s) => s.focusPlanId);
  const { data, isLoading } = useFocusModeData(focusPlanId);

  // Track which cards are dismissed
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // State selector (synced between footprint + yoy)
  const [selectedState, setSelectedState] = useState<string>("");

  // Set default selected state when data loads
  const defaultState = data?.states[0]?.abbrev || "";
  const activeState = selectedState || defaultState;

  // Reset dismissed cards when focus changes
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  if (focusPlanId !== lastPlanId) {
    setLastPlanId(focusPlanId);
    setDismissed(new Set());
    setSelectedState("");
  }

  if (!focusPlanId || !data || isLoading) return null;

  const dismiss = (card: string) => {
    setDismissed((prev) => new Set(prev).add(card));
  };

  return (
    <>
      {/* Top right — Revenue Trend (Uniswap-style area chart) */}
      {!dismissed.has("trend") && (
        <AnimatedCard
          from="right"
          delay={0}
          className="absolute top-4 right-4 z-[8]"
        >
          <RevenueTrendCard
            states={data.states}
            onDismiss={() => dismiss("trend")}
            animationDelay={600}
          />
        </AnimatedCard>
      )}

      {/* Bottom left — Territory Footprint */}
      {!dismissed.has("footprint") && (
        <AnimatedCard
          from="left"
          delay={150}
          className="absolute bottom-4 left-[396px] z-[8]"
        >
          <FootprintCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("footprint")}
            animationDelay={750}
          />
        </AnimatedCard>
      )}

      {/* Bottom right — YoY Performance */}
      {!dismissed.has("yoy") && (
        <AnimatedCard
          from="right"
          delay={300}
          className="absolute bottom-4 right-4 z-[8]"
        >
          <YoYCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("yoy")}
            animationDelay={800}
          />
        </AnimatedCard>
      )}
    </>
  );
}
```

**Key changes from original:**
- Cockpit layout: top-right, bottom-left, bottom-right
- Each card wrapped in `AnimatedCard` with staggered delays (0, 150, 300ms)
- `RevenueTrendCard` replaces `TrajectoryCard`
- No more stacked `flex-col` — cards spread to corners
- `animationDelay` passed to each card for internal chart/counter timing
- Dismissed keys updated: `"trajectory"` → `"trend"`

**Step 2: Delete old TrajectoryCard**

```bash
rm src/components/map-v2/focus-mode/TrajectoryCard.tsx
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (or only pre-existing unrelated errors)

**Step 4: Commit**

```bash
git add src/components/map-v2/focus-mode/FocusModeOverlay.tsx
git rm src/components/map-v2/focus-mode/TrajectoryCard.tsx
git commit -m "feat(focus-mode): cockpit layout with AnimatedCard and RevenueTrendCard"
```

---

### Task 7: Visual QA and polish

**Step 1: Start the dev server and test**

Run: `npm run dev`

Open the app, navigate to Map V2, open a territory plan, click "Focus Map". Verify:

- [ ] Three cards appear in corners (top-right, bottom-left, bottom-right)
- [ ] Cards stagger in from edges with smooth animation
- [ ] Revenue Trend card shows area chart with plum gradient fill
- [ ] Headline number counts up from 0
- [ ] Delta badge shows correct YoY % (green/mint if positive, coral if negative)
- [ ] FootprintCard customer count animates up, penetration bar fills
- [ ] Top districts have relative-size inline bars
- [ ] YoY bars are Plum + Steel Blue (not Coral)
- [ ] Delta badges show +/- dollar changes
- [ ] State selector tabs sync between Footprint and YoY
- [ ] Dismiss (X) and collapse (chevron) still work on all cards
- [ ] Cards don't overlap each other or the floating panel

**Step 2: Fix any visual issues found during QA**

Common adjustments:
- Chart margins/padding
- Animation timing (too fast/slow)
- Card widths on smaller viewports
- Z-index conflicts

**Step 3: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(focus-mode): visual polish for dynamic cards"
```
