# Leaderboard: Remove Tier Badges + Dynamic FY Checkboxes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove tier badge UI from all leaderboard views and replace FY dropdowns with dynamic, relative-label checkboxes (Previous/Current/Next) backed by prior-FY data from the API.

**Architecture:** Three-layer change — (1) API adds prior-FY pipeline/targeted data to the response, (2) types updated to carry the new fields, (3) frontend components stripped of tier badges and FY dropdowns replaced with checkbox groups. The API already dynamically computes fiscal years from the current date, so the frontend labels auto-roll each year.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, TanStack Query, Tailwind 4, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/leaderboard/route.ts` | Modify | Add prior-FY pipeline/targeted data to response |
| `src/features/leaderboard/lib/types.ts` | Modify | Add `pipelinePriorFY`, `targetedPriorFY` to `LeaderboardEntry` |
| `src/features/leaderboard/lib/queries.ts` | Modify | Add `priorFY` to `LeaderboardFiscalYears`, prior-FY fields to `teamTotals` |
| `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Modify | Replace FYSelect with FYCheckboxGroup + toast |
| `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` | Modify | Remove TierBadge, use neutral styling |
| `src/features/leaderboard/components/LeaderboardModal.tsx` | Modify | Remove tier grouping, flat ranked list |
| `src/features/leaderboard/components/LeaderboardDetailView.tsx` | Modify | Remove tier column |

---

### Task 1: Add Prior-FY Data to API Response

**Files:**
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Add `pipelinePriorFY` to per-user actuals extraction**

In the `repActuals` mapping (around line 76-84), add prior-FY pipeline alongside existing fields:

```typescript
return {
  userId: score.userId,
  pipeline: yearActuals.get(pipelineSchoolYr)?.openPipeline ?? 0,
  pipelineCurrentFY: yearActuals.get(defaultSchoolYr)?.openPipeline ?? 0,
  pipelineNextFY: yearActuals.get(nextFYSchoolYr)?.openPipeline ?? 0,
  pipelinePriorFY: yearActuals.get(priorSchoolYr)?.openPipeline ?? 0,
  take: yearActuals.get(takeSchoolYr)?.totalTake ?? 0,
  revenue: yearActuals.get(revenueSchoolYr)?.totalRevenue ?? 0,
  priorYearRevenue: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
};
```

Also update the catch fallback (around line 86) to include `pipelinePriorFY: 0`.

- [ ] **Step 2: Add prior-FY targeted districts query**

Add `priorFYInt` alongside existing `currentFYInt` and `nextFYInt` (around line 173):

```typescript
const priorFYInt = currentFY - 1;
```

Expand the `Promise.all` (around line 183-198) to include a third query:

```typescript
const [targetedPriorFYDistricts, targetedCurrentFYDistricts, targetedNextFYDistricts] = await Promise.all([
  prisma.territoryPlanDistrict.findMany({
    where: { plan: { ...ownerFilter, fiscalYear: priorFYInt } },
    select: {
      renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
      plan: { select: { ownerId: true, userId: true } },
    },
  }),
  prisma.territoryPlanDistrict.findMany({
    where: { plan: { ...ownerFilter, fiscalYear: currentFYInt } },
    select: {
      renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
      plan: { select: { ownerId: true, userId: true } },
    },
  }),
  prisma.territoryPlanDistrict.findMany({
    where: { plan: { ...ownerFilter, fiscalYear: nextFYInt } },
    select: {
      renewalTarget: true, winbackTarget: true, expansionTarget: true, newBusinessTarget: true,
      plan: { select: { ownerId: true, userId: true } },
    },
  }),
]);
```

Add after the existing `sumTargets` calls (around line 211-212):

```typescript
const targetedPriorFYByUser = sumTargets(targetedPriorFYDistricts);
```

- [ ] **Step 3: Wire prior-FY fields into entry response and team totals**

In the entry return object (around line 277-296), add:

```typescript
pipelinePriorFY: actuals.pipelinePriorFY,
targetedPriorFY: targetedPriorFYByUser.get(score.userId) ?? 0,
```

In `sumActuals` calls for `teamTotals` (around line 315-332), add:

```typescript
pipelinePriorFY: sumActuals(repActuals, "pipelinePriorFY"),
unassignedPipelinePriorFY: sumActuals(adminActuals, "pipelinePriorFY"),
targetedPriorFY: sumTargetedMap(targetedPriorFYByUser, userIds),
unassignedTargetedPriorFY: sumTargetedMap(targetedPriorFYByUser, adminUserIds),
```

Update `sumActuals` type parameter (around line 302-305) to include `"pipelinePriorFY"`:

```typescript
const sumActuals = (
  pool: typeof repActuals,
  key: "revenue" | "priorYearRevenue" | "pipelineCurrentFY" | "pipelineNextFY" | "pipelinePriorFY",
): number => pool.reduce((acc, a) => acc + (a[key] ?? 0), 0);
```

In the `fiscalYears` response object (around line 352-355), add `priorFY`:

```typescript
fiscalYears: {
  priorFY: priorSchoolYr,
  currentFY: defaultSchoolYr,
  nextFY: nextFYSchoolYr,
},
```

- [ ] **Step 4: Verify API compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "leaderboard/route" | head -20`
Expected: No errors from `route.ts` (there may be pre-existing errors in other files).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leaderboard/route.ts
git commit -m "feat(leaderboard): add prior-FY pipeline and targeted data to API response"
```

---

### Task 2: Update TypeScript Types and Query Interfaces

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts`
- Modify: `src/features/leaderboard/lib/queries.ts`

- [ ] **Step 1: Add prior-FY fields to LeaderboardEntry**

In `src/features/leaderboard/lib/types.ts`, add two fields to the `LeaderboardEntry` interface (after line 52, alongside existing `pipelineNextFY`):

```typescript
export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalPoints: number;
  tier: TierRank;
  rank: number;
  take: number;
  pipeline: number;
  pipelinePriorFY: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  revenue: number;
  priorYearRevenue: number;
  revenueTargeted: number;
  targetedPriorFY: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  combinedScore: number;
  initiativeScore: number;
  pointBreakdown: PointBreakdownItem[];
}
```

- [ ] **Step 2: Add priorFY to LeaderboardFiscalYears and teamTotals**

In `src/features/leaderboard/lib/queries.ts`, update:

```typescript
export interface LeaderboardFiscalYears {
  priorFY: string;
  currentFY: string;
  nextFY: string;
}
```

Add prior-FY fields to the `teamTotals` type (around line 22-37):

```typescript
teamTotals?: {
  revenue: number;
  priorYearRevenue: number;
  unassignedRevenue: number;
  unassignedPriorYearRevenue: number;

  pipelinePriorFY: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  unassignedPipelinePriorFY: number;
  unassignedPipelineCurrentFY: number;
  unassignedPipelineNextFY: number;

  targetedPriorFY: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  unassignedTargetedPriorFY: number;
  unassignedTargetedCurrentFY: number;
  unassignedTargetedNextFY: number;
};
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "leaderboard" | head -20`
Expected: No new errors from leaderboard files.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/lib/types.ts src/features/leaderboard/lib/queries.ts
git commit -m "feat(leaderboard): add prior-FY fields to entry and query types"
```

---

### Task 3: Replace FY Dropdowns with Checkbox Groups

**Files:**
- Modify: `src/features/leaderboard/components/RevenueOverviewTab.tsx`

- [ ] **Step 1: Replace FYSelection type and helper functions**

Replace the entire top section of the file (lines 1-31) with:

```typescript
"use client";

import { useState, useMemo, useCallback } from "react";
import { Check } from "lucide-react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn, RevenueTableTotals } from "./RevenueTable";
import { useLeaderboard } from "../lib/queries";
import type { LeaderboardEntry } from "../lib/types";

interface FYChecked {
  prior: boolean;
  current: boolean;
  next: boolean;
}

const DEFAULT_FY_CHECKED: FYChecked = { prior: false, current: true, next: true };

/** Convert school year "2025-26" to display "FY26" */
function formatFYLabel(schoolYr: string): string {
  const parts = schoolYr.split("-");
  return `FY${parts[1] ?? schoolYr}`;
}

/** Sum the checked FY values for pipeline */
function getPipelineValue(entry: LeaderboardEntry, checked: FYChecked): number {
  let sum = 0;
  if (checked.prior) sum += entry.pipelinePriorFY;
  if (checked.current) sum += entry.pipelineCurrentFY;
  if (checked.next) sum += entry.pipelineNextFY;
  return sum;
}

/** Sum the checked FY values for targeted */
function getTargetedValue(entry: LeaderboardEntry, checked: FYChecked): number {
  let sum = 0;
  if (checked.prior) sum += entry.targetedPriorFY;
  if (checked.current) sum += entry.targetedCurrentFY;
  if (checked.next) sum += entry.targetedNextFY;
  return sum;
}

/** Count how many FYs are checked */
function checkedCount(fy: FYChecked): number {
  return (fy.prior ? 1 : 0) + (fy.current ? 1 : 0) + (fy.next ? 1 : 0);
}
```

- [ ] **Step 2: Update component state and projections**

Replace the component function (from `export default function RevenueOverviewTab()` through the end of the file) with:

```typescript
export default function RevenueOverviewTab() {
  const [pipelineFY, setPipelineFY] = useState<FYChecked>({ ...DEFAULT_FY_CHECKED });
  const [targetedFY, setTargetedFY] = useState<FYChecked>({ ...DEFAULT_FY_CHECKED });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data: leaderboard, isLoading } = useLeaderboard();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const handleToggle = useCallback(
    (
      current: FYChecked,
      setter: (fy: FYChecked) => void,
      key: keyof FYChecked
    ) => {
      if (current[key] && checkedCount(current) === 1) {
        showToast("At least one fiscal year must be selected");
        return;
      }
      setter({ ...current, [key]: !current[key] });
    },
    [showToast]
  );

  // Project entries with computed pipeline/targeted values based on FY selection
  const projectedEntries = useMemo(() => {
    return (leaderboard?.entries ?? []).map((entry) => ({
      ...entry,
      pipeline: getPipelineValue(entry, pipelineFY),
      revenueTargeted: getTargetedValue(entry, targetedFY),
    }));
  }, [leaderboard?.entries, pipelineFY, targetedFY]);

  const projectedTotals = useMemo<RevenueTableTotals | undefined>(() => {
    const t = leaderboard?.teamTotals;
    if (!t) return undefined;

    const sumFY = (
      prior: number,
      current: number,
      next: number,
      checked: FYChecked
    ): number => {
      let sum = 0;
      if (checked.prior) sum += prior;
      if (checked.current) sum += current;
      if (checked.next) sum += next;
      return sum;
    };

    return {
      revenue: t.revenue,
      priorYearRevenue: t.priorYearRevenue,
      pipeline: sumFY(t.pipelinePriorFY, t.pipelineCurrentFY, t.pipelineNextFY, pipelineFY),
      revenueTargeted: sumFY(t.targetedPriorFY, t.targetedCurrentFY, t.targetedNextFY, targetedFY),
      unassignedRevenue: t.unassignedRevenue,
      unassignedPriorYearRevenue: t.unassignedPriorYearRevenue,
      unassignedPipeline: sumFY(
        t.unassignedPipelinePriorFY,
        t.unassignedPipelineCurrentFY,
        t.unassignedPipelineNextFY,
        pipelineFY
      ),
      unassignedRevenueTargeted: sumFY(
        t.unassignedTargetedPriorFY,
        t.unassignedTargetedCurrentFY,
        t.unassignedTargetedNextFY,
        targetedFY
      ),
    };
  }, [leaderboard?.teamTotals, pipelineFY, targetedFY]);

  const sortedEntries = useMemo(() => {
    return [...projectedEntries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [projectedEntries, sortColumn, sortDirection]);

  const handleSort = (column: RevenueSortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fy = leaderboard?.fiscalYears;

  const fyOptions: { key: keyof FYChecked; label: string; fyLabel: string }[] = fy
    ? [
        { key: "prior", label: "Previous", fyLabel: formatFYLabel(fy.priorFY) },
        { key: "current", label: "Current", fyLabel: formatFYLabel(fy.currentFY) },
        { key: "next", label: "Next", fyLabel: formatFYLabel(fy.nextFY) },
      ]
    : [];

  return (
    <div className="relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-[#403770] text-white text-xs font-medium rounded-lg shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* FY checkbox selectors */}
      {fy && (
        <div className="flex flex-col gap-2 px-4 py-2.5 bg-[#F7F5FA] border-b border-[#EFEDF5]">
          <FYCheckboxGroup
            label="Pipeline"
            options={fyOptions}
            checked={pipelineFY}
            onToggle={(key) => handleToggle(pipelineFY, setPipelineFY, key)}
          />
          <FYCheckboxGroup
            label="Targeted"
            options={fyOptions}
            checked={targetedFY}
            onToggle={(key) => handleToggle(targetedFY, setTargetedFY, key)}
          />
        </div>
      )}

      <RevenuePodium entries={sortedEntries} />
      <RevenueTable
        entries={sortedEntries}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        teamTotals={projectedTotals}
      />
    </div>
  );
}

function FYCheckboxGroup({
  label,
  options,
  checked,
  onToggle,
}: {
  label: string;
  options: { key: keyof FYChecked; label: string; fyLabel: string }[];
  checked: FYChecked;
  onToggle: (key: keyof FYChecked) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] w-16">
        {label}:
      </span>
      <div className="flex items-center gap-2.5">
        {options.map((opt) => {
          const isChecked = checked[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onToggle(opt.key)}
              className="flex items-center gap-1.5 group"
            >
              <div
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-[#403770] border-[#403770]"
                    : "bg-white border-[#D4CFE2] group-hover:border-[#403770]"
                }`}
              >
                {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs font-medium text-[#403770]">
                {opt.label}
              </span>
              <span className="text-[10px] text-[#8A80A8]">
                ({opt.fyLabel})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "RevenueOverviewTab" | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/RevenueOverviewTab.tsx
git commit -m "feat(leaderboard): replace FY dropdowns with dynamic checkbox groups"
```

---

### Task 4: Remove Tier Badge from LeaderboardHomeWidget

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardHomeWidget.tsx`

- [ ] **Step 1: Remove tier imports and use neutral styling**

Replace imports (lines 5-7):

```typescript
// Remove these:
// import TierBadge from "./TierBadge";
// import { parseTierRank, TIER_COLORS } from "../lib/types";
```

Remove tier color logic (lines 42-44):

```typescript
// Remove these:
// const tierRank = data.tier ?? "freshman";
// const { tier } = parseTierRank(tierRank);
// const colors = TIER_COLORS[tier];
```

Replace the style prop on the container div (around line 71-75) — swap `colors.bg` and `colors.glow` for static neutral values:

```typescript
style={{
  backgroundColor: "#F7F5FA",
  boxShadow: isHovered ? "0 0 20px rgba(138,128,168,0.3)" : "0 0 0 transparent",
  transform: rankChanged ? "scale(1.02)" : "scale(1)",
}}
```

Update the shimmer overlay gradient (around line 82):

```typescript
background: `linear-gradient(90deg, transparent, rgba(138,128,168,0.3), transparent)`,
```

- [ ] **Step 2: Replace tier badge row with rank-only display**

Replace the "Top row: tier badge + rank" section (lines 88-92):

```tsx
{/* Rank display */}
<div className="flex items-center justify-between mb-2">
  <span className="text-lg font-bold text-[#403770]">#{data.rank}</span>
  <span className="text-xs font-medium text-[#8A80A8]">
    {data.totalPoints} pts
  </span>
</div>
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "LeaderboardHomeWidget" | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardHomeWidget.tsx
git commit -m "fix(leaderboard): remove tier badge from home widget, use neutral styling"
```

---

### Task 5: Remove Tier Grouping from LeaderboardModal

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardModal.tsx`

- [ ] **Step 1: Remove tier-related imports and helpers**

Update the imports (lines 7-9). Remove `TierBadge` import and unused tier type imports:

```typescript
// Remove:
// import TierBadge from "./TierBadge";
// Remove from types import: parseTierRank, TIER_LABELS, TIERS, TIER_COLORS, TierName
// Keep:
import type { LeaderboardView, LeaderboardEntry } from "../lib/types";
```

Remove the `getTierForEntry` helper function (lines 115-117).

Remove `tierThresholdMap` construction (lines 119-124).

- [ ] **Step 2: Replace tier-grouped initiative list with flat ranked list**

Replace the entire initiative content section (lines 272-481 — the `{[...TIERS].reverse().map((tierKey) => { ... })}` block) with a flat list:

```tsx
<div className="divide-y divide-[#E2DEEC]">
  {rankedEntries.map((entry) => {
    const isExpanded = expandedUser === entry.userId;
    const isMe = myRank?.userId === entry.userId;

    return (
      <div key={entry.userId}>
        {/* Main row */}
        <button
          onClick={() =>
            setExpandedUser(isExpanded ? null : entry.userId)
          }
          className={`w-full flex items-center gap-3 px-6 py-3 transition-colors text-left ${
            isMe
              ? "bg-[#C4E7E6]/20 border-l-3 border-l-[#C4E7E6]"
              : "hover:bg-[#FAFAFA]"
          }`}
        >
          <span className="w-8 text-sm font-bold text-[#403770] text-right">
            #{entry.displayRank}
          </span>

          {entry.avatarUrl ? (
            <img
              src={entry.avatarUrl}
              alt={entry.fullName}
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#F37167] flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {entry.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            </div>
          )}

          <span className="flex-1 text-sm font-medium text-[#403770] truncate">
            {entry.fullName}
            {isMe && (
              <span className="ml-1.5 text-[10px] font-semibold text-[#6EA3BE]">You</span>
            )}
          </span>

          <span className="w-20 text-right text-sm font-semibold text-[#403770]">
            {getScore(entry)}
          </span>

          <ChevronDown
            className={`w-4 h-4 text-[#A69DC0] transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Expanded breakdown — same as before */}
        {isExpanded && (
          <div className="px-6 pb-3 pt-0">
            <div className="ml-11 rounded-xl bg-[#F7F5FA] p-4">
              {view === "initiative" ? (
                <div className="space-y-2">
                  {(entry.pointBreakdown ?? []).map((b) => {
                    const isRevenue = b.action === "revenue_targeted";
                    const revenueDollars = isRevenue ? b.count * 10000 : 0;

                    return (
                      <div
                        key={b.action}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-[#403770]/10 flex items-center justify-center">
                            <Target className="w-3.5 h-3.5 text-[#403770]" />
                          </div>
                          <div>
                            <span className="text-xs font-medium text-[#403770]">
                              {b.label}
                            </span>
                            {isRevenue ? (
                              <span className="text-[10px] text-[#8A80A8] ml-1.5">
                                {formatCurrency(revenueDollars)} targeted ÷ $10K = {b.count} units x {b.pointValue} pts
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#8A80A8] ml-1.5">
                                {b.count} x {b.pointValue} pts
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[#403770]">
                          {b.total} pts
                        </span>
                      </div>
                    );
                  })}
                  <div className="pt-2 mt-1 border-t border-[#E2DEEC] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#403770]">
                      Total Initiative Points
                    </span>
                    <span className="text-sm font-bold text-[#403770]">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <ScoreRow
                    icon={Target}
                    label="Initiative Points"
                    value={`${entry.totalPoints} pts`}
                    weight={weights.initiative}
                    color="#403770"
                  />
                  <ScoreRow
                    icon={TrendingUp}
                    label={`Pipeline (${fyLabels.pipeline})`}
                    value={formatCurrency(entry.pipeline)}
                    weight={weights.pipeline}
                    color="#6EA3BE"
                  />
                  <ScoreRow
                    icon={DollarSign}
                    label={`Take (${fyLabels.take})`}
                    value={formatCurrency(entry.take)}
                    weight={weights.take}
                    color="#69B34A"
                  />
                  <ScoreRow
                    icon={Trophy}
                    label={`Revenue (${fyLabels.revenue})`}
                    value={formatCurrency(entry.revenue)}
                    weight={weights.revenue}
                    color="#D4A843"
                  />
                  {weights.revenueTargeted > 0 && (
                    <ScoreRow
                      icon={Target}
                      label={`Targeted (${fyLabels.revenueTargeted})`}
                      value={formatCurrency(entry.revenueTargeted)}
                      weight={weights.revenueTargeted}
                      color="#F37167"
                    />
                  )}
                  <div className="col-span-2 pt-2 mt-1 border-t border-[#E2DEEC]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#403770]">
                        Combined Score
                      </span>
                      <span className="text-sm font-bold text-[#403770]">
                        {entry.combinedScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 3: Verify component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "LeaderboardModal" | head -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardModal.tsx
git commit -m "fix(leaderboard): remove tier grouping from modal, flat ranked list"
```

---

### Task 6: Remove Tier Column from LeaderboardDetailView

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardDetailView.tsx`

- [ ] **Step 1: Remove tier imports**

Update line 6 — remove tier-related imports:

```typescript
// Remove:
// import { TIER_LABELS, TIER_COLORS, parseTierRank } from "../lib/types";
// import TierBadge from "./TierBadge";
// import type { TierName } from "../lib/types";
```

- [ ] **Step 2: Remove tier column header**

Remove the `<th>` for "Tier" (lines 83-85):

```tsx
// Remove:
// <th className="text-center px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide w-28">
//   Tier
// </th>
```

- [ ] **Step 3: Remove tier column cell and unused variables**

Remove the tier parsing and colors (lines 102-103):

```typescript
// Remove:
// const tierKey = parseTierRank(entry.tier).tier;
// const colors = TIER_COLORS[tierKey];
```

Remove the `<td>` for TierBadge (lines 156-158):

```tsx
// Remove:
// <td className="px-4 py-3 text-center">
//   <TierBadge tierRank={entry.tier} size="sm" />
// </td>
```

Update the `colSpan` in the expanded detail row (line 182) — decrease by 1 since the tier column is gone:

```tsx
<td colSpan={2 + data.metrics.length + 1} className="px-6 py-4">
```

- [ ] **Step 4: Verify component compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "LeaderboardDetailView" | head -10`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardDetailView.tsx
git commit -m "fix(leaderboard): remove tier column from detail view"
```

---

### Task 7: Update Existing Test + Manual Verification

**Files:**
- Modify: `src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx` (check if it references tier)
- Modify: `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx` (check if mock data needs prior-FY fields)

- [ ] **Step 1: Update test mock data to include prior-FY fields**

Check the existing test files. The mock `LeaderboardEntry` objects in tests need `pipelinePriorFY` and `targetedPriorFY` fields added. In each test file, find the mock entry objects and add:

```typescript
pipelinePriorFY: 0,
targetedPriorFY: 0,
```

alongside the existing `pipelineCurrentFY`, `pipelineNextFY`, `targetedCurrentFY`, `targetedNextFY` fields.

- [ ] **Step 2: Run all leaderboard tests**

Run: `npx vitest run --reporter verbose src/features/leaderboard/ 2>&1`
Expected: All tests pass.

- [ ] **Step 3: Run type check on full project**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No new errors introduced.

- [ ] **Step 4: Commit test updates**

```bash
git add src/features/leaderboard/components/__tests__/
git commit -m "test(leaderboard): update mock data with prior-FY fields"
```

- [ ] **Step 5: Manual verification checklist**

Start dev server: `npm run dev`

Verify in browser:
1. **Leaderboard modal** — no tier badges, no tier dividers, flat ranked list
2. **Revenue Overview tab** — checkbox groups instead of dropdowns, defaults to Current + Next checked
3. **Uncheck last checkbox** — re-checks it + shows "At least one fiscal year must be selected" toast for ~2s
4. **Previous checkbox** — checking it adds prior-FY data to pipeline/targeted columns
5. **Profile sidebar widget** — no "Freshman" badge, shows rank and points only
6. **Detail view** — no tier column in the table
7. **FY labels** — show dynamic values from API (e.g., "Previous (FY25)", "Current (FY26)", "Next (FY27)")
