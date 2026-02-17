# Explore Data Report Builder - Design

**Date:** 2026-02-17
**Status:** Approved
**Pillar:** Report (third pillar alongside Plan and Execute)

## Philosophy

The territory planning app has three pillars:
1. **Plan** - Create territory plans, assign districts, set targets, organize visually
2. **Execute** - Manage tasks and activities, calendar sync, log outcomes, track progress
3. **Report** - Explore data, filter/search the database, quantify details, find gaps

The "Explore Data" feature is the entry point to the Report pillar, accessed from the map-v2 IconBar.

## Concept

A full-screen overlay data explorer with multi-entity tabs, column selection, filtering, KPI summary cards, and bidirectional map integration. Think lightweight Airtable/spreadsheet view embedded in the app.

## Layout & Navigation

### Entry Point
- New "Explore" icon in the left IconBar (consistent with Home/Search/Plans)
- Clicking it transitions from the map-centric view to a full-screen report overlay
- The map remains mounted but hidden behind the overlay

### Left Toolbar (consistent UX)
- IconBar stays on the left as always
- When Explore is active, a secondary icon strip appears for entity switching:
  - Districts
  - Activities
  - Tasks
  - Contacts
- Same pattern as plan workspace's section icon strip

### Overlay Layout
```
┌───┬──────────────────────────────────────────────────────┐
│   │  Filter Bar: [+ Add Filter] [Column Picker] [Sort]   │
│ 🏠│ ──────────────────────────────────────────────────── │
│   │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │
│ 🔍│  │ KPI 1  │  │ KPI 2  │  │ KPI 3  │  │ KPI 4  │    │
│   │  └────────┘  └────────┘  └────────┘  └────────┘    │
│ 📋│ ──────────────────────────────────────────────────── │
│   │  Table with virtualized rows, sortable columns       │
│[📊]│  ...                                                 │
│ ├─┤                                                       │
│ │🏫│ ──────────────────────────────────────────────────── │
│ │📅│  Pagination: Showing X of Y │ ◀ 1 2 3 ▶            │
│ │✅│                                           ┌────────┐│
│ │👥│                                           │Mini-Map││
│ └─┘                                           │  [↗]   ││
│ ⚙️│                                           └────────┘│
└───┴──────────────────────────────────────────────────────┘
```

### Navigation Behavior
- Clicking any other IconBar item exits Explore mode, returns to map
- Filter state preserved in store (re-entering Explore restores state)
- Filtered districts can remain highlighted when returning to map view

## Entity Tabs & Default Columns

### Districts (primary, richest data)
**Default columns:**
- Name, State, Enrollment, Customer Status, Open Pipeline, FY26 Revenue, Plans (count), Last Activity, Tags

**Available column groups:**
- CRM/Revenue: FY25-27 sessions, revenue, take, bookings, invoicing, pipeline
- Education: graduation rate, math/reading proficiency, expenditure per pupil, staffing/enrollment trends
- Demographics: enrollment by race, SPED %, ELL %, free lunch %, urbanicity
- Signals: vs-state deltas, quartile rankings, absenteeism
- Engagement: activity count, task count, contacts count, days since last activity

### Activities
**Default:** Title, Type, Status, Date, Outcome Type, Linked Districts, Linked Plans

### Tasks
**Default:** Title, Status, Priority, Due Date, Linked Districts, Linked Plans, Assignee

### Contacts
**Default:** Name, Title, Email, Phone, District, Primary, Last Activity

### Column Picker UX
- Dropdown/popover with checkboxes grouped by category
- Drag handles to reorder columns
- Selections persist in local storage per user per entity

## Filters & Sorting

### Filter Types
| Data Type | Filter UX |
|-----------|-----------|
| Text | Search / Contains |
| Enum | Multi-select dropdown |
| Number | Range (min/max inputs) |
| Boolean | Toggle |
| Date | Date range picker (presets + custom) |
| Tags | Multi-select from existing tags |

### Filter UX
1. Click "+ Add Filter"
2. Pick column from categorized dropdown
3. Set condition (varies by type)
4. Filter pill appears in bar
5. Click pill to edit, X to remove
6. All filters combine with AND logic

### Sorting
- Click column header to sort (toggle asc/desc)
- Arrow indicator on active sort column

### Future: Saved Filters
Filter state is serializable for future preset support ("My CA targets", "Unworked high-pipeline").

## KPI Summary Cards

Dynamic cards above the table that recalculate from filtered results.

### Districts Tab
| Card | Calculation |
|------|-------------|
| Districts | filtered count / total count |
| Total Enrollment | sum of enrollment |
| Open Pipeline | sum of fy26_open_pipeline_value |
| Closed Won | sum of fy26_closed_won_net_booking |

### Activities Tab
| Card | Calculation |
|------|-------------|
| Total Activities | count |
| Completed | count where status=completed |
| Positive Outcomes | count where outcomeType=positive_progress |
| Districts Touched | unique district count |

### Tasks Tab
| Card | Calculation |
|------|-------------|
| Total Tasks | count |
| Overdue | dueDate < today AND status != done |
| Completed | status=done |
| Blocked | status=blocked |

### Contacts Tab
| Card | Calculation |
|------|-------------|
| Total Contacts | count |
| Districts Covered | unique districts |
| Primary Contacts | isPrimary=true |
| With Recent Activity | activity in last 30 days |

Aggregates returned by API in response metadata so cards remain accurate with pagination.

## Map Integration (Bidirectional)

### Explore → Map
- Filtered district IDs sync to map layer
- Non-matching districts dimmed/hidden on mini-map
- Clicking a district row flies mini-map to that location
- Expanding mini-map returns to full map with filters active
- Banner on full map: "Showing X filtered districts - [Clear] [Back to Explore]"

### Map → Explore
- Map selections/viewport can feed into Explore as a geographic filter
- Drawing a selection on the map filters the Explore table to those districts

## Technical Architecture

### Components
```
src/components/map-v2/explore/
├── ExploreOverlay.tsx          # Full-screen overlay container
├── ExploreTable.tsx            # TanStack Table with virtualized rows
├── ExploreFilters.tsx          # Filter bar + filter pill management
├── ExploreColumnPicker.tsx     # Column selection popover
├── ExploreKPICards.tsx         # Dynamic KPI summary cards
├── ExploreMiniMap.tsx          # Mini-map with filtered pins
└── columns/
    ├── districtColumns.ts      # Column definitions for districts
    ├── activityColumns.ts      # Column definitions for activities
    ├── taskColumns.ts          # Column definitions for tasks
    └── contactColumns.ts       # Column definitions for contacts
```

### API
New endpoint: `GET /api/explore/[entity]`

```
GET /api/explore/districts?
  columns=name,state,enrollment,fy26_open_pipeline_value
  &filters=[{"column":"state","op":"in","value":["IL","IN"]}]
  &sort=enrollment&order=desc
  &page=1&pageSize=50

Response:
{
  data: [...rows...],
  aggregates: { count: 847, enrollment_sum: 1200000, pipeline_sum: 4200000 },
  pagination: { page: 1, pageSize: 50, total: 847 }
}
```

Single endpoint pattern works for all four entity types. Returns only requested columns for efficiency. Aggregates included for KPI cards.

### State Management
New `explore` slice in Zustand store:

```typescript
interface ExploreState {
  activeEntity: 'districts' | 'activities' | 'tasks' | 'contacts';
  columns: Record<string, string[]>;
  filters: Record<string, Filter[]>;
  sort: Record<string, SortConfig>;
  page: number;
  isExploreActive: boolean;
  filteredDistrictLeaids: string[];
}
```

### Table: TanStack Table v8
- Column visibility toggling
- Sorting
- Virtualized rows (tanstack-virtual)
- Column resizing/reordering

### Map Sync
- `filteredDistrictLeaids` in store read by map layer
- Map applies filter expression to dim non-matching districts
- Row click → `flyTo(district.lng, district.lat)` on mini-map

## Not in V1 (Future Enhancements)
- Saved filter presets
- Export to CSV
- Chart/visualization mode (sparklines, bar charts)
- Preset report templates
- Group-by / pivot table
- Summary footer rows (totals/averages)
- Inline editing from the table
