# Implementation Plan: Add Activity to Plan

**Date:** 2026-04-10
**Spec:** docs/superpowers/specs/2026-04-10-add-activity-to-plan-spec.md

## Tasks

### Task 1: Add `search` param to `useActivities` hook and `ActivitiesParams` type
**Files:**
- `src/features/shared/types/api-types.ts` — add `search?: string` to `ActivitiesParams`
- `src/features/activities/lib/queries.ts` — forward `search` param in `useActivities`

**Details:**
- Add `search?: string` to the `ActivitiesParams` interface
- In `useActivities`, add: `if (params.search) searchParams.set("search", params.search);`
- The API route already handles the `search` param via Prisma's `contains` filter

**Test:** Verify the hook passes `search` to the URL params

---

### Task 2: Build `ActivitySearchModal` component
**File:** `src/features/plans/components/ActivitySearchModal.tsx`

**Details:**
- Props: `isOpen`, `onClose`, `planId`, `linkedActivityIds: Set<string>`
- Internal state: `searchQuery`, `selectedIds: Set<string>`, filter dropdowns (type, status, owner)
- Uses `useActivities({ search, status, ownerId, category, limit: 50 })` with debounced search
- Uses `useUsers()` for owner filter options
- Uses `useLinkActivityPlans()` mutation for the "Add Selected" action
- On submit: iterates selected activity IDs, calls `linkActivityPlans.mutateAsync({ activityId, planIds: [planId] })` for each
- Layout:
  - Header: "Link Activities" + plan name + close button
  - Search input (full width, search icon, debounced 300ms)
  - Filter row: Type dropdown (grouped by category), Status dropdown, Owner dropdown
  - Scrollable results list (max-h-[400px])
  - Each row: checkbox | type emoji | title | status badge | date range | scope
  - Already-linked rows: checkbox disabled + checked, row opacity-50, "In this plan" badge
  - Footer: Cancel + "Add N Activities" button (disabled when N=0)
- Styling: Fullmind plum palette, matches AddDistrictCombobox patterns

**Test:** Unit test for rendering, filter interactions, selection state, submit behavior

---

### Task 3: Modify `ActivitiesPanel` — split "Add" button into dropdown
**File:** `src/features/plans/components/ActivitiesPanel.tsx`

**Details:**
- Replace the single "Add" button with a dropdown menu button
- Dropdown options: "Link Existing" (opens ActivitySearchModal), "Create New" (opens ActivityFormModal)
- Add `showSearchModal` state
- Compute `linkedActivityIds` set from the current `activities` list
- Render `ActivitySearchModal` when `showSearchModal` is true

**Test:** Verify dropdown renders both options, modals open correctly

---

### Task 4: Add unlink button to `ActivitiesTable`
**File:** `src/features/plans/components/ActivitiesTable.tsx`

**Details:**
- Add `planId?: string` and `onUnlink?: (activityId: string) => void` props
- In the hover actions column (alongside delete), add an unlink icon button
- Uses Lucide `Unlink` or a simple ✕ with tooltip "Remove from plan"
- Clicking triggers `onUnlink(activity.id)` — parent handles the mutation
- Add a small confirmation inline or skip confirmation since it's non-destructive (activity still exists)

**Test:** Verify unlink button renders and calls callback

---

### Task 5: Add unlink button to `ActivityCard`
**File:** `src/features/plans/components/ActivityCard.tsx`

**Details:**
- Add `planId?: string` and `onUnlink?: (activityId: string) => void` props
- Small ✕ icon in the top-right corner, visible on hover
- Same behavior as table — calls `onUnlink`

**Test:** Verify unlink button renders on hover

---

### Task 6: Wire up unlink in `ActivitiesPanel`
**File:** `src/features/plans/components/ActivitiesPanel.tsx`

**Details:**
- Import and use `useUnlinkActivityPlan` mutation
- Create `handleUnlinkActivity(activityId)` that calls `unlinkActivityPlan.mutateAsync({ activityId, planId })`
- Pass `planId` and `onUnlink={handleUnlinkActivity}` to both `ActivitiesTable` and `ActivityCard`
- After successful unlink, the activities query auto-invalidates (already handled by the mutation's `onSuccess`)

**Test:** Verify unlink flow works end-to-end

## Task Dependencies
- Task 1 must complete before Task 2 (search modal needs the search param)
- Tasks 2, 4, 5 are independent of each other (can be parallelized)
- Tasks 3 and 6 depend on Tasks 2, 4, 5 respectively
- Task 3 depends on Task 2 (needs ActivitySearchModal to import)
- Task 6 depends on Tasks 4 and 5 (needs unlink props wired)

## Test Strategy
- Unit tests for ActivitySearchModal: rendering, search input, filter dropdowns, checkbox selection, submit button state, already-linked display
- Unit tests for ActivitiesPanel: dropdown menu rendering, modal opening
- Unit tests for ActivitiesTable: unlink button in hover actions
- Unit tests for ActivityCard: unlink icon on hover
- Integration: linking activities via the search modal, unlinking via the panel
