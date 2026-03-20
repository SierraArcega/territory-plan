# Feature Report: Map Planning Overlays

**Date:** 2026-03-18
**Status:** Needs Attention

## Summary

The Map Planning Overlays feature implements a multi-layer map visualization with four new GeoJSON API endpoints, a collapsible layer drawer, pin/polygon rendering via MapLibre, and vacancy detail/edit right panels. The architecture is solid and follows existing codebase patterns well. Two issues require attention before merge: a date filter parameter mismatch (fixed) and a missing `/api/vacancies/:id` endpoint that the VacancyDetail and VacancyForm panels depend on.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/map/contacts/route.ts` | New | GeoJSON API for contacts at district centroids |
| `src/app/api/map/vacancies/route.ts` | New | GeoJSON API for vacancies at school/district coords |
| `src/app/api/map/activities/route.ts` | New | GeoJSON API for user-scoped activities at district centroids |
| `src/app/api/map/plans/route.ts` | New | GeoJSON API for plan district polygons |
| `src/features/map/lib/store.ts` | Modified | Added overlay layer state: activeLayers, layerFilters, dateRange, mapBounds |
| `src/features/map/lib/queries.ts` | Modified | Added useMapContacts, useMapVacancies, useMapActivities, useMapPlans hooks |
| `src/features/map/lib/pin-layers.ts` | New | MapLibre source/layer definitions for pins, clusters, plan polygons |
| `src/features/map/components/LayerDrawer.tsx` | New | Collapsible left drawer with layer toggles, filters, date range |
| `src/features/map/components/layer-drawer/LayerToggle.tsx` | New | Toggle switch per layer with count badge |
| `src/features/map/components/layer-drawer/LayerFilterSection.tsx` | New | Collapsible filter section + FilterDropdown |
| `src/features/map/components/layer-drawer/DateRangeFilter.tsx` | New | Date range with presets (7d/30d/90d/YTD/All) and custom inputs |
| `src/features/map/components/right-panels/VacancyDetail.tsx` | New | Vacancy detail view with badges, info rows, quick actions |
| `src/features/map/components/right-panels/VacancyForm.tsx` | New | Vacancy edit form (status, category, notes) |
| `src/features/map/components/MapV2Container.tsx` | Modified | Integrated overlay sources, layers, click/hover handlers |
| `src/features/map/components/MapV2Shell.tsx` | Modified | Added LayerDrawer, RightPanel for overlay pins, feature counts |
| `src/features/map/components/RightPanel.tsx` | Modified | Registered vacancy_detail and vacancy_form panel types |
| `src/features/shared/types/api-types.ts` | Modified | Added MapContactProperties, MapVacancyProperties, MapActivityProperties, MapPlanProperties |
| `src/app/api/vacancies/scan-bulk/route.ts` | Modified | Runs scans inline instead of via scan-next polling |
| `src/app/api/vacancies/scan-next/route.ts` | Deleted | Replaced by inline scan execution in scan-bulk |
| `src/features/vacancies/components/BulkScanButton.tsx` | Modified | Switched to polling batch progress instead of driving scan-next |
| `Docs/superpowers/plans/2026-03-18-map-planning-overlays-plan.md` | New | Implementation plan |
| `Docs/superpowers/specs/2026-03-18-map-planning-overlays-backend-context.md` | New | Backend context doc |
| `Docs/superpowers/specs/2026-03-18-map-planning-overlays-spec.md` | New | Feature spec (duplicate of docs/superpowers/specs/) |

## Design Review

**Passed with minor notes.** All new components use plum-derived color tokens exclusively -- no Tailwind grays detected. Specific findings:

- **Panel styling (LayerDrawer):** Matches `panel.md` spec exactly: `bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg`, header with `border-b border-[#E2DEEC]`, uppercase caption text.
- **Toggle (LayerToggle):** Matches `toggle.md` spec: `w-8 h-[18px]` track, `w-[14px] h-[14px]` thumb, correct on/off colors (`bg-[#403770]`/`bg-[#C2BBD4]`), `role="switch"` with `aria-checked`, Coral focus ring. Label uses `text-sm font-medium` which is correct.
- **Date inputs (DateRangeFilter):** Uses native `<input type="date">` per spec. Correct border (`border-[#C2BBD4]`), focus ring (`focus:ring-[#F37167]`). Uses `text-[10px]` for compact layout in the drawer -- smaller than the `text-sm` canonical size from `date-input.md` but justified by the narrow drawer context.
- **Spacing:** All spacing uses 4px grid values (`gap-1`, `gap-2`, `p-3`, etc.) -- no arbitrary pixel values.
- **Z-index:** Uses `z-20` for drawer (Panels tier) -- correct.
- **Map-to-Panel interaction:** Click pin -> `openRightPanel({ type, id })` follows the documented pattern. Cluster click zooms in. Plan polygon click opens plan_card. Tooltip on hover.
- **Minor:** `text-[9px]` used in VacancyDetail and VacancyForm badges/labels is below the Micro tier (`text-[10px]`), but this matches the existing pattern in ContactDetail, TaskForm, and ActivityForm.

## Code Review Findings

### Strengths
- All four API routes use parameterized queries with `$N` placeholders -- no SQL injection risk
- Bounds validation on all API routes that require it (rejects NaN, returns 400)
- Activities endpoint properly auth-scoped via `getUser()` with `created_by_user_id = user.id`
- MapLibre clustering uses built-in `cluster`/`clusterMaxZoom`/`clusterRadius` for efficient rendering
- `quantizeBounds()` reused from existing pattern to stabilize query keys and reduce cache thrashing
- `keepPreviousData` on all overlay queries prevents flash-of-empty during pan/zoom
- Store actions are immutable (new Set on toggle, spread on filter updates)
- Proper `client.release()` in `finally` blocks for all pg Pool connections
- XSS mitigated: `sourceUrl` rendered in `<a href>` with `rel="noopener noreferrer"`; vacancy IDs passed through `encodeURIComponent`
- `satisfies LayerSpecification` on all layer objects for type safety without widening

### Issues

| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| **Critical (FIXED)** | `buildOverlayParams` sends `dateStart`/`dateEnd` for all hooks, but activities API expects `startDate`/`endDate`. Date filtering silently broken for activities. | `queries.ts` | Fixed: `useMapActivities` now passes `startDate`/`endDate` directly as filter params instead of using the shared dateRange mechanism. |
| **Important** | No `/api/vacancies/[id]/route.ts` endpoint exists. VacancyDetail and VacancyForm fetch from `/api/vacancies/${id}` which returns 404. Clicking a vacancy pin opens an empty "Vacancy not found" panel. | `VacancyDetail.tsx`, `VacancyForm.tsx` | Must create `src/app/api/vacancies/[id]/route.ts` with GET and PATCH handlers before the feature is usable end-to-end. |
| **Minor (FIXED)** | Unused import `MapVacancyProperties` in VacancyDetail.tsx. | `VacancyDetail.tsx` | Removed. |
| **Minor (FIXED)** | Dead code: `const days = daysOpen(null)` assigned but never read. | `VacancyDetail.tsx` | Removed along with stale comments. |
| **Minor (FIXED)** | Unused constants `EMPTY_POINT_FC` and `EMPTY_GEOM_FC` declared but never referenced. | `queries.ts` | Removed. |
| **Minor** | Vacancy category options duplicated between `LayerDrawer.tsx` (as `VACANCY_CATEGORY_OPTIONS`) and `VacancyForm.tsx` (as `CATEGORY_OPTIONS`). | Both files | Extract to a shared `vacancy-constants.ts` file. |
| **Minor** | `MapVacancyProperties` type includes `hiringManager`, `hiringEmail`, `sourceUrl` but the `/api/map/vacancies` SQL query does not SELECT these columns. Type is wider than the actual API response. | `api-types.ts`, `map/vacancies/route.ts` | Either add these columns to the map endpoint or narrow the type. Not critical since VacancyDetail fetches full data separately. |
| **Minor** | `text-[9px]` in new components is below the documented Micro tier (`text-[10px]`). | `VacancyDetail.tsx`, `VacancyForm.tsx` | Matches existing codebase pattern -- consider a future cleanup pass to standardize. |
| **Minor** | Plans endpoint has no bounds filtering (loads all plan polygons globally). For territories with many plans this could be heavy. | `map/plans/route.ts` | Acceptable for v1 since plans are relatively few. Add bounds filtering if performance issues arise. |
| **Minor** | Bulk scan changes (scan-bulk running inline, scan-next deletion) are unrelated to map planning overlays. | `scan-bulk/route.ts`, `scan-next/route.ts`, `BulkScanButton.tsx` | Consider splitting into a separate PR for cleaner git history. |

## Recommendation

**NEEDS ATTENTION** -- The critical date filter bug has been fixed. The remaining blocker is the missing `/api/vacancies/[id]` endpoint (GET + PATCH) which is required for VacancyDetail and VacancyForm to function. Once that endpoint is created, the feature is ready for review.
