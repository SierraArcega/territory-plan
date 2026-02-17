# Plan Workspace Design

**Date:** 2026-02-15
**Status:** Approved
**Branch:** feature/map-v2-prototype

## Overview

Transform the plan view from a simple summary panel into a full workspace where reps can navigate districts, tasks, contacts, and performance data — all within the floating panel. Inspired by PamPam's dual-panel pattern: the plan stays visible on the left while editing/detail flows expand to the right.

## Architecture: Nested Panel State Machine (Approach A)

Extend the existing `PanelState` and Zustand store with plan-scoped sub-states and a right-panel slot.

### Panel Layout

```
Normal:    [IconBar 56px] [PanelContent 320px]
Plan mode: [IconBar 56px] [PlanPanel 320px]
Expanded:  [IconBar 56px] [PlanPanel 320px] [RightPanel 280px]
```

- FloatingPanel renders three slots: `IconBar`, `PlanPanel`, `RightPanel` (conditional)
- RightPanel slides in with `transition-all duration-300`
- RightPanel has its own scroll context and an X dismiss button
- Mobile: RightPanel renders as a bottom sheet overlay

### State Machine Changes

New `PanelState` values:

```typescript
type PanelState =
  | "BROWSE" | "DISTRICT" | "STATE"
  | "PLAN_NEW" | "PLAN_VIEW" | "PLAN_ADD"
  | "PLAN_OVERVIEW"   // summary + district list
  | "PLAN_TASKS"      // task checklist
  | "PLAN_CONTACTS"   // contacts across plan districts
  | "PLAN_PERF"       // pipeline & revenue summary
```

New store fields:

```typescript
planSection: "overview" | "tasks" | "contacts" | "performance";

rightPanelContent: null | {
  type: "district_card" | "task_form" | "task_edit" | "contact_detail" | "contact_form";
  id?: string;
};
```

New store actions:

```typescript
setPlanSection: (section) => void;
openRightPanel: (content) => void;
closeRightPanel: () => void;
```

`viewPlan(planId)` transitions to `PLAN_OVERVIEW` instead of `PLAN_VIEW`.

### PlanIconStrip

A horizontal row of icons at the top of the PlanPanel, below the plan header:

| Icon | Section | Description |
|------|---------|-------------|
| Grid/dashboard | Overview | Plan summary + district list |
| Checkbox | Tasks | Task checklist |
| People | Contacts | Contacts grouped by district |
| Chart | Performance | Pipeline & revenue metrics |

- 32px tall, icons with labels or tooltip
- Active state: plum tint with background pill

## Section 1: Overview + Districts

Default view when entering a plan.

### Plan Header

- Plan name (click to edit via right panel)
- Status badge (draft/active/archived) + FY badge
- "..." menu: delete, archive, edit metadata

### Stats Row

2-column grid: district count, total enrollment

### District List

- Each row: color dot, district name, state abbreviation, enrollment
- Click: opens district compact card in right panel
- Hover/swipe: reveals remove (X) button
- Sort toggle: alpha / enrollment / state
- "Add Districts" button at bottom (enters PLAN_ADD mode)

### District Compact Card (Right Panel)

**Header:** District name, state, locale type

**Key stats:** Enrollment, student-teacher ratio, % FRPL, graduation rate

**Plan-specific (editable inline):** Revenue target, pipeline target, notes, target services

**Action buttons:**
- Add Task (pre-links district)
- View Contacts (filters to this district)
- Open Full Profile (exits plan workspace to DISTRICT state)
- Remove from Plan (with confirmation)

## Section 2: Tasks

### Task Checklist (Plan Panel)

- Flat list of plan-linked tasks, ordered by priority then due date
- Each row: checkbox, title, priority pill (urgent/high/medium/low), due date, district count badge
- Filter chips: All / To Do / In Progress / Done
- "New Task" button at bottom

### Task Form (Right Panel)

Opens on "New Task" or clicking an existing task row.

**Fields:** title, description, priority dropdown, due date picker, status

**Link sections:**
- Districts: multi-select from plan districts
- Contacts: multi-select from plan contacts

Save / Delete buttons. Pre-fills linked district when opened from a district card.

## Section 3: Contacts

### Contacts List (Plan Panel)

- Uses existing `/api/territory-plans/[id]/contacts` endpoint
- Grouped by district: district header with contacts below
- Each row: avatar (initials), name, title, primary badge (star), email/phone icons on hover
- "Add Contact" button per district group

### Contact Detail (Right Panel)

Opens on clicking a contact row.

**Shows:** name, title, email, phone, LinkedIn, persona, seniority, district context

**Quick actions:** email (mailto), call (tel), add task (pre-links contact)

Edit button transforms to inline edit form. Delete with confirmation.

## Section 4: Performance / Pipeline

### Metric Cards (2x2 Grid)

| Metric | Source | Fallback |
|--------|--------|----------|
| Pipeline Targeted | Sum of `revenueTarget` from TerritoryPlanDistrict | Sum available targets |
| Open Pipeline | Sum of `fy26_pipeline` from plan districts | Placeholder: "---" |
| Closed Won | Count of plan districts with bookings | Placeholder: "---" |
| Revenue | Sum of `fy26_revenue` from plan districts | Placeholder: "---" |

### Status Bar

- "X of Y districts with activity this month"
- "N overdue tasks"

### Empty State

Each card shows label with "---" and "Data not yet available" when the underlying field doesn't exist. Section is scaffolded and ready for data.

Read-only for v1 (no right panel interaction).

## Component Structure

```
components/map-v2/
  FloatingPanel.tsx           -- updated: 3-slot layout
  panels/
    PlanWorkspace.tsx          -- new: plan wrapper with header + icon strip
    PlanOverviewSection.tsx    -- new: stats + district list
    PlanTasksSection.tsx       -- new: task checklist
    PlanContactsSection.tsx    -- new: contacts grouped by district
    PlanPerfSection.tsx        -- new: performance metrics
  right-panels/
    DistrictCard.tsx            -- new: compact district card + actions
    TaskForm.tsx                -- new: task create/edit form
    ContactDetail.tsx           -- new: contact view/edit
```

## Out of Scope (v1)

- Activities + Calendar integration (future section)
- Drag-and-drop task reordering
- Performance metric drill-downs
- Bulk district operations from plan view
- Mobile-specific right panel gestures
