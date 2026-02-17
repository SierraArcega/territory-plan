# Map-v2 Activity Creation Parity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full activity creation, editing, and management to the map-v2 plan workspace, with a global-style form and updated tab layout.

**Architecture:** Add `PLAN_ACTIVITIES` panel state + `"activities"` plan section. Create `PlanActivitiesSection` (list + filters) and `ActivityForm` (right panel). Rename the "overview" section to "districts" and reorder tabs. Reuse existing `useActivities`, `useCreateActivity`, `useUpdateActivity`, `useDeleteActivity` hooks from `src/lib/api.ts` and type configs from `src/lib/activityTypes.ts`.

**Tech Stack:** React 19, TypeScript, Zustand (map-v2-store), TanStack Query (api hooks), Tailwind CSS 4

---

### Task 1: Update store types — add activities to PanelState, PlanSection, RightPanelContent

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Update PanelState union**

Add `"PLAN_ACTIVITIES"` to the `PanelState` type (line 9-19):

```typescript
export type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"
  | "PLAN_ADD"
  | "PLAN_OVERVIEW"
  | "PLAN_ACTIVITIES"
  | "PLAN_TASKS"
  | "PLAN_CONTACTS"
  | "PLAN_PERF";
```

**Step 2: Update PlanSection type**

Change `PlanSection` (line 25) to include `"activities"` and rename `"overview"` to `"districts"`:

```typescript
export type PlanSection = "districts" | "activities" | "tasks" | "contacts" | "performance";
```

**Step 3: Update RightPanelContent type**

Add `"activity_form"` and `"activity_edit"` to the type union (line 27-30):

```typescript
export interface RightPanelContent {
  type: "district_card" | "task_form" | "task_edit" | "activity_form" | "activity_edit" | "contact_detail" | "contact_form";
  id?: string;
}
```

**Step 4: Update setPlanSection action**

Update the `sectionToState` mapping (line 352-360) to use new section names:

```typescript
setPlanSection: (section) => {
  const sectionToState: Record<PlanSection, PanelState> = {
    districts: "PLAN_OVERVIEW",
    activities: "PLAN_ACTIVITIES",
    tasks: "PLAN_TASKS",
    contacts: "PLAN_CONTACTS",
    performance: "PLAN_PERF",
  };
  set({ planSection: section, panelState: sectionToState[section], rightPanelContent: null });
},
```

**Step 5: Update viewPlan action**

Change the default `planSection` from `"overview"` to `"districts"` (line 322-329):

```typescript
viewPlan: (planId) =>
  set((s) => ({
    activePlanId: planId,
    panelState: "PLAN_OVERVIEW",
    panelHistory: [...s.panelHistory, s.panelState],
    planSection: "districts" as PlanSection,
    rightPanelContent: null,
  })),
```

**Step 6: Update initial state**

Change the initial `planSection` from `"overview"` to `"districts"` (line 214):

```typescript
planSection: "districts" as PlanSection,
```

**Step 7: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat(map-v2): add activities to store types, rename overview → districts"
```

---

### Task 2: Update PanelContent router and PlanWorkspace tabs

**Files:**
- Modify: `src/components/map-v2/PanelContent.tsx`
- Modify: `src/components/map-v2/panels/PlanWorkspace.tsx`

**Step 1: Update PanelContent router**

Add `"PLAN_ACTIVITIES"` to the plan workspace state check (line 20):

```typescript
if (["PLAN_OVERVIEW", "PLAN_ACTIVITIES", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(panelState))
  return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;
```

**Step 2: Update PlanWorkspace ICON_TABS**

Replace the `ICON_TABS` array (line 17-42) with the new 5-tab layout:

```typescript
const ICON_TABS: { key: PlanSection; label: string; path: string; stroke?: boolean }[] = [
  {
    key: "districts",
    label: "Districts",
    path: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z",
    stroke: false,
  },
  {
    key: "activities",
    label: "Activities",
    path: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M8 14C11.3 14 14 11.3 14 8S11.3 2 8 2 2 4.7 2 8 4.7 14 8 14Z",
    stroke: true,
  },
  {
    key: "tasks",
    label: "Tasks",
    path: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13",
    stroke: true,
  },
  {
    key: "contacts",
    label: "Contacts",
    path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
    stroke: true,
  },
  {
    key: "performance",
    label: "Performance",
    path: "M3 13V8M7 13V5M11 13V9M15 13V3",
    stroke: true,
  },
];
```

**Step 3: Update PlanWorkspace section content renderer**

Add the import for PlanActivitiesSection and update the section switch (lines 6, 119-122):

```typescript
import PlanActivitiesSection from "./PlanActivitiesSection";
```

Update the section content area:

```typescript
{planSection === "districts" && <PlanOverviewSection />}
{planSection === "activities" && <PlanActivitiesSection />}
{planSection === "tasks" && <PlanTasksSection />}
{planSection === "contacts" && <PlanContactsSection />}
{planSection === "performance" && <PlanPerfSection />}
```

**Step 4: Commit**

```bash
git add src/components/map-v2/PanelContent.tsx src/components/map-v2/panels/PlanWorkspace.tsx
git commit -m "feat(map-v2): update tab layout — districts, activities, tasks, contacts, performance"
```

---

### Task 3: Create PlanActivitiesSection component

**Files:**
- Create: `src/components/map-v2/panels/PlanActivitiesSection.tsx`

**Step 1: Build the activities list section**

Follow the same pattern as `PlanTasksSection.tsx` — filter chips at top, activity rows, "New Activity" button at bottom.

Key behaviors:
- Fetch activities using `useActivities({ planId: activePlanId })` with optional status filter
- Filter chips: All / Planned / Completed / Cancelled
- Each row shows: type icon (from `ACTIVITY_TYPE_ICONS`), title, date range, status badge, district count
- Click row → `openRightPanel({ type: "activity_edit", id: activity.id })`
- "New Activity" button → `openRightPanel({ type: "activity_form" })`
- Include loading skeleton and empty state

Activity row layout (compact, matches task row style):
```
[icon] Title                             [status badge] [date] [3d]
```

Use `ACTIVITY_TYPE_ICONS` from `@/lib/activityTypes` for the row icon. Use `ACTIVITY_STATUS_CONFIG` for status badge colors.

**Step 2: Commit**

```bash
git add src/components/map-v2/panels/PlanActivitiesSection.tsx
git commit -m "feat(map-v2): create PlanActivitiesSection with filters and activity list"
```

---

### Task 4: Create ActivityForm right panel component

**Files:**
- Create: `src/components/map-v2/right-panels/ActivityForm.tsx`

**Step 1: Build the activity creation/editing form**

Follow the same structural pattern as `TaskForm.tsx` but with activity-specific fields. This is the full global form.

Props:
```typescript
interface ActivityFormProps {
  activityId?: string;          // edit mode
  preLinkedLeaid?: string;      // pre-select district when opened from DistrictCard
}
```

Form fields (in order):
1. **Type** — grouped dropdown or pill selector by category (Engagement, Outreach, Meetings). Use `ACTIVITY_CATEGORIES` from `activityTypes.ts`.
2. **Title** — text input (required)
3. **Start Date** — date input
4. **End Date** — date input (optional, shown when "multi-day" toggled)
5. **Status** — pill buttons: planned / completed / cancelled. Use `ACTIVITY_STATUS_CONFIG` colors.
6. **Plans** — checkbox list of user's plans. Pre-check the current `activePlanId`. Fetch plans with `useTerritoryPlans()`.
7. **Districts** — checkbox list from the currently selected plans' districts. Pre-check `preLinkedLeaid` if provided.
8. **Contacts** — checkbox list, filtered by selected districts. Use `useDistrictDetail()` for each selected district to get contacts, or simplify to show contacts from current plan's districts.
9. **Notes** — textarea

Hooks to use:
- `useActivity(activityId)` — load existing for edit mode
- `useCreateActivity()` — create new
- `useUpdateActivity()` — update existing
- `useDeleteActivity()` — delete (edit mode only)
- `useTerritoryPlans()` — for plan multi-select
- `useTerritoryPlan(activePlanId)` — for district list

Actions: Save / Delete (with confirmation, edit mode only)

For create, call:
```typescript
createActivity.mutateAsync({
  type,
  title: title.trim(),
  startDate: startDate || null,
  endDate: endDate || null,
  status,
  notes: notes.trim() || null,
  planIds: Array.from(selectedPlanIds),
  districtLeaids: Array.from(selectedLeaids),
  contactIds: Array.from(selectedContactIds),
})
```

For update, call:
```typescript
updateActivity.mutateAsync({
  activityId,
  type,
  title: title.trim(),
  startDate: startDate || null,
  endDate: endDate || null,
  status,
  notes: notes.trim() || null,
})
```

Note: Plan/district/contact linking on updates uses separate link/unlink mutations — for the initial implementation, only link on create and allow field edits on update. We can add link management later.

**Step 2: Commit**

```bash
git add src/components/map-v2/right-panels/ActivityForm.tsx
git commit -m "feat(map-v2): create ActivityForm right panel with full global form"
```

---

### Task 5: Wire ActivityForm into RightPanel router

**Files:**
- Modify: `src/components/map-v2/RightPanel.tsx`

**Step 1: Add ActivityForm import and routing**

Add import:
```typescript
import ActivityForm from "./right-panels/ActivityForm";
```

Add to the header title mapping (line 17-22):
```typescript
{rightPanelContent.type === "activity_form" && "New Activity"}
{rightPanelContent.type === "activity_edit" && "Edit Activity"}
```

Add to the content area (line 35-44):
```typescript
{rightPanelContent.type === "activity_form" && (
  <ActivityForm preLinkedLeaid={rightPanelContent.id} />
)}
{rightPanelContent.type === "activity_edit" && rightPanelContent.id && (
  <ActivityForm activityId={rightPanelContent.id} />
)}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/RightPanel.tsx
git commit -m "feat(map-v2): wire ActivityForm into RightPanel router"
```

---

### Task 6: Add "Add Activity" button to DistrictCard

**Files:**
- Modify: `src/components/map-v2/right-panels/DistrictCard.tsx`

**Step 1: Add activity button to plan actions footer**

Add a new button between the existing "Add Task" button and the "Remove from Plan" button (after line 118):

```typescript
<button
  onClick={() => openRightPanel({ type: "activity_form", id: leaid })}
  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
>
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-gray-400">
    <path
      d="M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M8 14C11.3 14 14 11.3 14 8S11.3 2 8 2 2 4.7 2 8 4.7 14 8 14Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
  Add Activity
</button>
```

**Step 2: Commit**

```bash
git add src/components/map-v2/right-panels/DistrictCard.tsx
git commit -m "feat(map-v2): add 'Add Activity' button to DistrictCard footer"
```

---

### Task 7: Verify and fix any remaining references to old section names

**Files:**
- Potentially modify: any file referencing `"overview"` as a PlanSection value

**Step 1: Search for stale references**

Search codebase for `planSection.*overview` or `"overview"` in map-v2 related files. Common spots:
- `PlanWorkspace.tsx` — already updated in Task 2
- `map-v2-store.ts` — already updated in Task 1
- Any other component referencing `setPlanSection("overview")`

**Step 2: Fix any found references**

Replace `"overview"` with `"districts"` in all PlanSection contexts.

**Step 3: Manual verification**

Run `npm run dev` and verify:
- Plan workspace opens to Districts tab by default
- All 5 tabs (Districts, Activities, Tasks, Contacts, Performance) render and switch correctly
- "New Activity" button opens the ActivityForm in the right panel
- Creating an activity from the form saves and appears in the list
- Clicking an activity row opens it in edit mode
- DistrictCard shows both "Add Task" and "Add Activity" buttons
- "Add Activity" from DistrictCard pre-selects that district

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(map-v2): clean up stale overview references, verify activity creation flow"
```
