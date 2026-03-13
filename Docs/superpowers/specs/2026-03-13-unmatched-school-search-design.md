# Unified School Search in Resolve Modal

**Date:** 2026-03-13
**Status:** Approved

## Problem

When resolving unmatched opportunities to NCES districts, sometimes the "district" name in the CRM is actually a school name (e.g., "Boys & Girls Club of Paterson and Passaic"). The current resolve modal only searches districts, so users have no way to find the correct parent district when the opportunity name is a school.

## Solution

Enhance the manual search in the `DistrictSearchModal` to query both districts and schools in parallel. School results display alongside district results in a clearly labeled section. Selecting a school resolves the opportunity to its parent district (via the school's `leaid`).

## Scope

- **In scope:** Adding school search to the manual search box in the resolve modal
- **Out of scope:** Changing the automatic suggestions algorithm, school-level resolution

## Design

### Backend

No new API routes. The existing endpoints are sufficient:

- `/api/admin/districts/search?q=<query>` — already used for district manual search
- `/api/schools?search=<query>&limit=10` — already supports case-insensitive school name search

### Frontend: `DistrictSearchModal` in `page.tsx`

#### New API helper

```typescript
async function searchSchools(q: string): Promise<{ schools: SchoolResult[] }> {
  if (q.length < 2) return { schools: [] };
  const res = await fetch(`/api/schools?search=${encodeURIComponent(q)}&limit=10`);
  if (!res.ok) throw new Error("Failed to search schools");
  return res.json();
}
```

#### New type

```typescript
interface SchoolResult {
  ncessch: string;
  leaid: string;
  schoolName: string;
  city: string;
  stateAbbrev: string;
  enrollment: number | null;
}
```

#### New `useQuery` in `DistrictSearchModal`

Add a parallel query alongside the existing `searchResults` query:

```typescript
const { data: schoolResults, isLoading: schoolsLoading } = useQuery({
  queryKey: ["school-search", debouncedQuery],
  queryFn: () => searchSchools(debouncedQuery),
  enabled: debouncedQuery.length >= 2,
});
```

#### School selection flow

When a user selects a school result, the `resolveOpportunity` PATCH endpoint validates that the district exists in our database (it does a `prisma.district.findUnique` and returns 404 if not found). So we handle both cases:

1. Call `onSelect` with a `DistrictResult` constructed from the school data (using `school.leaid`)
2. The existing `resolveMutation` fires. If the district exists, resolution succeeds normally.
3. If the PATCH returns 404 (district not in our DB), show an error toast: "District (LEAID) not in system yet — use Create New District to add it first."

This leverages the existing error path — we just need to add an `onError` handler to the `resolveMutation` that shows a helpful message instead of a generic failure.

#### UI layout for search results

When the user is searching (`debouncedQuery.length >= 2`), the results area shows:

1. **Districts section** (existing behavior, unchanged)
   - Header: "Districts" with count badge
   - List of `DistrictRow` components

2. **Schools section** (new)
   - Header: "Schools" with count badge
   - List of `SchoolRow` components
   - Each row shows:
     - School name (bold, left) + LEAID (muted, right)
     - City, State (second line)
     - "Enrollment: X" (third line, if available)
   - Selecting a school triggers resolution to its parent district

3. **Empty state** — combined message "No districts or schools found" only when BOTH queries return empty. If one has results and the other doesn't, only show the section with results (no empty message for the missing section).

4. **Loading state** — show each section independently as its query resolves. Districts may return before schools (school table is larger). Don't block one section waiting for the other.

5. **Search placeholder** — update from "Search districts by name, LEAID, or state..." to "Search districts or schools by name..."

#### `SchoolRow` component

New component similar to `DistrictRow`:

```tsx
function SchoolRow({
  school,
  onSelect,
}: {
  school: SchoolResult;
  onSelect: (leaid: string) => void;
}) {
  return (
    <button onClick={() => onSelect(school.leaid)} className="...same styles as DistrictRow...">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#403770]">{school.schoolName}</span>
        <span className="text-xs text-[#A69DC0] font-medium tabular-nums flex-shrink-0 ml-3">
          {school.leaid}
        </span>
      </div>
      <div className="text-xs text-[#8A80A8] mt-0.5">
        {school.city}, {school.stateAbbrev}
      </div>
      {school.enrollment != null && (
        <div className="text-xs text-[#8A80A8] mt-0.5">
          Enrollment: {school.enrollment.toLocaleString()}
        </div>
      )}
    </button>
  );
}
```

### Resolution behavior

When a school is selected, `SchoolRow` calls `onSelect` which constructs a `DistrictResult` and passes it to `handleResolve` → `resolveMutation`. The PATCH endpoint validates the district exists and returns the actual district data in the response (`resolvedDistrict: { leaid, name, stateAbbrev }`).

The toast message uses `variables.districtName`, so we pass the school name with a qualifier to be clear about what happened:

```typescript
// SchoolRow calls onSelect, which flows into handleResolve
onSelect({
  leaid: school.leaid,
  name: `${school.schoolName} (via school)`,
  stateAbbrev: school.stateAbbrev,
  enrollment: school.enrollment,
  cityLocation: school.city,
});
```

The toast will read e.g. "Resolved 3 to Success Academy (via school) (1813237)".

**Error handling:** Add `onError` to `resolveMutation` to catch the 404 case when a school's parent district isn't in our database. Show a descriptive toast: "District LEAID not found in system — create it first using Create New District."

## Files to modify

1. `src/app/admin/unmatched-opportunities/page.tsx`
   - Add `SchoolResult` interface
   - Add `searchSchools` helper
   - Add `SchoolRow` component
   - Modify `DistrictSearchModal` to add school query + render school results section
   - Update search placeholder text
   - Add `onError` handler to `resolveMutation` for 404 case

## Testing

- Manual: search for a school name in the resolve modal, verify school results appear, select one, confirm it resolves to the correct district LEAID
- Verify district-only searches still work as before
- Verify empty state shows when neither districts nor schools match
