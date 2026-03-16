# Click-Nav Titles Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make activity row clicks open the full `activity_edit` right panel consistently across `PlanActivitiesSection` and the `ExploreOverlay` activities tab.

**Architecture:** Two isolated edits. `PlanActivitiesSection` already has the right click behavior — add `group-hover:underline` to the title span for visual affordance. `ExploreOverlay` needs an `"activities"` branch added to `handleRowClick` so row clicks open the right panel instead of doing nothing.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Zustand (map store)

**Spec:** `docs/superpowers/specs/2026-03-15-click-nav-titles-design.md`

---

## Chunk 1: Branch + PlanActivitiesSection

### Task 1: Create branch

**Files:**
- No file changes

- [ ] **Step 1: Create and check out branch**

Run:
```bash
git checkout main && git pull && git checkout -b click-nav-titles
```
Expected: `Switched to a new branch 'click-nav-titles'`

---

### Task 2: Add hover underline to activity title in PlanActivitiesSection

**Files:**
- Modify: `src/features/map/components/panels/PlanActivitiesSection.tsx:174-179`

Context: `ActivityRow` renders a title `<span>` inside a `<div>` that already has the `group` class. Adding `group-hover:underline` to the span makes the underline appear whenever the full row is hovered — consistent with the row-level click target.

Current code (lines 174–179):
```tsx
<span
  className="flex-1 text-xs text-gray-700 font-medium truncate"
  title={activity.title}
>
  {activity.title}
</span>
```

- [ ] **Step 1: Add `group-hover:underline` to the title span**

Replace the `className` on the title span:
```tsx
<span
  className="flex-1 text-xs text-gray-700 font-medium truncate group-hover:underline"
  title={activity.title}
>
  {activity.title}
</span>
```

- [ ] **Step 2: Verify visually in browser**

Navigate to the map → open a plan that has activities in the left panel activities section.
Hover over an activity row.
Expected: the title text underlines.
Expected: clicking the row still opens the `activity_edit` right panel with the correct activity pre-filled.

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/panels/PlanActivitiesSection.tsx
git commit -m "feat: add group-hover:underline to activity title in PlanActivitiesSection"
```

---

## Chunk 2: ExploreOverlay activities row click

### Task 3: Wire activity row clicks in ExploreOverlay

**Files:**
- Modify: `src/features/map/components/explore/ExploreOverlay.tsx:209-215`

Context: `handleRowClick` (lines 209–215) currently has two branches — `"districts"` and `"plans"`. Add a third for `"activities"`. The `row.id` guard matches the existing `"plans"` pattern. The `RightPanelContent` union already includes `"activity_edit"` and `RightPanel.tsx` already renders `ActivityForm` for that type.

Current code:
```ts
const handleRowClick = (row: Record<string, unknown>) => {
  if (exploreEntity === "districts" && row.leaid) {
    openRightPanel({ type: "district_card", id: row.leaid as string });
  } else if (exploreEntity === "plans" && row.id) {
    openRightPanel({ type: "plan_card", id: row.id as string });
  }
};
```

- [ ] **Step 1: Add the `"activities"` branch**

```ts
const handleRowClick = (row: Record<string, unknown>) => {
  if (exploreEntity === "districts" && row.leaid) {
    openRightPanel({ type: "district_card", id: row.leaid as string });
  } else if (exploreEntity === "plans" && row.id) {
    openRightPanel({ type: "plan_card", id: row.id as string });
  } else if (exploreEntity === "activities" && row.id) {
    openRightPanel({ type: "activity_edit", id: row.id as string });
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Verify visually in browser**

Navigate to the map → open Explore → switch to the Activities tab.
Expected: rows now show `cursor-pointer` on hover (DataGrid already applies this when `onRowClick` is provided) and `hover:bg-[#EFEDF5]` row highlight.
Click any activity row.
Expected: the `activity_edit` right panel slides open with the correct activity pre-filled (title, type, status, notes, dates all populated).
Click a task or contact row (if switching to those tabs).
Expected: nothing happens — no panel opens.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/explore/ExploreOverlay.tsx
git commit -m "feat: wire activity row clicks to activity_edit panel in ExploreOverlay"
```

---

## Final Check

- [ ] Run full test suite: `npx vitest run`
- [ ] Confirm no TypeScript errors: `npx tsc --noEmit`
- [ ] Use superpowers:finishing-a-development-branch to ship
