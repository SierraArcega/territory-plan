# Click-Nav Titles — Design Spec

**Branch:** `click-nav-titles` (off `main`)
**Date:** 2026-03-15

---

## Problem

Clicking an activity title in the app either does nothing or forces an immediate edit, depending on where the activity appears. In `PlanActivitiesSection`, the whole row is clickable but opens an edit form (good behavior, already correct). In the `ExploreOverlay` activities tab, clicking a row does nothing at all. The goal is to make both surfaces consistent: clicking opens the full activity editor.

## Goal

Make activity row clicks open the full activity editor (`activity_edit` right panel) consistently across all views that show activities. Apply minimal visual affordance so the title reads as a navigation target.

---

## Behavior Change

**Before:**
- `PlanActivitiesSection`: whole row click → `activity_edit` ✓ (already correct)
- `ExploreOverlay` activities tab: row click → nothing

**After:**
- `PlanActivitiesSection`: unchanged. Title gets `group-hover:underline` to reinforce clickability.
- `ExploreOverlay` activities tab: row click → `openRightPanel({ type: "activity_edit", id: row.id as string })`, guarded by `&& row.id` (matching the existing pattern for `districts` and `plans` branches).

---

## Affected Files

### 1. `PlanActivitiesSection.tsx`

**Location:** `src/features/map/components/panels/PlanActivitiesSection.tsx`

No logic change. The `ActivityRow` wrapper `<div>` already has `cursor-pointer` and fires `openRightPanel({ type: "activity_edit", id })` on click.

Visual only: add `group-hover:underline` to the title `<span>` so the underline appears whenever the row is hovered (the wrapper already carries the `group` class). This activates on full-row hover, not just title hover, which is consistent with the row-level click target.

### 2. `ExploreOverlay.tsx`

**Location:** `src/features/map/components/explore/ExploreOverlay.tsx`

Add an `"activities"` branch to `handleRowClick`:

```ts
} else if (exploreEntity === "activities" && row.id) {
  openRightPanel({ type: "activity_edit", id: row.id as string });
}
```

The `"tasks"` and `"contacts"` entity tabs are intentionally left as no-ops in this branch — they have no right panel destination yet and that work is out of scope here.

---

## Visual

- `PlanActivitiesSection` title: add `group-hover:underline` to the title span. Row already has `hover:bg-gray-50` and `cursor-pointer`.
- `ExploreOverlay` activities rows: DataGrid already applies `cursor-pointer` when `onRowClick` is provided and `hover:bg-[#EFEDF5]` on the row. No additional styling needed.
- No new components. No new panel types.

---

## Out of Scope

- **LineupView:** The Lineup activities table will need the same treatment when it is built. That work belongs in the Lineup feature branch.
- **Tasks and Contacts tabs in ExploreOverlay:** Row clicks remain no-ops intentionally — no right panel destination exists for these entities yet.
- **Read-only detail view:** Not needed. The full editor is the right destination.
- **Keyboard accessibility:** Not addressed in this pass.

---

## Testing

- Manual: click an activity row in `PlanActivitiesSection` → `activity_edit` panel opens with correct activity.
- Manual: hover an activity row in `PlanActivitiesSection` → title underlines.
- Manual: click an activity row in the ExploreOverlay Activities tab → `activity_edit` panel opens with correct activity.
- Manual: click a task or contact row in ExploreOverlay → nothing happens (expected).
- No new unit tests required — changes are wiring and styling only.
