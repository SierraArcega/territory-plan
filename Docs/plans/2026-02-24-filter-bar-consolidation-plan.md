# Filter Bar Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewire the top FilterBar to `useMapV2Store` so its dropdowns actually control the map, consolidate district search into the top bar, and remove dead code.

**Architecture:** The FilterBar component is rewritten to read/write `useMapV2Store` instead of the old `useMapStore`. The old SearchBar/SearchPanel in the left panel are removed. LayerBubble is unchanged — it shares the same store so everything stays in sync. The old store's filter-related state is cleaned up but navigation state (`activeTab`, `sidebarCollapsed`) is preserved.

**Tech Stack:** React, Zustand (`useMapV2Store`), Next.js, Tailwind CSS, SWR (for API hooks)

---

### Task 1: Rewrite FilterBar to use useMapV2Store

**Files:**
- Modify: `src/features/shared/components/filters/FilterBar.tsx` (full rewrite)
- Reference: `src/features/map/lib/store.ts` (useMapV2Store actions)
- Reference: `src/features/map/components/LayerBubble.tsx:407-428` (API fetch pattern for owners/plans/states)
- Reference: `src/features/map/components/SearchBar.tsx` (search autocomplete pattern)

**Step 1: Rewrite FilterBar.tsx**

Replace the entire component. The new version:
- Imports `useMapV2Store` instead of `useMapStore`
- Fetches states, owners, and territory plans via the same API calls LayerBubble uses
- District search uses debounced fetch to `/api/districts?search=...&limit=8` with autocomplete dropdown
- States dropdown is a multi-select checkbox dropdown (matching LayerBubble's pattern)
- Status dropdown maps simplified labels to `filterAccountTypes`
- Owner dropdown is a single-select writing to `filterOwner`
- Territory Plan dropdown is a single-select writing to `filterPlanId`
- No MultiSelectToggle
- Active filter chips shown below the bar when filters are active

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import type { AccountTypeValue } from "@/features/shared/types/account-types";

// Status mapping: simplified labels → V2 store filterAccountTypes
const STATUS_OPTIONS: Array<{ value: string; label: string; accountTypes: AccountTypeValue[] }> = [
  { value: "all", label: "All Districts", accountTypes: [] },
  { value: "customer", label: "Customers", accountTypes: ["customer"] },
  { value: "pipeline", label: "Pipeline", accountTypes: ["prospect"] },
  { value: "customer_pipeline", label: "Customer + Pipeline", accountTypes: ["customer", "prospect"] },
  { value: "no_data", label: "No Fullmind Data", accountTypes: ["investigation", "administrative"] },
];

interface SearchResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  enrollment: number | null;
}

interface FilterBarProps {
  activeTab: string;
}

export default function FilterBar({ activeTab }: FilterBarProps) {
  const filterStates = useMapV2Store((s) => s.filterStates);
  const toggleFilterState = useMapV2Store((s) => s.toggleFilterState);
  const setFilterStates = useMapV2Store((s) => s.setFilterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const setFilterOwner = useMapV2Store((s) => s.setFilterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const setFilterPlanId = useMapV2Store((s) => s.setFilterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const setFilterAccountTypes = useMapV2Store((s) => s.setFilterAccountTypes);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);

  const isMapTab = activeTab === "map";

  // Derive current status value from filterAccountTypes
  const currentStatus = STATUS_OPTIONS.find(
    (opt) =>
      opt.accountTypes.length === filterAccountTypes.length &&
      opt.accountTypes.every((t) => filterAccountTypes.includes(t))
  )?.value ?? "all";

  // Fetch filter options (same pattern as LayerBubble)
  const [owners, setOwners] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [states, setStates] = useState<Array<{ abbrev: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/sales-executives")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOwners(data.map?.((d: any) => d.name || d) || []))
      .catch(() => {});
    fetch("/api/territory-plans")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : data.plans || []))
      .catch(() => {});
    fetch("/api/states")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setStates(
          (data as Array<{ abbrev: string; name: string }>).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        )
      )
      .catch(() => {});
  }, []);

  // District search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/districts?search=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.districts || []);
        setShowResults(true);
      }
    } catch {
      // silently fail
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const handleSelectDistrict = (result: SearchResult) => {
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
    selectDistrict(result.leaid);
  };

  // Close search results on outside click
  useEffect(() => {
    if (!showResults) return;
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showResults]);

  // States dropdown state
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stateDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setStateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [stateDropdownOpen]);

  const hasActiveFilters =
    filterStates.length > 0 || filterOwner || filterPlanId || filterAccountTypes.length > 0;

  const handleClearFilters = () => {
    setFilterStates([]);
    setFilterOwner(null);
    setFilterPlanId(null);
    setFilterAccountTypes([]);
  };

  const selectStyle =
    "h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 bg-white text-gray-700";

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200/60 px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Fullmind Logo */}
        <span className="flex-shrink-0 text-plum font-bold text-base">
          Fullmind
        </span>

        {isMapTab && (
          <>
            <div className="h-6 border-l border-gray-200" />

            {/* District Search */}
            <div ref={searchContainerRef} className="relative flex-1 min-w-[180px] max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Search districts..."
                className="w-full h-9 pl-9 pr-8 text-sm bg-gray-50 border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-plum rounded-full tile-loading-spinner" />
                </div>
              )}
              {!searchLoading && searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); setShowResults(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                  aria-label="Clear search"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2L8 8M8 2L2 8" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              {/* Search results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 max-h-[280px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.leaid}
                      onClick={() => handleSelectDistrict(result)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-300 shrink-0">
                        <path d="M7 1C4.5 1 2.5 3.5 2.5 6C2.5 9 7 13 7 13S11.5 9 11.5 6C11.5 3.5 9.5 1 7 1Z" stroke="currentColor" strokeWidth="1.2" />
                        <circle cx="7" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-700 truncate">{result.name}</div>
                        <div className="text-xs text-gray-400">
                          {result.stateAbbrev}
                          {result.enrollment ? ` · ${result.enrollment.toLocaleString()} students` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searchLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-3 z-50 text-center">
                  <p className="text-xs text-gray-400">No districts found</p>
                </div>
              )}
            </div>

            {/* States Multi-Select Dropdown */}
            <div ref={stateDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
                className={`${selectStyle} flex items-center gap-1.5 min-w-[120px]`}
              >
                <span className={filterStates.length === 0 ? "text-gray-500" : "text-gray-700 truncate"}>
                  {filterStates.length === 0
                    ? "All States"
                    : filterStates.length <= 2
                      ? filterStates.sort().join(", ")
                      : `${filterStates.length} states`}
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-gray-400">
                  <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {stateDropdownOpen && (
                <div className="absolute z-50 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[200px]">
                  {filterStates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterStates([])}
                      className="w-full text-left text-xs text-plum hover:bg-gray-50 px-2.5 py-1.5 border-b border-gray-100"
                    >
                      Clear selection
                    </button>
                  )}
                  {states.map((s) => (
                    <label key={s.abbrev} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterStates.includes(s.abbrev)}
                        onChange={() => toggleFilterState(s.abbrev)}
                        className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                      />
                      <span className="text-sm text-gray-700">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Status Dropdown */}
            <select
              value={currentStatus}
              onChange={(e) => {
                const opt = STATUS_OPTIONS.find((o) => o.value === e.target.value);
                setFilterAccountTypes(opt?.accountTypes ?? []);
              }}
              className={selectStyle}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Owner Dropdown */}
            <select
              value={filterOwner || ""}
              onChange={(e) => setFilterOwner(e.target.value || null)}
              className={selectStyle}
            >
              <option value="">All Sales Execs</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>

            {/* Territory Plan Dropdown */}
            <select
              value={filterPlanId || ""}
              onChange={(e) => setFilterPlanId(e.target.value || null)}
              className={selectStyle}
            >
              <option value="">All Plans</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-9 px-2 text-sm text-plum/70 hover:text-plum font-medium flex items-center gap-1 transition-colors"
                title="Clear all filters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Active filter chips */}
      {isMapTab && hasActiveFilters && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-gray-400">Filters:</span>
          {filterStates.length > 0 && (
            <span className="px-2 py-0.5 bg-plum/10 text-plum rounded">
              {filterStates.length <= 3 ? filterStates.sort().join(", ") : `${filterStates.length} states`}
            </span>
          )}
          {currentStatus !== "all" && (
            <span className="px-2 py-0.5 bg-plum/10 text-plum rounded">
              {STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label}
            </span>
          )}
          {filterOwner && (
            <span className="px-2 py-0.5 bg-plum/10 text-plum rounded">
              {filterOwner}
            </span>
          )}
          {filterPlanId && (
            <span className="px-2 py-0.5 bg-plum/10 text-plum rounded">
              {plans.find((p) => p.id === filterPlanId)?.name || "Plan"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -40` (or `npx tsc --noEmit`)
Expected: No type errors in FilterBar.tsx

**Step 3: Commit**

```bash
git add src/features/shared/components/filters/FilterBar.tsx
git commit -m "feat: rewire FilterBar to useMapV2Store with territory plan dropdown"
```

---

### Task 2: Remove old SearchBar, SearchPanel, and search icon tab

**Files:**
- Delete: `src/features/map/components/SearchBar.tsx`
- Delete: `src/features/map/components/panels/SearchPanel.tsx`
- Modify: `src/features/map/components/PanelContent.tsx:4,37,39-40` (remove SearchPanel import and cases)
- Modify: `src/features/map/components/IconBar.tsx:9` (remove search tab)
- Modify: `src/features/map/lib/store.ts:25` (remove "search" from IconBarTab type)

**Step 1: Delete SearchBar.tsx and SearchPanel.tsx**

```bash
rm src/features/map/components/SearchBar.tsx
rm src/features/map/components/panels/SearchPanel.tsx
```

**Step 2: Update PanelContent.tsx**

Remove the SearchPanel import (line 4) and the two cases that render it (lines 37, 39-40). The default fallback should become `HomePanel`:

```tsx
"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import DistrictDetailPanel from "./panels/district/DistrictDetailPanel";
import PlanFormPanel from "./panels/PlanFormPanel";
import PlanWorkspace from "./panels/PlanWorkspace";
import PlanAddPanel from "./panels/PlanAddPanel";
import PlansListPanel from "./panels/PlansListPanel";
import HomePanel from "./panels/HomePanel";
import AccountForm from "./panels/AccountForm";

export default function PanelContent() {
  const panelState = useMapV2Store((s) => s.panelState);
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);
  const showAccountForm = useMapV2Store((s) => s.showAccountForm);

  if (showAccountForm) return <PanelContentWrapper><AccountForm /></PanelContentWrapper>;
  if (panelState === "PLAN_NEW") return <PanelContentWrapper><PlanFormPanel /></PanelContentWrapper>;
  if (["PLAN_OVERVIEW", "PLAN_ACTIVITIES", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(panelState))
    return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;
  if (panelState === "PLAN_VIEW") return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;
  if (panelState === "PLAN_ADD") return <PanelContentWrapper><PlanAddPanel /></PanelContentWrapper>;
  if (panelState === "DISTRICT") return <PanelContentWrapper><DistrictDetailPanel /></PanelContentWrapper>;

  if (activeIconTab === "home") return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
  if (activeIconTab === "plans") return <PanelContentWrapper><PlansListPanel /></PanelContentWrapper>;

  // Default: home panel
  return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
}

function PanelContentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      {children}
    </div>
  );
}
```

**Step 3: Update IconBar.tsx — remove search tab**

Change line 7-13 to remove the search entry:

```tsx
const tabs: Array<{ id: IconBarTab; icon: string; label: string }> = [
  { id: "home", icon: "home", label: "Home" },
  { id: "plans", icon: "plans", label: "Plans" },
  { id: "explore", icon: "explore", label: "Explore" },
  { id: "settings", icon: "settings", label: "Settings" },
];
```

Also remove the `case "search":` block from `TabIcon` (lines 48-65) since it's no longer used.

**Step 4: Update store.ts — remove "search" from IconBarTab**

In `src/features/map/lib/store.ts:25`, change:

```ts
export type IconBarTab = "home" | "plans" | "explore" | "settings";
```

Also update `setActiveIconTab` action (around line 567) — the `tab === "search"` check in the panelState logic should be removed:

```ts
// Before:
panelState: tab === "home" || tab === "search" ? "BROWSE" : s.panelState,
// After:
panelState: tab === "home" ? "BROWSE" : s.panelState,
```

**Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove SearchBar/SearchPanel, search tab from sidebar"
```

---

### Task 3: Delete MultiSelectToggle and old SearchBox

**Files:**
- Delete: `src/features/shared/components/filters/MultiSelectToggle.tsx`
- Delete: `src/features/shared/components/filters/SearchBox.tsx`

**Step 1: Delete the files**

```bash
rm src/features/shared/components/filters/MultiSelectToggle.tsx
rm src/features/shared/components/filters/SearchBox.tsx
```

**Step 2: Verify nothing else imports them**

Run: `grep -r "MultiSelectToggle\|filters/SearchBox" src/ --include="*.tsx" --include="*.ts"`
Expected: No results (FilterBar.tsx no longer imports them after Task 1 rewrite)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused MultiSelectToggle and old SearchBox components"
```

---

### Task 4: Clean up old store filter state

**Files:**
- Modify: `src/features/shared/lib/app-store.ts` (remove filter-related state/actions)
- Modify: `src/features/shared/lib/__tests__/app-store.test.ts` (remove filter tests)

**Step 1: Remove filter-related state from app-store.ts**

Remove from `MapState` interface (lines 19-24, 71):
- `filters: Filters` property
- The `Filters` interface entirely
- `StatusFilter` type export

Remove from `MapActions` interface (lines 104-109):
- `setStateFilter`, `setStatusFilter`, `setSalesExecutive`, `setSearchQuery`, `clearFilters`

Remove from the store implementation:
- `filters: initialFilters` initial value (line 171)
- `initialFilters` constant (lines 142-147)
- All five filter setter implementations (lines 202-211)
- `selectFilters` selector (line 329)

Keep everything else: `activeTab`, `sidebarCollapsed`, tooltip, ripple, panel, multi-select, vendor/charter layer state.

**Step 2: Update imports across the codebase**

Check for any remaining imports of `StatusFilter`, `selectFilters`, or filter actions from `app-store`. Files that may need updates:
- `src/features/shared/lib/__tests__/app-store.test.ts` — remove filter-related tests
- Any other files found by: `grep -r "StatusFilter\|selectFilters\|setStateFilter\|setStatusFilter\|setSalesExecutive\|clearFilters" src/ --include="*.ts" --include="*.tsx"`

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead filter state from old app-store"
```

---

### Task 5: Verify end-to-end filter wiring

**Files:**
- Reference: `src/features/map/components/MapV2Container.tsx` (where filters are applied)
- Reference: `src/features/map/lib/layers.ts` (`buildFilterExpression`)

**Step 1: Manual verification checklist**

Run: `npm run dev`

Verify in browser:
1. Top bar States dropdown → selecting states filters map polygons
2. Top bar Status dropdown → "Customers" shows only customer districts
3. Top bar Owner dropdown → selecting an owner filters to their districts
4. Top bar Territory Plan dropdown → selecting a plan filters to plan districts
5. Top bar district search → typing shows autocomplete, clicking navigates to district detail
6. Top bar Clear button → resets all filters
7. LayerBubble States/Owner/Plan filters stay in sync with top bar (change one, other updates)
8. Left sidebar no longer has search icon tab
9. Non-map tabs (Plans, Activities, etc.) still work — top bar hides filter controls

**Step 2: Run existing tests**

Run: `npx jest --passWithNoTests`
Expected: All pass (or only pre-existing failures)

**Step 3: Commit any fixes**

If any issues found, fix and commit with descriptive message.
