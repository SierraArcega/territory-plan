# LHF Banner Collapsible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Low Hanging Fruit summary banner collapsible — a chevron-up button hides it to a slim "Instructions" row; chevron-down restores it; state persists for the browser session via sessionStorage.

**Architecture:** Single file change to `LowHangingFruitView.tsx`. Add `bannerCollapsed` state (initialised from sessionStorage), a `toggleBanner` handler, and replace the static banner `<div>` with a conditional that renders either the full banner (+ chevron-up) or a slim collapsed row (+ chevron-down). Tests are added to the existing test file.

**Tech Stack:** React 19, Tailwind CSS 4, Lucide React icons, Vitest + Testing Library.

---

### Task 1: Add collapsible banner to `LowHangingFruitView`

**Files:**
- Modify: `src/features/leaderboard/components/LowHangingFruitView.tsx`
- Test: `src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx`

Work in the worktree at `/Users/astonfurious/The Laboratory/territory-plan-mobile-scroll-fix`.

- [ ] **Step 1: Add failing tests**

Open `src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx` and add `fireEvent` and `beforeEach` imports, then append the new describe block **after** the existing `describe("LowHangingFruitView", ...)` block:

```tsx
// Add fireEvent to existing import
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
```

Then add at the bottom of the file:

```tsx
describe("LowHangingFruitView — summary banner collapse", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows the banner and a hide button by default", () => {
    renderView();
    expect(screen.getByLabelText("Hide instructions")).toBeInTheDocument();
    expect(screen.getByText(/How to action them/i)).toBeInTheDocument();
  });

  it("collapses the banner when hide button is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    expect(screen.queryByText(/How to action them/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show instructions")).toBeInTheDocument();
  });

  it("re-expands the banner when the collapsed row is clicked", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    fireEvent.click(screen.getByLabelText("Show instructions"));
    expect(screen.getByText(/How to action them/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Hide instructions")).toBeInTheDocument();
  });

  it("starts collapsed when sessionStorage flag is pre-set", () => {
    sessionStorage.setItem("lhf-banner-collapsed", "true");
    renderView();
    expect(screen.queryByText(/How to action them/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show instructions")).toBeInTheDocument();
  });

  it("persists collapsed state to sessionStorage", () => {
    renderView();
    fireEvent.click(screen.getByLabelText("Hide instructions"));
    expect(sessionStorage.getItem("lhf-banner-collapsed")).toBe("true");
  });

  it("persists expanded state to sessionStorage when re-expanded", () => {
    sessionStorage.setItem("lhf-banner-collapsed", "true");
    renderView();
    fireEvent.click(screen.getByLabelText("Show instructions"));
    expect(sessionStorage.getItem("lhf-banner-collapsed")).toBe("false");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- --run src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
```

Expected: the 6 new tests FAIL (Hide/Show instructions buttons don't exist yet). The 2 existing tests should still PASS.

- [ ] **Step 3: Add `ChevronUp` to the lucide import**

In `src/features/leaderboard/components/LowHangingFruitView.tsx`, find the existing import:

```tsx
import { ArrowUpRight, Check, ChevronDown, Plus } from "lucide-react";
```

Change it to:

```tsx
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
```

- [ ] **Step 4: Add `bannerCollapsed` state and `toggleBanner` handler**

In `LowHangingFruitView.tsx`, find the block of `useState`/`useRef` declarations at the top of the `LowHangingFruitView` function (around line 223). Add these two declarations immediately after the existing ones:

```tsx
const [bannerCollapsed, setBannerCollapsed] = useState(() =>
  typeof window !== "undefined" &&
  sessionStorage.getItem("lhf-banner-collapsed") === "true"
);

const toggleBanner = () => {
  setBannerCollapsed((prev) => {
    const next = !prev;
    sessionStorage.setItem("lhf-banner-collapsed", String(next));
    return next;
  });
};
```

- [ ] **Step 5: Replace the static banner `<div>` with the collapsible version**

Find the `{/* Summary banner */}` comment and the `<div>` that follows it (lines 356–377 in the original). Replace the entire block with:

```tsx
{/* Summary banner */}
{bannerCollapsed ? (
  <button
    onClick={toggleBanner}
    className="flex-shrink-0 flex items-center justify-between px-5 py-2 bg-[#F7F5FA] border-b border-[#E2DEEC] w-full text-left"
    aria-expanded={false}
    aria-label="Show instructions"
  >
    <span className="text-[11px] font-semibold text-[#6E6390]">Instructions</span>
    <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8]" />
  </button>
) : (
  <div className="flex-shrink-0 px-5 py-3.5 bg-[#F7F5FA] border-b border-[#E2DEEC]">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <p className="text-xs text-[#544A78] leading-relaxed">
          You&apos;ll find 3 buckets of customers on this page:{" "}
          <strong className="text-[#403770]">Missing Renewals</strong>,{" "}
          <strong className="text-[#403770]">Fullmind Winbacks</strong>, and{" "}
          <strong className="text-[#403770]">Elevate Winbacks</strong>.{" "}
          All Winbacks are first-come, first-serve — it doesn&apos;t matter if you were the original rep or if the customer is from your company of origin.
          Grab any winback that looks exciting and fits into the goals you have for your Book of Business!
        </p>
        <p className="text-xs text-[#544A78] mt-2">
          <strong className="text-[#403770]">How to action them:</strong>{" "}
          Click the <strong className="text-[#403770]">+Opp</strong> button to jump straight into the LMS and create the opportunity, or add to a plan and set a target.
        </p>
        <ul className="text-xs text-[#544A78] mt-1.5 space-y-0.5 list-disc pl-5">
          <li>
            <strong className="text-[#403770]">Missing Renewals</strong> leave this list once an FY27 opp exists — renewals are required to have an FY27 opportunity, so <strong className="text-[#403770]">+Opp</strong> is the path.
          </li>
          <li>
            <strong className="text-[#403770]">Winbacks</strong> leave this list when an FY27 opp is created <em>or</em> a plan target is set.
          </li>
        </ul>
      </div>
      <button
        onClick={toggleBanner}
        className="flex-shrink-0 text-[#8A80A8] hover:text-[#403770] mt-0.5"
        aria-expanded={true}
        aria-label="Hide instructions"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Run tests — confirm all pass**

```bash
npm test -- --run src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
```

Expected: all 8 tests PASS (2 existing + 6 new).

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: same number of passes as before — no new failures.

- [ ] **Step 8: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitView.tsx \
        src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
git commit -m "feat(lhf): collapsible summary banner with sessionStorage persistence"
```
