# Unified Search & Filter System

## Philosophy

**Filters** and **Layers** are separate concerns with a clear visual hierarchy:

- **Filters** narrow *which* districts appear in results and get highlighted on the map. Primary, prominent, always visible in the search bar.
- **Layers** control *how* the map renders matched districts (vendor coloring, engagement levels, signal overlays, palettes, school types, locales). Secondary, accessed via a gear icon.

## Search Bar Layout

```
[🔍 Search districts, cities, ZIP...] | Fullmind | Competitors | Finance | Demographics | Academics | ⚙️
```

- **Search input** (left): Type-ahead for districts/cities/ZIP. Selecting a result flies the map to that location. Reuses `searchLocations()`.
- **5 filter domain buttons** (center): Each opens a dropdown with filters for that domain.
- **Gear icon** (right): Opens the Layers panel (vendor toggles, engagement, palettes, signals, school types, locales). This is the existing LayerBubble content, repositioned.
- **Active filter pills** appear below the bar. Each pill shows the filter and an × to remove it.

## Filter Domains

### Fullmind
| Filter | Type | Notes |
|--------|------|-------|
| Customer / Prospect | Toggle chips | `isCustomer` true/false |
| Has Open Pipeline | Toggle chips | `hasOpenPipeline` true/false |
| Sales Executive | Select dropdown | Fetched from `/api/sales-executives` |
| FY26 Pipeline Value | Range (min/max inputs) | `fy26_open_pipeline_value` |
| FY26 Bookings | Range | `fy26_closed_won_net_booking` |
| FY26 Invoicing | Range | `fy26_net_invoicing` |
| Plan Membership | Select dropdown | Fetched from `/api/territory-plans` |
| Tags | Multi-select | Fetched from `/api/tags` |

### Competitors
| Filter | Type | Notes |
|--------|------|-------|
| Has Competitor | Vendor checkboxes | Proximity, Elevate, TBT, Educere |
| Competitor Spend | Range per vendor | From `competitorSpend` relation |

### Finance
| Filter | Type | Notes |
|--------|------|-------|
| Expenditure/Pupil | Range | `expenditurePerPupil` |
| Total Revenue | Range | `totalRevenue` |
| Federal Revenue | Range | `federalRevenue` |
| State Revenue | Range | `stateRevenue` |
| Local Revenue | Range | `localRevenue` |
| Tech Spending | Range | `techSpending` |
| Title I Revenue | Range | `titleIRevenue` |
| ESSER Funding | Range | `esserFundingTotal` |

### Demographics
| Filter | Type | Notes |
|--------|------|-------|
| Enrollment | Range | `enrollment` |
| ELL % | Range | `ell_percent` |
| SWD % | Range | `sped_percent` |
| Poverty % | Range | `free_lunch_percent` |
| Median Income | Range | `medianHouseholdIncome` |
| Urbanicity | Toggle chips | City/Suburb/Town/Rural |
| Enrollment Trend (3yr) | Range | `enrollmentTrend3yr` |

### Academics
| Filter | Type | Notes |
|--------|------|-------|
| Graduation Rate | Range | `graduationRate` |
| Math Proficiency | Range | `mathProficiency` |
| Reading Proficiency | Range | `readProficiency` |
| Chronic Absenteeism | Range | `chronicAbsenteeismRate` |
| Student-Teacher Ratio | Range | `studentTeacherRatio` |
| Teacher FTE | Range | `teachersFte` |
| SPED Expend/Student | Range | `spedExpenditurePerStudent` |

## Filter Controls

- **Range filters**: Two number inputs (Min / Max) with an "Apply" button. No histograms for now.
- **Toggle chips**: Clickable buttons that immediately add a filter (e.g., "Customer" / "Prospect").
- **Select dropdowns**: Standard `<select>` that adds a filter on selection.
- **Multi-select**: Checkboxes in a scrollable list.

Each filter, when applied, becomes a pill below the search bar and immediately triggers a search.

## Results Panel (right side, 300px)

Appears when any filter is active. Shows districts matching ALL active filters within the current map viewport.

- **Header**: District count + sort dropdown
- **District cards**: Name, state, county, customer/prospect badge, enrollment, adaptive metrics based on active filters, plan badges, "Add to Plan" button
- **Bulk selection**: Checkbox per card, "Select all" in header, sticky bulk action bar at bottom
- **Viewport sync**: Map `moveend` (debounced 300ms) updates the bounding box, re-queries results
- **Pagination**: "Load more" button

## Layers Panel (gear icon)

Opens as a dropdown/popover from the gear icon. Contains ALL existing LayerBubble functionality:

- Fiscal year selector + Compare mode toggle
- Vendor layer toggles (Fullmind, Proximity, Elevate, TBT, Educere)
- Engagement level checkboxes (pipeline, first year, multi-year, churned)
- Signal overlays (enrollment, ELL, SWD, expenditure)
- School type toggles (elementary, middle, high, charter)
- Locale toggles
- Palette pickers and opacity sliders
- Saved map views

This panel does NOT affect which districts appear in the results panel. It only controls map rendering.

## Data Flow

1. User sets filters → stored in `searchFilters: ExploreFilter[]` in the map store
2. On filter change or map pan → `GET /api/districts/search` with `filters` + `bounds` + `sort` + `page`
3. API runs `buildWhereClause(filters, DISTRICT_FIELD_MAP)` + PostGIS bounding box
4. Returns paginated district cards + all matching leaids (for map dimming)
5. Results panel renders cards. Map dims non-matching districts.
6. Layers panel controls are independent — they only change map paint properties.

## What Changes from Current Implementation

### Remove
- `LayersDropdown.tsx` from SearchBar (duplicate of LayerBubble)
- `DemographicsDropdown.tsx` (replaced by domain-specific dropdowns)
- `CRMDropdown` inline component (replaced by FullmindDropdown)

### New Files
- `src/features/map/components/SearchBar/FullmindDropdown.tsx`
- `src/features/map/components/SearchBar/CompetitorsDropdown.tsx`
- `src/features/map/components/SearchBar/FinanceDropdown.tsx`
- `src/features/map/components/SearchBar/DemographicsDropdown.tsx` (rewrite)
- `src/features/map/components/SearchBar/AcademicsDropdown.tsx`
- `src/features/map/components/SearchBar/LayersPanel.tsx` (extracted from LayerBubble)

### Modified
- `SearchBar/index.tsx` — 5 domain buttons + gear icon instead of Layers/Demographics/CRM
- `SearchBar/FilterPills.tsx` — expanded column label map for all new filter fields
- `MapV2Shell.tsx` — remove `<LayerBubble />` entirely (functionality moves to LayersPanel)

### Unchanged
- `SearchResults/` — works as-is (reads from `searchFilters` store)
- `/api/districts/search` — works as-is (`buildWhereClause` + `DISTRICT_FIELD_MAP` already supports all fields)
- Map store search slice — works as-is
- All existing layer/vendor/signal store state and actions
