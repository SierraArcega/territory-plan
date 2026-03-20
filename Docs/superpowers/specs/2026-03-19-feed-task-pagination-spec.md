# Feature Spec: Feed Task Pagination & Day Navigation

**Date:** 2026-03-19
**Slug:** feed-task-pagination
**Branch:** worktree-feed-task-pagination

## Requirements

The Home > Feed currently shows only "today's" overdue tasks, activities needing next steps, and meetings to log — with an "All caught up!" empty state that triggers too easily. Users need to see all upcoming tasks with proper pagination and day-by-day navigation.

**Core requirements:**
1. Replace the flat feed with a day-focused view showing tasks for a selected date
2. Day navigation arrows (prev/next) that skip days with no tasks
3. Dropdown selector for page size: 5 (default), 10, 25, 50
4. Toggle to show/hide completed tasks (show by default)
5. Overdue tasks always pinned at top regardless of which day is viewed
6. Activity and meeting feed sections remain below the task list
7. "All caught up" only shows when the user genuinely has zero incomplete tasks across ALL days

## Visual Design

**Approved approach: Day-Focused Feed (Direction A)**

Layout (top to bottom):
1. **Date header bar** — `◄  Thursday, March 19, 2026  ►` with chevron navigation arrows
2. **Summary cards** — existing 5-card grid (unchanged, global counts)
3. **Controls bar** — left: completed toggle (`☑ Show Completed`), right: page size dropdown (`Showing: [5 ▼]`)
4. **Overdue section** — pinned coral-dotted section (always visible when overdue tasks exist, regardless of selected day)
5. **Day's tasks** — task rows for the selected date, sorted by priority (urgent > high > medium > low), paginated by dropdown selection
6. **Task count footer** — `Showing X of Y tasks`
7. **Activities Need Next Steps** — existing section (unchanged)
8. **Meetings to Log** — existing section (unchanged)
9. **True empty state** — only when zero incomplete tasks exist across all dates

**Key architectural decisions:**
- Pure client-side filtering/pagination (existing `useTasks({})` already fetches all tasks)
- Day navigation computes available days from the full task set, skipping empty days
- No new API endpoints needed — the existing task list + date filtering is sufficient

## Component Plan

**Existing components to reuse:**
- `FeedSummaryCards` — unchanged
- `FeedSection` — for overdue, activities, meetings sections
- `TaskRow` from `FeedRows.tsx` — extended with completed styling
- `ActionButton`, `TaskCheckbox` from `FeedRows.tsx`
- `ActivityRow`, `MeetingRow` from `FeedRows.tsx` — unchanged

**New components needed:**
- `DayNavigator` — date header with prev/next arrows (follows Navigation/pagination.md arrow patterns)
- `FeedControls` — controls bar with completed toggle + page size dropdown (follows Forms/toggle.md + Forms/select.md)

**Components to extend:**
- `FeedTab.tsx` — major refactor to add day state, pagination state, completed toggle state, and day-filtered task computation
- `TaskRow` — already supports `isCompleted` prop with line-through styling; needs to pass it from feed

## Backend Design

- See: `docs/superpowers/specs/2026-03-19-feed-task-pagination-backend-context.md`
- No new models/tables needed
- No new API routes needed
- No new queries needed — existing `useTasks({})` returns all tasks with `dueDate`, which is sufficient for client-side day grouping and pagination
- Future optimization: could add server-side pagination if task counts grow large, but not needed now

## States

- **Loading:** Existing React Query loading state — show skeleton/spinner in task list area while `useTasks` loads
- **Empty day (impossible):** Navigation arrows skip empty days, so user never lands on one
- **Empty (all complete):** When genuinely zero incomplete tasks across all dates, show a CTA encouraging the user to create a new plan or add contacts (not "All caught up!")
- **No due date tasks:** Tasks with `dueDate === null` should appear in a "No Due Date" bucket accessible via day navigation (after all dated days)
- **Error:** Existing React Query error handling

## Out of Scope

- Server-side pagination (premature — task counts are manageable client-side)
- Calendar view / week view
- Task creation from the feed
- Drag-and-drop reordering in the feed
- Bulk task operations
- Filtering by priority/status/plan in the feed (existing Kanban board handles this)
