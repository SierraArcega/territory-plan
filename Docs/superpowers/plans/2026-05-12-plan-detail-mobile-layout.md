# Plan Detail Mobile Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plan detail modal fully usable at any window width by rendering a full-screen mobile layout (< 640px) instead of the cramped two-column desktop modal.

**Architecture:** A new `PlanDetailMobileShell` component handles the full-screen mobile layout — purple header bar with nav, collapsible stats strip, and full-height tabs. A `useIsMobile` hook drives the React branch in `PlanDetailModal`. Desktop layout is untouched.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Next.js App Router. Tests: Vitest + Testing Library.

---

## File Map

| Action | File |
|--------|------|
| Create | `src/features/shared/hooks/useIsMobile.ts` |
| Create | `src/features/shared/hooks/__tests__/useIsMobile.test.ts` |
| Create | `src/features/map/components/SearchResults/PlanDetailMobileShell.tsx` |
| Create | `src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx` |
| Modify | `src/features/map/components/SearchResults/PlanDetailModal.tsx` |

---

## Task 1: `useIsMobile` hook

**Files:**
- Create: `src/features/shared/hooks/useIsMobile.ts`
- Test: `src/features/shared/hooks/__tests__/useIsMobile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/shared/hooks/__tests__/useIsMobile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../useIsMobile";

type MQListener = (e: Pick<MediaQueryListEvent, "matches">) => void;

function mockMatchMedia(matches: boolean) {
  const listeners: MQListener[] = [];
  const mq = {
    matches,
    media: "(max-width: 639px)",
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MQListener) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => mq),
  });
  return { mq, listeners };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("returns true when matchMedia reports a narrow window", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia reports a wide window", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when the media query fires a change event", () => {
    const { listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    const { mq } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mq.removeEventListener).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan"
npx vitest run src/features/shared/hooks/__tests__/useIsMobile.test.ts
```

Expected: FAIL — `Cannot find module '../useIsMobile'`

- [ ] **Step 3: Implement the hook**

Create `src/features/shared/hooks/useIsMobile.ts`:

```ts
import { useState, useEffect } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/features/shared/hooks/__tests__/useIsMobile.test.ts
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/hooks/useIsMobile.ts src/features/shared/hooks/__tests__/useIsMobile.test.ts
git commit -m "feat: add useIsMobile hook for responsive breakpoint detection"
```

---

## Task 2: `PlanDetailMobileShell` component

**Files:**
- Create: `src/features/map/components/SearchResults/PlanDetailMobileShell.tsx`
- Test: `src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PlanDetailMobileShell from "../PlanDetailMobileShell";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";

// Mock PlanDetailTabs so we don't need QueryClientProvider
vi.mock("../PlanDetailTabs", () => ({
  default: () => <div data-testid="plan-detail-tabs">Tabs</div>,
}));

const mockPlan: TerritoryPlanDetail = {
  id: "plan-1",
  name: "Westchester County",
  description: null,
  owner: null,
  color: "#403770",
  status: "working",
  fiscalYear: 2026,
  startDate: null,
  endDate: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  districtLeaids: [],
  schoolNcesIds: [],
  totalEnrollment: 134291,
  stateCount: 1,
  states: [],
  collaborators: [],
  taskCount: 0,
  completedTaskCount: 0,
  renewalRollup: 0,
  expansionRollup: 150000,
  winbackRollup: 0,
  newBusinessRollup: 1100000,
  pipelineTotal: 0,
  districts: [
    {
      leaid: "3620580",
      addedAt: "2026-01-01T00:00:00Z",
      name: "Yonkers City SD",
      stateAbbrev: "NY",
      enrollment: 25000,
      owner: null,
      renewalTarget: null,
      winbackTarget: null,
      expansionTarget: null,
      newBusinessTarget: null,
      notes: null,
      returnServices: [],
      newServices: [],
      tags: [],
      actuals: { totalRevenue: 42000, openPipeline: 0 },
    },
  ],
};

describe("PlanDetailMobileShell", () => {
  it("renders plan name and FY badge", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Westchester County")).toBeInTheDocument();
    expect(screen.getByText("FY26")).toBeInTheDocument();
  });

  it("renders Return to Map and close buttons", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Return to Map/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  it("calls onClose when Return to Map is clicked", () => {
    const onClose = vi.fn();
    render(<PlanDetailMobileShell plan={mockPlan} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Return to Map/i));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides stats section by default", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    expect(screen.queryByText("Total Target")).not.toBeInTheDocument();
  });

  it("shows stats section after tapping the Stats toggle", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /stats/i }));
    expect(screen.getByText("Total Target")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("hides stats section again when toggle is tapped a second time", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /stats/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText("Total Target")).not.toBeInTheDocument();
  });

  it("renders prev/next buttons and counter when navigation props are provided", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        currentIndex={1}
        totalCount={7}
      />
    );
    expect(screen.getByRole("button", { name: /Previous plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next plan/i })).toBeInTheDocument();
    expect(screen.getByText("2 of 7")).toBeInTheDocument();
  });

  it("calls onPrev and onNext when nav buttons are clicked", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        currentIndex={1}
        totalCount={7}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Previous plan/i }));
    expect(onPrev).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Next plan/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("renders the tabs panel", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    expect(screen.getByTestId("plan-detail-tabs")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx
```

Expected: FAIL — `Cannot find module '../PlanDetailMobileShell'`

- [ ] **Step 3: Implement the component**

Create `src/features/map/components/SearchResults/PlanDetailMobileShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";
import PlanDetailTabs from "./PlanDetailTabs";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  planning: { bg: "bg-[#f0edf5]", text: "text-[#6E6390]" },
  working: { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" },
  stale: { bg: "bg-[#FEF3C7]", text: "text-[#92700C]" },
  archived: { bg: "bg-[#f0edf5]", text: "text-[#8A80A8]" },
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

interface PlanDetailMobileShellProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export default function PlanDetailMobileShell({
  plan,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: PlanDetailMobileShellProps) {
  const [showStats, setShowStats] = useState(false);

  const statusBadge = STATUS_BADGE[plan.status] ?? STATUS_BADGE.planning;

  const totalTarget =
    (plan.renewalRollup || 0) +
    (plan.expansionRollup || 0) +
    (plan.winbackRollup || 0) +
    (plan.newBusinessRollup || 0);

  const totalActual = plan.districts.reduce(
    (sum, d) => sum + (d.actuals?.totalRevenue ?? 0),
    0
  );

  const showNav =
    (onPrev != null || onNext != null) &&
    currentIndex != null &&
    totalCount != null &&
    totalCount > 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Purple header bar */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2"
        style={{ background: "#403770" }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Map
        </button>

        {showNav && (
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <button
              onClick={onPrev}
              disabled={!onPrev}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.15)" }}
              aria-label="Previous plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] text-white/70 whitespace-nowrap tabular-nums">
              {currentIndex! + 1} of {totalCount}
            </span>
            <button
              onClick={onNext}
              disabled={!onNext}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.15)" }}
              aria-label="Next plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white"
          style={{ background: "rgba(255,255,255,0.15)" }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Summary strip */}
      <div
        className="shrink-0 px-4 py-3 border-b border-[#E2DEEC]"
        style={{ background: "linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: plan.color || "#403770" }}
            />
            <h2 className="text-sm font-bold text-[#403770] truncate whitespace-nowrap">
              {plan.name}
            </h2>
          </div>
          <button
            onClick={() => setShowStats((s) => !s)}
            className="shrink-0 text-xs font-semibold whitespace-nowrap focus-visible:outline-none"
            style={{ color: showStats ? "#403770" : "#8A80A8" }}
            aria-label={showStats ? "Hide stats" : "Show stats"}
            aria-expanded={showStats}
          >
            Stats {showStats ? "▴" : "▾"}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#403770] text-white">
            FY{String(plan.fiscalYear).slice(-2)}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}
          >
            {plan.status}
          </span>
        </div>

        {showStats && (
          <div className="mt-3 pt-3 border-t border-[#E2DEEC]">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <StatCell label="Districts" value={String(plan.districts.length)} highlight />
              <StatCell label="Total Target" value={formatCurrency(totalTarget)} highlight />
              <StatCell label="Revenue" value={formatCurrency(totalActual)} highlight />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Renewal" value={formatCurrency(plan.renewalRollup)} />
              <StatCell label="Expansion" value={formatCurrency(plan.expansionRollup)} />
              <StatCell label="New Biz" value={formatCurrency(plan.newBusinessRollup)} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs — fills remaining height */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PlanDetailTabs plan={plan} onClose={onClose} />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`text-xs tabular-nums font-bold ${
          highlight ? "text-[#403770]" : "text-[#544A78]"
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] text-[#8A80A8] whitespace-nowrap">{label}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx
```

Expected: PASS — 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add \
  src/features/map/components/SearchResults/PlanDetailMobileShell.tsx \
  src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx
git commit -m "feat: PlanDetailMobileShell — full-screen mobile layout for plan detail"
```

---

## Task 3: Wire `PlanDetailModal` to render the mobile shell

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDetailModal.tsx`

No new tests needed — the modal's toggle behaviour is covered by the `useIsMobile` and `PlanDetailMobileShell` tests. Manual verification covers the integration.

- [ ] **Step 1: Replace the file content**

Open `src/features/map/components/SearchResults/PlanDetailModal.tsx` and replace with:

```tsx
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTerritoryPlan } from "@/lib/api";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import PlanDetailSidebar from "./PlanDetailSidebar";
import PlanDetailTabs from "./PlanDetailTabs";
import PlanDetailMobileShell from "./PlanDetailMobileShell";

interface PlanDetailModalProps {
  planId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export default function PlanDetailModal({
  planId,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: PlanDetailModalProps) {
  const { data: plan, isLoading, error } = useTerritoryPlan(planId);
  const isMobile = useIsMobile();

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {isMobile ? (
        /* ── Mobile: full-screen overlay ── */
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
          {isLoading ? (
            <MobileModalSkeleton />
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-sm font-medium text-[#F37167]">Failed to load plan</p>
                <p className="text-xs text-[#8A80A8] mt-1">{error.message}</p>
              </div>
            </div>
          ) : plan ? (
            <PlanDetailMobileShell
              plan={plan}
              onClose={onClose}
              onPrev={onPrev}
              onNext={onNext}
              currentIndex={currentIndex}
              totalCount={totalCount}
            />
          ) : null}
        </div>
      ) : (
        /* ── Desktop: original modal + floating arrows ── */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <div
            className="flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev arrow */}
            {onPrev ? (
              <button
                onClick={onPrev}
                className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
                title="Previous plan (←)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="w-10 shrink-0" />
            )}

            {/* Center column: back button + modal + counter */}
            <div className="flex flex-col items-start gap-2">
              {/* Top row: back + close */}
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Return to Map
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal container */}
              <div className="relative bg-white rounded-2xl shadow-xl w-[70vw] max-w-[1076px] h-[70vh] max-h-[745px] flex overflow-hidden">
                {isLoading ? (
                  <DesktopModalSkeleton />
                ) : error ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#F37167]">Failed to load plan</p>
                      <p className="text-xs text-[#8A80A8] mt-1">{error.message}</p>
                    </div>
                  </div>
                ) : plan ? (
                  <div className="flex-1 flex overflow-hidden">
                    <PlanDetailSidebar plan={plan} />
                    <PlanDetailTabs plan={plan} onClose={onClose} />
                  </div>
                ) : null}
              </div>

              {/* Counter */}
              {currentIndex != null && totalCount != null && totalCount > 0 && (
                <span className="self-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78]">
                  {currentIndex + 1} of {totalCount}
                </span>
              )}
            </div>

            {/* Next arrow */}
            {onNext ? (
              <button
                onClick={onNext}
                className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
                title="Next plan (→)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="w-10 shrink-0" />
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function MobileModalSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="h-11 shrink-0" style={{ background: "#403770" }} />
      <div
        className="h-20 shrink-0 border-b border-[#E2DEEC]"
        style={{ background: "linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)" }}
      >
        <div className="px-4 py-3 space-y-2">
          <div className="h-4 bg-[#f0edf5] rounded w-3/4" />
          <div className="flex gap-2">
            <div className="h-4 bg-[#f0edf5] rounded-full w-10" />
            <div className="h-4 bg-[#f0edf5] rounded-full w-16" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#f0edf5] rounded" />
        ))}
      </div>
    </div>
  );
}

function DesktopModalSkeleton() {
  return (
    <div className="flex-1 flex">
      <div className="w-[280px] border-r border-[#E2DEEC] p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-[#f0edf5]" />
          <div className="h-5 bg-[#f0edf5] rounded w-3/4" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 bg-[#f0edf5] rounded-full w-12" />
          <div className="h-5 bg-[#f0edf5] rounded-full w-16" />
        </div>
        <div className="space-y-2 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#f0edf5] rounded w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-5 space-y-4 animate-pulse">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-[#f0edf5] rounded w-20" />
          ))}
        </div>
        <div className="space-y-3 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f0edf5] rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run src/features/shared/hooks/__tests__/useIsMobile.test.ts src/features/map/components/SearchResults/__tests__/PlanDetailMobileShell.test.tsx
```

Expected: PASS — all tests from Tasks 1 and 2 still pass

- [ ] **Step 3: Start the dev server and verify manually**

```bash
npm run dev
```

Open http://localhost:3005 → Plans tab → pick any plan → open it.

**Desktop check (window ≥ 640px):**
- Modal renders as before — white rounded box, floating arrows, sidebar + tabs
- Counter "N of M" still shows below the modal

**Mobile check (window < 640px, or use Safari Responsive Design Mode):**
- Full-screen overlay appears
- Purple header bar with "← Return to Map", prev/next arrows (if multiple plans), and "✕"
- Plan name + FY badge + status badge visible
- "Stats ▾" button on the right of the name row
- Tapping Stats expands the grid (Districts / Total Target / Revenue / Renewal / Expansion / New Biz)
- Tapping Stats again collapses it
- Tab bar (Districts, Opportunities, Contacts…) scrolls horizontally
- Districts tab fills remaining height and scrolls

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDetailModal.tsx
git commit -m "feat: render PlanDetailMobileShell on narrow viewports in PlanDetailModal"
```

---

## Task 4: Final integration check

- [ ] **Step 1: Run full project test suite**

```bash
npm test
```

Expected: existing tests still pass, new tests pass. No regressions.

- [ ] **Step 2: Verify in Safari Responsive Design Mode**

In macOS Safari: Develop → Enter Responsive Design Mode → set width to 390px (iPhone 14).

Open a plan. Confirm:
1. Full-screen layout renders (no floating modal box)
2. Plan name is not clipped
3. Stats toggle works
4. Tab bar scrolls horizontally when there are 6 tabs
5. Districts table is fully readable and scrollable
6. "Return to Map" closes the overlay

- [ ] **Step 3: Commit the plan doc**

```bash
git add docs/superpowers/plans/2026-05-12-plan-detail-mobile-layout.md
git commit -m "docs: implementation plan for plan detail mobile layout"
```
