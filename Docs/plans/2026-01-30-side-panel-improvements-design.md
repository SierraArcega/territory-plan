# Side Panel Improvements Design

**Date:** 2026-01-30
**Status:** Approved

## Overview

Improve the side panel UX by simplifying navigation, reducing redundancy, and keeping users in-context when working with plans.

## Goals

1. Move territory owner to a more prominent location in state header
2. Remove redundant districts sub-tab from state panel
3. Make District tab state-aware (shows districts list when state selected)
4. Add hover-to-highlight interaction for districts in the list
5. Keep plans workflow entirely within the panel (no page navigation)

## Design

### State Tab Changes

**Current:**
- Header: State name + abbreviation (territory owner on right, but often empty)
- Sub-tabs: Overview | Districts (N)
- Overview shows: Business Metrics, Education Metrics, Goals, Territory Owner section, Notes
- Districts sub-tab shows: Searchable/filterable districts list

**New:**
- Header: State name + abbreviation + territory owner (prominently displayed)
- No sub-tabs
- Content shows: Business Metrics, Education Metrics, Goals, Notes (no territory owner section - moved to header)

**Files affected:**
- `StateHeader.tsx` - Add territory owner display near abbreviation
- `StateNotesEditor.tsx` - Remove territory owner editing (move to header or separate control)
- `StateTabContent.tsx` - Remove sub-tabs, show only overview content

### District Tab Changes

**Current:**
- Empty state when no district selected
- District detail view when district selected

**New - Two Modes:**

**Mode A: State selected, no district selected**
- Shows the state's districts list (reuses `StateDistrictsList` component)
- Search and filter controls at top
- Scrollable list with status badges, tags, enrollment info
- **Hover interaction**: Hovering a district row calls `setHoveredLeaid()` to highlight on map
- **Click**: Opens district detail (switches to Mode B)

**Mode B: District selected**
- Shows "← Back to [State] districts" link at top
- Full district detail view (current behavior)
- All sections: header, Fullmind metrics, demographics, finances, tags, notes, contacts

**Files affected:**
- `DistrictTabContent.tsx` - Add state-aware mode, back navigation
- `StateDistrictsList.tsx` - Add hover handlers (`onMouseEnter`/`onMouseLeave`)
- `store.ts` - May need state for tracking navigation context

### Plans Tab Changes

**Current:**
- Shows plans list with links to `/plans/{id}` pages
- "Create New Plan" links to `/plans` page
- All plan management happens on separate pages

**New - In-Panel Flow:**

**Plans List View (default):**
- List of plans with: color dot, name, status badge, district count, owner, description preview
- Click plan → drills into Plan Dashboard view
- "Create New Plan" button at bottom → opens modal

**Plan Dashboard View:**
- "← Back to Plans" link at top
- Plan header: name, color, status badge
- Edit button → opens `PlanFormModal` with data pre-filled
- Summary section: owner, district count, date range
- Districts in plan (collapsible/scrollable list)

**Create Flow:**
- Click "Create New Plan" → `PlanFormModal` opens
- Submit → plan created → return to plans list

**Edit Flow:**
- Click "Edit" on dashboard → `PlanFormModal` opens with existing data
- Submit → plan updated → stay on dashboard with refreshed data

**Files affected:**
- `PlansTabContent.tsx` - Add internal navigation state (list vs dashboard), integrate modals
- `PlanFormModal.tsx` - No changes needed (already supports create/edit)

## Component Structure

```
PanelContainer
├── State Tab → StateTabContent
│   ├── StateHeader (+ territory owner)
│   ├── StateStats
│   └── StateNotesEditor (notes only)
│
├── District Tab → DistrictTabContent
│   ├── [If state selected, no district] → StateDistrictsList (with hover handlers)
│   └── [If district selected] → Back link + District detail components
│
└── Plans Tab → PlansTabContent
    ├── [List view] → Plans list + Create button
    └── [Dashboard view] → Back link + Plan details + Edit button
```

## Store Changes

The `store.ts` may need additions:

```typescript
// Track whether we're viewing districts list vs district detail
// (Could also be inferred from selectedLeaid being null/set)

// hoveredLeaid already exists and will be used for map highlighting
```

## Implementation Order

1. **State header + territory owner** - Move territory owner to StateHeader
2. **Remove state sub-tabs** - Simplify StateTabContent
3. **District tab state-awareness** - Add districts list mode to DistrictTabContent
4. **Hover-to-highlight** - Add mouse handlers to StateDistrictsList
5. **Back navigation** - Add back link to district detail view
6. **Plans list view** - Convert Links to onClick handlers with internal state
7. **Plan dashboard view** - Create new view within PlansTabContent
8. **Create/edit integration** - Wire up PlanFormModal for in-panel use

## Testing Considerations

- State tab displays territory owner correctly (with value, without value)
- District tab shows districts list when state selected
- District tab shows detail when district selected
- Hovering district in list highlights on map
- Clicking district opens detail view
- Back link returns to districts list
- Plans list shows all plans
- Clicking plan opens dashboard
- Create plan modal works, returns to list
- Edit plan modal works, stays on dashboard
