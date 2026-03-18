# Feature Spec: Map Planning Overlays

**Date:** 2026-03-18
**Slug:** map-planning-overlays
**Branch:** worktree-map-planning-overlays

## Requirements

The existing map page shows only districts. Users need a multi-layer planning tool that overlays contacts, vacancies, territory plans, and activities on the map to:
- **Find coverage gaps** — see where plans/activity exist vs. underserved areas
- **Cluster opportunities** — see where vacancies, contacts, and plans converge to prioritize outreach
- **Track activity** — visualize what's been done where, geographically over time

### User Decisions
- All 5 layers ship in v1: Districts, Contacts, Vacancies, Plans, Activities
- Individual pins with clustering (no heatmap)
- Full editing via right-side panel on click
- Date range filtering is essential (activities, vacancies)
- Replace current districts-only map (districts become one layer)

## Visual Design

### Approved Approach: Layer Drawer (Direction A)

**Layout:** Three-column — collapsible left drawer (~240px) | map | right detail panel (280-380px)

**Left Drawer:**
- `bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg` (matches existing FloatingPanel)
- Collapses to ~48px icon strip
- Layer stack: toggle + label + count badge + expand arrow per layer
- Expanding a layer reveals 1-2 sub-filters
- Date range section at bottom with quick presets (7d, 30d, 90d, YTD, All)

**Map Pins (distinct shape + color per layer):**
| Layer | Color | Shape | Icon |
|-------|-------|-------|------|
| Contacts | Coral `#F37167` | Circle | person |
| Vacancies | Golden `#FFCF70` | Diamond | briefcase |
| Activities | Steel Blue `#6EA3BE` | Star | calendar |
| Plans | Plum `#403770` (or plan.color) | Square | map |

**Pin Placement:**
- Contacts: district centroid (via `leaid` → district)
- Vacancies: school lat/lng when available, else district centroid
- Activities: centroid of linked districts (multi-district → multiple pins)
- Plans: highlighted district polygons (fill overlay), not pins

**Clustering:** At zoom < 9, cluster pins per district showing count badge. At zoom >= 9, show individual pins.

**Interactions:**
- Hover pin → tooltip with entity name + type
- Click pin → open right panel with detail/edit form
- Click district polygon (when Plans layer active) → show plan card

## Component Plan

### Existing Components to Reuse
- `RightPanel.tsx` — panel shell with header, close, scroll
- `ContactDetail.tsx` — contact view (name, email, phone, LinkedIn, title)
- `ActivityForm.tsx` — activity create/edit form
- `PlanCard.tsx` — plan overview with status badge, targets
- `PlanEditForm.tsx` — plan editing
- `TaskForm.tsx` — task create/edit
- `ToggleChips.tsx` — chip toggle buttons
- `FilterSelect.tsx` / `FilterMultiSelect.tsx` — dropdown filters
- `FloatingPanel.tsx` — floating panel container pattern
- Multi-select components (`MultiSelect`, `AsyncMultiSelect`)
- Badge system (status, signal, recency badges)

### New Components Needed
| Component | Category | Doc Reference |
|-----------|----------|---------------|
| `LayerDrawer` | Container/Panel | `Containers/panel.md` |
| `LayerToggle` | Form/Toggle | `Forms/toggle.md` |
| `LayerFilterSection` | Container/Accordion | `Containers/accordion.md` |
| `DateRangeFilter` | Form/DateInput | `Forms/date-input.md` |
| `MapPinLayer` | Map/Custom | — |
| `PinCluster` | Map/Custom | — |
| `PinTooltip` | Display/Tooltip | `Display/tooltips.md` |
| `VacancyDetail` | Right Panel | `Patterns/detail-views.md` |
| `VacancyForm` | Right Panel | `Patterns/forms-and-editing.md` |

### Components to Extend
- `MapV2Container.tsx` — add GeoJSON sources + layers for each overlay type, click handlers for pins
- `useMapV2Store` (Zustand) — add `activeLayers`, `layerFilters`, `dateRange` state slices
- `RightPanel.tsx` — add `vacancy_detail` and `vacancy_form` panel content types
- `api-types.ts` — add `MapContact`, `MapVacancy`, `MapActivity` interfaces with lat/lng

## Backend Design

See: `docs/superpowers/specs/2026-03-18-map-planning-overlays-backend-context.md`

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/map/contacts` | GET | GeoJSON FeatureCollection of contacts with district centroid coordinates. Filters: `seniorityLevel`, `persona`, bounds. |
| `GET /api/map/vacancies` | GET | GeoJSON FeatureCollection of vacancies with school lat/lng or district centroid. Filters: `category`, `status`, `datePosted` range, bounds. |
| `GET /api/map/activities` | GET | GeoJSON FeatureCollection of activities with district centroid coordinates. Filters: `type`, `status`, `startDate`/`endDate` range, bounds. Auth required (user-scoped). |
| `GET /api/map/plans` | GET | GeoJSON FeatureCollection of plan district polygons with plan metadata. Filters: `status`, `fiscalYear`. |

All map endpoints return GeoJSON `FeatureCollection` with properties needed for pin rendering and tooltip display. Bounds-based filtering (`?bounds=west,south,east,north`) for performance.

### New Query Hooks
- `useMapContacts(bounds, filters, enabled)` — fetches contact GeoJSON
- `useMapVacancies(bounds, filters, enabled)` — fetches vacancy GeoJSON
- `useMapActivities(bounds, filters, enabled)` — fetches activity GeoJSON
- `useMapPlans(filters, enabled)` — fetches plan district GeoJSON

### Geo Strategy
- Contacts: JOIN `contact` → `district` → `ST_X(centroid), ST_Y(centroid)` via raw pg Pool
- Vacancies: JOIN `vacancy` → `school` (lat/lng) with fallback to `district` centroid
- Activities: JOIN `activity` → `activity_district` → `district` → centroid
- Plans: Return district geometries already available in `district_map_features` view, filtered by plan membership

## States

| State | Approach |
|-------|----------|
| **Loading** | Skeleton shimmer in layer drawer count badges; pins fade in when GeoJSON loads |
| **Empty layer** | Muted text in layer row: "No contacts in view" / "No vacancies match filters" |
| **Error** | Red inline callout in layer drawer section for failed layer, other layers unaffected |
| **No layers active** | Subtle centered prompt on map: "Toggle a layer to explore your territory" |
| **Right panel loading** | Skeleton in right panel while entity detail fetches |

## Out of Scope

- Heatmap visualization (future enhancement)
- Drawing/creating new entities directly on the map (click-to-create)
- Geocoding calendar event `location` strings
- Cross-user activity visibility (activities remain user-scoped)
- Mobile-specific layer drawer layout (desktop-first for v1)
- Saved layer presets / saved views with layer state (extend existing MapView later)
- Real-time collaboration / live updates
