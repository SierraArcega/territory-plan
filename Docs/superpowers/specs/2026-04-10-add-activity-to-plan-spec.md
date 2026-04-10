# Feature Spec: Add Activity to Plan

**Date:** 2026-04-10
**Slug:** add-activity-to-plan
**Branch:** worktree-add-activity-to-plan

## Requirements
- Users need to search for and link existing activities to a territory plan
- The "+ Add" button on the Activities tab should offer two options: "Link Existing" and "Create New"
- "Link Existing" opens a centered search modal with text search + filters (type, status, owner)
- Multi-select: users can check multiple activities and add them all at once
- Already-linked activities appear in search results but are shown as disabled with an "In this plan" badge
- Users can unlink/remove activities from the plan via a remove button on each activity

## Visual Design
- **Approved approach:** Split-action dropdown button + dedicated search modal
- **Key decisions:**
  - Reuses existing `ActivityListItem` data shape and `useActivities` hook
  - Search modal follows AddDistrictCombobox patterns for "already in plan" indicators
  - Unlink button appears on hover in both card and table views
  - No backend changes required — all API routes and mutations already exist

## Component Plan

### Existing components to reuse
- `ActivitiesPanel` (src/features/plans/components/ActivitiesPanel.tsx) — will be modified
- `ActivitiesTable` (src/features/plans/components/ActivitiesTable.tsx) — will be modified (add unlink button)
- `ActivityCard` (src/features/plans/components/ActivityCard.tsx) — will be modified (add unlink button)
- `useActivities` hook (src/features/activities/lib/queries.ts) — needs `search` param support
- `useLinkActivityPlans` mutation (src/features/activities/lib/queries.ts) — existing, no changes
- `useUnlinkActivityPlan` mutation (src/features/activities/lib/queries.ts) — existing, no changes
- `useUsers` hook (src/features/shared/lib/queries.ts) — for owner filter dropdown
- Activity types/icons/status configs (src/features/activities/types.ts) — for display in search results

### New components needed
- `ActivitySearchModal` (src/features/plans/components/ActivitySearchModal.tsx) — the search/filter/multi-select modal

### Components to extend
- `ActivitiesPanel` — replace single "Add" button with dropdown menu offering "Link Existing" / "Create New"
- `ActivitiesTable` — add unlink icon in the hover actions column
- `ActivityCard` — add unlink ✕ icon on hover
- `useActivities` hook — add `search` param forwarding
- `ActivitiesParams` type — add `search` field

## Backend Design
- See: docs/superpowers/specs/2026-04-10-add-activity-to-plan-backend-context.md
- No new models/tables needed — `ActivityPlan` join table exists
- No new API routes needed — link/unlink endpoints exist
- No new queries needed — `GET /api/activities?search=` already works

## States
- **Loading:** Spinner in search results area of modal
- **Empty (no results):** "No activities matching [query]" centered message
- **Empty (no activities):** Current empty state in ActivitiesPanel unchanged
- **Error:** Toast/inline error for failed link/unlink operations
- **Already linked:** Checkbox checked + disabled, row dimmed, "In this plan" badge

## Out of Scope
- Creating new activities from the search modal (that's the existing "Create New" flow)
- Bulk unlink (remove multiple activities at once)
- Activity detail preview within the search modal
- Fiscal year filter (activities don't have a FY field — date-based filtering could be added later)
