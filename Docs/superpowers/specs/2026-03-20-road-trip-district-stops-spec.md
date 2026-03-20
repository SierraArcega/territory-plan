# Feature Spec: Road Trip District Stops

**Date:** 2026-03-20
**Slug:** road-trip-district-stops
**Branch:** worktree-road-trip-district-stops

## Requirements

- Reps can add district "stops" to Road Trip activities in the DETAILS section
- Districts are searchable and selected from existing district data (via `/api/admin/districts/search`)
- Each stop has: district, single visit date, notes, display position
- Stops can be drag-reordered (Google Maps route-stop style) using HTML5 drag-and-drop
- On save, each stop with a date auto-creates a linked "Visit" activity (`school_site_visit` type) for that district
- Scoped to Road Trip activities only

## Visual Design

- **Approved approach:** Inline Stop Cards — vertical list of bordered cards in the DETAILS section
- Each card: drag handle | numbered circle | district name · state | remove button, with date picker and notes input below
- "**+ Add Stop**" button at bottom opens inline district search
- Empty state: italic placeholder text (already exists)

### Stop Card Layout

```
┌──────────────────────────────────────────────┐
│ ⠿  ①  Richland School District 2 · SC    ×  │
│     📅 [date picker]   📝 [notes input...]   │
└──────────────────────────────────────────────┘
```

### Styling Tokens
- Card: `border border-[#E2DEEC] rounded-lg p-3 bg-[#FDFCFF]`
- Drag handle: `text-[#A69DC0] cursor-grab` / `cursor-grabbing` while dragging
- Number circle: `w-5 h-5 rounded-full bg-[#403770] text-white text-xs flex items-center justify-center`
- District name: `text-sm font-medium text-[#403770]`
- State abbrev: `text-[#A69DC0] ml-1`
- Remove button: `text-[#A69DC0] hover:text-[#F37167]`
- Date input: existing form input styles
- Notes input: `text-sm text-[#403770] placeholder:text-[#A69DC0]` compact single-line
- "+ Add Stop": `text-sm font-medium text-[#F37167] hover:text-[#d4544a]`

### Interaction States
- **Dragging:** Card has `shadow-md opacity-75`, drop indicator line (2px `bg-[#403770]`) between cards
- **Search dropdown:** Appears below "+ Add Stop", max 8 results, debounced 300ms
- **Already-added districts:** Grayed out in search results, not clickable

## Component Plan

### Existing components to reuse
- `EventTypeFields` — routing switch for type-specific fields (already routes `road_trip` → `RoadTripFields`)
- `ActivityFormModal` — parent form container (already has `districtStops` state)
- District search API — `GET /api/admin/districts/search?q=`

### Components to extend
- **`RoadTripFields`** (`src/features/activities/components/event-fields/RoadTripFields.tsx`) — complete rewrite to support: district search/add, drag-to-reorder, per-stop date + notes, remove stop

### New components needed
- **`DistrictStopCard`** — individual stop card with drag handle, date, notes, remove (extracted from RoadTripFields for clarity)
- **`DistrictSearchInput`** — inline search input with dropdown results (fetches from `/api/admin/districts/search`)

## Backend Design

See: `docs/superpowers/specs/2026-03-20-road-trip-district-stops-backend-context.md`

### Schema changes (new migration)

Add to `ActivityDistrict`:
- `position` Int @default(0) @map("position") — ordering within road trip
- `notes` String? @map("notes") — per-stop notes

### API changes

**POST /api/activities** (create):
- Accept `position` and `notes` per district in the `districts` array
- After creating road trip + district links, auto-create Visit activities:
  - For each district with a `visitDate`:
    - Create activity: type `school_site_visit`, title `"Visit: {district.name}"`, startDate = visitDate, status `"planned"`, same `createdByUserId`, same `planIds`
    - Link Visit district: same district leaid
    - Link Visit to road trip: ActivityRelation with relationType `"part_of"`

**PATCH /api/activities/[id]** (update):
- Accept `position` and `notes` per district

**GET /api/activities/[id]** (read):
- Return `position` and `notes` in district objects
- Order districts by `position` ascending

## States

- **Empty:** Italic placeholder — "Add districts to this road trip to set per-stop visit dates."
- **Loading search:** Spinner in search dropdown while fetching
- **No search results:** "No districts found" message in dropdown
- **Dragging:** Card elevated with shadow, drop indicator line between other cards

## Out of Scope

- Map visualization of the route
- Editing auto-created visits from within the road trip form
- Multi-day date ranges per stop (single date only)
- Distance/drive time calculations between stops
- Editing stops on an existing road trip (this spec covers create flow only; edit will follow)
