# Feature Spec: Plan Detail Modal

**Date:** 2026-03-20
**Slug:** plan-detail-panel
**Branch:** worktree-plan-detail-panel

## Requirements

- Click a plan card in the search results right panel (PlansTab) to open a full modal dialog
- Modal displays plan details in a two-panel layout: left sidebar for metadata, right area for tabbed content
- Editable: district targets per category, plan metadata, add/remove districts, notes/comments
- View contacts, vacancies, activities, tasks associated with the plan
- Display actuals (pipeline + activity data) alongside targets
- Auto-save on blur for all editable fields
- Prev/Next navigation between plans in the list
- Escape key or backdrop click closes the modal

## Visual Design

### Modal Shell
- Full-screen centered modal: `max-w-[1200px] max-h-[90vh]` with rounded corners
- Rendered via `createPortal` into `document.body` (same pattern as `DistrictExploreModal`)
- Semi-transparent backdrop (`bg-black/50`)
- Close button (×) in top-right corner
- Prev/Next arrow buttons on left/right edges (when navigating between plans)

### Left Sidebar (~280px fixed width)
- **Header**: Plan color dot + plan name + FY badge + status badge
- **Edit toggle**: Pencil icon button in the header area; toggles between read/edit mode
- **Read mode (default)**:
  - Stats section: district count, state count, total enrollment
  - Target rollups: Renewal, Expansion, Winback, New Biz totals
  - Actuals summary: total pipeline, closed-won, activity count
  - Owner name + avatar
  - Date range (start – end)
  - Description (truncated with expand)
- **Edit mode** (toggled):
  - Name: text input (auto-save on blur)
  - Status: dropdown (planning/working/stale/archived)
  - Owner: user search dropdown
  - FY: number input
  - Start/End dates: date inputs
  - Description: textarea
  - All fields auto-save individually on blur via `useUpdateTerritoryPlan`

### Right Content Area (flex-1)
- **Tab strip**: Districts | Contacts | Activities | Tasks
  - Uses the Fullmind plum color scheme for active tab indicator
  - Tab counts shown as badges (e.g., "Districts 21")

#### Districts Tab (default)
- **Table layout** with columns: District Name, State, Renewal, Expansion, Winback, New Biz, Total Target, Actuals
- Currency cells are inline-editable (click to edit, auto-save on blur via `useUpdateDistrictTargets`)
- **Row expansion** (click chevron or row): Expands to show:
  - Return Services + New Services (tag pills, editable)
  - Notes field (textarea, auto-save on blur)
  - Recent pipeline details (from actuals)
- **Add district**: Button at bottom/top with two options:
  - Search dropdown: type-ahead district search, click to add
  - "Browse Map" link: closes modal, enters plan add-districts mode on the map
- **Remove district**: Trash icon on each row (with confirmation)
- Sorted by district name by default; column headers are sortable

#### Contacts Tab
- List of contacts across all districts in the plan
- Reuse existing contact card patterns from `PlanContactsSection`
- Show district name per contact for context

#### Activities Tab
- List of activities linked to the plan
- Reuse existing activity patterns from `PlanActivitiesSection`
- Show district name per activity

#### Tasks Tab
- List of tasks linked to the plan
- Reuse existing task patterns from `PlanTasksSection`
- Show task status, assignee, due date

## Component Plan

### Existing components to reuse
- `useTerritoryPlan()` — full plan detail fetch (already includes districts, targets, services, actuals)
- `useUpdateTerritoryPlan()` — plan metadata mutation
- `useUpdateDistrictTargets()` — per-district target mutation with optimistic updates
- `useAddDistrictsToPlan()` — add districts mutation
- `useRemoveDistrictFromPlan()` — remove district mutation
- `ServiceSelector` — tag-based service picker
- `PlanContactsSection` patterns — contact list for plan
- `PlanActivitiesSection` patterns — activity list for plan
- `PlanTasksSection` patterns — task list for plan
- `DistrictExploreModal` — portal/backdrop/keyboard pattern
- Currency formatting utilities from `DistrictTargetEditor`

### New components needed
- `PlanDetailModal` — modal shell with backdrop, close, prev/next navigation
- `PlanDetailSidebar` — left sidebar with read/edit mode for plan metadata
- `PlanDetailTabStrip` — tab navigation for Districts/Contacts/Activities/Tasks
- `PlanDistrictsTab` — districts table with inline editing and row expansion
- `PlanDistrictRow` — individual district row with expandable detail
- `InlineEditableCell` — generic auto-save-on-blur currency input cell
- `AddDistrictDropdown` — search-as-you-type district search for adding districts

### Components to extend
- `SearchResults/PlanCard` — add `onClick` handler to open the modal
- `SearchResults/PlansTab` — manage modal open/close state and pass plan navigation

## Backend Design

- See: `docs/superpowers/specs/2026-03-20-plan-detail-panel-backend-context.md`
- **No new models/tables needed** — all data exists
- **No new API routes needed** — `useTerritoryPlan()` already returns districts with targets, services, and actuals
- **Existing endpoints to reuse:**
  - `GET /api/territory-plans/:id` — full plan detail
  - `PUT /api/territory-plans/:id` — update plan metadata
  - `PUT /api/territory-plans/:planId/districts/:leaid/targets` — update district targets
  - `POST /api/territory-plans/:id/districts` — add districts
  - `DELETE /api/territory-plans/:planId/districts/:leaid` — remove district
  - `GET /api/territory-plans/:id/contacts` — plan contacts
  - `GET /api/activities?planId=:id` — plan activities
  - `GET /api/tasks?planId=:id` — plan tasks

## States

### Loading
- Skeleton shimmer for sidebar stats and table rows
- Tabs remain interactive during content loading

### Empty
- Districts tab: "No districts yet. Add districts to start building your plan."
- Contacts/Activities/Tasks: "No [entity] linked to this plan yet."

### Error
- Red banner at top of modal with retry button
- Individual field save errors shown as inline toast/tooltip near the field

## Out of Scope

- Drag-and-drop reordering of districts
- Bulk target editing (editing multiple districts at once)
- Plan comparison view
- Export plan data from the modal
- Plan deletion from the modal
- Vacancies tab (can be added later — contacts/activities/tasks cover initial needs)
