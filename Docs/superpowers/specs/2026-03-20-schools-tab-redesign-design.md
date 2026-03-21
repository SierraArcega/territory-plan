# Schools Tab Redesign — DistrictExploreModal

**Date:** 2026-03-20
**Branch:** `feature/schools-tab-redesign`
**Component:** `src/features/map/components/SearchResults/DistrictExploreModal.tsx` → `SchoolsTab`

## Problem

The Schools tab in the DistrictExploreModal is a placeholder that says "Open full detail to view individual schools." Users should be able to browse schools directly in the modal.

## Design

### Data Fetching

- `SchoolsTab` receives `leaid` and fetches from `/api/schools/by-district/[leaid]`
- The API endpoint needs a small extension to include each school's primary contact (via `SchoolContact` join table)
- Returns: schools array with name, address, grade span, level, enrollment, charter status, contacts + summary

### Card Layout

Each school renders as a compact card (rounded-lg bordered row, matching ContactsTab pattern):

- **Left:** School name (semibold, plum) with charter badge if applicable. Grade span below (e.g. "K – 5")
- **Middle:** Street address + city/state. Primary contact name + title below in muted text
- **Right:** "Scan Vacancies" button (small, outlined plum style). After scan, shows matched vacancy count as a clickable link

### Grouping

Schools grouped under level headers: **Elementary**, **Middle**, **High**, **Other**.

- Groups only shown if they contain schools
- Each group header shows count (e.g. "Elementary (4)")
- Schools sorted alphabetically within each group
- Level mapping: `schoolLevel` 1=Elementary, 2=Middle, 3=High, 4/null=Other

### Vacancy Scan Interaction

1. **District already scanned** (vacancies in cache): Skip scan, show matched vacancy count per school by filtering on `schoolNcessch`
2. **No scan exists**: Trigger district-level scan via `useScanDistrict()`, show spinner on button, then display matched counts for all schools once complete
3. **Click vacancy count**: Switch modal to Vacancies tab, pre-filtered to that school's vacancies
4. Scanning from one school card benefits all — after district scan completes, all school cards update with their matched counts

### Empty & Loading States

- **Loading:** 3 skeleton card rows with pulse animation
- **No schools:** Centered "No schools found for this district."
- **No contacts on school:** Omit contact line entirely
- **No vacancies after scan:** Button text changes to "No vacancies" in muted style

## Files to Modify

1. **`src/features/map/components/SearchResults/DistrictExploreModal.tsx`** — Replace `SchoolsTab` placeholder with full implementation
2. **`src/app/api/schools/by-district/[leaid]/route.ts`** — Extend to include primary contacts per school
3. **Possibly `src/features/shared/types/api-types.ts`** — Add/extend types if needed for school contacts in list response

## Out of Scope

- School detail view / individual school modal
- Editing school data from this tab
- School-level (vs district-level) vacancy scanning
