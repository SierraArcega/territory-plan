# Districts Tab Mobile Column Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Districts tab table readable at mobile widths by replacing the fixed 5-column grid with a responsive layout that allocates full space to the district name column.

**Architecture:** All changes are in a single file (`PlanDistrictsTab.tsx`). The fix is purely CSS/JSX — no new components, no new hooks, no API changes. The `SortBtn` label prop is widened from `string` to `React.ReactNode` so "Rev. Target" / "Rev. Actual" headers can render short text on mobile and full text on desktop via responsive Tailwind spans. The grid template changes from `[1fr_110px_110px_55px_28px]` to `[1fr_52px_52px_44px_28px]` at mobile and is unchanged on `sm:` (≥640px). A sub-label showing state and enrollment appears below the district name on mobile only.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library

---

## Files

**Modify only:**
- `src/features/map/components/SearchResults/PlanDistrictsTab.tsx`

**Add tests to:**
- `src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx` (new file)

---

### Task 1: Widen `SortBtn` label type and add `formatEnrollment` helper

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:694–725`

This is a prerequisite for Task 2. `SortBtn` currently takes `label: string` — widening it to `React.ReactNode` lets us pass responsive JSX labels without any other changes to the component.

- [ ] **Step 1: Write the failing test**

Create `src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── formatEnrollment is not exported, so we test via the rendered sub-label.
// We will test it indirectly in Task 2. For now just verify the file imports cleanly.
describe("PlanDistrictsTab helpers", () => {
  it("placeholder — will be replaced in Task 2", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes (it's a placeholder)**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
```

Expected: PASS (1 test)

- [ ] **Step 3: Widen `SortBtn` label type**

In `PlanDistrictsTab.tsx`, find the `SortBtn` function signature (around line 694) and change `label: string` to `label: React.ReactNode`:

```tsx
function SortBtn({
  label,
  col,
  activeCol,
  dir,
  onSort,
  align = "left",
}: {
  label: React.ReactNode;
  col: SortColumn;
  activeCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  align?: "left" | "right" | "center";
}) {
```

- [ ] **Step 4: Add `formatEnrollment` helper**

Add this function in the "Formatting Helpers" section at the top of the file, after `getPercentOfBadge` (around line 56):

```ts
function formatEnrollment(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}
```

- [ ] **Step 5: Run existing tests to confirm nothing broke**

```bash
npx vitest run src/features/map/components/SearchResults/
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx \
        src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
git commit -m "refactor: widen SortBtn label to ReactNode, add formatEnrollment helper"
```

---

### Task 2: Update header row — responsive grid + short mobile labels

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:142–151`

The header row currently uses `grid-cols-[1fr_110px_110px_55px_28px]`. This task changes it to use the mobile grid at narrow widths and the desktop grid at ≥640px, and passes responsive labels to the two columns that need shorter text on mobile.

- [ ] **Step 1: Write the failing test**

Replace the placeholder test in `PlanDistrictsTab.test.tsx` with a real test. We need a minimal `plan` fixture — copy the shape from `PlanDetailMobileShell.test.tsx`.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import PlanDistrictsTab from "../PlanDistrictsTab";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";

// Mock all hooks that hit the network
vi.mock("@/lib/api", () => ({
  useUpdateDistrictTargets: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveDistrictFromPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useServices: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: () => ({ setFocusedLeaid: vi.fn() }),
}));

const district = {
  leaid: "3620580",
  addedAt: "2026-01-01T00:00:00Z",
  name: "Yonkers City School District",
  stateAbbrev: "NY",
  enrollment: 25000,
  owner: null,
  renewalTarget: 42000,
  winbackTarget: null,
  expansionTarget: null,
  newBusinessTarget: null,
  notes: null,
  returnServices: [],
  newServices: [],
  tags: [],
  actuals: undefined,
  opportunities: [],
  pacing: undefined,
};

const mockPlan: TerritoryPlanDetail = {
  id: 1,
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
  districtLeaids: ["3620580"],
  schoolNcesIds: [],
  totalEnrollment: 25000,
  stateCount: 1,
  states: [],
  collaborators: [],
  taskCount: 0,
  completedTaskCount: 0,
  renewalRollup: 0,
  expansionRollup: 0,
  winbackRollup: 0,
  newBusinessRollup: 42000,
  pipelineTotal: 0,
  districts: [district],
};

describe("PlanDistrictsTab", () => {
  it("renders short mobile header label 'Target' (the sm:hidden span)", () => {
    render(<PlanDistrictsTab plan={mockPlan} onClose={vi.fn()} />);
    // Both spans are in the DOM; JSDOM doesn't apply CSS, so both are present.
    // We just check the short version exists.
    expect(screen.getAllByText("Target").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
```

Expected: FAIL — "Target" text not found (short label span doesn't exist yet)

- [ ] **Step 3: Update the header row in `PlanDistrictsTab.tsx`**

Find the header row div (around line 143–151):

```tsx
{/* Table header */}
<div className="shrink-0 border-y border-[#E2DEEC] bg-[#FAFAFE]">
  <div className="grid grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
    <SortBtn label="District" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
    <SortBtn label="Rev. Target" col="target" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
    <SortBtn label="Rev. Actual" col="actual" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
    <SortBtn label="Attain." col="attainment" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="center" />
    <span />
  </div>
</div>
```

Replace with:

```tsx
{/* Table header */}
<div className="shrink-0 border-y border-[#E2DEEC] bg-[#FAFAFE]">
  <div className="grid grid-cols-[1fr_52px_52px_44px_28px] sm:grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
    <SortBtn label="District" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
    <SortBtn
      label={<><span className="sm:hidden">Target</span><span className="hidden sm:inline">Rev. Target</span></>}
      col="target"
      activeCol={sortCol}
      dir={sortDir}
      onSort={handleSort}
      align="right"
    />
    <SortBtn
      label={<><span className="sm:hidden">Actual</span><span className="hidden sm:inline">Rev. Actual</span></>}
      col="actual"
      activeCol={sortCol}
      dir={sortDir}
      onSort={handleSort}
      align="right"
    />
    <SortBtn label="Attain." col="attainment" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="center" />
    <span />
  </div>
</div>
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite for the directory**

```bash
npx vitest run src/features/map/components/SearchResults/
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx \
        src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
git commit -m "feat: responsive header grid + short mobile column labels for districts tab"
```

---

### Task 3: Update `DistrictRow` collapsed row — responsive grid + sub-label

**Files:**
- Modify: `src/features/map/components/SearchResults/PlanDistrictsTab.tsx:240–260`

This task changes the data row grid template to match the header (from Task 2) and adds a `sm:hidden` state/enrollment sub-label beneath the district name.

- [ ] **Step 1: Write the failing test**

Add to `PlanDistrictsTab.test.tsx`:

```tsx
it("renders the state/enrollment sub-label for the district row", () => {
  render(<PlanDistrictsTab plan={mockPlan} onClose={vi.fn()} />);
  // stateAbbrev="NY", enrollment=25000 → "NY · 25K"
  expect(screen.getByText("NY · 25K")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
```

Expected: FAIL — "NY · 25K" not found

- [ ] **Step 3: Update `DistrictRow` collapsed-row div**

Find the collapsed-row div in the `DistrictRow` function (around line 242–260). Change the grid class and add the sub-label:

**Before** (lines 242–260):
```tsx
<div
  className={`grid grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2.5 cursor-pointer transition-colors ${
    isExpanded ? "bg-[#FAFAFE] border-b border-[#E2DEEC]" : "hover:bg-[#FAFAFE]"
  }`}
  onClick={onToggle}
>
  <div className="flex items-center gap-2 min-w-0">
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
    >
      <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth={isExpanded ? "1.5" : "1.2"} fill="none" strokeLinecap="round" />
    </svg>
    <span className={`text-xs truncate ${isExpanded ? "font-semibold text-[#403770]" : "font-medium text-[#544A78]"}`}>
      {district.name}
    </span>
  </div>
```

**After:**
```tsx
<div
  className={`grid grid-cols-[1fr_52px_52px_44px_28px] sm:grid-cols-[1fr_110px_110px_55px_28px] items-center px-5 py-2.5 cursor-pointer transition-colors ${
    isExpanded ? "bg-[#FAFAFE] border-b border-[#E2DEEC]" : "hover:bg-[#FAFAFE]"
  }`}
  onClick={onToggle}
>
  <div className="flex items-center gap-2 min-w-0">
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
    >
      <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth={isExpanded ? "1.5" : "1.2"} fill="none" strokeLinecap="round" />
    </svg>
    <div className="min-w-0">
      <span className={`text-xs truncate block ${isExpanded ? "font-semibold text-[#403770]" : "font-medium text-[#544A78]"}`}>
        {district.name}
      </span>
      <span className="sm:hidden text-[9px] text-[#8A80A8] mt-0.5 block">
        {district.stateAbbrev ?? "—"}
        {district.enrollment != null && ` · ${formatEnrollment(district.enrollment)}`}
      </span>
    </div>
  </div>
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Run full suite**

```bash
npx vitest run src/features/map/components/SearchResults/
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx \
        src/features/map/components/SearchResults/__tests__/PlanDistrictsTab.test.tsx
git commit -m "feat: responsive district row grid + state/enrollment sub-label on mobile"
```

---

### Task 4: Verify in browser at mobile widths

No code changes — this task confirms the visual result.

- [ ] **Step 1: Start the dev server (if not already running)**

```bash
npm run dev
```

Server runs on port 3005.

- [ ] **Step 2: Open Safari Responsive Design Mode**

In Safari: Develop → Enter Responsive Design Mode (or ⌃⌘R). Set width to 390px (iPhone 14).

- [ ] **Step 3: Open a plan detail at http://localhost:3005**

Navigate to the map, click a plan marker, open the plan detail. On mobile/narrow the `PlanDetailMobileShell` will render. Tap the Districts tab.

- [ ] **Step 4: Verify the Districts tab**

Check:
- [ ] District names show at least ~12 characters (e.g. "Yonkers City…", not "Y…")
- [ ] State/enrollment sub-label is visible below each name (e.g. "NY · 25K")
- [ ] Column headers "District", "Target", "Actual", "Attain." align directly above their values
- [ ] Attainment badge colors are correct (green ≥70%, amber ≥40%, red below)
- [ ] Expand chevron is visible in the name cell
- [ ] Tapping a row expands it and shows the remove button

- [ ] **Step 5: Verify at 320px**

Change Responsive Design Mode width to 320px. Confirm no overflow or clipping — the name column should still truncate gracefully, not spill outside the row.

- [ ] **Step 6: Verify desktop layout is unchanged**

Exit Responsive Design Mode (or widen the window to ≥640px). Confirm the full-width "Rev. Target" / "Rev. Actual" column headers are visible and the original 110px column widths are intact.

- [ ] **Step 7: Commit if any visual fixes were needed**

If steps 4–6 uncovered layout issues and required code changes, commit them:

```bash
git add src/features/map/components/SearchResults/PlanDistrictsTab.tsx
git commit -m "fix: districts tab mobile column visual adjustments"
```

If no changes were needed, skip this step.
