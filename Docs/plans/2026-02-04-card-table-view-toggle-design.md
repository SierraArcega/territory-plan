# Card/Table View Toggle with Inline Editing

**Date:** 2026-02-04
**Status:** Approved

## Overview

Add the ability to toggle between card views and table views for the Plans list and Activities panel. Table views include inline editing for quick updates without opening modals.

## Requirements

### Plans List (PlansListView)
- Toggle between card grid and table view
- Inline editable fields: Name, Description, Owner, Status, Start Date, End Date
- Non-editable display: Color, Fiscal Year, District count

### Activities Panel (ActivitiesPanel)
- Toggle between card list and table view
- Inline editable fields: Title, Type, Status, Start Date, End Date, Notes
- Non-editable display: Icon, Scope (districts/states)

### Toggle Behavior
- Independent toggles for each section (not linked)
- Small icon buttons in header row (grid icon / list icon)
- Default to cards view
- Hidden on mobile (< 768px) — cards only on small screens

### Inline Editing
- Click-to-edit: click cell to enter edit mode
- Save on blur or Enter key
- Cancel on Escape key
- Optimistic updates with rollback on error

---

## Component Architecture

### New Components

#### 1. ViewToggle.tsx
Reusable toggle with grid/list icons.

```typescript
interface ViewToggleProps {
  view: "cards" | "table";
  onViewChange: (view: "cards" | "table") => void;
}
```

- 28×28px icon buttons, grouped with pill effect
- Active: `bg-[#403770] text-white`
- Inactive: `bg-gray-100 text-gray-500 hover:bg-gray-200`

#### 2. InlineEditCell.tsx
Reusable click-to-edit cell component.

```typescript
interface InlineEditCellProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  type: "text" | "textarea" | "select" | "date";
  options?: { value: string; label: string }[]; // for select
  placeholder?: string;
  required?: boolean;
}
```

**States:**
- Display: Shows formatted value, hover hint (`bg-[#C4E7E6]/30`)
- Edit: Shows appropriate input with focus ring
- Saving: Subtle opacity/spinner
- Success: Brief green flash (500ms)
- Error: Red border + tooltip

#### 3. PlansTable.tsx
Table view for territory plans.

**Columns:**
| Column | Width | Editable |
|--------|-------|----------|
| Color | 40px | No |
| Name | flex | Yes (text) |
| Description | 200px | Yes (textarea) |
| Owner | 120px | Yes (text) |
| FY | 60px | No |
| Status | 100px | Yes (select) |
| Dates | 160px | Yes (date) |
| Districts | 80px | No |
| Actions | 60px | — |

- Row click on non-editable areas navigates to plan detail
- Footer row with total district count

#### 4. ActivitiesTable.tsx
Table view for activities.

**Columns:**
| Column | Width | Editable |
|--------|-------|----------|
| Icon | 40px | No |
| Title | flex | Yes (text) |
| Type | 120px | Yes (select) |
| Status | 100px | Yes (select) |
| Date(s) | 140px | Yes (date) |
| Scope | 120px | No |
| Notes | 150px | Yes (textarea) |
| Actions | 80px | — |

### Modified Components

#### PlansListView (in PlansView.tsx)
- Add `view` state: `useState<"cards" | "table">("cards")`
- Add ViewToggle to header
- Conditionally render PlanCard grid or PlansTable

#### ActivitiesPanel.tsx
- Add `view` state: `useState<"cards" | "table">("cards")`
- Add ViewToggle to header
- Conditionally render ActivityCard list or ActivitiesTable

---

## Data Flow

Tables use existing React Query hooks:
- `useTerritoryPlans()` — fetch plans list
- `useUpdateTerritoryPlan()` — inline edit plans
- `useActivities({ planId })` — fetch activities
- `useUpdateActivity()` — inline edit activities

**Optimistic Updates:**
1. UI updates immediately on save
2. Mutation fires to API
3. On success: React Query invalidates/refetches
4. On error: Revert UI, show error message

---

## Error Handling

### Validation
- Name/Title required (prevent empty save)
- End date must be ≥ start date

### API Errors
- Red border on failed cell
- Tooltip with error message
- Cell stays in edit mode for correction

### Network Failures
- Toast: "Failed to save. Please try again."
- Retry option in toast

---

## Edge Cases

| Case | Handling |
|------|----------|
| Empty table | Same empty state as cards view |
| Long text | Truncate with ellipsis, full text in edit mode |
| Row navigation | Non-editable areas navigate; editable cells enter edit mode |
| Delete | Reuse existing confirmation modal pattern |
| Mobile | Hide toggle, show cards only |

---

## Implementation Order

1. **ViewToggle** — Simple reusable component
2. **InlineEditCell** — Core reusable editing component
3. **PlansTable** + PlansListView integration
4. **ActivitiesTable** + ActivitiesPanel integration
5. **Testing & polish**

---

## File Structure

```
src/components/
├── common/
│   ├── ViewToggle.tsx          # NEW
│   └── InlineEditCell.tsx      # NEW
├── plans/
│   ├── PlanCard.tsx            # existing
│   ├── PlansTable.tsx          # NEW
│   ├── ActivityCard.tsx        # existing
│   ├── ActivitiesPanel.tsx     # MODIFY
│   └── ActivitiesTable.tsx     # NEW
└── views/
    └── PlansView.tsx           # MODIFY
```

---

## Design Decisions

1. **Independent toggles** — Users may prefer cards for plans but table for activities, or vice versa
2. **Click-to-edit** — More discoverable than always-editable inputs, cleaner appearance
3. **No persistence** — Keep it simple; users can set preference each session
4. **Mobile cards-only** — Tables don't work well on small screens; forced responsive design
