# District Profiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "District Profiles" tab to the Data Reconciliation view with summary cards, filterable/sortable table, and expandable row details.

**Architecture:** New Next.js API route proxies to existing FastAPI endpoint (`GET /api/reconciliation/district-profiles`). New React Query hook fetches data. DataView.tsx gets a third tab that renders summary cards + a ProfilesTable component with expandable rows. All code lives in existing files (api.ts, DataView.tsx) plus one new API route file.

**Tech Stack:** Next.js (App Router), React 19, TailwindCSS 4, TanStack React Query 5, Zustand

---

### Task 1: Create the Next.js API proxy route

The FastAPI endpoint is already running at `FASTAPI_URL` (defined in `.env.local` as `http://localhost:8000`). We need a Next.js API route to proxy requests to it so the frontend can call `/api/data/district-profiles` without CORS issues.

**Files:**
- Create: `src/app/api/data/district-profiles/route.ts`

**Step 1: Create the proxy route**

```typescript
// src/app/api/data/district-profiles/route.ts
//
// Proxies requests to the FastAPI district-profiles endpoint.
// The FastAPI server URL comes from FASTAPI_URL env var.
// Query params are forwarded as-is to the upstream endpoint.

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const fastApiUrl = process.env.FASTAPI_URL;
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: "FASTAPI_URL environment variable not configured" },
      { status: 503 }
    );
  }

  // Forward all query params to FastAPI
  const { searchParams } = new URL(request.url);
  const upstreamUrl = `${fastApiUrl}/api/reconciliation/district-profiles?${searchParams}`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("FastAPI error:", response.status, text);
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch district profiles:", error);
    return NextResponse.json(
      { error: "Failed to connect to data service" },
      { status: 503 }
    );
  }
}
```

**Step 2: Add the route to the middleware public paths**

The middleware at `src/middleware.ts` has a regex that exempts certain API routes from auth. The existing `api/data/reconciliation` is already public. We need to add `api/data/district-profiles` too.

In `src/middleware.ts`, find the matcher regex and add `api/data/district-profiles` alongside `api/data/reconciliation`.

**Step 3: Verify**

Run: `npm run build` (or `npx tsc --noEmit`) to check for TypeScript errors.

**Step 4: Commit**

```bash
git add src/app/api/data/district-profiles/route.ts src/middleware.ts
git commit -m "feat: Add Next.js proxy route for district-profiles FastAPI endpoint

- Created /api/data/district-profiles proxy route
- Forwards query params to FastAPI upstream
- Added to middleware public paths"
```

---

### Task 2: Add TypeScript types and React Query hook in api.ts

**Files:**
- Modify: `src/lib/api.ts` (add types after line ~1369, add hook after line ~1403)

**Step 1: Add the TypeScript interfaces**

Add these types after the existing `ReconciliationFilters` interface (around line 1369):

```typescript
// ===== District Profiles (FastAPI) =====

export interface DistrictProfileOpportunities {
  count: number;
  revenue: number;
  account_names_used: string[];
}

export interface DistrictProfileSchools {
  count: number;
  sample_names: string[];
}

export interface DistrictProfileSessions {
  count: number;
  revenue: number;
  schools_in_sessions: string[];
}

export interface DistrictProfileCourses {
  count: number;
}

export interface DistrictProfileTotals {
  entity_count: number;
  total_revenue: number;
}

export interface DistrictProfileDataQuality {
  has_nces: boolean;
  has_state: boolean;
  is_orphaned: boolean;
  has_opps: boolean;
  has_schools: boolean;
  has_sessions: boolean;
}

export interface DistrictProfile {
  district_id: string;
  district_name: string;
  state: string | null;
  state_sources: [string, string][];
  nces_id: string | null;
  exists_in_index: boolean;
  referenced_by: string[];
  opportunities: DistrictProfileOpportunities;
  schools: DistrictProfileSchools;
  sessions: DistrictProfileSessions;
  courses: DistrictProfileCourses;
  totals: DistrictProfileTotals;
  data_quality: DistrictProfileDataQuality;
}

export interface DistrictProfileFilters {
  include_orphaned?: boolean;
  min_total_entities?: number;
  state?: string;
  limit?: number;
}
```

**Step 2: Add the React Query hook**

Add after the existing reconciliation hooks (around line 1403):

```typescript
export function useDistrictProfiles(filters: DistrictProfileFilters = {}) {
  const params = new URLSearchParams();
  if (filters.include_orphaned !== undefined)
    params.set("include_orphaned", String(filters.include_orphaned));
  if (filters.min_total_entities)
    params.set("min_total_entities", filters.min_total_entities.toString());
  if (filters.state) params.set("state", filters.state);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "district-profiles", filters],
    queryFn: () =>
      fetchJson<DistrictProfile[]>(
        `${API_BASE}/data/district-profiles?${params}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit` to check for TypeScript errors.

**Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: Add DistrictProfile types and useDistrictProfiles hook

- Added TypeScript interfaces matching FastAPI response
- Added React Query hook with filter support
- 5-minute stale time, consistent with existing hooks"
```

---

### Task 3: Add the District Profiles tab to DataView

This is the main UI task. We'll modify DataView.tsx to:
1. Add `"profiles"` as a third tab option
2. Call the new `useDistrictProfiles` hook
3. Render the summary cards and table when this tab is active

**Files:**
- Modify: `src/components/views/DataView.tsx`

**Step 1: Update imports and tab type**

At the top of the file, update the imports and type:

```typescript
"use client";

import { useState, useMemo, Fragment } from "react";
import {
  useReconciliationUnmatched,
  useReconciliationFragmented,
  useDistrictProfiles,
  ReconciliationFilters,
  ReconciliationUnmatchedAccount,
  ReconciliationFragmentedDistrict,
  DistrictProfile,
  DistrictProfileFilters,
} from "@/lib/api";

type TabType = "unmatched" | "fragmented" | "profiles";
```

**Step 2: Add state and hook for profiles**

Inside the `DataView` component, after the existing hooks (around line 29), add:

```typescript
// District profiles state — separate filters since this endpoint has different params
const [profileFilters, setProfileFilters] = useState<DistrictProfileFilters>({});
const [profileStatusFilter, setProfileStatusFilter] = useState<"all" | "orphaned" | "valid">("all");

const {
  data: profilesData,
  isLoading: profilesLoading,
  error: profilesError,
} = useDistrictProfiles(profileFilters);
```

Update the `isLoading` and `error` derivations:

```typescript
const isLoading =
  activeTab === "unmatched" ? unmatchedLoading :
  activeTab === "fragmented" ? fragmentedLoading :
  profilesLoading;

const error =
  activeTab === "unmatched" ? unmatchedError :
  activeTab === "fragmented" ? fragmentedError :
  profilesError;
```

**Step 3: Add the third tab button**

After the "Account Fragmentation" button (around line 111), add:

```tsx
<button
  onClick={() => setActiveTab("profiles")}
  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
    activeTab === "profiles"
      ? "bg-[#403770] text-white"
      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
  }`}
>
  District Profiles
  {profilesData && (
    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
      {profilesData.length}
    </span>
  )}
</button>
```

**Step 4: Update the filter bar for profiles tab**

When the profiles tab is active, the filter bar should show a status toggle (All/Orphaned/Valid) instead of the sales exec dropdown. Replace the hardcoded state dropdown with one populated from the data.

In the filter bar section (around line 115-148), wrap the state dropdown and add the status filter conditionally:

```tsx
{/* State dropdown — use unique states from profiles data when on profiles tab */}
<select
  value={activeTab === "profiles" ? (profileFilters.state || "") : (filters.state || "")}
  onChange={(e) => {
    if (activeTab === "profiles") {
      setProfileFilters((f) => ({ ...f, state: e.target.value || undefined }));
    } else {
      setFilters((f) => ({ ...f, state: e.target.value || undefined }));
    }
  }}
  className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
>
  <option value="">All States</option>
  {activeTab === "profiles" && profilesData
    ? [...new Set(profilesData.map((d) => d.state).filter(Boolean))].sort().map((st) => (
        <option key={st} value={st!}>{st}</option>
      ))
    : <>
        <option value="CA">California</option>
        <option value="TX">Texas</option>
        <option value="NY">New York</option>
        <option value="FL">Florida</option>
        <option value="IL">Illinois</option>
      </>
  }
</select>

{/* Status filter — only shown on profiles tab */}
{activeTab === "profiles" && (
  <select
    value={profileStatusFilter}
    onChange={(e) => setProfileStatusFilter(e.target.value as "all" | "orphaned" | "valid")}
    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
  >
    <option value="all">All Status</option>
    <option value="orphaned">Orphaned Only</option>
    <option value="valid">Valid Only</option>
  </select>
)}
```

**Step 5: Update the CSV export handler**

Add a profiles case to `handleExport`:

```typescript
} else if (activeTab === "profiles") {
  const profileData = data as DistrictProfile[];
  csv = "District Name,District ID,State,NCES ID,Orphaned,Schools,Sessions,Opportunities,Courses,Entity Count\n";
  csv += profileData
    .map(
      (row) =>
        `"${row.district_name || ""}","${row.district_id}","${row.state || ""}","${row.nces_id || ""}",${row.data_quality.is_orphaned},${row.schools.count},${row.sessions.count},${row.opportunities.count},${row.courses.count},${row.totals.entity_count}`
    )
    .join("\n");
}
```

Also update the `handleExport` data source to include profiles:

```typescript
const data =
  activeTab === "unmatched" ? unmatchedData :
  activeTab === "fragmented" ? fragmentedData :
  profilesData;
```

**Step 6: Add the profiles table rendering**

After the fragmented table conditional (around line 171), add:

```tsx
{/* District Profiles */}
{!isLoading && !error && activeTab === "profiles" && profilesData && (
  <DistrictProfilesView
    data={profilesData}
    searchTerm={searchTerm}
    statusFilter={profileStatusFilter}
  />
)}
```

**Step 7: Commit**

```bash
git add src/components/views/DataView.tsx
git commit -m "feat: Add District Profiles tab to DataView

- Third tab alongside Unmatched Accounts and Account Fragmentation
- Separate filter state for profile-specific params
- Status filter (All/Orphaned/Valid) for profiles tab
- Dynamic state dropdown populated from API data
- CSV export support for district profiles"
```

---

### Task 4: Build the DistrictProfilesView component

This is the main visual component — summary cards at top, then the sortable table with expandable rows. Add it as a function inside DataView.tsx (following the existing pattern of UnmatchedTable and FragmentedTable being defined in the same file).

**Files:**
- Modify: `src/components/views/DataView.tsx` (add after the FragmentedTable component, around line 382)

**Step 1: Build the component**

```tsx
// DistrictProfilesView — summary cards + sortable table with expandable detail rows
function DistrictProfilesView({
  data,
  searchTerm,
  statusFilter,
}: {
  data: DistrictProfile[];
  searchTerm: string;
  statusFilter: "all" | "orphaned" | "valid";
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"entities" | "schools" | "sessions" | "opps">("entities");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filter by search term and status
  const filtered = useMemo(() => {
    let result = data;

    // Status filter
    if (statusFilter === "orphaned") {
      result = result.filter((d) => d.data_quality.is_orphaned);
    } else if (statusFilter === "valid") {
      result = result.filter((d) => !d.data_quality.is_orphaned);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.district_name?.toLowerCase().includes(term) ||
          d.district_id.includes(term) ||
          d.nces_id?.includes(term) ||
          d.state?.toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "schools": aVal = a.schools.count; bVal = b.schools.count; break;
        case "sessions": aVal = a.sessions.count; bVal = b.sessions.count; break;
        case "opps": aVal = a.opportunities.count; bVal = b.opportunities.count; break;
        default: aVal = a.totals.entity_count; bVal = b.totals.entity_count;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [data, searchTerm, statusFilter, sortField, sortDir]);

  // Summary stats computed from the full (unfiltered) dataset
  const stats = useMemo(() => {
    const orphanedCount = data.filter((d) => d.data_quality.is_orphaned).length;
    const missingNcesCount = data.filter((d) => !d.data_quality.has_nces).length;
    const uniqueStates = new Set(data.map((d) => d.state).filter(Boolean)).size;
    return { orphanedCount, missingNcesCount, total: data.length, uniqueStates };
  }, [data]);

  // Toggle sort: if clicking the same field, flip direction; otherwise set new field desc
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Small helper for the sort indicator arrow
  const sortIcon = (field: typeof sortField) =>
    sortField === field ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Orphaned Districts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Orphaned Districts</p>
          <p className="text-3xl font-bold text-[#F37167] mt-1">
            {stats.orphanedCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            IDs referenced but not in district index
          </p>
        </div>

        {/* Missing NCES */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Missing NCES ID</p>
          <p className="text-3xl font-bold text-amber-500 mt-1">
            {stats.missingNcesCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Districts without federal reporting ID
          </p>
        </div>

        {/* Total Districts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Districts</p>
          <p className="text-3xl font-bold text-[#6EA3BE] mt-1">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Across {stats.uniqueStates} states
          </p>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        Showing {filtered.length} of {data.length} district profiles
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No district profiles match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  District
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  District ID
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  NCES ID
                </th>
                <th
                  onClick={() => handleSort("schools")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Schools{sortIcon("schools")}
                </th>
                <th
                  onClick={() => handleSort("sessions")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Sessions{sortIcon("sessions")}
                </th>
                <th
                  onClick={() => handleSort("opps")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Opps{sortIcon("opps")}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Data Sources
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.district_id}>
                  <tr
                    onClick={() =>
                      setExpandedRow(expandedRow === row.district_id ? null : row.district_id)
                    }
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    {/* District Name + State */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-[#403770] font-medium">
                        {row.district_name || "Unknown District"}
                      </div>
                      <div className="text-xs text-gray-400">{row.state || "—"}</div>
                    </td>

                    {/* District ID + orphaned badge */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-mono">
                          {row.district_id}
                        </span>
                        {row.data_quality.is_orphaned && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            Orphaned
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NCES ID or Missing badge */}
                    <td className="px-4 py-3 text-sm">
                      {row.nces_id ? (
                        <span className="text-gray-600 font-mono">{row.nces_id}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          Missing
                        </span>
                      )}
                    </td>

                    {/* Counts */}
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.schools.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.sessions.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.opportunities.count.toLocaleString()}
                    </td>

                    {/* Data sources */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {row.referenced_by.map((source) => (
                          <span
                            key={source}
                            className="px-2 py-0.5 rounded text-xs bg-[#C4E7E6] text-[#403770]"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedRow === row.district_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Left: Entity breakdown */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Entity Breakdown
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Opportunities</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.opportunities.count.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Schools</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.schools.count.toLocaleString()}
                                </p>
                                {row.schools.sample_names.length > 0 && (
                                  <p className="text-xs text-gray-400 mt-1 truncate">
                                    {row.schools.sample_names.slice(0, 3).join(", ")}
                                  </p>
                                )}
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Sessions</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.sessions.count.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Courses</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.courses.count.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Right: Data quality checklist */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Data Quality
                            </h4>
                            <div className="space-y-2">
                              {[
                                { label: "Has NCES ID", ok: row.data_quality.has_nces },
                                { label: "Has State", ok: row.data_quality.has_state },
                                { label: "Has Opportunities", ok: row.data_quality.has_opps },
                                { label: "Has Schools", ok: row.data_quality.has_schools },
                                { label: "Has Sessions", ok: row.data_quality.has_sessions },
                                { label: "In District Index", ok: !row.data_quality.is_orphaned },
                              ].map(({ label, ok }) => (
                                <div key={label} className="flex items-center gap-2 text-sm">
                                  <span className={ok ? "text-green-600" : "text-red-500"}>
                                    {ok ? "✓" : "✗"}
                                  </span>
                                  <span className={ok ? "text-gray-700" : "text-gray-500"}>
                                    {label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* State sources */}
                            {row.state_sources && row.state_sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500">
                                  State from:{" "}
                                  {row.state_sources.map(([source]) => source).join(", ")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` to check for TypeScript errors.
Run: `npm run dev` and navigate to `/?tab=data`, click "District Profiles" tab.

**Step 3: Commit**

```bash
git add src/components/views/DataView.tsx
git commit -m "feat: Build DistrictProfilesView component

- Summary cards: Orphaned, Missing NCES, Total Districts
- Sortable table with 7 columns
- Expandable rows with entity breakdown and data quality checklist
- Client-side search, status filter, and column sorting
- State sources shown in expanded detail"
```

---

### Task 5: Verify end-to-end and fix any issues

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Run dev server and test manually**

Run: `npm run dev`

Test checklist:
- [ ] Navigate to Data tab — three tabs visible
- [ ] Click "District Profiles" — loading spinner, then data loads
- [ ] Summary cards show correct counts
- [ ] Table displays district rows with badges
- [ ] Click a row — expands to show entity breakdown and data quality
- [ ] Click again — collapses
- [ ] Sort by Schools, Sessions, Opps columns
- [ ] Search by district name
- [ ] Filter by state dropdown
- [ ] Filter by Orphaned Only / Valid Only
- [ ] Export CSV downloads file with correct data
- [ ] When FastAPI is not running — error message displays

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: Address any issues found in end-to-end testing"
```
