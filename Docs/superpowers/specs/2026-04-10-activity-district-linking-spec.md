# Feature Spec: Activity-District Linking

**Date:** 2026-04-10
**Slug:** activity-district-linking
**Branch:** worktree-activity-district-linking

## Requirements

Users need to associate one or more school districts with any activity type
(conference, school site visit, happy hour, etc.) directly from the activity
creation/editing modal. Currently, district linking is only available on
road trip activities via a specialized stops UI, and indirectly via contact
auto-linking. The goal is a simple, universal district picker available on
every activity type.

### Success criteria
- A "Districts" search field appears on the activity modal for all types
- Users can search by district name and add multiple districts as compact chips
- Selected districts persist on save (create and update)
- Existing auto-linked districts from contacts remain as read-only chips
- Road trip activities use the same top-level field (consolidated from separate stops UI)

## Visual Design

### Approved approach
A dedicated **Districts** field placed directly below the Contacts section
(and its auto-linked chips). The field has two parts:

1. **Search input** — debounced typeahead using the existing
   `/api/admin/districts/search` endpoint. Shows a dropdown of results with
   district name, state abbreviation, and enrollment.
2. **Selected chips** — compact removable tags showing
   `District Name · ST ×`, styled in the plum/steel-blue palette consistent
   with other chips in the form.

Auto-linked district chips (from contacts) remain in their current position
below the Contacts field, visually distinct in the lighter `#e8f1f5` blue.

### Road trip consolidation
The `RoadTripFields` district stops UI is removed. Road trips use the same
top-level Districts field. Per-stop visit dates, notes, and drag-to-reorder
are dropped in favor of consistency across all activity types.

## Component Plan

### Existing components to reuse
- `DistrictSearchInput` (`src/features/activities/components/event-fields/DistrictSearchInput.tsx`)
  — already has debounced search, dropdown, result display, exclude logic
- `ActivityFormModal` (`src/features/activities/components/ActivityFormModal.tsx`)
  — already has `districtStops` state and wires it into create/update mutations

### Changes to existing components

**`ActivityFormModal.tsx`:**
- Simplify `districtStops` type from `{leaid, name, stateAbbrev, visitDate, notes}[]`
  to `{leaid, name, stateAbbrev}[]` (rename to `selectedDistricts`)
- Add the Districts field UI below Contacts — search input + chip list
- Remove `districtStops`/`onDistrictStopsChange` props from `EventTypeFields`
- Update create/update mutation payloads (districts array no longer sends
  visitDate/notes/position — just leaid)

**`EventTypeFields.tsx`:**
- Remove `districtStops` and `onDistrictStopsChange` props
- Remove passing these props to `RoadTripFields`

**`RoadTripFields.tsx`:**
- Remove entirely (or gut it — it only contained the district stops UI).
  If road trips have no other type-specific fields, the component can be
  deleted and its case in `EventTypeFields` returns `null`.

**`DistrictSearchInput.tsx`:**
- No changes needed — it already works as a standalone search-and-select.

### New components needed
None. The chip display is simple inline JSX in the modal (map over
`selectedDistricts`, render a `<span>` with an `×` remove button).

## Backend Design

### No schema changes
The `ActivityDistrict` junction table already exists:
```prisma
model ActivityDistrict {
  activityId       String
  districtLeaid    String
  warningDismissed Boolean   @default(false)
  visitDate        DateTime?
  position         Int       @default(0)
  notes            String?
  activity         Activity  @relation(...)
  district         District  @relation(...)
  @@id([activityId, districtLeaid])
}
```

The `visitDate`, `notes`, and `position` columns become unused but remain
in the schema (no migration needed). They'll receive default/null values.

### No API changes
- `POST /api/activities/[id]/districts` — link districts (already exists)
- `DELETE /api/activities/[id]/districts/[leaid]` — unlink (already exists)
- The create/update activity mutations already accept a `districts` array
- `/api/admin/districts/search?q=...` — search endpoint (already exists)

### Auto-state derivation
Existing behavior preserved: when districts are linked, the backend
automatically creates `ActivityState` records for the districts' states
(non-explicit). When districts are unlinked, orphaned state links are
cleaned up.

## States

- **Loading:** Spinner in the search input while results load (already built into `DistrictSearchInput`)
- **Empty:** No districts selected — just the search input with placeholder
- **Error:** Search failure silently shows empty results (existing behavior)
- **Edit mode:** Pre-populates chips from existing `activity.districts` data

## Out of Scope

- Per-district visit dates, notes, or ordering (removed with road trip consolidation)
- Modifying the auto-linked districts from contacts behavior
- District search improvements (different endpoint, better ranking)
- Displaying districts on the activity timeline/list views
- Bulk district operations
