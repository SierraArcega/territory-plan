# LineupView Status + Activity Type Filters — Design Spec

**Date:** 2026-03-15
**Branch:** aston-sortable-tables
**Status:** Approved

---

## Problem

The Lineup toolbar lets users filter by State and Plan, but not by activity status or type. On a busy day, there's no way to quickly see only planned activities, or only demos and discovery calls. Both fields are already present on `ActivityListItem` — this is purely a UI gap.

---

## Scope

**Modified files:**
- `src/features/lineup/components/LineupView.tsx` — two new filter dropdowns + state + useMemo clauses
- `Documentation/UI Framework/Components/Forms/select.md` — Do/Don't note for filter dropdowns (already noted as pending in prior spec work)

**No new files.** Dropdowns are implemented inline, following the existing pattern in `FilterBar.tsx` and `LayerBubble.tsx`.

---

## Design

### Toolbar placement

Two inline multi-select dropdowns are added to the LineupView toolbar, in the filter chips row (the second toolbar row), after the State chips and before "Clear filters":

```
[ State chips... ]  [ Status ▾ ]  [ Activity Type ▾ ]  [ Clear filters ]
```

### New state

```ts
const [selectedStatuses, setSelectedStatuses] = useState<ActivityStatus[]>([]);
const [selectedActivityTypes, setSelectedActivityTypes] = useState<ActivityType[]>([]);
```

### filteredActivities useMemo

Two new filter clauses appended after the existing State filter. Filters are ANDed — an activity must pass all active filters:

```ts
if (selectedStatuses.length > 0) {
  result = result.filter((a) => selectedStatuses.includes(a.status));
}
if (selectedActivityTypes.length > 0) {
  result = result.filter((a) => selectedActivityTypes.includes(a.type));
}
```

Dependency array gains `selectedStatuses` and `selectedActivityTypes`.

### Status dropdown

- **Options:** 3, static — from `VALID_ACTIVITY_STATUSES` (`planned`, `completed`, `cancelled`)
- **Labels:** `ACTIVITY_STATUS_CONFIG[s].label`
- **Visual:** Colored dot beside each label using `ACTIVITY_STATUS_CONFIG[s].color`
- **Trigger label:**
  - 0 selected → "All Statuses"
  - 1 selected → label of that status
  - 2+ selected → "N statuses"
- **Implementation:** Inline trigger button + floating panel; click-outside close via `useRef` + `useEffect`

### Activity Type dropdown

- **Options:** 11, static — from `ALL_ACTIVITY_TYPES`
- **Labels:** `ACTIVITY_TYPE_LABELS[t]`
- **Grouping:** Options grouped under non-selectable category section headers (Events, Outreach, Meetings) using `ACTIVITY_CATEGORIES` and `CATEGORY_LABELS`
- **Trigger label:**
  - 0 selected → "All Types"
  - 1 selected → label of that type
  - 2+ selected → "N types"
- **Implementation:** Same inline pattern as Status dropdown

### "Clear filters" update

Condition expands to include both new filters:

```ts
selectedPlanIds.length > 0
  || selectedStates.length > 0
  || selectedStatuses.length > 0
  || selectedActivityTypes.length > 0
```

onClick resets all four:

```ts
setSelectedPlanIds([]);
setSelectedStates([]);
setSelectedStatuses([]);
setSelectedActivityTypes([]);
```

---

## Data notes

- `ActivityListItem.status` is `ActivityStatus` (`planned` | `completed` | `cancelled`). No API extension needed.
- `ActivityListItem.type` is `ActivityType` (one of 11 values). No API extension needed.
- Option lists are static enums — no need to derive from the current day's activities.

---

## Testing

- Unit: `filteredActivities` logic — status filter, type filter, combined filters, empty selection (no filter applied), "Clear filters" resets all four states
- Happy path: select "Planned" status → only planned activities visible; select "Demo" type → only demos visible; both active → intersection shown; Clear filters → all activities restored

---

## Out of scope

- Persisting filter selections across date navigation or page reload
- Combining Status/Type filters with the Plan filter beyond the existing AND logic
- Any changes to the existing State chip filter UI
