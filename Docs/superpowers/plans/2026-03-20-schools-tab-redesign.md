# Schools Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Schools tab in the DistrictExploreModal with a scrollable, grouped list of school cards showing name, address, contact, and per-school vacancy scanning.

**Architecture:** Extend the existing `/api/schools/by-district/[leaid]` endpoint to include address fields and first linked contact. Build a new `SchoolsTab` component that groups schools by level, renders cards, and integrates with the vacancy scan system. Add a `schoolNcessch` filter prop to `VacancyList` for school-level filtering.

**Tech Stack:** Next.js API route (Prisma), React, TanStack Query, Tailwind, Zustand (modal state), Vitest

**Spec:** `Docs/superpowers/specs/2026-03-20-schools-tab-redesign-design.md`

---

### Task 1: Extend API — add address fields and contacts to schools-by-district

**Files:**
- Modify: `src/app/api/schools/by-district/[leaid]/route.ts`
- Modify: `src/features/shared/types/api-types.ts` (lines 743-765)

- [ ] **Step 1: Extend `SchoolListItem` type with address and contact fields**

In `src/features/shared/types/api-types.ts`, add to `SchoolListItem`:

```typescript
// After frplTotal line (~761)
// Address
streetAddress: string | null;
city: string | null;
stateAbbrev: string | null;
// First linked contact
contact: { name: string; title: string | null; email: string | null } | null;
```

- [ ] **Step 2: Update Prisma query to include contacts**

In `src/app/api/schools/by-district/[leaid]/route.ts`, update the `prisma.school.findMany` call to also include `SchoolContact` → `Contact`:

```typescript
const schools = await prisma.school.findMany({
  where,
  include: {
    enrollmentHistory: {
      orderBy: { year: "asc" },
    },
    schoolContacts: {
      take: 1,
      include: {
        contact: {
          select: { name: true, title: true, email: true },
        },
      },
    },
  },
  orderBy: { schoolName: "asc" },
});
```

- [ ] **Step 3: Add address fields and contact to the response mapping**

In the `schoolList` mapping, add after `frplTotal`:

```typescript
streetAddress: s.streetAddress,
city: s.city,
stateAbbrev: s.stateAbbrev,
contact: s.schoolContacts[0]?.contact
  ? {
      name: s.schoolContacts[0].contact.name,
      title: s.schoolContacts[0].contact.title,
      email: s.schoolContacts[0].contact.email,
    }
  : null,
```

- [ ] **Step 4: Verify the API returns the new fields**

Run: `npm run dev` (port 3005), then test with curl:
```bash
curl -s http://localhost:3005/api/schools/by-district/3620580 | jq '.schools[0] | {schoolName, streetAddress, city, stateAbbrev, contact}'
```
Expected: JSON with address fields populated (or null) and contact object (or null).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schools/by-district/\[leaid\]/route.ts src/features/shared/types/api-types.ts
git commit -m "feat(api): add address fields and contacts to schools-by-district endpoint"
```

---

### Task 2: Add school-level filtering to VacancyList

**Files:**
- Modify: `src/features/vacancies/components/VacancyList.tsx` (lines 37-39, 78, 95-102)

- [ ] **Step 1: Add optional `schoolNcessch` prop**

Update the `VacancyListProps` interface:

```typescript
export interface VacancyListProps {
  leaid: string;
  schoolNcessch?: string | null;
}
```

Update the component signature:

```typescript
export default function VacancyList({ leaid, schoolNcessch }: VacancyListProps) {
```

- [ ] **Step 2: Filter vacancies by school when prop is provided**

After the `useQuery` call (~line 92), add client-side filtering before the grouping logic:

```typescript
const filteredVacancies = schoolNcessch
  ? (data?.vacancies ?? []).filter((v) => v.school?.ncessch === schoolNcessch)
  : (data?.vacancies ?? []);
```

Update the grouping logic to use `filteredVacancies` instead of `data?.vacancies`:

```typescript
const groupedByCategory = filteredVacancies.reduce<
  Record<string, VacancyRecord[]>
>((acc, v) => {
  const cat = v.category || "Other";
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(v);
  return acc;
}, {} as Record<string, VacancyRecord[]>);
```

- [ ] **Step 3: Update the summary line to reflect filtered count**

Replace the summary line block (~line 155-166) to use filtered count while preserving the Fullmind-relevant indicator:

```typescript
<div className="text-sm text-gray-600">
  <span className="font-semibold text-[#403770]">{filteredVacancies.length}</span>{" "}
  open position{filteredVacancies.length !== 1 ? "s" : ""}
  {(() => {
    const relevantCount = filteredVacancies.filter((v) => v.fullmindRelevant).length;
    return relevantCount > 0 ? (
      <>
        {" "}
        <span className="text-xs text-gray-400">(</span>
        <span className="font-semibold text-[#F37167]">{relevantCount}</span>
        <span className="text-xs text-gray-400"> Fullmind-relevant)</span>
      </>
    ) : null;
  })()}
  {schoolNcessch && data && filteredVacancies.length !== data.vacancies.length && (
    <span className="text-xs text-[#A69DC0] ml-1">
      (filtered from {data.vacancies.length} district-wide)
    </span>
  )}
</div>
```

- [ ] **Step 4: Update the empty state to handle filtered-empty case**

In the empty state check (~line 134), account for filtered results:

```typescript
if (!data || filteredVacancies.length === 0) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        {schoolNcessch
          ? "No vacancies matched to this school"
          : data?.summary.lastScannedAt
            ? "No vacancies found"
            : "Not yet scanned"}
      </p>
      {data?.summary.lastScannedAt && (
        <LastScannedInfo lastScannedAt={data.summary.lastScannedAt} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/components/VacancyList.tsx
git commit -m "feat(vacancies): add schoolNcessch filter prop to VacancyList"
```

---

### Task 3: Build SchoolsTab component

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictExploreModal.tsx` (replace SchoolsTab at lines 952-963)

- [ ] **Step 1: Add imports needed by the new SchoolsTab**

At the top of `DistrictExploreModal.tsx`, add these imports (some may already exist — check first):

```typescript
import { useScanDistrict } from "@/features/vacancies/lib/queries";
```

The component already imports `useQuery` from TanStack Query.

- [ ] **Step 2: Define SchoolsTab props interface**

Replace the existing `SchoolsTab` function (lines 952-963) with the new implementation. Start with the interface and data fetching:

```typescript
function SchoolsTab({
  leaid,
  setActiveTab,
  setVacancySchoolFilter,
}: {
  leaid: string;
  setActiveTab: (tab: Tab) => void;
  setVacancySchoolFilter: (ncessch: string | null) => void;
}) {
  // Fetch schools for this district
  const { data, isLoading, error } = useQuery<{
    schools: Array<{
      ncessch: string;
      schoolName: string;
      charter: number;
      schoolLevel: number | null;
      enrollment: number | null;
      lograde: string | null;
      higrade: string | null;
      streetAddress: string | null;
      city: string | null;
      stateAbbrev: string | null;
      contact: { name: string; title: string | null; email: string | null } | null;
    }>;
    summary: { totalSchools: number };
  }>({
    queryKey: ["schoolsByDistrict", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/schools/by-district/${encodeURIComponent(leaid)}`);
      if (!res.ok) throw new Error("Failed to fetch schools");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch vacancies to check if already scanned
  const { data: vacancyData } = useQuery<{
    summary: { totalOpen: number; lastScannedAt: string | null };
    vacancies: Array<{ school?: { ncessch: string } | null }>;
  }>({
    queryKey: ["vacancies", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${encodeURIComponent(leaid)}/vacancies`);
      if (!res.ok) throw new Error("Failed to fetch vacancies");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const scanDistrict = useScanDistrict();

  // Count vacancies per school
  const vacancyCountBySchool = (vacancyData?.vacancies ?? []).reduce<Record<string, number>>(
    (acc, v) => {
      const ncessch = v.school?.ncessch;
      if (ncessch) acc[ncessch] = (acc[ncessch] || 0) + 1;
      return acc;
    },
    {}
  );

  const hasBeenScanned = !!vacancyData?.summary.lastScannedAt;

  // Group schools by level
  type SchoolItem = NonNullable<typeof data>["schools"][number];
  const levelLabels: Record<number, string> = { 1: "Primary", 2: "Middle", 3: "High" };
  const groups: Record<string, SchoolItem[]> = {};

  if (data?.schools) {
    for (const school of data.schools) {
      const label = (school.schoolLevel && levelLabels[school.schoolLevel]) || "Other";
      if (!groups[label]) groups[label] = [];
      groups[label].push(school);
    }
  }

  const levelOrder = ["Primary", "Middle", "High", "Other"];
  const sortedGroupKeys = Object.keys(groups).sort(
    (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b)
  );

  // Grade formatting
  const formatGrades = (lo: string | null, hi: string | null) => {
    if (!lo || !hi) return null;
    const map: Record<string, string> = {
      PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4",
      "05": "5", "06": "6", "07": "7", "08": "8", "09": "9",
      "10": "10", "11": "11", "12": "12",
    };
    return `${map[lo] || lo} – ${map[hi] || hi}`;
  };

  const handleScanVacancies = () => {
    scanDistrict.mutate(leaid);
  };

  const handleViewSchoolVacancies = (ncessch: string) => {
    setVacancySchoolFilter(ncessch);
    setActiveTab("vacancies");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse p-3 rounded-lg border border-[#E2DEEC]">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-[#EFEDF5] rounded" />
                <div className="h-3 w-1/2 bg-[#EFEDF5] rounded" />
              </div>
              <div className="h-8 w-28 bg-[#EFEDF5] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#F37167]">Failed to load schools.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-[#6EA3BE] hover:underline mt-1"
        >
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (!data || data.schools.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#A69DC0]">No schools found for this district.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sortedGroupKeys.map((groupLabel) => (
        <div key={groupLabel}>
          <SectionLabel>
            {groupLabel} ({groups[groupLabel].length})
          </SectionLabel>
          <div className="flex flex-col gap-2">
            {groups[groupLabel].map((school) => {
              const grades = formatGrades(school.lograde, school.higrade);
              const address = [school.streetAddress, school.city, school.stateAbbrev]
                .filter(Boolean)
                .join(", ");
              const vacCount = vacancyCountBySchool[school.ncessch];

              return (
                <div
                  key={school.ncessch}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#E2DEEC] hover:bg-[#F7F5FA] transition-colors"
                >
                  {/* Left: name + grades */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#544A78] truncate">
                        {school.schoolName}
                      </span>
                      {school.charter === 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#FFCF70]/30 text-[#8A7230] shrink-0">
                          Charter
                        </span>
                      )}
                    </div>
                    {grades && (
                      <div className="text-[11px] text-[#A69DC0] mt-0.5">
                        Grades {grades}
                      </div>
                    )}
                    {address && (
                      <div className="text-[11px] text-[#8A80A8] truncate mt-0.5">
                        {address}
                      </div>
                    )}
                    {school.contact && (
                      <div className="text-[11px] text-[#6EA3BE] truncate mt-0.5">
                        {school.contact.name}
                        {school.contact.title && (
                          <span className="text-[#A69DC0]"> · {school.contact.title}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: vacancy action */}
                  <div className="shrink-0">
                    {hasBeenScanned ? (
                      vacCount ? (
                        <button
                          onClick={() => handleViewSchoolVacancies(school.ncessch)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-[#403770] bg-[#403770]/10 hover:bg-[#403770]/15 rounded-lg transition-colors"
                        >
                          {vacCount} {vacCount === 1 ? "vacancy" : "vacancies"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#A69DC0]">No vacancies</span>
                      )
                    ) : (
                      <button
                        onClick={handleScanVacancies}
                        disabled={scanDistrict.isPending}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-[#403770] border border-[#D4CFE2] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-50"
                      >
                        {scanDistrict.isPending ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Scanning…
                          </span>
                        ) : (
                          "Scan Vacancies"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchResults/DistrictExploreModal.tsx
git commit -m "feat: implement SchoolsTab with grouped cards and vacancy scanning"
```

---

### Task 4: Wire SchoolsTab and VacancyList into the modal

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictExploreModal.tsx` (modal state + tab wiring)

- [ ] **Step 1: Add `vacancySchoolFilter` state to the modal**

In the `DistrictExploreModal` function body, after the existing state declarations (~line 42):

```typescript
const [vacancySchoolFilter, setVacancySchoolFilter] = useState<string | null>(null);
```

- [ ] **Step 2: Clear filter on manual tab switch**

Update the tab button `onClick` to clear the filter when switching tabs manually. Replace the tab `onClick` (~line 310):

```typescript
onClick={() => {
  setActiveTab(key);
  if (key !== "vacancies") setVacancySchoolFilter(null);
}}
```

- [ ] **Step 3: Clear filter on district navigation**

In the existing `useEffect` that resets tab on navigation (~line 48), also clear the filter:

```typescript
useEffect(() => {
  setActiveTab("fullmind");
  setShowPlanDropdown(false);
  setVacancySchoolFilter(null);
}, [leaid]);
```

- [ ] **Step 4: Update SchoolsTab call site with new props**

Replace the `<SchoolsTab district={district} />` call (~line 364) with:

```typescript
<SchoolsTab
  leaid={leaid}
  setActiveTab={setActiveTab}
  setVacancySchoolFilter={setVacancySchoolFilter}
/>
```

- [ ] **Step 5: Pass school filter to VacancyList**

Replace the `<VacancyList leaid={leaid} />` call (~line 366) with:

```typescript
<VacancyList leaid={leaid} schoolNcessch={vacancySchoolFilter} />
```

- [ ] **Step 6: Update Schools tab label to show count**

In the tab config array (~line 305), update the schools entry:

```typescript
{ key: "schools", label: `Schools${district?.numberOfSchools != null ? ` (${district.numberOfSchools})` : ""}` },
```

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/SearchResults/DistrictExploreModal.tsx
git commit -m "feat: wire SchoolsTab and vacancy filter into DistrictExploreModal"
```

---

### Task 5: Manual testing and polish

- [ ] **Step 1: Test the full flow**

Run `npm run dev` on port 3005. Navigate to the map, search for a district (e.g. "West Seneca"), open the DistrictExploreModal, and click the Schools tab.

Verify:
1. Schools load and display grouped by level (Primary/Middle/High/Other)
2. Each card shows school name, charter badge (if applicable), grade span, address, and contact
3. "Scan Vacancies" button appears when district hasn't been scanned
4. Clicking "Scan Vacancies" shows spinner, then updates all cards with vacancy counts
5. Clicking a vacancy count switches to Vacancies tab filtered to that school
6. Switching tabs manually clears the school filter
7. Navigating between districts resets the tab to Fullmind

- [ ] **Step 2: Test edge cases**

- District with no schools → "No schools found" message
- School with no contact → contact line omitted
- School with no address → address line omitted
- After scan, school with 0 vacancies → "No vacancies" text

- [ ] **Step 3: Run type checking and linting**

```bash
npx tsc --noEmit
npm run lint
```

Fix any errors found.

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -u
git commit -m "fix: address type/lint issues in schools tab"
```
