# Unmatched School Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add school search to the resolve modal's manual search so users can find districts via school names.

**Architecture:** Parallel `useQuery` for schools alongside existing district search. School results render in a separate section below districts. Selecting a school resolves to its parent district via `leaid`.

**Tech Stack:** React, TanStack Query, Next.js API routes, Prisma

**Spec:** `docs/superpowers/specs/2026-03-13-unmatched-school-search-design.md`

---

## File Map

- **Modify:** `src/app/admin/unmatched-opportunities/page.tsx`
  - Add `SchoolResult` type (~line 35)
  - Add `searchSchools` helper (~line 90)
  - Add `SchoolRow` component (~line 315)
  - Add `onError` to `resolveMutation` (~line 718)
  - Modify `DistrictSearchModal` to add school query + render school results (~line 456-583)
  - Update search placeholder (~line 562)

No new files. No backend changes.

---

## Chunk 1: Implementation

### Task 1: Add type and API helper

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:35,85-90`

- [ ] **Step 1: Add `SchoolResult` interface after `DistrictResult`**

After the `DistrictResult` interface (line 35), add:

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

- [ ] **Step 2: Add `searchSchools` helper after `searchDistricts`**

After the `searchDistricts` function (line 90), add:

```typescript
async function searchSchools(q: string): Promise<{ schools: SchoolResult[] }> {
  if (q.length < 2) return { schools: [] };
  const res = await fetch(`/api/schools?search=${encodeURIComponent(q)}&limit=10`);
  if (!res.ok) throw new Error("Failed to search schools");
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): add SchoolResult type and searchSchools helper"
```

---

### Task 2: Add SchoolRow component

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:315`

- [ ] **Step 1: Add `SchoolRow` component after `DistrictRow`**

After the `DistrictRow` component (ends at line 315), add:

```tsx
function SchoolRow({
  school,
  onSelect,
}: {
  school: SchoolResult;
  onSelect: (district: DistrictResult) => void;
}) {
  return (
    <button
      onClick={() =>
        onSelect({
          leaid: school.leaid,
          name: `${school.schoolName} (via school)`,
          stateAbbrev: school.stateAbbrev,
          enrollment: school.enrollment,
          cityLocation: school.city,
        })
      }
      className="w-full text-left px-4 py-3 border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#EFEDF5] transition-colors duration-100"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#403770]">
          {school.schoolName}
        </span>
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

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): add SchoolRow component for school search results"
```

---

### Task 3: Add school search query to DistrictSearchModal

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:456-460`

- [ ] **Step 1: Add school search `useQuery` after the district search query**

After the existing `searchResults` query (line 456-460), add:

```typescript
const { data: schoolResults, isLoading: schoolsLoading } = useQuery({
  queryKey: ["school-search", debouncedQuery],
  queryFn: () => searchSchools(debouncedQuery),
  enabled: debouncedQuery.length >= 2,
});
```

- [ ] **Step 2: Update `isSearching`-related derived state**

After `isSearching` (line 463), add:

```typescript
const hasSchoolResults = (schoolResults?.schools.length ?? 0) > 0;
```

- [ ] **Step 3: Update search placeholder**

Change the placeholder text (line 562) from:
```
"Search districts by name, LEAID, or state..."
```
to:
```
"Search districts or schools by name..."
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): add school search query to DistrictSearchModal"
```

---

### Task 4: Render school results and update empty/loading states

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:566-583`

- [ ] **Step 1: Replace the search results section**

Replace the current search results block (lines 566-583) with sectioned results showing districts and schools independently:

```tsx
{/* Search results */}
{isSearching && (
  <div className="max-h-64 overflow-y-auto border border-[#E2DEEC] rounded-lg">
    {/* District results */}
    {searchLoading && !schoolsLoading && (
      <div className="px-4 py-4 text-center">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#403770] border-t-transparent mx-auto" />
      </div>
    )}
    {!searchLoading && (searchResults?.items.length ?? 0) > 0 && (
      <>
        <div className="px-4 py-1.5 bg-[#F5F3FA] border-b border-[#E2DEEC] flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#403770] uppercase tracking-wide">Districts</span>
          <span className="text-[10px] text-[#8A80A8] bg-white px-1.5 py-0.5 rounded">
            {searchResults!.items.length}
          </span>
        </div>
        {searchResults!.items.map((district) => (
          <DistrictRow key={district.leaid} district={district} onSelect={onSelect} />
        ))}
      </>
    )}

    {/* School results */}
    {schoolsLoading && !searchLoading && (
      <div className="px-4 py-4 text-center">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#403770] border-t-transparent mx-auto" />
      </div>
    )}
    {!schoolsLoading && hasSchoolResults && (
      <>
        <div className="px-4 py-1.5 bg-[#F5F3FA] border-b border-[#E2DEEC] flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#403770] uppercase tracking-wide">Schools</span>
          <span className="text-[10px] text-[#8A80A8] bg-white px-1.5 py-0.5 rounded">
            {schoolResults!.schools.length}
          </span>
        </div>
        {schoolResults!.schools.map((school) => (
          <SchoolRow key={school.ncessch} school={school} onSelect={onSelect} />
        ))}
      </>
    )}

    {/* Combined loading spinner when both are loading */}
    {searchLoading && schoolsLoading && (
      <div className="px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#403770] border-t-transparent mx-auto" />
      </div>
    )}

    {/* Empty state when both queries done and no results */}
    {!searchLoading && !schoolsLoading && (searchResults?.items.length ?? 0) === 0 && !hasSchoolResults && (
      <div className="px-4 py-6 text-center text-sm text-[#8A80A8]">
        No districts or schools found
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): render school results in resolve modal search"
```

---

### Task 5: Add error handling for missing districts

**Files:**
- Modify: `src/app/admin/unmatched-opportunities/page.tsx:718-729`

- [ ] **Step 1: Add `onError` handler to `resolveMutation`**

Add an `onError` callback to the mutation (after the `onSuccess` block, line 728):

```typescript
onError: (error) => {
  const msg = error.message?.includes("404")
    ? "District not found in system — use Create New District to add it first"
    : "Failed to resolve opportunity";
  setToast(msg);
  setResolvingOpp(null);
},
```

Note: The `resolveOpportunity` helper throws `new Error("Failed to resolve")` on any non-ok response. We should improve this to include status info. Update the `resolveOpportunity` function:

```typescript
async function resolveOpportunity(
  id: string,
  resolvedDistrictLeaid: string,
): Promise<{ resolvedCount: number }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolvedDistrictLeaid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to resolve (${res.status})`);
  }
  return res.json();
}
```

Then the `onError` handler becomes:

```typescript
onError: (error) => {
  const msg = error.message?.includes("not found")
    ? "District not found in system — use Create New District to add it first"
    : "Failed to resolve opportunity";
  setToast(msg);
  setResolvingOpp(null);
},
```

- [ ] **Step 2: Verify the app builds**

Run: `npx next build` or `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/unmatched-opportunities/page.tsx
git commit -m "feat(admin): add error handling for school→district resolution failures"
```

---

### Task 6: Manual testing

- [ ] **Step 1: Start dev server and test**

Run: `npm run dev`

Test cases:
1. Open unmatched opportunities, click Resolve on any row
2. In the manual search box, type a school name — verify school results appear in a "Schools" section
3. Type a district name — verify district results still appear in a "Districts" section
4. Type something that matches neither — verify "No districts or schools found" message
5. Select a school result — verify it resolves to the parent district LEAID
6. Verify suggestions section still works unchanged
