# Implementation Plan: Feed Task Pagination & Day Navigation

**Date:** 2026-03-19
**Spec:** `docs/superpowers/specs/2026-03-19-feed-task-pagination-spec.md`
**Branch:** worktree-feed-task-pagination

## Task Overview

All work is frontend-only. No backend changes needed.

---

### Task 1: Create `DayNavigator` component

**File:** `src/features/home/components/DayNavigator.tsx`

A date header bar with prev/next chevron arrows.

**Props:**
- `selectedDate: string` (YYYY-MM-DD)
- `onPrev: () => void`
- `onNext: () => void`
- `hasPrev: boolean`
- `hasNext: boolean`

**Behavior:**
- Display date as "Thursday, March 19, 2026" format
- Left/right chevron buttons (ChevronLeft, ChevronRight from lucide-react)
- Disabled state when `hasPrev`/`hasNext` is false
- Styling per pagination.md: `w-8 h-8 rounded-lg` buttons, disabled = `text-[#A69DC0] cursor-not-allowed opacity-50`

**Test strategy:** Visual component, no complex logic to test independently.

---

### Task 2: Create `FeedControls` component

**File:** `src/features/home/components/FeedControls.tsx`

Controls bar with completed toggle and page size dropdown.

**Props:**
- `showCompleted: boolean`
- `onToggleCompleted: () => void`
- `pageSize: number`
- `onPageSizeChange: (size: number) => void`

**Behavior:**
- Left side: toggle switch (per Forms/toggle.md) + "Show Completed" label
- Right side: "Showing:" label + native `<select>` with options 5, 10, 25, 50
- Select styling per Forms/select.md: `border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390]`
- Toggle: track `w-8 h-[18px] rounded-full`, off `bg-[#C2BBD4]`, on `bg-[#403770]`, thumb `w-[14px] h-[14px]`

**Test strategy:** Visual component with simple state passthrough.

---

### Task 3: Refactor `FeedTab.tsx` — core logic

**File:** `src/features/home/components/FeedTab.tsx`

This is the main task. Refactor to add day navigation, pagination, and completed toggle.

**New state:**
```typescript
const [selectedDate, setSelectedDate] = useState<string>(getToday());
const [pageSize, setPageSize] = useState<number>(5);
const [showCompleted, setShowCompleted] = useState<boolean>(true);
```

**New computed values:**

1. **`allTasks`** — all tasks from `useTasks({})`
2. **`overdueTasks`** — tasks where `status !== "done" && dueDate < today` (unchanged, always shown)
3. **`incompleteTasks`** — all tasks where `status !== "done"` (for empty state check)
4. **`daysWithTasks`** — sorted unique dates from all non-overdue tasks that have tasks (computed from allTasks, includes "no-due-date" as a virtual day at the end)
5. **`selectedDayTasks`** — tasks for `selectedDate`, filtered by `showCompleted`, sorted by priority order (urgent=0, high=1, medium=2, low=3)
6. **`paginatedTasks`** — `selectedDayTasks.slice(0, pageSize)`
7. **`prevDay` / `nextDay`** — previous/next date in `daysWithTasks` relative to `selectedDate`; null if at boundary

**Day navigation logic:**
- On mount: start at today. If today has no tasks, jump to the nearest future day with tasks (or nearest past day if no future tasks).
- Prev/next arrows: jump to adjacent entry in `daysWithTasks`
- Tasks with `dueDate === null`: grouped under a virtual "No Due Date" entry at the end of `daysWithTasks`

**Updated render:**
1. `<DayNavigator>` at top
2. `<FeedSummaryCards>` (unchanged)
3. `<FeedControls>`
4. Overdue section (always visible when overdue tasks exist — unchanged logic)
5. Day's tasks section using `<FeedSection>` with paginated task rows
6. Task count: `Showing {paginatedTasks.length} of {selectedDayTasks.length} tasks`
7. Activities + Meetings sections (unchanged)
8. Empty state: only when `incompleteTasks.length === 0 && activitiesNeedNextSteps.length === 0 && meetingsToLog.length === 0`

**Dependencies:** Tasks 1 and 2 (DayNavigator and FeedControls components)

---

### Task 4: Update `TaskRow` usage for completed tasks

**File:** `src/features/home/components/FeedTab.tsx`

When rendering day tasks, pass `isCompleted={task.status === "done"}` to `TaskRow` so completed tasks show with line-through styling. The `TaskRow` component already supports this prop — just needs to be wired up in FeedTab.

Also: when a task is completed via the checkbox, if `showCompleted` is false, it should disappear from the list immediately (React Query invalidation handles this naturally).

**Dependencies:** Task 3

---

## Execution Order

Tasks 1 & 2 can be done in parallel (independent components).
Task 3 depends on 1 & 2.
Task 4 is a small addition within Task 3 (can be combined).

**Recommended:** Dispatch Tasks 1+2 in parallel, then Task 3+4 together.

## Test Strategy

- Primary testing: manual verification in dev server
- The logic is mostly array filtering/sorting which is straightforward
- React Query handles data fetching/caching — no custom data layer to test
