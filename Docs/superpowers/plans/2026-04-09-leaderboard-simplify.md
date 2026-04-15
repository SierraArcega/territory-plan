# Leaderboard Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-tab points-driven leaderboard with a 2-tab structure — Revenue Overview (default, money-based with top-3 podium) and Initiative (existing points system).

**Architecture:** Refactor `LeaderboardModal` in-place to use a 2-tab layout. Create three new components: `RevenueOverviewTab`, `RevenuePodium`, and `RevenueTable`. Add `priorYearRevenue` to the API response. The Initiative tab nests all existing sub-views.

**Tech Stack:** React 19, TypeScript, Tailwind 4, TanStack Query, Next.js App Router, Prisma, Lucide icons

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/features/leaderboard/components/RevenuePodium.tsx` | Top-3 gold/silver/bronze cards |
| Create | `src/features/leaderboard/components/RevenueTable.tsx` | Sortable 4-column revenue table |
| Create | `src/features/leaderboard/components/RevenueOverviewTab.tsx` | Orchestrates podium + table, manages sort state |
| Create | `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx` | Table sorting, column rendering, currency formatting |
| Create | `src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx` | Podium rendering, correct rank ordering |
| Modify | `src/features/leaderboard/lib/types.ts` | Add `priorYearRevenue` to `LeaderboardEntry` |
| Modify | `src/features/leaderboard/lib/queries.ts` | Add `LeaderboardResponse` export (already exists, just needs export keyword) |
| Modify | `src/app/api/leaderboard/route.ts:46-79` | Fetch prior-year actuals, add `priorYearRevenue` to response |
| Modify | `src/features/leaderboard/components/LeaderboardModal.tsx:30-41,195-232` | Replace 6-tab with 2-tab structure |
| Modify | `src/features/leaderboard/components/LeaderboardDetailView.tsx` | Same 2-tab restructure for the detail page |

---

### Task 1: Add `priorYearRevenue` to types and API

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts:42-56`
- Modify: `src/app/api/leaderboard/route.ts:46-79,229-244`

- [ ] **Step 1: Add `priorYearRevenue` to `LeaderboardEntry` type**

In `src/features/leaderboard/lib/types.ts`, add the new field to the `LeaderboardEntry` interface after `revenue`:

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
  revenue: number;
  priorYearRevenue: number;
  revenueTargeted: number;
  combinedScore: number;
  initiativeScore: number;
  pointBreakdown: PointBreakdownItem[];
}
```

- [ ] **Step 2: Modify API to fetch prior-year actuals**

In `src/app/api/leaderboard/route.ts`, after the `defaultSchoolYr` calculation (line 48), compute the prior year school year and add it to the unique years:

```typescript
    // After line 48: const defaultSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
    const priorFY = currentFY - 1;
    const priorSchoolYr = `${priorFY - 1}-${String(priorFY).slice(-2)}`;

    const pipelineSchoolYr = initiative.pipelineFiscalYear ?? defaultSchoolYr;
    const takeSchoolYr = initiative.takeFiscalYear ?? defaultSchoolYr;
    const revenueSchoolYr = initiative.revenueFiscalYear ?? defaultSchoolYr;

    const uniqueYears = [...new Set([pipelineSchoolYr, takeSchoolYr, revenueSchoolYr, priorSchoolYr])];
```

- [ ] **Step 3: Add `priorYearRevenue` to each entry in the response**

In the `repActuals` mapping (around line 69-74), add the prior year revenue:

```typescript
          return {
            userId: score.userId,
            pipeline: yearActuals.get(pipelineSchoolYr)?.openPipeline ?? 0,
            take: yearActuals.get(takeSchoolYr)?.totalTake ?? 0,
            revenue: yearActuals.get(revenueSchoolYr)?.totalRevenue ?? 0,
            priorYearRevenue: yearActuals.get(priorSchoolYr)?.totalRevenue ?? 0,
          };
```

Update the fallback (line 76):
```typescript
          return { userId: score.userId, take: 0, pipeline: 0, revenue: 0, priorYearRevenue: 0 };
```

In the entry building (around line 229-244), add `priorYearRevenue` to the returned entry:

```typescript
      return {
        userId: score.userId,
        fullName: score.user.fullName ?? "Unknown",
        avatarUrl: score.user.avatarUrl,
        totalPoints: score.totalPoints,
        tier,
        rank: index + 1,
        take: actuals.take,
        pipeline: actuals.pipeline,
        revenue: actuals.revenue,
        priorYearRevenue: actuals.priorYearRevenue,
        revenueTargeted: revenueTargetedByUser.get(score.userId) ?? 0,
        combinedScore: Math.round(combinedScore * 10) / 10,
        initiativeScore: Math.round(initiativeScore * 10) / 10,
        pointBreakdown,
      };
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors related to `priorYearRevenue`

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/types.ts src/app/api/leaderboard/route.ts
git commit -m "feat(leaderboard): add priorYearRevenue to API response and types"
```

---

### Task 2: Create `RevenuePodium` component with tests

**Files:**
- Create: `src/features/leaderboard/components/RevenuePodium.tsx`
- Create: `src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx`

- [ ] **Step 1: Write failing tests for RevenuePodium**

Create `src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RevenuePodium from "../RevenuePodium";
import type { LeaderboardEntry } from "../../lib/types";

const makeEntry = (overrides: Partial<LeaderboardEntry> & { fullName: string; revenue: number }): LeaderboardEntry => ({
  userId: crypto.randomUUID(),
  avatarUrl: null,
  totalPoints: 0,
  tier: "freshman",
  rank: 1,
  take: 0,
  pipeline: 0,
  priorYearRevenue: 0,
  revenueTargeted: 0,
  combinedScore: 0,
  initiativeScore: 0,
  pointBreakdown: [],
  ...overrides,
});

describe("RevenuePodium", () => {
  it("renders top 3 entries in 2-1-3 visual order", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 900000, rank: 1 }),
      makeEntry({ fullName: "Bob", revenue: 700000, rank: 2 }),
      makeEntry({ fullName: "Carol", revenue: 500000, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();

    // Rank labels
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders currency values", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 961964, rank: 1 }),
      makeEntry({ fullName: "Bob", revenue: 795726, rank: 2 }),
      makeEntry({ fullName: "Carol", revenue: 578543, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("$961,964")).toBeInTheDocument();
    expect(screen.getByText("$795,726")).toBeInTheDocument();
    expect(screen.getByText("$578,543")).toBeInTheDocument();
  });

  it("renders nothing when fewer than 3 entries", () => {
    const entries = [
      makeEntry({ fullName: "Alice", revenue: 900000, rank: 1 }),
    ];

    const { container } = render(<RevenuePodium entries={entries} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows initials when no avatar", () => {
    const entries = [
      makeEntry({ fullName: "Monica Sherwood", revenue: 900000, rank: 1 }),
      makeEntry({ fullName: "Mike O'Donnell", revenue: 700000, rank: 2 }),
      makeEntry({ fullName: "Kris Tedesco", revenue: 500000, rank: 3 }),
    ];

    render(<RevenuePodium entries={entries} />);

    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(screen.getByText("MO")).toBeInTheDocument();
    expect(screen.getByText("KT")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx 2>&1 | tail -20`
Expected: FAIL — cannot find module `../RevenuePodium`

- [ ] **Step 3: Implement RevenuePodium**

Create `src/features/leaderboard/components/RevenuePodium.tsx`:

```tsx
"use client";

import type { LeaderboardEntry } from "../lib/types";

interface RevenuePodiumProps {
  entries: LeaderboardEntry[];
}

function formatRevenue(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

const PODIUM_STYLES = {
  first: {
    bg: "bg-gradient-to-br from-[#FFF9E6] to-[#FFF3CC]",
    border: "border-[#F0D060]",
    shadow: "shadow-[0_4px_16px_rgba(240,208,96,0.25)]",
    avatarBg: "bg-[#B8860B]",
    rankColor: "text-[#B8860B]",
    lift: "-translate-y-3",
  },
  second: {
    bg: "bg-gradient-to-br from-[#F5F5F7] to-[#E8E8EC]",
    border: "border-[#C0C0C8]",
    shadow: "",
    avatarBg: "bg-[#808088]",
    rankColor: "text-[#808088]",
    lift: "",
  },
  third: {
    bg: "bg-gradient-to-br from-[#FDF5EE] to-[#F8E8D4]",
    border: "border-[#D4A574]",
    shadow: "",
    avatarBg: "bg-[#A0724E]",
    rankColor: "text-[#A0724E]",
    lift: "",
  },
} as const;

export default function RevenuePodium({ entries }: RevenuePodiumProps) {
  if (entries.length < 3) return null;

  const [first, second, third] = entries;

  // Render order: 2nd, 1st, 3rd (visual podium layout)
  const podiumOrder = [
    { entry: second, place: "second" as const },
    { entry: first, place: "first" as const },
    { entry: third, place: "third" as const },
  ];

  return (
    <div className="flex justify-center items-end gap-5 py-8 px-10">
      {podiumOrder.map(({ entry, place }) => {
        const style = PODIUM_STYLES[place];
        return (
          <div
            key={entry.userId}
            className={`flex flex-col items-center px-4 pt-5 pb-4 rounded-xl border w-[200px] transition-transform ${style.bg} ${style.border} ${style.shadow} ${style.lift}`}
          >
            <span className={`text-[13px] font-bold mb-2 ${style.rankColor}`}>
              #{entry.rank}
            </span>
            {entry.avatarUrl ? (
              <img
                src={entry.avatarUrl}
                alt={entry.fullName}
                className="w-12 h-12 rounded-full object-cover mb-2"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${style.avatarBg}`}
              >
                <span className="text-lg font-bold text-white">
                  {getInitials(entry.fullName)}
                </span>
              </div>
            )}
            <span className="text-sm font-semibold text-[#2D2440] text-center mb-1">
              {entry.fullName}
            </span>
            <span className="text-lg font-bold text-[#5B2E91]">
              {formatRevenue(entry.revenue)}
            </span>
            <span className="text-[11px] text-[#8A849A] uppercase tracking-wider mt-0.5">
              Current Year
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx 2>&1 | tail -20`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/RevenuePodium.tsx src/features/leaderboard/components/__tests__/RevenuePodium.test.tsx
git commit -m "feat(leaderboard): add RevenuePodium component with top-3 display"
```

---

### Task 3: Create `RevenueTable` component with tests

**Files:**
- Create: `src/features/leaderboard/components/RevenueTable.tsx`
- Create: `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`

- [ ] **Step 1: Write failing tests for RevenueTable**

Create `src/features/leaderboard/components/__tests__/RevenueTable.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import RevenueTable from "../RevenueTable";
import type { LeaderboardEntry } from "../../lib/types";

const makeEntry = (overrides: Partial<LeaderboardEntry> & { fullName: string }): LeaderboardEntry => ({
  userId: crypto.randomUUID(),
  avatarUrl: null,
  totalPoints: 0,
  tier: "freshman",
  rank: 1,
  take: 0,
  pipeline: 0,
  revenue: 0,
  priorYearRevenue: 0,
  revenueTargeted: 0,
  combinedScore: 0,
  initiativeScore: 0,
  pointBreakdown: [],
  ...overrides,
});

const entries = [
  makeEntry({ fullName: "Alice", revenue: 900000, priorYearRevenue: 1200000, pipeline: 500000, revenueTargeted: 300000, rank: 1 }),
  makeEntry({ fullName: "Bob", revenue: 700000, priorYearRevenue: 800000, pipeline: 300000, revenueTargeted: 200000, rank: 2 }),
  makeEntry({ fullName: "Carol", revenue: 500000, priorYearRevenue: 600000, pipeline: 100000, revenueTargeted: 100000, rank: 3 }),
];

describe("RevenueTable", () => {
  it("renders all entries with rank, name, and 4 money columns", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();

    // Check column headers
    expect(screen.getByText("Current Revenue")).toBeInTheDocument();
    expect(screen.getByText("Prior Year Closed")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Targeted")).toBeInTheDocument();
  });

  it("calls onSort when clicking a column header", async () => {
    const onSort = vi.fn();
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={onSort} />);

    await userEvent.click(screen.getByText("Pipeline"));
    expect(onSort).toHaveBeenCalledWith("pipeline");
  });

  it("highlights the active sort column", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    const header = screen.getByText("Current Revenue");
    expect(header.closest("th")).toHaveClass("text-[#5B2E91]");
  });

  it("formats currency values with commas", () => {
    render(<RevenueTable entries={entries} sortColumn="revenue" sortDirection="desc" onSort={vi.fn()} />);

    expect(screen.getByText("$900,000")).toBeInTheDocument();
    expect(screen.getByText("$1,200,000")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/leaderboard/components/__tests__/RevenueTable.test.tsx 2>&1 | tail -20`
Expected: FAIL — cannot find module `../RevenueTable`

- [ ] **Step 3: Implement RevenueTable**

Create `src/features/leaderboard/components/RevenueTable.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { LeaderboardEntry } from "../lib/types";

export type RevenueSortColumn = "revenue" | "priorYearRevenue" | "pipeline" | "revenueTargeted";

interface RevenueTableProps {
  entries: LeaderboardEntry[];
  sortColumn: RevenueSortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: RevenueSortColumn) => void;
}

function formatRevenue(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

const COLUMNS: { key: RevenueSortColumn; label: string }[] = [
  { key: "revenue", label: "Current Revenue" },
  { key: "priorYearRevenue", label: "Prior Year Closed" },
  { key: "pipeline", label: "Pipeline" },
  { key: "revenueTargeted", label: "Targeted" },
];

export default function RevenueTable({
  entries,
  sortColumn,
  sortDirection,
  onSort,
}: RevenueTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] px-3 py-2.5 border-b-2 border-[#EFEDF5] w-12">
            #
          </th>
          <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A849A] px-3 py-2.5 border-b-2 border-[#EFEDF5]">
            Rep
          </th>
          {COLUMNS.map((col) => {
            const isActive = sortColumn === col.key;
            const SortIcon = sortDirection === "asc" ? ChevronUp : ChevronDown;
            return (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`text-right text-[11px] font-semibold uppercase tracking-wider px-3 py-2.5 border-b-2 border-[#EFEDF5] cursor-pointer select-none transition-colors hover:text-[#5B2E91] ${
                  isActive ? "text-[#5B2E91]" : "text-[#8A849A]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {isActive && <SortIcon className="w-3 h-3" />}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.userId}
            className="border-b border-[#EFEDF5] transition-colors hover:bg-[#F7F5FA]"
          >
            <td className="px-3 py-3.5 text-sm font-semibold text-[#8A849A]">
              {index + 1}
            </td>
            <td className="px-3 py-3.5">
              <div className="flex items-center gap-2.5">
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt={entry.fullName}
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#5B2E91] flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">
                      {getInitials(entry.fullName)}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-[#2D2440]">
                  {entry.fullName}
                </span>
              </div>
            </td>
            {COLUMNS.map((col) => {
              const isActive = sortColumn === col.key;
              return (
                <td
                  key={col.key}
                  className={`px-3 py-3.5 text-right text-sm tabular-nums ${
                    isActive
                      ? "text-[#5B2E91] font-semibold"
                      : "text-[#2D2440] font-medium"
                  }`}
                >
                  {formatRevenue(entry[col.key])}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/components/__tests__/RevenueTable.test.tsx 2>&1 | tail -20`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/RevenueTable.tsx src/features/leaderboard/components/__tests__/RevenueTable.test.tsx
git commit -m "feat(leaderboard): add RevenueTable component with sortable columns"
```

---

### Task 4: Create `RevenueOverviewTab` component

**Files:**
- Create: `src/features/leaderboard/components/RevenueOverviewTab.tsx`

- [ ] **Step 1: Implement RevenueOverviewTab**

Create `src/features/leaderboard/components/RevenueOverviewTab.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import RevenuePodium from "./RevenuePodium";
import RevenueTable from "./RevenueTable";
import type { RevenueSortColumn } from "./RevenueTable";
import type { LeaderboardEntry } from "../lib/types";

interface RevenueOverviewTabProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
}

export default function RevenueOverviewTab({ entries, isLoading }: RevenueOverviewTabProps) {
  const [sortColumn, setSortColumn] = useState<RevenueSortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [entries, sortColumn, sortDirection]);

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

  return (
    <div>
      <RevenuePodium entries={sortedEntries} />
      <RevenueTable
        entries={sortedEntries}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "revenueoverviewtab\|revenuepodium\|revenuetable" | head -10`
Expected: No errors for these files

- [ ] **Step 3: Commit**

```bash
git add src/features/leaderboard/components/RevenueOverviewTab.tsx
git commit -m "feat(leaderboard): add RevenueOverviewTab orchestrating podium and table"
```

---

### Task 5: Refactor `LeaderboardModal` to 2-tab structure

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardModal.tsx`

This is the core refactor. The modal switches from 6 flat tabs to 2 top-level tabs: "Revenue Overview" and "Initiative". The Initiative tab renders the existing modal content (all 6 sub-views) nested inside.

- [ ] **Step 1: Add import for RevenueOverviewTab**

At the top of `LeaderboardModal.tsx`, add the import:

```typescript
import RevenueOverviewTab from "./RevenueOverviewTab";
```

- [ ] **Step 2: Add top-level tab type and state**

Replace the `LeaderboardView` state (line 44) with a top-level tab and keep the initiative sub-view:

```typescript
  const [activeTab, setActiveTab] = useState<"revenue" | "initiative">("revenue");
  const [view, setView] = useState<LeaderboardView>("combined");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
```

Update the effect that collapses expanded rows (line 57-60) to also react to `activeTab`:

```typescript
  useEffect(() => {
    setExpandedUser(null);
  }, [activeTab, view]);
```

- [ ] **Step 3: Replace the tabs section (lines 195-232)**

Replace the tabs + description section with a 2-tab bar and conditional content:

```tsx
        {/* Top-level tabs */}
        <div className="flex-shrink-0 border-b border-[#E2DEEC]">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab("revenue")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "revenue"
                  ? "border-[#403770] text-[#403770]"
                  : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
              }`}
            >
              Revenue Overview
            </button>
            <button
              onClick={() => setActiveTab("initiative")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "initiative"
                  ? "border-[#403770] text-[#403770]"
                  : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
              }`}
            >
              Initiative
            </button>
          </div>
          {activeTab === "initiative" && (
            <>
              {/* Initiative sub-tabs */}
              <div className="flex px-6 border-t border-[#EFEDF5]">
                {VIEW_CONFIG.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = view === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setView(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        isActive
                          ? "border-[#403770] text-[#403770]"
                          : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="px-6 py-2 text-[11px] text-[#6E6390] bg-[#F7F5FA] leading-relaxed">
                {view === "combined" && (
                  <>
                    Weighted blend of all metrics, normalized across reps.
                    <span className="text-[#8A80A8]">
                      {" "}Initiative {weights.initiative}% · Pipeline {weights.pipeline}% ({fyLabels.pipeline}) · Take {weights.take}% ({fyLabels.take}) · Revenue {weights.revenue}% ({fyLabels.revenue}){weights.revenueTargeted > 0 && <> · Targeted {weights.revenueTargeted}% ({fyLabels.revenueTargeted})</>}
                    </span>
                  </>
                )}
                {view === "initiative" && "Points from tracked actions — plans created, activities logged, and revenue targeted."}
                {view === "pipeline" && (<>Open pipeline (stages 0–5) from opportunities in <span className="font-medium text-[#403770]">{fyLabels.pipeline}</span>.</>)}
                {view === "take" && (<>Net revenue after costs from closed opportunities in <span className="font-medium text-[#403770]">{fyLabels.take}</span>.</>)}
                {view === "revenue" && (<>Total revenue from opportunities in <span className="font-medium text-[#403770]">{fyLabels.revenue}</span>.</>)}
                {view === "revenueTargeted" && (<>Total revenue targeted in territory plans{fyLabels.revenueTargeted !== "Current FY" ? <> for <span className="font-medium text-[#403770]">{fyLabels.revenueTargeted}</span></> : ""}.</>)}
              </p>
            </>
          )}
        </div>
```

- [ ] **Step 4: Update the scrollable content area (lines 234-452)**

Replace the scrollable content area to branch on `activeTab`:

```tsx
        {/* Content — scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === "revenue" ? (
            <RevenueOverviewTab
              entries={leaderboard?.entries ?? []}
              isLoading={lbLoading}
            />
          ) : (
            /* Existing initiative content — tier-grouped rankings */
            <>
              {lbLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div>
                  {/* ... existing tier-grouped rankedEntries rendering unchanged ... */}
                </div>
              )}
            </>
          )}
        </div>
```

Keep all existing tier-grouped rendering code inside the initiative branch. The `rankedEntries`, `getScore`, `getTierForEntry`, etc. logic stays — it's only used when `activeTab === "initiative"`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardModal.tsx
git commit -m "refactor(leaderboard): restructure modal to 2-tab layout with Revenue Overview default"
```

---

### Task 6: Refactor `LeaderboardDetailView` to 2-tab structure

**Files:**
- Modify: `src/features/leaderboard/components/LeaderboardDetailView.tsx`

The detail view (rendered when `?tab=leaderboard`) needs the same 2-tab structure.

- [ ] **Step 1: Add imports and tab state**

At the top of `LeaderboardDetailView.tsx`, add:

```typescript
import { useState, useMemo } from "react";
import { useLeaderboard } from "../lib/queries";
import RevenueOverviewTab from "./RevenueOverviewTab";
```

Add state for the active tab:

```typescript
  const [activeTab, setActiveTab] = useState<"revenue" | "initiative">("revenue");
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard();
```

- [ ] **Step 2: Add 2-tab bar above the table**

Before the existing table content, add a tab bar:

```tsx
  return (
    <div>
      <h2 className="text-2xl font-bold text-[#403770] mb-1">Leaderboard</h2>
      <p className="text-sm text-[#8A80A8] mb-4">
        {activeTab === "revenue"
          ? "Revenue Overview — ranked by current year revenue"
          : "Point breakdown by rep — click a row to see details"}
      </p>

      {/* Tab bar */}
      <div className="flex border-b border-[#EFEDF5] mb-4">
        <button
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "revenue"
              ? "border-[#403770] text-[#403770]"
              : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
          }`}
        >
          Revenue Overview
        </button>
        <button
          onClick={() => setActiveTab("initiative")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "initiative"
              ? "border-[#403770] text-[#403770]"
              : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
          }`}
        >
          Initiative
        </button>
      </div>

      {activeTab === "revenue" ? (
        <RevenueOverviewTab
          entries={leaderboard?.entries ?? []}
          isLoading={lbLoading}
        />
      ) : (
        /* Existing initiative detail table unchanged */
        <div className="overflow-hidden rounded-xl border border-[#E2DEEC] bg-white">
          {/* ... existing table content ... */}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardDetailView.tsx
git commit -m "refactor(leaderboard): add 2-tab structure to LeaderboardDetailView"
```

---

### Task 7: Export `LeaderboardResponse` from queries and final cleanup

**Files:**
- Modify: `src/features/leaderboard/lib/queries.ts:5`

- [ ] **Step 1: Export the `LeaderboardResponse` interface**

In `src/features/leaderboard/lib/queries.ts`, change line 5 from `interface` to `export interface`:

```typescript
export interface LeaderboardResponse {
  initiative: InitiativeInfo;
  entries: LeaderboardEntry[];
  metrics: { action: string; label: string; pointValue: number }[];
  thresholds: { tier: string; minPoints: number }[];
}
```

This makes it available if other components need to type-check the leaderboard data.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests pass, including new RevenuePodium and RevenueTable tests

- [ ] **Step 3: Verify TypeScript compiles clean**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -20`
Expected: No errors (or only pre-existing ones unrelated to leaderboard)

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/lib/queries.ts
git commit -m "chore(leaderboard): export LeaderboardResponse type"
```
