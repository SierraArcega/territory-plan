# Map-v2 Activity Creation Parity — Design

**Date:** 2026-02-15
**Goal:** Bring full activity creation, editing, and management into the map-v2 plan workspace, matching the old view's capabilities.

---

## Architecture

### 1. Rename "Overview" → "Districts" and Reorder Tabs

- Tab order: **Districts, Activities, Tasks, Contacts, Performance**
- `PlanOverviewSection` already shows the district list — this is mostly a rename
- Update `PanelSection` type in `map-v2-store.ts`
- Rename `PLAN_OVERVIEW` → `PLAN_DISTRICTS` for clarity

### 2. New `PlanActivitiesSection` Component (in `panels/`)

- List of activities linked to the current plan
- Filter chips: All / Planned / Completed / Cancelled
- Category grouping: Engagement, Outreach, Sales Meetings
- Each row: type icon, title, date range, status badge, district count
- "New Activity" button → opens `activity_form` in right panel
- Click activity row → opens `activity_edit` in right panel

### 3. New `ActivityForm` Right Panel (in `right-panels/`)

Full global form with all fields:

- **Type** selector (grouped by category)
- **Title** (required)
- **Date range** (start + optional end, multi-day toggle)
- **Status** (planned / completed / cancelled)
- **Plans** multi-select (checkboxes, current plan pre-checked)
- **District scope** — all districts in plan, or pick specific
- **Contacts** — multi-select when district selected
- **State** tagging (explicit state associations)
- **Notes** textarea
- Create / Update / Delete actions
- Pre-linking: when opened from DistrictCard, district is pre-selected

### 4. Store Updates (`map-v2-store.ts`)

- Add `activity_form` and `activity_edit` to `RightPanelContent.type`
- Add `PLAN_ACTIVITIES` to `PanelSection`
- Rename `PLAN_OVERVIEW` → `PLAN_DISTRICTS`

### 5. DistrictCard Update

- Add "Add Activity" button alongside existing "Add Task"
- Opens `activity_form` with district pre-linked

### 6. RightPanel Router Update

- Handle `activity_form` → render ActivityForm (create mode)
- Handle `activity_edit` → render ActivityForm (edit mode, load existing)

---

## Out of Scope

- Calendar view integration in map-v2
- Google Calendar sync UI in map-v2
- Activity outcome tracking fields
- Unscheduled activities inbox
- Contact creation form
