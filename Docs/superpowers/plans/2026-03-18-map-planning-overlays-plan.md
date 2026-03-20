# Implementation Plan: Map Planning Overlays

**Date:** 2026-03-18
**Spec:** `docs/superpowers/specs/2026-03-18-map-planning-overlays-spec.md`
**Backend Context:** `docs/superpowers/specs/2026-03-18-map-planning-overlays-backend-context.md`

## Task Overview

### Backend Tasks (can run in parallel with frontend scaffolding)

#### B1: Map GeoJSON API — Contacts
**Files:** `src/app/api/map/contacts/route.ts`
- New GET endpoint returning GeoJSON FeatureCollection
- JOIN contacts → districts via leaid, extract centroid as lng/lat
- Use raw pg Pool (like customer-dots) for PostGIS centroid extraction
- Filters: `seniorityLevel`, `persona`, `bounds` (west,south,east,north)
- Properties: id, name, title, email, seniorityLevel, persona, districtName, leaid
- No auth required (contacts are team-shared)

#### B2: Map GeoJSON API — Vacancies
**Files:** `src/app/api/map/vacancies/route.ts`
- New GET endpoint returning GeoJSON FeatureCollection
- JOIN vacancy → school (lat/lng) with COALESCE fallback to district centroid
- Filters: `category`, `status`, `dateStart`/`dateEnd` (posted date range), `bounds`
- Properties: id, title, category, status, schoolName, datePosted, daysOpen, fullmindRelevant, districtName, leaid
- No auth required

#### B3: Map GeoJSON API — Activities
**Files:** `src/app/api/map/activities/route.ts`
- New GET endpoint returning GeoJSON FeatureCollection
- JOIN activity → activity_district → district → centroid
- Multi-district activities produce multiple features (one per district)
- Filters: `type`, `status`, `startDate`/`endDate`, `bounds`
- Properties: id, title, type, status, startDate, endDate, outcome, districtName, leaid
- Auth required — scoped to `createdByUserId: user.id`

#### B4: Map GeoJSON API — Plans
**Files:** `src/app/api/map/plans/route.ts`
- New GET endpoint returning GeoJSON FeatureCollection
- JOIN territory_plan → territory_plan_district → district → geometry
- Returns district polygons with plan metadata attached
- Filters: `status`, `fiscalYear`, `planId` (optional single-plan mode)
- Properties: planId, planName, planColor, planStatus, districtName, leaid, renewalTarget, expansionTarget
- No auth required (plans are team-shared)

### Frontend Tasks

#### F1: Zustand Store Extensions
**Files:** `src/features/map/lib/store.ts`
- Add `activeLayers: Set<LayerType>` where LayerType = 'districts' | 'contacts' | 'vacancies' | 'plans' | 'activities'
- Add `layerFilters: Record<LayerType, LayerFilter>` with per-layer filter state
- Add `dateRange: { start: string | null, end: string | null, preset: DatePreset | null }`
- Add actions: `toggleLayer(layer)`, `setLayerFilter(layer, filter)`, `setDateRange(range)`
- Default: `activeLayers = new Set(['districts'])`

#### F2: Map Query Hooks
**Files:** `src/features/map/lib/queries.ts`
- `useMapContacts(bounds, filters, enabled)` — GET /api/map/contacts with query params
- `useMapVacancies(bounds, filters, enabled)` — GET /api/map/vacancies with query params
- `useMapActivities(bounds, filters, enabled)` — GET /api/map/activities with query params
- `useMapPlans(filters, enabled)` — GET /api/map/plans with query params
- All use TanStack Query with 2-min stale time
- Bounds come from map viewport, auto-refetch on pan/zoom (debounced)

#### F3: Layer Drawer Component
**Files:** `src/features/map/components/LayerDrawer.tsx`, `src/features/map/components/layer-drawer/LayerToggle.tsx`, `src/features/map/components/layer-drawer/LayerFilterSection.tsx`, `src/features/map/components/layer-drawer/DateRangeFilter.tsx`
- Collapsible left panel (~240px → 48px icon strip)
- `bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg` per design tokens
- Layer stack: each row = toggle + label + count badge + chevron
- Expanding a row shows sub-filters (FilterSelect components)
- Bottom section: date range with native date inputs + preset chips
- Layer-specific filters:
  - Contacts: seniorityLevel, persona
  - Vacancies: category, status
  - Plans: status, fiscalYear
  - Activities: type, status

#### F4: Map Pin Layers
**Files:** `src/features/map/components/MapV2Container.tsx` (extend), `src/features/map/lib/pin-layers.ts` (new)
- For each active layer, add a MapLibre GeoJSON source + circle/symbol layer
- Pin styling per spec (Coral circles, Golden diamonds, Steel Blue stars, Plum squares)
- Use MapLibre expressions for shape differentiation or SVG icon images
- Clustering: use MapLibre's built-in cluster option on GeoJSON sources (clusterRadius, clusterMaxZoom: 8)
- Cluster circles show count text
- Individual pins show small icon
- Hover handler: show tooltip with entity name + type
- Click handler: call `store.openRightPanel({ type: layerType + '_detail', id: feature.properties.id })`

#### F5: Plan Polygon Overlay
**Files:** `src/features/map/components/MapV2Container.tsx` (extend)
- When Plans layer is active, render plan district polygons as semi-transparent fills
- Color = plan's `color` field with ~30% opacity fill + solid border
- Multiple plans can overlap — use layered fills with different colors
- Click polygon → open plan_card in right panel

#### F6: Vacancy Right Panel
**Files:** `src/features/map/components/right-panels/VacancyDetail.tsx`, `src/features/map/components/right-panels/VacancyForm.tsx`
- VacancyDetail: title, category badge, status badge, school name, hiring manager, email, date posted, days open, relevance flag, source URL link
- VacancyForm: edit status, category, contact link, notes
- Register `vacancy_detail` and `vacancy_form` in RightPanel content type switch

#### F7: Wire Up MapV2Container
**Files:** `src/features/map/components/MapV2Container.tsx`, `src/features/map/components/MapV2Shell.tsx`
- Integrate LayerDrawer into the map layout (left of map, alongside existing FloatingPanel)
- Connect GeoJSON sources to query hooks (conditionally fetched when layer is active)
- Wire map `moveend` event to update bounds in store (debounced 300ms)
- Wire pin click/hover events to right panel and tooltip
- Ensure existing district rendering, vendor overlays, and school layers continue working

## Task Dependencies

```
B1, B2, B3, B4 ─── (independent, run in parallel)
      │
F1 ─── (no backend dependency, can start immediately)
      │
F2 ─── depends on B1-B4 being defined (types), but can stub
      │
F3 ─── depends on F1 (store state)
      │
F4, F5 ─── depends on F1, F2
      │
F6 ─── independent (right panel component)
      │
F7 ─── depends on F3, F4, F5, F6 (integration)
```

**Recommended execution order:**
1. **Parallel batch 1:** B1 + B2 + B3 + B4 + F1 + F6
2. **Parallel batch 2:** F2 + F3
3. **Sequential:** F4 → F5 → F7

## Test Strategy

| Task | Test Approach |
|------|--------------|
| B1-B4 | API route tests: mock Prisma/pg Pool, verify GeoJSON structure, filter logic, auth scoping |
| F1 | Unit test store actions: toggleLayer, setLayerFilter, setDateRange |
| F2 | Mock fetch, verify query params match filters and bounds |
| F3 | Component test: render drawer, toggle layers, verify store updates |
| F4-F5 | Integration test: verify GeoJSON sources added/removed when layers toggle |
| F6 | Component test: render VacancyDetail with mock data, verify fields |
| F7 | Integration test: full map with layers active, verify click → panel flow |
