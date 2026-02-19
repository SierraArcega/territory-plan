# Focus Mode Overlays Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add floating translucent data cards that overlay the map during Focus Mode, showing Fullmind footprint, YoY performance, and FY trajectory for the plan's territory.

**Architecture:** A new API route `/api/focus-mode/[planId]` aggregates district-level Fullmind data by state (plan districts vs all state districts). A `FocusModeOverlay` component renders three floating cards positioned over the map area. Cards use Recharts BarChart for the YoY chart and Tailwind for the trajectory bars and footprint metrics. Each card is dismissable and collapsible.

**Tech Stack:** Next.js API route, Prisma aggregation, TanStack Query, Recharts BarChart, Tailwind CSS (backdrop-blur glass cards)

---

### Task 1: API route — Focus Mode data aggregation

**Files:**
- Create: `src/app/api/focus-mode/[planId]/route.ts`

**Step 1: Create the API route**

This route takes a plan ID and returns per-state aggregated Fullmind data for both the plan's districts and all districts in those states. Follow the pattern in `src/app/api/states/[code]/route.ts`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toNum(val: Decimal | null | undefined): number {
  return val != null ? Number(val) : 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const user = await getUser();

    // Fetch plan with its districts
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId, userId: user?.id },
      include: {
        districts: {
          select: { districtLeaid: true },
        },
        states: {
          select: { stateFips: true, stateAbbrev: true, stateName: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const planLeaids = plan.districts.map((d) => d.districtLeaid);
    const stateAbbrevs = plan.states.map((s) => s.stateAbbrev);

    // For each state, aggregate data for plan districts AND all state districts
    const stateData = await Promise.all(
      stateAbbrevs.map(async (abbrev) => {
        const stateName = plan.states.find((s) => s.stateAbbrev === abbrev)?.stateName || abbrev;

        // All districts in this state
        const [stateAgg, stateCustomerCount, statePipelineCount] = await Promise.all([
          prisma.district.aggregate({
            where: { stateAbbrev: abbrev },
            _count: { leaid: true },
            _sum: {
              enrollment: true,
              fy25ClosedWonNetBooking: true,
              fy25NetInvoicing: true,
              fy26ClosedWonNetBooking: true,
              fy26NetInvoicing: true,
              fy26OpenPipeline: true,
              fy27OpenPipeline: true,
            },
          }),
          prisma.district.count({
            where: { stateAbbrev: abbrev, isCustomer: true },
          }),
          prisma.district.count({
            where: { stateAbbrev: abbrev, hasOpenPipeline: true },
          }),
        ]);

        // Plan districts in this state only
        const planLeaidsInState = await prisma.district.findMany({
          where: { stateAbbrev: abbrev, leaid: { in: planLeaids } },
          select: { leaid: true },
        });
        const planLeaidList = planLeaidsInState.map((d) => d.leaid);

        const [planAgg, planCustomerCount] = planLeaidList.length > 0
          ? await Promise.all([
              prisma.district.aggregate({
                where: { leaid: { in: planLeaidList } },
                _sum: {
                  fy25ClosedWonNetBooking: true,
                  fy25NetInvoicing: true,
                  fy26ClosedWonNetBooking: true,
                  fy26NetInvoicing: true,
                  fy26OpenPipeline: true,
                  fy27OpenPipeline: true,
                },
              }),
              prisma.district.count({
                where: { leaid: { in: planLeaidList }, isCustomer: true },
              }),
            ])
          : [null, 0];

        // Top 3 plan districts by FY26 net invoicing
        const topDistricts = planLeaidList.length > 0
          ? await prisma.district.findMany({
              where: { leaid: { in: planLeaidList }, fy26NetInvoicing: { not: null } },
              orderBy: { fy26NetInvoicing: "desc" },
              take: 3,
              select: {
                leaid: true,
                name: true,
                fy26NetInvoicing: true,
              },
            })
          : [];

        return {
          abbrev,
          name: stateName,
          // Full state totals
          state: {
            totalDistricts: stateAgg._count.leaid,
            totalCustomers: stateCustomerCount,
            totalWithPipeline: statePipelineCount,
            fy25ClosedWon: toNum(stateAgg._sum.fy25ClosedWonNetBooking),
            fy25Invoicing: toNum(stateAgg._sum.fy25NetInvoicing),
            fy26ClosedWon: toNum(stateAgg._sum.fy26ClosedWonNetBooking),
            fy26Invoicing: toNum(stateAgg._sum.fy26NetInvoicing),
            fy26Pipeline: toNum(stateAgg._sum.fy26OpenPipeline),
            fy27Pipeline: toNum(stateAgg._sum.fy27OpenPipeline),
          },
          // Plan districts in this state
          plan: {
            districtCount: planLeaidList.length,
            customerCount: planCustomerCount,
            fy25ClosedWon: toNum(planAgg?._sum?.fy25ClosedWonNetBooking),
            fy25Invoicing: toNum(planAgg?._sum?.fy25NetInvoicing),
            fy26ClosedWon: toNum(planAgg?._sum?.fy26ClosedWonNetBooking),
            fy26Invoicing: toNum(planAgg?._sum?.fy26NetInvoicing),
            fy26Pipeline: toNum(planAgg?._sum?.fy26OpenPipeline),
            fy27Pipeline: toNum(planAgg?._sum?.fy27OpenPipeline),
          },
          topDistricts: topDistricts.map((d) => ({
            leaid: d.leaid,
            name: d.name,
            fy26Invoicing: toNum(d.fy26NetInvoicing),
          })),
        };
      })
    );

    return NextResponse.json({
      planId: plan.id,
      planName: plan.name ?? null,
      fiscalYear: plan.fiscalYear,
      states: stateData,
    });
  } catch (error) {
    console.error("Error fetching focus mode data:", error);
    return NextResponse.json(
      { error: "Failed to fetch focus mode data" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/focus-mode/[planId]/route.ts
git commit -m "feat(api): add focus-mode data aggregation endpoint"
```

---

### Task 2: TanStack Query hook + TypeScript types

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add types and hook**

Add these types and hook near the other territory plan types/hooks:

```typescript
// Focus Mode types
export interface FocusModeStateData {
  abbrev: string;
  name: string;
  state: {
    totalDistricts: number;
    totalCustomers: number;
    totalWithPipeline: number;
    fy25ClosedWon: number;
    fy25Invoicing: number;
    fy26ClosedWon: number;
    fy26Invoicing: number;
    fy26Pipeline: number;
    fy27Pipeline: number;
  };
  plan: {
    districtCount: number;
    customerCount: number;
    fy25ClosedWon: number;
    fy25Invoicing: number;
    fy26ClosedWon: number;
    fy26Invoicing: number;
    fy26Pipeline: number;
    fy27Pipeline: number;
  };
  topDistricts: Array<{
    leaid: string;
    name: string;
    fy26Invoicing: number;
  }>;
}

export interface FocusModeData {
  planId: string;
  planName: string | null;
  fiscalYear: number;
  states: FocusModeStateData[];
}

export function useFocusModeData(planId: string | null) {
  return useQuery({
    queryKey: ["focusMode", planId],
    queryFn: () => fetchJson<FocusModeData>(`${API_BASE}/focus-mode/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): add useFocusModeData hook and types"
```

---

### Task 3: Shared FocusCard wrapper component

**Files:**
- Create: `src/components/map-v2/focus-mode/FocusCard.tsx`

**Step 1: Create the reusable card wrapper**

This is the glass card shell shared by all three overlay cards — handles the translucent background, dismissing, and collapsing.

```typescript
"use client";

import { useState } from "react";

interface FocusCardProps {
  title: string;
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  defaultCollapsed?: boolean;
}

export default function FocusCard({
  title,
  children,
  onDismiss,
  className = "",
  defaultCollapsed = false,
}: FocusCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`
        bg-white/85 backdrop-blur-xl shadow-lg border border-white/50 rounded-2xl
        overflow-hidden transition-all duration-200
        ${className}
      `}
    >
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          >
            <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
        <button
          onClick={onDismiss}
          className="w-4 h-4 rounded-full hover:bg-gray-200/50 flex items-center justify-center transition-colors"
          aria-label="Dismiss"
        >
          <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
            <path d="M1 1L7 7M7 1L1 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content — collapsible */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/focus-mode/FocusCard.tsx
git commit -m "feat(focus-mode): add shared FocusCard glass wrapper component"
```

---

### Task 4: FY Trajectory Bar card (top right)

**Files:**
- Create: `src/components/map-v2/focus-mode/TrajectoryCard.tsx`

**Step 1: Create the trajectory card**

Shows plan districts' share within the full state total as horizontal proportion bars.

```typescript
"use client";

import FocusCard from "./FocusCard";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface TrajectoryCardProps {
  states: FocusModeStateData[];
  onDismiss: () => void;
}

export default function TrajectoryCard({ states, onDismiss }: TrajectoryCardProps) {
  // Aggregate across all plan states
  const totals = states.reduce(
    (acc, s) => ({
      stateFy26: acc.stateFy26 + s.state.fy26ClosedWon,
      planFy26: acc.planFy26 + s.plan.fy26ClosedWon,
      stateFy27Pipeline: acc.stateFy27Pipeline + s.state.fy27Pipeline,
      planFy27Pipeline: acc.planFy27Pipeline + s.plan.fy27Pipeline,
    }),
    { stateFy26: 0, planFy26: 0, stateFy27Pipeline: 0, planFy27Pipeline: 0 }
  );

  const fy26Pct = totals.stateFy26 > 0 ? (totals.planFy26 / totals.stateFy26) * 100 : 0;
  const fy27Pct = totals.stateFy27Pipeline > 0 ? (totals.planFy27Pipeline / totals.stateFy27Pipeline) * 100 : 0;

  return (
    <FocusCard title="FY Trajectory" onDismiss={onDismiss} className="w-[340px]">
      <div className="space-y-3">
        {/* FY26 Bookings */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-500">FY26 Bookings</span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatCurrency(totals.planFy26)}
              <span className="text-gray-300"> / {formatCurrency(totals.stateFy26)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-plum transition-all duration-500"
                style={{ width: `${Math.min(fy26Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-plum tabular-nums w-8 text-right">
              {Math.round(fy26Pct)}%
            </span>
          </div>
        </div>

        {/* FY27 Pipeline */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-500">FY27 Pipeline</span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatCurrency(totals.planFy27Pipeline)}
              <span className="text-gray-300"> / {formatCurrency(totals.stateFy27Pipeline)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-coral transition-all duration-500"
                style={{ width: `${Math.min(fy27Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-coral tabular-nums w-8 text-right">
              {Math.round(fy27Pct)}%
            </span>
          </div>
        </div>
      </div>
    </FocusCard>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/focus-mode/TrajectoryCard.tsx
git commit -m "feat(focus-mode): add FY Trajectory proportion bar card"
```

---

### Task 5: Fullmind Footprint card (bottom left, top)

**Files:**
- Create: `src/components/map-v2/focus-mode/FootprintCard.tsx`

**Step 1: Create the footprint card with state tabs**

```typescript
"use client";

import FocusCard from "./FocusCard";
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
}

export default function FootprintCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
}: FootprintCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  const penetration = data.state.totalDistricts > 0
    ? ((data.state.totalCustomers / data.state.totalDistricts) * 100).toFixed(0)
    : "0";

  return (
    <FocusCard title="Fullmind Footprint" onDismiss={onDismiss} className="w-[280px]">
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
                    ? "bg-plum text-white"
                    : "text-gray-400 hover:text-plum hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

        {/* Customers */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Customers</div>
          <div className="text-sm font-semibold text-gray-700">
            {data.state.totalCustomers}
            <span className="text-gray-400 font-normal text-xs"> of {data.state.totalDistricts} districts</span>
            <span className="ml-1.5 text-[10px] font-semibold text-plum">{penetration}%</span>
          </div>
        </div>

        {/* Open Pipeline */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Open Pipeline</div>
          <div className="text-sm font-semibold text-gray-700">
            {formatCurrency(data.state.fy26Pipeline + data.state.fy27Pipeline)}
            <span className="text-gray-400 font-normal text-xs ml-1">
              {data.state.totalWithPipeline} opps
            </span>
          </div>
        </div>

        {/* Top 3 Districts */}
        {data.topDistricts.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">
              Top Districts (FY26 Invoicing)
            </div>
            <div className="space-y-0.5">
              {data.topDistricts.map((d, i) => (
                <div key={d.leaid} className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] text-gray-300 w-3">{i + 1}</span>
                  <span className="text-gray-600 truncate flex-1">{d.name}</span>
                  <span className="text-gray-500 font-medium tabular-nums">
                    {formatCurrency(d.fy26Invoicing)}
                  </span>
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

**Step 2: Commit**

```bash
git add src/components/map-v2/focus-mode/FootprintCard.tsx
git commit -m "feat(focus-mode): add Fullmind Footprint card with state tabs"
```

---

### Task 6: YoY Performance chart card (bottom left, below footprint)

**Files:**
- Create: `src/components/map-v2/focus-mode/YoYCard.tsx`

**Step 1: Create the YoY grouped bar chart card**

Uses Recharts BarChart for the year-over-year comparison.

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import FocusCard from "./FocusCard";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface YoYCardProps {
  states: FocusModeStateData[];
  selectedState: string;
  onSelectState: (abbrev: string) => void;
  onDismiss: () => void;
}

export default function YoYCard({
  states,
  selectedState,
  onSelectState,
  onDismiss,
}: YoYCardProps) {
  const data = states.find((s) => s.abbrev === selectedState) || states[0];
  if (!data) return null;

  // Chart data: FY25 vs FY26, bookings vs invoicing (plan districts)
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
    <FocusCard title="YoY Performance" onDismiss={onDismiss} className="w-[280px]">
      <div className="space-y-2.5">
        {/* State selector tabs (synced with footprint) */}
        {states.length > 1 && (
          <div className="flex gap-0.5">
            {states.map((s) => (
              <button
                key={s.abbrev}
                onClick={() => onSelectState(s.abbrev)}
                className={`
                  px-2 py-1 text-[10px] font-semibold rounded-md transition-colors
                  ${selectedState === s.abbrev
                    ? "bg-plum text-white"
                    : "text-gray-400 hover:text-plum hover:bg-gray-50"
                  }
                `}
              >
                {s.abbrev}
              </button>
            ))}
          </div>
        )}

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
                }}
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => (value === "bookings" ? "Closed Won" : "Net Invoicing")}
              />
              <Bar dataKey="bookings" fill="#403770" radius={[3, 3, 0, 0]} />
              <Bar dataKey="invoicing" fill="#F37167" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </FocusCard>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/focus-mode/YoYCard.tsx
git commit -m "feat(focus-mode): add YoY Performance grouped bar chart card"
```

---

### Task 7: FocusModeOverlay container + wire into MapV2Shell

**Files:**
- Create: `src/components/map-v2/focus-mode/FocusModeOverlay.tsx`
- Modify: `src/components/map-v2/MapV2Shell.tsx`

**Step 1: Create the overlay container**

This component orchestrates all three cards, manages dismissed/selected state, and positions them over the map.

```typescript
"use client";

import { useState, useMemo } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useFocusModeData } from "@/lib/api";
import TrajectoryCard from "./TrajectoryCard";
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
      {/* Top right — FY Trajectory */}
      {!dismissed.has("trajectory") && (
        <div className="absolute top-4 right-4 z-[8]">
          <TrajectoryCard
            states={data.states}
            onDismiss={() => dismiss("trajectory")}
          />
        </div>
      )}

      {/* Bottom left — stacked: Footprint + YoY */}
      <div className="absolute bottom-4 left-[396px] z-[8] flex flex-col gap-2">
        {!dismissed.has("footprint") && (
          <FootprintCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("footprint")}
          />
        )}
        {!dismissed.has("yoy") && (
          <YoYCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("yoy")}
          />
        )}
      </div>
    </>
  );
}
```

Note: `left-[396px]` positions the bottom-left cards to the right of the floating panel (which is ~380px wide with some margin).

**Step 2: Add to MapV2Shell**

In `src/components/map-v2/MapV2Shell.tsx`, import and render the overlay:

Add import:
```typescript
import FocusModeOverlay from "./focus-mode/FocusModeOverlay";
```

Add the component between ExploreOverlay and MultiSelectChip:
```tsx
      {/* Focus Mode data overlay cards */}
      <FocusModeOverlay />
```

**Step 3: Commit**

```bash
git add src/components/map-v2/focus-mode/FocusModeOverlay.tsx src/components/map-v2/MapV2Shell.tsx
git commit -m "feat(focus-mode): wire FocusModeOverlay container into MapV2Shell"
```

---

### Task 8: Build verification and manual testing

**Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "route.test.ts"
```

Expected: no new errors (only pre-existing test file errors).

**Step 2: Run dev server and test**

```bash
npm run dev
```

Test:
1. Open a plan with districts in 1+ states
2. Click "Focus Map" — verify cards appear:
   - Top right: FY Trajectory with proportion bars
   - Bottom left: Fullmind Footprint with customer count, pipeline, top districts
   - Bottom left (below): YoY Performance with grouped bar chart
3. Test state tabs — switching in one card switches the other
4. Test dismiss (X) — card disappears
5. Test collapse (header click) — card collapses to title bar
6. Test Exit Focus — all cards disappear
7. Re-enter Focus — dismissed cards reappear (reset on new focus)

**Step 3: Commit any fixes**
