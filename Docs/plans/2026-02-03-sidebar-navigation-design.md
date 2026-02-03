# Sidebar Navigation Design

**Date:** 2026-02-03
**Status:** Approved

## Overview

Add a collapsible left sidebar as the primary navigation for the Territory Plan Builder. Clicking tabs swaps the main content area while preserving the FilterBar and sidebar shell.

## Layout

```
┌─────────────────────────────────────────────────────┐
│  FilterBar (search, filters, user menu)             │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  Sidebar │         Main Content Area                │
│          │    (swaps based on active tab)           │
│  - Map   │                                          │
│  - Plans │                                          │
│  - Goals │                                          │
│  - Data  │                                          │
│          │                                          │
│  ──────  │                                          │
│  Profile │                                          │
│          │                                          │
│    [<]   │                                          │
└──────────┴──────────────────────────────────────────┘
```

## Tabs

| Tab | Description | Status |
|-----|-------------|--------|
| Map | Current map view with district selection, side panel | Default view |
| Plans | Plans list with nested plan detail view | Extracted from `/plans` |
| Goals | Goal tracking dashboard | Extracted from `/goals` |
| Data | Data reconciliation | Placeholder for future |
| Profile | User info, settings modal, sign out | New |

## Sidebar Component

### Dimensions
- **Expanded width:** 140px
- **Collapsed width:** 56px
- **Transition:** 200ms ease

### Visual Design
- Background: White with right border (`border-gray-200`)
- Tab items: Icon + label when expanded, icon-only when collapsed
- Active indicator: Left border accent in Deep Coral (`#F37167`) + subtle background tint
- Hover state: Light background (`bg-gray-50`)

### Tab Icons
| Tab | Icon |
|-----|------|
| Map | Map/globe |
| Plans | Clipboard/checklist |
| Goals | Target/bullseye |
| Data | Database/table |
| Profile | User circle |

### Collapse Behavior
- Default: Expanded
- Toggle: Chevron button at bottom of sidebar
- Collapsed state shows tooltips on hover
- Preference persisted to localStorage

## FilterBar Adaptations

FilterBar behavior varies by active tab:

| Tab | Search | Filters | Multi-select | User Menu |
|-----|--------|---------|--------------|-----------|
| Map | Visible | Visible | Visible | Visible |
| Plans | Hidden | Hidden | Hidden | Visible |
| Goals | Hidden | Hidden | Hidden | Visible |
| Data | Hidden | Hidden | Hidden | Visible |
| Profile | Hidden | Hidden | Hidden | Visible |

On non-Map tabs, FilterBar shows only: Logo (links to Map) + User Menu.

## Content Views

### MapView
- Extracted from current `page.tsx`
- Contains: MapContainer, PanelContainer, MultiSelectActionBar, GoalSetupModal
- State preserved when switching tabs (zoom, selected district, open panel)

### PlansView
- Extracted from `/plans/page.tsx`
- Nested plan detail: clicking a plan shows detail within same view
- Breadcrumb navigation to return to list
- No separate `/plans/[id]` route needed

### GoalsView
- Extracted from `/goals/page.tsx`
- Self-contained with fiscal year tabs and goal editor modal

### DataView
- Placeholder component
- Empty state with "Coming soon" message
- Ready for future data reconciliation features

### ProfileView
- User avatar, name, email
- "Settings" button opens modal (shell for now)
- "Sign out" button
- Simple account info only (no goal summary)

## State Management

### New Zustand State
```typescript
// In store.ts
activeTab: 'map' | 'plans' | 'goals' | 'data' | 'profile'
sidebarCollapsed: boolean  // persisted to localStorage

// Within PlansView (local or store)
selectedPlanId: string | null  // null = list view, string = detail view
```

### URL Sync
- Query param: `?tab=plans`
- Plan detail: `?tab=plans&plan=abc123`
- On page load, read `tab` param to set initial state
- Tab changes update URL (replace, not push)

## Files to Create/Modify

### New Files
- `src/components/navigation/Sidebar.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/views/MapView.tsx`
- `src/components/views/PlansView.tsx`
- `src/components/views/GoalsView.tsx`
- `src/components/views/DataView.tsx`
- `src/components/views/ProfileView.tsx`

### Modified Files
- `src/lib/store.ts` - add navigation state
- `src/components/filters/FilterBar.tsx` - conditional rendering
- `src/app/page.tsx` - use AppShell, render active view

### Files to Delete (after migration)
- `src/app/plans/page.tsx`
- `src/app/plans/[id]/page.tsx`
- `src/app/goals/page.tsx`

## Implementation Plan

### Git Workflow
```bash
git checkout main
git pull origin main
git checkout -b feature/sidebar-navigation
```

Commit after each phase. Push to GitHub after phase 2-3.

### Phases

| Phase | Description | Commit Message |
|-------|-------------|----------------|
| 1 | Create Sidebar component (expanded/collapsed, tabs, styling) | `feat: Add collapsible sidebar component` |
| 2 | Create AppShell layout wrapper (sidebar + content area) | `feat: Add AppShell layout with sidebar` |
| 3 | Add activeTab and sidebarCollapsed to Zustand store | `feat: Add navigation state to store` |
| 4 | Update FilterBar (conditional rendering based on tab) | `feat: Adapt FilterBar for tab-based nav` |
| 5 | Extract map content into MapView component | `refactor: Extract MapView from page.tsx` |
| 6 | Extract plans into PlansView with nested detail | `refactor: Move Plans into PlansView component` |
| 7 | Extract goals into GoalsView | `refactor: Move Goals into GoalsView component` |
| 8 | Add DataView placeholder | `feat: Add Data tab placeholder` |
| 9 | Add ProfileView with Settings modal shell | `feat: Add Profile view with settings modal` |
| 10 | Add URL sync (query params) | `feat: Sync active tab to URL params` |
| 11 | Clean up old routes, test everything | `chore: Remove old routes, final cleanup` |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single-page vs routes | Single-page with tab switching | Unified experience, preserves map state |
| Sidebar width | 140px expanded, 56px collapsed | Slim to maximize content space |
| FilterBar on other tabs | Minimal (logo + user menu) | Simplified for now, can add contextual search later |
| Plan detail | Nested in PlansView | Consistent single-page model |
| Profile content | Account info only | Keep simple, goals live in Goals tab |
| URL sync | Included from start | Shareable links from day one |
| Default sidebar state | Expanded | Better discoverability for new users |
