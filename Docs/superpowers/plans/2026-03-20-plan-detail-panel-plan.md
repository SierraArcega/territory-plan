# Implementation Plan: Plan Detail Modal

**Date:** 2026-03-20
**Spec:** `docs/superpowers/specs/2026-03-20-plan-detail-panel-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-20-plan-detail-panel-backend-context.md`

---

## Task 1: PlanDetailModal shell + state wiring

**Files:**
- `src/features/map/components/SearchResults/PlanDetailModal.tsx` (NEW)
- `src/features/map/components/SearchResults/PlansTab.tsx` (MODIFY)
- `src/features/map/components/SearchResults/PlanCard.tsx` (MODIFY)

**Work:**
1. Create `PlanDetailModal` — portal-based modal shell:
   - Backdrop with `bg-black/50`, Escape key handler, click-outside-to-close
   - Close button (×) in top-right
   - Prev/Next navigation buttons on left/right edges
   - Takes `planId`, `onClose`, `onPrev?`, `onNext?` props
   - Fetches plan data via `useTerritoryPlan(planId)`
   - Two-panel layout: left sidebar (280px) + right flex-1 content area
   - Loading skeleton state

2. Wire `PlanCard.onClick` to open the modal:
   - `PlansTab` manages `selectedPlanId` state (string | null)
   - Computes prev/next plan IDs from the uniquePlans list
   - Renders `PlanDetailModal` via portal when `selectedPlanId` is set

**Test:** Modal opens on plan card click, closes on × / Escape / backdrop. Prev/Next cycle through plans.

---

## Task 2: PlanDetailSidebar (left panel)

**Files:**
- `src/features/map/components/SearchResults/PlanDetailSidebar.tsx` (NEW)

**Work:**
1. Create `PlanDetailSidebar` component:
   - **Read mode (default):**
     - Plan color dot + name (large, bold)
     - FY badge + status badge
     - Divider
     - Stats: district count, state count, total enrollment
     - Target rollups: 4 categories with dollar formatting
     - Actual totals (summed from plan districts)
     - Owner name
     - Date range
     - Description (truncated with "show more")
   - **Edit mode (toggle via pencil icon):**
     - Name: text input
     - Status: `<select>` with planning/working/stale/archived
     - Owner: user dropdown (fetch via existing `useTeamMembers` or `useProfile`)
     - FY: number input
     - Dates: date inputs
     - Description: textarea
     - All fields auto-save on blur via `useUpdateTerritoryPlan`

**Dependencies:** `useTerritoryPlan`, `useUpdateTerritoryPlan`
**Test:** Toggle between read/edit modes. Edit a field, blur, verify API call fires.

---

## Task 3: PlanDetailTabStrip + Districts Tab

**Files:**
- `src/features/map/components/SearchResults/PlanDetailTabs.tsx` (NEW)
- `src/features/map/components/SearchResults/PlanDistrictsTab.tsx` (NEW)
- `src/features/map/components/SearchResults/PlanDistrictRow.tsx` (NEW)

**Work:**
1. `PlanDetailTabs` — tab strip component:
   - Tabs: Districts, Contacts, Activities, Tasks
   - Counts as badges
   - Active tab indicator with plum color
   - Manages `activeTab` state

2. `PlanDistrictsTab` — districts table:
   - Header row: District, State, Renewal, Expansion, Winback, New Biz, Total, Actuals
   - Sortable columns (client-side, the plan has max ~50 districts)
   - Uses `InlineEditableCell` for target columns
   - Row click expands to show detail (services, notes)
   - Empty state when no districts
   - "Add District" button at bottom

3. `PlanDistrictRow` — individual row:
   - Compact row with district name, state abbrev, 4 target cells, total, actual
   - Expandable: chevron toggle reveals services (tag pills), notes (textarea), pipeline detail
   - Target cells use auto-save on blur via `useUpdateDistrictTargets`
   - Remove button (trash icon) with confirmation

**Dependencies:** `useTerritoryPlan`, `useUpdateDistrictTargets`, `ServiceSelector`
**Test:** Targets auto-save on blur. Row expansion toggles. Remove district with confirmation.

---

## Task 4: InlineEditableCell + AddDistrictDropdown

**Files:**
- `src/features/map/components/SearchResults/InlineEditableCell.tsx` (NEW)
- `src/features/map/components/SearchResults/AddDistrictDropdown.tsx` (NEW)

**Work:**
1. `InlineEditableCell`:
   - Displays formatted currency value by default
   - Click to activate: shows input with $ prefix
   - On blur: parse value, call `onSave(newValue)`, return to display mode
   - On Escape: cancel edit, revert to original value
   - Pending state: subtle opacity during save
   - Error state: red border flash if save fails

2. `AddDistrictDropdown`:
   - "+" button that opens a dropdown
   - Search input with type-ahead (uses `/api/districts/search` or existing search endpoint)
   - Results list showing district name + state
   - Click result → add to plan via `useAddDistrictsToPlan`
   - "Browse Map" link → closes modal, enters plan add-districts mode
   - Excludes districts already in the plan

**Dependencies:** `useAddDistrictsToPlan`, district search API
**Test:** Currency input formats correctly. Search finds districts. Adding works.

---

## Task 5: Contacts, Activities, Tasks tabs

**Files:**
- `src/features/map/components/SearchResults/PlanContactsTab.tsx` (NEW)
- `src/features/map/components/SearchResults/PlanActivitiesTab.tsx` (NEW)
- `src/features/map/components/SearchResults/PlanTasksTab.tsx` (NEW)

**Work:**
1. `PlanContactsTab`:
   - Fetch contacts via `usePlanContacts(planId)` or inline from plan detail
   - List of contact cards with name, role, email, phone, district name
   - Click contact to open contact detail (reuse existing patterns)

2. `PlanActivitiesTab`:
   - Fetch activities via `useActivities({ planId })`
   - List of activity cards with type, date, subject, district name
   - "Log Activity" button to create new

3. `PlanTasksTab`:
   - Fetch tasks via `useTasks({ planId })`
   - List of task cards with title, status, assignee, due date
   - "Create Task" button

**Dependencies:** Existing plan query hooks for contacts/activities/tasks
**Test:** Each tab loads data correctly. Empty states shown when no data.

---

## Task Ordering

```
Task 1 (Modal shell)
  └─→ Task 2 (Sidebar)  ← can start after Task 1
  └─→ Task 3 (Tabs + Districts)  ← can start after Task 1
       └─→ Task 4 (InlineEdit + AddDistrict)  ← depends on Task 3
  └─→ Task 5 (Contacts/Activities/Tasks tabs)  ← can start after Task 1
```

Tasks 2, 3, and 5 are independent of each other and can be built in parallel after Task 1.
Task 4 depends on Task 3 for integration context.

## Test Strategy

- **Unit tests**: InlineEditableCell (formatting, save, cancel, error states)
- **Component tests**: PlanDetailModal (open/close/navigation), PlanDistrictsTab (row expansion, sort)
- **Integration**: Full flow — open modal from plan card, edit targets, verify optimistic update, close modal
