# Schools Tab Redesign — DistrictExploreModal

**Date:** 2026-03-20
**Branch:** `feature/schools-tab-redesign`
**Component:** `src/features/map/components/SearchResults/DistrictExploreModal.tsx` → `SchoolsTab`

## Problem

The Schools tab in the DistrictExploreModal is a placeholder that says "Open full detail to view individual schools." Users should be able to browse schools directly in the modal.

## Design

### Data Fetching

- `SchoolsTab` receives `leaid`, `setActiveTab`, and a school-filter state setter from the modal
- Fetches from `/api/schools/by-district/[leaid]`
- The API endpoint must be extended to:
  - Include `streetAddress`, `city`, `stateAbbrev` in the response (fields exist on the Prisma model but are currently omitted from the mapping)
  - Include each school's first linked contact via the `SchoolContact` join table (there is no `isPrimary` flag on `SchoolContact`, so we use the first contact found; the `Contact` model's `isPrimary` flag is district-level, not school-level)
- Returns: schools array with name, address fields, grade span, level, enrollment, charter status, contacts + summary

### Card Layout

Each school renders as a compact card (rounded-lg bordered row, matching ContactsTab pattern):

- **Left:** School name (semibold, plum) with charter badge if applicable. Grade span below (e.g. "K – 5")
- **Middle:** Street address + city/state. First linked contact name + title below in muted text (omit line if no contacts)
- **Right:** "Scan Vacancies" button (small, outlined plum style). After scan, shows matched vacancy count as a clickable link

### Grouping

Schools grouped under level headers: **Primary (Elementary)**, **Middle**, **High**, **Other**.

- Groups only shown if they contain schools
- Each group header shows count (e.g. "Primary (4)")
- Schools sorted alphabetically within each group
- Level mapping: `schoolLevel` 1=Primary, 2=Middle, 3=High, 4/null=Other

### Vacancy Scan Interaction

1. **District already scanned** (vacancies in cache via `useVacancies(leaid)`): Show matched vacancy count per school by client-side filtering on `schoolNcessch`
2. **No scan exists**: "Scan Vacancies" button triggers district-level scan via `useScanDistrict()`. Show spinner on button. `useScanDistrict` enqueues the scan asynchronously — on mutation success it invalidates the vacancies query, which will refetch. Use `useVacancies`'s loading/refetch state to know when results arrive
3. **Click vacancy count**: Call `setActiveTab("vacancies")` and set a school filter state (lifted to the modal) so the Vacancies tab renders `VacancyList` filtered to that school
4. Scanning from one school card benefits all — after district scan completes, all school cards update with their matched counts

### Vacancy Tab Filtering

- `VacancyList` needs an optional `schoolNcessch` prop to filter displayed vacancies client-side (vacancies already have `schoolNcessch` field)
- The modal needs a `vacancySchoolFilter` state (lifted) that gets set when clicking a vacancy count from a school card, and cleared when switching tabs manually

### Tab Label

Show school count in the tab label: "Schools (9)" — consistent with Contacts and Vacancies tabs. Uses `district.numberOfSchools` which is already available.

### Empty & Loading States

- **Loading:** 3 skeleton card rows with pulse animation
- **No schools:** Centered "No schools found for this district."
- **No contacts on school:** Omit contact line entirely
- **No vacancies after scan:** Button text changes to "No vacancies" in muted style
- **API error:** Centered error message with retry, matching existing tab error patterns

## Props Interface

```typescript
interface SchoolsTabProps {
  leaid: string;
  setActiveTab: (tab: Tab) => void;
  setVacancySchoolFilter: (ncessch: string | null) => void;
}
```

## Files to Modify

1. **`src/features/map/components/SearchResults/DistrictExploreModal.tsx`** — Replace `SchoolsTab` placeholder, add `vacancySchoolFilter` state, update tab label, pass new props
2. **`src/app/api/schools/by-district/[leaid]/route.ts`** — Extend response to include `streetAddress`, `city`, `stateAbbrev`, and first contact per school
3. **`src/features/shared/types/api-types.ts`** — Extend `SchoolListItem` with address fields and optional contact
4. **`src/features/vacancies/components/VacancyList.tsx`** — Add optional `schoolNcessch` prop for client-side filtering

## Out of Scope

- School detail view / individual school modal
- Editing school data from this tab
- School-level (vs district-level) vacancy scanning
- Adding `isPrimary` to `SchoolContact` model
