# Plan Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the plan view panel into a full workspace with icon-strip navigation (overview, tasks, contacts, performance) and a PamPam-style right expand panel for editing and detail flows.

**Architecture:** Extend the existing Zustand state machine with plan-scoped sub-states and a `rightPanelContent` field. FloatingPanel grows a third slot that conditionally renders the right panel. Each plan section is a standalone component wired to existing API hooks.

**Tech Stack:** React 19, Zustand, React Query, Tailwind CSS, existing API hooks from `src/lib/api.ts`

**Design Doc:** `Docs/plans/2026-02-15-plan-workspace-design.md`

---

### Task 1: Update Zustand Store with Plan Workspace State

**Files:**
- Modify: `src/lib/map-v2-store.ts`
- Test: `src/lib/__tests__/map-v2-store.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/map-v2-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../map-v2-store";

describe("useMapV2Store - Plan Workspace", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      panelState: "BROWSE",
      panelHistory: [],
      activePlanId: null,
      planSection: "overview",
      rightPanelContent: null,
    });
  });

  describe("viewPlan", () => {
    it("transitions to PLAN_OVERVIEW and sets activePlanId", () => {
      useMapV2Store.getState().viewPlan("plan-123");

      const state = useMapV2Store.getState();
      expect(state.panelState).toBe("PLAN_OVERVIEW");
      expect(state.activePlanId).toBe("plan-123");
      expect(state.planSection).toBe("overview");
    });
  });

  describe("setPlanSection", () => {
    it("updates planSection and panelState", () => {
      useMapV2Store.setState({ activePlanId: "plan-123", panelState: "PLAN_OVERVIEW" });

      useMapV2Store.getState().setPlanSection("tasks");

      const state = useMapV2Store.getState();
      expect(state.planSection).toBe("tasks");
      expect(state.panelState).toBe("PLAN_TASKS");
    });

    it("closes right panel when switching sections", () => {
      useMapV2Store.setState({
        activePlanId: "plan-123",
        panelState: "PLAN_OVERVIEW",
        rightPanelContent: { type: "district_card", id: "1234567" },
      });

      useMapV2Store.getState().setPlanSection("contacts");

      expect(useMapV2Store.getState().rightPanelContent).toBeNull();
    });
  });

  describe("openRightPanel / closeRightPanel", () => {
    it("sets rightPanelContent", () => {
      useMapV2Store.getState().openRightPanel({ type: "district_card", id: "1234567" });

      expect(useMapV2Store.getState().rightPanelContent).toEqual({
        type: "district_card",
        id: "1234567",
      });
    });

    it("clears rightPanelContent on close", () => {
      useMapV2Store.setState({
        rightPanelContent: { type: "task_form" },
      });

      useMapV2Store.getState().closeRightPanel();

      expect(useMapV2Store.getState().rightPanelContent).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd territory-plan && npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: FAIL — `planSection`, `rightPanelContent`, `setPlanSection`, `openRightPanel`, `closeRightPanel` don't exist yet.

**Step 3: Update the store**

In `src/lib/map-v2-store.ts`:

1. Add to `PanelState` type (line ~5-11):
```typescript
export type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"    // keep for backwards compat, redirects to PLAN_OVERVIEW
  | "PLAN_ADD"
  | "PLAN_OVERVIEW"
  | "PLAN_TASKS"
  | "PLAN_CONTACTS"
  | "PLAN_PERF";
```

2. Add new types after `IconBarTab`:
```typescript
export type PlanSection = "overview" | "tasks" | "contacts" | "performance";

export interface RightPanelContent {
  type: "district_card" | "task_form" | "task_edit" | "contact_detail" | "contact_form";
  id?: string;
}
```

3. Add to `MapV2State` interface (after `activePlanId`):
```typescript
planSection: PlanSection;
rightPanelContent: RightPanelContent | null;
```

4. Add to `MapV2Actions` interface:
```typescript
setPlanSection: (section: PlanSection) => void;
openRightPanel: (content: RightPanelContent) => void;
closeRightPanel: () => void;
```

5. Add initial values in `create()`:
```typescript
planSection: "overview" as PlanSection,
rightPanelContent: null as RightPanelContent | null,
```

6. Update `viewPlan` action to transition to `PLAN_OVERVIEW`:
```typescript
viewPlan: (planId) =>
  set((s) => ({
    activePlanId: planId,
    panelState: "PLAN_OVERVIEW",
    panelHistory: [...s.panelHistory, s.panelState],
    planSection: "overview" as PlanSection,
    rightPanelContent: null,
  })),
```

7. Add section mapping helper and new actions:
```typescript
setPlanSection: (section) => {
  const sectionToState: Record<PlanSection, PanelState> = {
    overview: "PLAN_OVERVIEW",
    tasks: "PLAN_TASKS",
    contacts: "PLAN_CONTACTS",
    performance: "PLAN_PERF",
  };
  set({ planSection: section, panelState: sectionToState[section], rightPanelContent: null });
},

openRightPanel: (content) => set({ rightPanelContent: content }),

closeRightPanel: () => set({ rightPanelContent: null }),
```

**Step 4: Run test to verify it passes**

Run: `cd territory-plan && npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/map-v2-store.ts src/lib/__tests__/map-v2-store.test.ts
git commit -m "feat(plan-workspace): add plan section state + right panel to store"
```

---

### Task 2: Update FloatingPanel with 3-Slot Layout

**Files:**
- Modify: `src/components/map-v2/FloatingPanel.tsx`
- Create: `src/components/map-v2/RightPanel.tsx`

**Step 1: Create the RightPanel component**

Create `src/components/map-v2/RightPanel.tsx`:

```tsx
"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function RightPanel() {
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  if (!rightPanelContent) return null;

  return (
    <div className="w-[280px] border-l border-gray-200/60 flex flex-col bg-white/95">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {rightPanelContent.type === "district_card" && "District"}
          {rightPanelContent.type === "task_form" && "New Task"}
          {rightPanelContent.type === "task_edit" && "Edit Task"}
          {rightPanelContent.type === "contact_detail" && "Contact"}
          {rightPanelContent.type === "contact_form" && "New Contact"}
        </span>
        <button
          onClick={closeRightPanel}
          className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content - placeholder for now, Task 6/8/10 will fill these */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-center py-8 text-xs text-gray-400">
          {rightPanelContent.type} — {rightPanelContent.id || "new"}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update FloatingPanel to include the right panel slot**

In `src/components/map-v2/FloatingPanel.tsx`, update the desktop panel div (line 28-46):

Replace the current width class logic with:

```tsx
import RightPanel from "./RightPanel";
import { useMapV2Store } from "@/lib/map-v2-store";

// Inside component, add:
const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
const isInPlanWorkspace = ["PLAN_OVERVIEW", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(
  useMapV2Store((s) => s.panelState)
);

// Update the desktop panel div width:
// panelCollapsed: w-[56px]
// normal: w-[376px] (56 + 320)
// plan with right panel: w-[656px] (56 + 320 + 280)
const panelWidth = panelCollapsed
  ? "w-[56px]"
  : rightPanelContent && isInPlanWorkspace
    ? "w-[656px]"
    : "w-[376px]";
```

Update the desktop panel JSX:
```tsx
<div
  className={`
    absolute top-10 left-12 z-10
    bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
    flex flex-row overflow-hidden
    transition-all duration-300 ease-out
    panel-v2-enter
    ${panelWidth} ${panelCollapsed ? "bottom-10" : "bottom-[380px]"}
  `}
>
  {/* Icon strip */}
  <IconBar />

  {/* Content area */}
  {!panelCollapsed && (
    <>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
        <PanelContent />
      </div>
      {/* Right panel slot */}
      {isInPlanWorkspace && <RightPanel />}
    </>
  )}
</div>
```

**Step 3: Verify it builds**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds (or at least no errors in FloatingPanel/RightPanel)

**Step 4: Commit**

```bash
git add src/components/map-v2/FloatingPanel.tsx src/components/map-v2/RightPanel.tsx
git commit -m "feat(plan-workspace): add right panel slot to FloatingPanel"
```

---

### Task 3: Create PlanWorkspace Component with Header + Icon Strip

**Files:**
- Create: `src/components/map-v2/panels/PlanWorkspace.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useMapV2Store, type PlanSection } from "@/lib/map-v2-store";
import { useTerritoryPlan } from "@/lib/api";
import PlanOverviewSection from "./PlanOverviewSection";
import PlanTasksSection from "./PlanTasksSection";
import PlanContactsSection from "./PlanContactsSection";
import PlanPerfSection from "./PlanPerfSection";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  active: { bg: "bg-green-100", text: "text-green-700" },
  archived: { bg: "bg-amber-100", text: "text-amber-700" },
};

const PLAN_SECTIONS: Array<{ id: PlanSection; label: string; iconPath: string }> = [
  {
    id: "overview",
    label: "Overview",
    iconPath: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z",
  },
  {
    id: "tasks",
    label: "Tasks",
    iconPath: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13",
  },
  {
    id: "contacts",
    label: "Contacts",
    iconPath: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
  },
  {
    id: "performance",
    label: "Performance",
    iconPath: "M3 13V8M7 13V5M11 13V9M15 13V3",
  },
];

export default function PlanWorkspace() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const planSection = useMapV2Store((s) => s.planSection);
  const setPlanSection = useMapV2Store((s) => s.setPlanSection);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);

  const badge = plan ? STATUS_BADGE[plan.status] || STATUS_BADGE.draft : null;

  return (
    <div className="flex flex-col h-full">
      {/* Plan Header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={goBack}
            className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6L8 10" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isLoading ? (
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          ) : (
            <h2 className="text-sm font-bold text-gray-800 truncate flex-1">
              {plan?.name || "Plan"}
            </h2>
          )}
        </div>

        {/* Badges */}
        {plan && (
          <div className="flex gap-1.5 ml-8">
            {badge && (
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text} capitalize`}>
                {plan.status}
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/10 text-plum">
              FY {plan.fiscalYear}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
              {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Plan Icon Strip */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100">
        {PLAN_SECTIONS.map((section) => {
          const isActive = planSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setPlanSection(section.id)}
              className={`
                flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                transition-all duration-150
                ${isActive
                  ? "bg-plum/10 text-plum"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }
              `}
              title={section.label}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d={section.iconPath}
                  stroke={isActive ? "#403770" : "#9CA3AF"}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {planSection === "overview" && <PlanOverviewSection />}
        {planSection === "tasks" && <PlanTasksSection />}
        {planSection === "contacts" && <PlanContactsSection />}
        {planSection === "performance" && <PlanPerfSection />}
      </div>
    </div>
  );
}
```

**Step 2: Create placeholder section components**

Create each of these four files with a simple placeholder body. Example for `PlanOverviewSection.tsx`:

```tsx
"use client";

export default function PlanOverviewSection() {
  return (
    <div className="p-3 text-center py-8 text-xs text-gray-400">
      Overview section — coming in Task 5
    </div>
  );
}
```

Repeat for `PlanTasksSection.tsx` ("Tasks section — coming in Task 7"), `PlanContactsSection.tsx` ("Contacts section — coming in Task 9"), and `PlanPerfSection.tsx` ("Performance section — coming in Task 11").

**Step 3: Commit**

```bash
git add src/components/map-v2/panels/PlanWorkspace.tsx \
  src/components/map-v2/panels/PlanOverviewSection.tsx \
  src/components/map-v2/panels/PlanTasksSection.tsx \
  src/components/map-v2/panels/PlanContactsSection.tsx \
  src/components/map-v2/panels/PlanPerfSection.tsx
git commit -m "feat(plan-workspace): create PlanWorkspace shell with icon strip + placeholder sections"
```

---

### Task 4: Wire PlanWorkspace into PanelContent

**Files:**
- Modify: `src/components/map-v2/PanelContent.tsx`

**Step 1: Update the routing**

In `src/components/map-v2/PanelContent.tsx`, add the import and new routing cases:

```tsx
import PlanWorkspace from "./panels/PlanWorkspace";
```

Add these lines before the existing `PLAN_VIEW` case (around line 17-19):

```tsx
// Plan workspace states
if (["PLAN_OVERVIEW", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(panelState))
  return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;
```

Keep the existing `PLAN_VIEW` case but update it to also render PlanWorkspace (for backwards compat):

```tsx
if (panelState === "PLAN_VIEW") return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;
```

**Step 2: Verify it renders**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds. Navigating to a plan now shows the PlanWorkspace with header, icon strip, and placeholder content.

**Step 3: Commit**

```bash
git add src/components/map-v2/PanelContent.tsx
git commit -m "feat(plan-workspace): wire PlanWorkspace into PanelContent routing"
```

---

### Task 5: Build PlanOverviewSection (District List)

**Files:**
- Modify: `src/components/map-v2/panels/PlanOverviewSection.tsx`

**Step 1: Implement the full overview section**

Replace the placeholder in `PlanOverviewSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlan } from "@/lib/api";

type SortKey = "alpha" | "enrollment" | "state";

export default function PlanOverviewSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const setPanelState = useMapV2Store((s) => s.setPanelState);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const [sortBy, setSortBy] = useState<SortKey>("alpha");

  if (isLoading) return <OverviewSkeleton />;
  if (!plan) return <div className="text-center py-8 text-xs text-gray-400">Plan not found</div>;

  const districts = [...plan.districts].sort((a, b) => {
    if (sortBy === "enrollment") return (b.enrollment || 0) - (a.enrollment || 0);
    if (sortBy === "state") return (a.stateAbbrev || "").localeCompare(b.stateAbbrev || "");
    return a.name.localeCompare(b.name);
  });

  const totalEnrollment = plan.districts.reduce((sum, d) => sum + (d.enrollment || 0), 0);

  return (
    <div className="p-3 space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Districts</div>
          <div className="text-sm font-semibold text-gray-700">{plan.districts.length}</div>
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Total Enrollment</div>
          <div className="text-sm font-semibold text-gray-700">{totalEnrollment.toLocaleString()}</div>
        </div>
      </div>

      {/* Sort + Add */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["alpha", "enrollment", "state"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${
                sortBy === key ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {key === "alpha" ? "A-Z" : key === "enrollment" ? "Size" : "State"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPanelState("PLAN_ADD")}
          className="text-[11px] font-medium text-plum hover:text-plum/80 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* District list */}
      <div className="space-y-1">
        {districts.map((d) => (
          <button
            key={d.leaid}
            onClick={() => openRightPanel({ type: "district_card", id: d.leaid })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
          >
            <div
              className="w-2.5 h-2.5 rounded-md shrink-0"
              style={{ backgroundColor: plan.color || "#403770" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-700 truncate">{d.name}</div>
              <div className="text-xs text-gray-400">
                {d.stateAbbrev}
                {d.enrollment ? ` · ${d.enrollment.toLocaleString()}` : ""}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300 group-hover:text-gray-400">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
        {districts.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 mb-2">No districts in this plan yet</p>
            <button
              onClick={() => setPanelState("PLAN_ADD")}
              className="px-4 py-2 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all"
            >
              Add Districts
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
```

**Step 2: Verify it renders**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/map-v2/panels/PlanOverviewSection.tsx
git commit -m "feat(plan-workspace): implement PlanOverviewSection with district list + sorting"
```

---

### Task 6: Build DistrictCard Right Panel

**Files:**
- Create: `src/components/map-v2/right-panels/DistrictCard.tsx`
- Modify: `src/components/map-v2/RightPanel.tsx`

**Step 1: Create the DistrictCard component**

Create directory `src/components/map-v2/right-panels/` and file `DistrictCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail, useRemoveDistrictFromPlan } from "@/lib/api";

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

export default function DistrictCard({ leaid }: { leaid: string }) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const setPlanSection = useMapV2Store((s) => s.setPlanSection);

  const { data, isLoading } = useDistrictDetail(leaid);
  const removeMutation = useRemoveDistrictFromPlan();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const district = data?.district;
  const edu = data?.educationData;

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!district) {
    return <div className="text-center py-6 text-xs text-gray-400">District not found</div>;
  }

  const handleRemove = async () => {
    if (!activePlanId) return;
    try {
      await removeMutation.mutateAsync({ planId: activePlanId, leaid });
      closeRightPanel();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-gray-800 leading-tight">{district.name}</h3>
        <div className="text-xs text-gray-400 mt-0.5">
          {district.stateAbbrev}
          {district.countyName ? ` · ${district.countyName}` : ""}
          {district.locale ? ` · ${district.locale}` : ""}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatCard label="Enrollment" value={formatNumber(district.enrollment)} />
        <StatCard label="Schools" value={formatNumber(district.numberOfSchools)} />
        {edu?.studentTeacherRatio != null && (
          <StatCard label="Student:Teacher" value={`${edu.studentTeacherRatio.toFixed(1)}:1`} />
        )}
        {edu?.childrenPovertyPercent != null && (
          <StatCard label="% FRPL" value={`${edu.childrenPovertyPercent.toFixed(1)}%`} />
        )}
        {edu?.graduationRateTotal != null && (
          <StatCard label="Grad Rate" value={`${edu.graduationRateTotal.toFixed(1)}%`} />
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-1.5">
        <ActionButton
          label="Add Task"
          icon="M8 4V12M4 8H12"
          onClick={() => openRightPanel({ type: "task_form", id: leaid })}
        />
        <ActionButton
          label="View Contacts"
          icon="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13"
          onClick={() => setPlanSection("contacts")}
        />
        <ActionButton
          label="Open Full Profile"
          icon="M5 3H3V5M11 3H13V5M3 11V13H5M13 11V13H11"
          onClick={() => selectDistrict(leaid)}
        />
      </div>

      {/* Remove */}
      {confirmRemove ? (
        <div className="bg-red-50 rounded-xl p-2.5 space-y-2">
          <p className="text-xs text-red-600 font-medium">Remove this district from the plan?</p>
          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRemove(true)}
          className="w-full py-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
        >
          Remove from Plan
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs font-semibold text-gray-700">{value}</div>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d={icon} stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </button>
  );
}
```

**Step 2: Check if `useRemoveDistrictFromPlan` exists**

Search `src/lib/api.ts` for a remove district mutation. If it doesn't exist, you'll need to add one. The API route `DELETE /api/territory-plans/[id]/districts` or similar should exist. Check and add a hook if needed:

```typescript
export function useRemoveDistrictFromPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, leaid }: { planId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/territory-plans/${planId}/districts/${leaid}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
    },
  });
}
```

Note: You may also need to create the API route `DELETE /api/territory-plans/[id]/districts/[leaid]/route.ts` if it doesn't exist. Check first.

**Step 3: Wire DistrictCard into RightPanel**

Update `src/components/map-v2/RightPanel.tsx` to render the actual component:

```tsx
import DistrictCard from "./right-panels/DistrictCard";

// In the content area, replace the placeholder:
<div className="flex-1 overflow-y-auto p-3">
  {rightPanelContent.type === "district_card" && rightPanelContent.id && (
    <DistrictCard leaid={rightPanelContent.id} />
  )}
  {/* Other types rendered in later tasks */}
  {!["district_card"].includes(rightPanelContent.type) && (
    <div className="text-center py-8 text-xs text-gray-400">
      {rightPanelContent.type} — coming soon
    </div>
  )}
</div>
```

**Step 4: Commit**

```bash
git add src/components/map-v2/right-panels/DistrictCard.tsx \
  src/components/map-v2/RightPanel.tsx \
  src/lib/api.ts
git commit -m "feat(plan-workspace): add DistrictCard right panel with stats + actions"
```

---

### Task 7: Build PlanTasksSection (Task Checklist)

**Files:**
- Modify: `src/components/map-v2/panels/PlanTasksSection.tsx`

**Step 1: Implement the task checklist**

Replace the placeholder:

```tsx
"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useTasks, useUpdateTask } from "@/lib/api";
import type { TaskStatus } from "@/lib/taskTypes";
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from "@/lib/taskTypes";

const FILTER_OPTIONS: Array<{ label: string; value: TaskStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
];

export default function PlanTasksSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  const { data, isLoading } = useTasks({
    planId: activePlanId || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const updateTask = useUpdateTask();

  const tasks = data?.tasks || [];

  const toggleDone = (taskId: string, currentStatus: TaskStatus) => {
    updateTask.mutate({
      taskId,
      status: currentStatus === "done" ? "todo" : "done",
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex gap-1 px-3 pt-3 pb-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-lg transition-colors ${
              statusFilter === opt.value
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {isLoading ? (
          <TasksSkeleton />
        ) : tasks.length > 0 ? (
          tasks.map((task) => {
            const priorityCfg = TASK_PRIORITY_CONFIG[task.priority];
            const dueDateStr = formatDueDate(task.dueDate);
            const overdue = task.status !== "done" && isOverdue(task.dueDate);

            return (
              <div
                key={task.id}
                className="flex items-start gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer"
                onClick={() => openRightPanel({ type: "task_edit", id: task.id })}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDone(task.id, task.status);
                  }}
                  className={`w-4 h-4 rounded border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                    task.status === "done"
                      ? "bg-plum border-plum"
                      : "border-gray-300 hover:border-plum/50"
                  }`}
                >
                  {task.status === "done" && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${
                    task.status === "done" ? "text-gray-400 line-through" : "text-gray-700"
                  }`}>
                    {task.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {/* Priority badge */}
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded"
                      style={{ color: priorityCfg.color, backgroundColor: priorityCfg.color + "15" }}
                    >
                      {priorityCfg.icon} {priorityCfg.label}
                    </span>
                    {/* Due date */}
                    {dueDateStr && (
                      <span className={`text-[10px] ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                        {dueDateStr}
                      </span>
                    )}
                    {/* District count */}
                    {task.districts.length > 0 && (
                      <span className="text-[10px] text-gray-400">
                        {task.districts.length}d
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 mb-2">No tasks yet</p>
          </div>
        )}
      </div>

      {/* New Task button */}
      <div className="px-3 pb-3">
        <button
          onClick={() => openRightPanel({ type: "task_form" })}
          className="w-full py-2 bg-plum/10 text-plum text-xs font-medium rounded-xl hover:bg-plum/15 transition-all"
        >
          + New Task
        </button>
      </div>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2">
          <div className="w-4 h-4 rounded border-2 border-gray-200 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse mb-1" />
            <div className="h-2 bg-gray-100 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/panels/PlanTasksSection.tsx
git commit -m "feat(plan-workspace): implement PlanTasksSection with checklist + filters"
```

---

### Task 8: Build TaskForm Right Panel

**Files:**
- Create: `src/components/map-v2/right-panels/TaskForm.tsx`
- Modify: `src/components/map-v2/RightPanel.tsx`

**Step 1: Create the TaskForm component**

Create `src/components/map-v2/right-panels/TaskForm.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import {
  useTerritoryPlan,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/lib/api";
import { TASK_PRIORITIES, TASK_PRIORITY_CONFIG, type TaskPriority } from "@/lib/taskTypes";

interface TaskFormProps {
  taskId?: string;           // if editing existing task
  preLinkedLeaid?: string;   // if opened from district card "Add Task"
}

export default function TaskForm({ taskId, preLinkedLeaid }: TaskFormProps) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  const { data: plan } = useTerritoryPlan(activePlanId);
  const { data: existingTask } = useTask(taskId || null);

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [linkedLeaids, setLinkedLeaids] = useState<Set<string>>(new Set());

  // Pre-fill when editing
  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description || "");
      setPriority(existingTask.priority);
      setDueDate(existingTask.dueDate ? existingTask.dueDate.split("T")[0] : "");
      setLinkedLeaids(new Set(existingTask.districts.map((d) => d.leaid)));
    }
  }, [existingTask]);

  // Pre-link district if provided
  useEffect(() => {
    if (preLinkedLeaid && !taskId) {
      setLinkedLeaids(new Set([preLinkedLeaid]));
    }
  }, [preLinkedLeaid, taskId]);

  const handleSave = async () => {
    if (!title.trim()) return;

    try {
      if (taskId && existingTask) {
        await updateTask.mutateAsync({
          taskId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueDate: dueDate || null,
        });
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueDate: dueDate || null,
          status: "todo",
          planIds: activePlanId ? [activePlanId] : [],
          leaids: Array.from(linkedLeaids),
        });
      }
      closeRightPanel();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await deleteTask.mutateAsync(taskId);
      closeRightPanel();
    } catch {
      // Error handled by mutation
    }
  };

  const isSaving = createTask.isPending || updateTask.isPending;

  const toggleLeaid = (leaid: string) => {
    setLinkedLeaids((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details..."
          rows={2}
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 resize-none"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Priority</label>
        <div className="flex gap-1">
          {TASK_PRIORITIES.map((p) => {
            const cfg = TASK_PRIORITY_CONFIG[p];
            const isSelected = priority === p;
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
                  isSelected ? "text-white" : "text-gray-500 bg-gray-50 hover:bg-gray-100"
                }`}
                style={isSelected ? { backgroundColor: cfg.color } : undefined}
              >
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
        />
      </div>

      {/* Link to districts */}
      {plan && plan.districts.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
            Districts ({linkedLeaids.size} selected)
          </label>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {plan.districts.map((d) => (
              <label
                key={d.leaid}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={linkedLeaids.has(d.leaid)}
                  onChange={() => toggleLeaid(d.leaid)}
                  className="w-3 h-3 rounded accent-[#403770]"
                />
                <span className="text-xs text-gray-600 truncate">{d.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Save / Delete */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="w-full py-2 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : taskId ? "Update Task" : "Create Task"}
        </button>
        {taskId && (
          <button
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className="w-full py-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            {deleteTask.isPending ? "Deleting..." : "Delete Task"}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Wire TaskForm into RightPanel**

Update `src/components/map-v2/RightPanel.tsx`:

```tsx
import TaskForm from "./right-panels/TaskForm";

// In content area:
{rightPanelContent.type === "task_form" && (
  <TaskForm preLinkedLeaid={rightPanelContent.id} />
)}
{rightPanelContent.type === "task_edit" && rightPanelContent.id && (
  <TaskForm taskId={rightPanelContent.id} />
)}
```

**Step 3: Commit**

```bash
git add src/components/map-v2/right-panels/TaskForm.tsx src/components/map-v2/RightPanel.tsx
git commit -m "feat(plan-workspace): add TaskForm right panel for create/edit tasks"
```

---

### Task 9: Build PlanContactsSection

**Files:**
- Modify: `src/components/map-v2/panels/PlanContactsSection.tsx`

**Step 1: Implement the contacts section**

Replace the placeholder:

```tsx
"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { usePlanContacts, useTerritoryPlan } from "@/lib/api";
import type { Contact } from "@/lib/api";

export default function PlanContactsSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data: plan } = useTerritoryPlan(activePlanId);
  const { data: contacts, isLoading } = usePlanContacts(activePlanId);

  if (isLoading) return <ContactsSkeleton />;

  // Group contacts by district leaid
  const districtMap = new Map<string, { name: string; contacts: Contact[] }>();

  // Initialize with plan districts (so districts with no contacts still show)
  plan?.districts.forEach((d) => {
    districtMap.set(d.leaid, { name: d.name, contacts: [] });
  });

  // Assign contacts to their district
  contacts?.forEach((contact) => {
    const entry = districtMap.get(contact.leaid);
    if (entry) {
      entry.contacts.push(contact);
    } else {
      districtMap.set(contact.leaid, { name: contact.leaid, contacts: [contact] });
    }
  });

  const groups = Array.from(districtMap.entries()).filter(
    ([, { contacts: c }]) => c.length > 0
  );

  const emptyDistricts = Array.from(districtMap.entries()).filter(
    ([, { contacts: c }]) => c.length === 0
  );

  return (
    <div className="p-3 space-y-3">
      {groups.length === 0 && emptyDistricts.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400">
          No contacts found for this plan
        </div>
      ) : (
        <>
          {groups.map(([leaid, { name, contacts: districtContacts }]) => (
            <div key={leaid}>
              {/* District header */}
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {name}
              </div>
              <div className="space-y-1">
                {districtContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => openRightPanel({ type: "contact_detail", id: String(contact.id) })}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                  >
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-gray-500">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{contact.name}</span>
                        {contact.isPrimary && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                            <path d="M5 1L6.1 3.5L8.8 3.8L6.9 5.5L7.4 8.2L5 6.9L2.6 8.2L3.1 5.5L1.2 3.8L3.9 3.5L5 1Z" fill="#F59E0B" />
                          </svg>
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-[10px] text-gray-400 truncate">{contact.title}</div>
                      )}
                    </div>
                    {/* Quick actions on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-200"
                          title="Email"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <rect x="1" y="2.5" width="10" height="7" rx="1" stroke="#9CA3AF" strokeWidth="1" />
                            <path d="M1 3.5L6 7L11 3.5" stroke="#9CA3AF" strokeWidth="1" />
                          </svg>
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-200"
                          title="Call"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M4.5 2L3 4.5L5.5 7L7.5 9L10 7.5L8 6L7 7L5 5L6 4L4.5 2Z" stroke="#9CA3AF" strokeWidth="1" strokeLinejoin="round" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {emptyDistricts.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[10px] font-medium text-gray-300 uppercase tracking-wider mb-1">
                No contacts ({emptyDistricts.length} district{emptyDistricts.length !== 1 ? "s" : ""})
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContactsSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-2.5 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
          <div className="space-y-1">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2 px-2.5 py-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-1 animate-pulse" />
                  <div className="h-2 bg-gray-100 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/panels/PlanContactsSection.tsx
git commit -m "feat(plan-workspace): implement PlanContactsSection grouped by district"
```

---

### Task 10: Build ContactDetail Right Panel

**Files:**
- Create: `src/components/map-v2/right-panels/ContactDetail.tsx`
- Modify: `src/components/map-v2/RightPanel.tsx`

**Step 1: Create ContactDetail component**

Create `src/components/map-v2/right-panels/ContactDetail.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { usePlanContacts, useUpdateContact, useDeleteContact } from "@/lib/api";
import type { Contact } from "@/lib/api";

export default function ContactDetail({ contactId }: { contactId: string }) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data: contacts } = usePlanContacts(activePlanId);
  const deleteMutation = useDeleteContact();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const contact = contacts?.find((c) => String(c.id) === contactId);

  if (!contact) {
    return <div className="text-center py-6 text-xs text-gray-400">Contact not found</div>;
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(contact.id);
      closeRightPanel();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-3">
      {/* Avatar + Name */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-plum/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-plum">
            {contact.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-800">{contact.name}</div>
          {contact.title && (
            <div className="text-xs text-gray-500 truncate">{contact.title}</div>
          )}
        </div>
        {contact.isPrimary && (
          <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
            Primary
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="space-y-2">
        {contact.email && (
          <InfoRow
            label="Email"
            value={contact.email}
            href={`mailto:${contact.email}`}
          />
        )}
        {contact.phone && (
          <InfoRow
            label="Phone"
            value={contact.phone}
            href={`tel:${contact.phone}`}
          />
        )}
        {contact.linkedinUrl && (
          <InfoRow
            label="LinkedIn"
            value="View Profile"
            href={contact.linkedinUrl}
            external
          />
        )}
        {contact.persona && (
          <InfoRow label="Role" value={contact.persona.replace(/_/g, " ")} />
        )}
        {contact.seniorityLevel && (
          <InfoRow label="Seniority" value={contact.seniorityLevel.replace(/_/g, " ")} />
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={() => openRightPanel({ type: "task_form", id: contact.leaid })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 4V12M4 8H12" stroke="#6B7280" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-medium text-gray-600">Add Task</span>
        </button>
      </div>

      {/* Delete */}
      {confirmDelete ? (
        <div className="bg-red-50 rounded-xl p-2.5 space-y-2">
          <p className="text-xs text-red-600 font-medium">Delete this contact?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full py-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
        >
          Delete Contact
        </button>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-xs text-plum hover:underline text-right max-w-[180px] truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-xs text-gray-700 text-right max-w-[180px] truncate capitalize">{value}</span>
      )}
    </div>
  );
}
```

**Step 2: Check if `useDeleteContact` and `useUpdateContact` exist in api.ts**

Search for them — if missing, add:

```typescript
export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/contacts/${contactId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planContacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
```

**Step 3: Wire into RightPanel**

Update `src/components/map-v2/RightPanel.tsx`:

```tsx
import ContactDetail from "./right-panels/ContactDetail";

// Add to content area:
{rightPanelContent.type === "contact_detail" && rightPanelContent.id && (
  <ContactDetail contactId={rightPanelContent.id} />
)}
```

**Step 4: Commit**

```bash
git add src/components/map-v2/right-panels/ContactDetail.tsx \
  src/components/map-v2/RightPanel.tsx \
  src/lib/api.ts
git commit -m "feat(plan-workspace): add ContactDetail right panel with info + actions"
```

---

### Task 11: Build PlanPerfSection (Performance / Pipeline)

**Files:**
- Modify: `src/components/map-v2/panels/PlanPerfSection.tsx`

**Step 1: Implement the performance section**

Replace the placeholder:

```tsx
"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlan, useTasks } from "@/lib/api";

export default function PlanPerfSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const { data: tasksData } = useTasks({ planId: activePlanId || undefined });

  if (isLoading) return <PerfSkeleton />;
  if (!plan) return <div className="text-center py-8 text-xs text-gray-400">Plan not found</div>;

  // Pipeline Targeted: sum of revenueTarget from plan districts
  const pipelineTargeted = plan.districts.reduce((sum, d) => sum + (d.revenueTarget || 0), 0);

  // Overdue tasks count
  const now = new Date();
  const overdueTasks = (tasksData?.tasks || []).filter(
    (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now
  ).length;

  const completedTasks = (tasksData?.tasks || []).filter((t) => t.status === "done").length;
  const totalTasks = tasksData?.tasks.length || 0;

  return (
    <div className="p-3 space-y-3">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Pipeline Targeted"
          value={pipelineTargeted > 0 ? formatCurrency(pipelineTargeted) : "—"}
          available={pipelineTargeted > 0}
        />
        <MetricCard
          label="Open Pipeline"
          value="—"
          available={false}
          note="Data not yet available"
        />
        <MetricCard
          label="Closed Won"
          value="—"
          available={false}
          note="Data not yet available"
        />
        <MetricCard
          label="Revenue"
          value="—"
          available={false}
          note="Data not yet available"
        />
      </div>

      {/* Status bars */}
      <div className="space-y-2 pt-1">
        <StatusRow
          label="Districts in plan"
          value={String(plan.districts.length)}
        />
        {totalTasks > 0 && (
          <StatusRow
            label="Tasks completed"
            value={`${completedTasks} of ${totalTasks}`}
            progress={completedTasks / totalTasks}
          />
        )}
        {overdueTasks > 0 && (
          <StatusRow
            label="Overdue tasks"
            value={String(overdueTasks)}
            alert
          />
        )}
      </div>

      {/* Note */}
      <div className="text-center pt-4">
        <p className="text-[10px] text-gray-300">
          Pipeline and revenue metrics will update as data becomes available
        </p>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function MetricCard({
  label,
  value,
  available,
  note,
}: {
  label: string;
  value: string;
  available: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-2.5">
      <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-semibold ${available ? "text-gray-700" : "text-gray-300"}`}>
        {value}
      </div>
      {note && !available && (
        <div className="text-[9px] text-gray-300 mt-0.5">{note}</div>
      )}
    </div>
  );
}

function StatusRow({
  label,
  value,
  progress,
  alert,
}: {
  label: string;
  value: string;
  progress?: number;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 flex-1">{label}</span>
      <span className={`text-xs font-medium ${alert ? "text-red-500" : "text-gray-700"}`}>{value}</span>
      {progress != null && (
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-plum rounded-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PerfSkeleton() {
  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/panels/PlanPerfSection.tsx
git commit -m "feat(plan-workspace): implement PlanPerfSection with metrics + status bars"
```

---

### Task 12: Run Full Build + Store Tests

**Step 1: Run store tests**

Run: `cd territory-plan && npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: PASS

**Step 2: Run full build**

Run: `cd territory-plan && npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds with no errors.

**Step 3: Fix any build errors**

Address any TypeScript or import errors discovered during build. Common issues:
- Missing exports from `map-v2-store.ts` (ensure `PlanSection`, `RightPanelContent` are exported)
- Missing API hooks (`useRemoveDistrictFromPlan`, `useDeleteContact`) — add if needed
- Import path typos in RightPanel.tsx

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(plan-workspace): resolve build errors from plan workspace integration"
```

---

## Summary

| Task | Component | Commit |
|------|-----------|--------|
| 1 | Zustand store + tests | `feat: add plan section state + right panel to store` |
| 2 | FloatingPanel 3-slot + RightPanel shell | `feat: add right panel slot to FloatingPanel` |
| 3 | PlanWorkspace + icon strip + placeholders | `feat: create PlanWorkspace shell with icon strip` |
| 4 | PanelContent routing | `feat: wire PlanWorkspace into PanelContent routing` |
| 5 | PlanOverviewSection | `feat: implement PlanOverviewSection with district list` |
| 6 | DistrictCard right panel | `feat: add DistrictCard right panel with stats + actions` |
| 7 | PlanTasksSection | `feat: implement PlanTasksSection with checklist` |
| 8 | TaskForm right panel | `feat: add TaskForm right panel for create/edit` |
| 9 | PlanContactsSection | `feat: implement PlanContactsSection grouped by district` |
| 10 | ContactDetail right panel | `feat: add ContactDetail right panel` |
| 11 | PlanPerfSection | `feat: implement PlanPerfSection with metrics` |
| 12 | Build validation | `fix: resolve build errors` |
