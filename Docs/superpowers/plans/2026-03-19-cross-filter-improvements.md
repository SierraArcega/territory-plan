# Cross-Filter & Linked Views Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs and consolidate the cross-filtering system so that overlay filters (plans, contacts, vacancies, activities) correctly cross-filter to the districts tab, the map, and each other — with a single source of truth and no duplicated logic.

**Architecture:** Extract all cross-filter logic into a shared `useCrossFilter` hook and a `filter-utils.ts` module. Both `SearchResults` and `MapV2Container` consume the hook instead of maintaining parallel computations. The hook owns the canonical leaid sets, filter-active booleans, and overlay filtering function. District fetching in `SearchResults` is driven by the hook's output.

**Tech Stack:** React 19 hooks, Zustand selectors, Vitest, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/features/map/lib/filter-utils.ts` | **Create** | Pure functions: `isLayerFiltered()` for each layer type, `computeOverlayLeaidSet()`, `extractLeaids()`, `leaidSetKey()` (stable serialization) |
| `src/features/map/lib/useCrossFilter.ts` | **Create** | Shared React hook consumed by SearchResults and MapV2Container. Computes `overlayLeaidSet`, `overlayDerivedLeaids`, `planFilterLeaids`, `filterOverlayGeoJSON`, per-layer `*Filtered` booleans |
| `src/features/map/lib/__tests__/filter-utils.test.ts` | **Create** | Unit tests for pure filter utility functions |
| `src/features/map/lib/__tests__/useCrossFilter.test.ts` | **Create** | Hook tests using renderHook + mock store |
| `src/features/map/components/SearchResults/index.tsx` | **Modify** | Remove ~60 lines of inline filter logic (lines 137-194), consume `useCrossFilter()`. Fix fetchResults to not write searchResultLeaids during overlay-derived mode. Add cross-filter source banner. |
| `src/features/map/components/MapV2Container.tsx` | **Modify** | Remove ~40 lines of inline filter logic (lines 263-302), consume `useCrossFilter()` |
| `src/features/map/components/SearchBar/index.tsx` | **Modify** | Import `isLayerFiltered` from filter-utils instead of inline count functions (lines 25-64). Keep count functions for badge display but reuse `isLayerFiltered` for the boolean check. |

---

### Task 1: Create `filter-utils.ts` — Pure filter logic

**Files:**
- Create: `src/features/map/lib/filter-utils.ts`
- Test: `src/features/map/lib/__tests__/filter-utils.test.ts`

This module contains zero React dependencies — pure functions only.

- [ ] **Step 1: Write failing tests for `isLayerFiltered` functions**

```typescript
// src/features/map/lib/__tests__/filter-utils.test.ts
import { describe, it, expect } from "vitest";
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
} from "../filter-utils";

describe("isPlansFiltered", () => {
  it("returns false for empty/default filters", () => {
    expect(isPlansFiltered({})).toBe(false);
    expect(isPlansFiltered({ ownerScope: "mine" })).toBe(false);
  });
  it("returns true when ownerIds set", () => {
    expect(isPlansFiltered({ ownerIds: ["abc"] })).toBe(true);
  });
  it("returns true when ownerScope is all", () => {
    expect(isPlansFiltered({ ownerScope: "all" })).toBe(true);
  });
  it("returns true when planIds set", () => {
    expect(isPlansFiltered({ planIds: ["p1"] })).toBe(true);
  });
  it("returns true when status set", () => {
    expect(isPlansFiltered({ status: ["working"] })).toBe(true);
  });
  it("returns true when fiscalYear set", () => {
    expect(isPlansFiltered({ fiscalYear: 26 })).toBe(true);
  });
});

describe("isContactsFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isContactsFiltered({})).toBe(false);
  });
  it("returns true when seniorityLevel set", () => {
    expect(isContactsFiltered({ seniorityLevel: ["C-Suite"] })).toBe(true);
  });
  it("returns true when primaryOnly set", () => {
    expect(isContactsFiltered({ primaryOnly: true })).toBe(true);
  });
});

describe("isVacanciesFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isVacanciesFiltered({})).toBe(false);
  });
  it("returns true when category set", () => {
    expect(isVacanciesFiltered({ category: ["SPED"] })).toBe(true);
  });
  it("returns true when fullmindRelevant set", () => {
    expect(isVacanciesFiltered({ fullmindRelevant: true })).toBe(true);
  });
});

describe("isActivitiesFiltered", () => {
  it("returns false for empty filters", () => {
    expect(isActivitiesFiltered({})).toBe(false);
  });
  it("returns true when type set", () => {
    expect(isActivitiesFiltered({ type: ["call"] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/map/lib/__tests__/filter-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write failing tests for `extractLeaids` and `leaidSetKey`**

Add to the same test file:

```typescript
import { extractLeaids, leaidSetKey } from "../filter-utils";

describe("extractLeaids", () => {
  it("extracts leaids from GeoJSON features", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        { properties: { leaid: "A" } },
        { properties: { leaid: "B" } },
        { properties: { leaid: "A" } }, // duplicate
        { properties: {} }, // no leaid
      ],
    };
    const result = extractLeaids(geojson);
    expect(result).toEqual(new Set(["A", "B"]));
  });
  it("returns empty set for null input", () => {
    expect(extractLeaids(null)).toEqual(new Set());
  });
});

describe("leaidSetKey", () => {
  it("returns stable key for same contents in different order", () => {
    const a = new Set(["B", "A", "C"]);
    const b = new Set(["C", "A", "B"]);
    expect(leaidSetKey(a)).toBe(leaidSetKey(b));
  });
  it("returns empty string for null", () => {
    expect(leaidSetKey(null)).toBe("");
  });
});
```

- [ ] **Step 4: Implement `filter-utils.ts`**

```typescript
// src/features/map/lib/filter-utils.ts
import type {
  PlanLayerFilter,
  ContactLayerFilter,
  VacancyLayerFilter,
  ActivityLayerFilter,
} from "./store";

/** Is any plan layer filter actively narrowing results? */
export function isPlansFiltered(f: Partial<PlanLayerFilter>): boolean {
  return !!(
    f.planIds?.length ||
    f.ownerIds?.length ||
    f.status?.length ||
    f.fiscalYear ||
    f.ownerScope === "all"
  );
}

/** Is any contact layer filter actively narrowing results? */
export function isContactsFiltered(f: Partial<ContactLayerFilter>): boolean {
  return !!(f.seniorityLevel?.length || f.persona?.length || f.primaryOnly);
}

/** Is any vacancy layer filter actively narrowing results? */
export function isVacanciesFiltered(f: Partial<VacancyLayerFilter>): boolean {
  return !!(
    f.category?.length ||
    f.status?.length ||
    f.fullmindRelevant ||
    (f.minDaysOpen != null && f.minDaysOpen > 0) ||
    (f.maxDaysOpen != null && f.maxDaysOpen < 365)
  );
}

/** Is any activity layer filter actively narrowing results? */
export function isActivitiesFiltered(f: Partial<ActivityLayerFilter>): boolean {
  return !!(f.type?.length || f.status?.length || f.outcome?.length);
}

/** Extract unique leaid values from a GeoJSON FeatureCollection */
export function extractLeaids(geojson: any): Set<string> {
  const leaids = new Set<string>();
  if (!geojson?.features) return leaids;
  for (const f of geojson.features) {
    const id = f.properties?.leaid;
    if (id) leaids.add(id);
  }
  return leaids;
}

/**
 * Stable string key for a Set<string> — used to compare sets by value
 * in React dependency arrays without triggering spurious re-renders.
 */
export function leaidSetKey(s: Set<string> | null): string {
  if (!s || s.size === 0) return "";
  return [...s].sort().join(",");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/map/lib/__tests__/filter-utils.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/filter-utils.ts src/features/map/lib/__tests__/filter-utils.test.ts
git commit -m "feat: add pure filter-utils for cross-filter logic"
```

---

### Task 2: Create `useCrossFilter` hook — single source of truth

**Files:**
- Create: `src/features/map/lib/useCrossFilter.ts`
- Reference: `src/features/map/lib/filter-utils.ts`

This hook reads from the Zustand store and overlay query data. It returns everything both `SearchResults` and `MapV2Container` need for cross-filtering.

- [ ] **Step 1: Write the hook**

```typescript
// src/features/map/lib/useCrossFilter.ts
"use client";

import { useMemo, useCallback, useRef } from "react";
import { useMapV2Store } from "./store";
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
  extractLeaids,
  leaidSetKey,
} from "./filter-utils";

interface OverlayData {
  plansGeoJSON: any;
  contactsGeoJSON: any;
  vacanciesGeoJSON: any;
  activitiesGeoJSON: any;
}

/**
 * Single source of truth for cross-filter leaid sets.
 *
 * Consumers pass in the overlay GeoJSON data (from TanStack queries).
 * The hook computes:
 * - overlayLeaidSet: leaids to constrain map overlay rendering
 * - overlayDerivedLeaids: leaids from filtered overlays → drives district tab
 * - filterOverlayGeoJSON: function to filter any GeoJSON by overlayLeaidSet
 * - Per-layer filtered booleans
 */
export function useCrossFilter(data: OverlayData) {
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const focusLeaids = useMapV2Store((s) => s.focusLeaids);
  const isSearchActive = useMapV2Store((s) => s.isSearchActive);
  const searchResultLeaids = useMapV2Store((s) => s.searchResultLeaids);

  // Per-layer "has active filters?" booleans
  const plansActive = useMemo(() => isPlansFiltered(layerFilters.plans), [layerFilters.plans]);
  const contactsActive = useMemo(() => isContactsFiltered(layerFilters.contacts), [layerFilters.contacts]);
  const vacanciesActive = useMemo(() => isVacanciesFiltered(layerFilters.vacancies), [layerFilters.vacancies]);
  const activitiesActive = useMemo(() => isActivitiesFiltered(layerFilters.activities), [layerFilters.activities]);

  // Leaids from filtered plan GeoJSON
  const planFilterLeaids = useMemo(() => {
    if (!plansActive || !data.plansGeoJSON) return null;
    const s = extractLeaids(data.plansGeoJSON);
    return s.size > 0 ? s : null;
  }, [plansActive, data.plansGeoJSON]);

  // Overlay leaid set — constrains map overlay rendering.
  // Uses intersection when both plan filter and search are active.
  const overlayLeaidSet = useMemo(() => {
    // Plan focus takes priority (most specific view)
    if (focusLeaids.length > 0) return new Set(focusLeaids);

    const sets: Set<string>[] = [];
    if (planFilterLeaids) sets.push(planFilterLeaids);
    if (isSearchActive && searchResultLeaids.length > 0) sets.push(new Set(searchResultLeaids));

    if (sets.length === 0) return null;
    if (sets.length === 1) return sets[0];

    // Intersect all active sets
    const [first, ...rest] = sets;
    const result = new Set<string>();
    for (const id of first) {
      if (rest.every((s) => s.has(id))) result.add(id);
    }
    return result.size > 0 ? result : null;
  }, [focusLeaids, planFilterLeaids, isSearchActive, searchResultLeaids]);

  // Filter any GeoJSON FeatureCollection by overlayLeaidSet
  const filterOverlayGeoJSON = useCallback(
    (geojson: any) => {
      if (!geojson || !overlayLeaidSet) return geojson;
      return {
        ...geojson,
        features: geojson.features.filter(
          (f: any) => overlayLeaidSet.has(f.properties?.leaid)
        ),
      };
    },
    [overlayLeaidSet],
  );

  // Filtered overlay GeoJSONs (for tabs and cross-filter extraction)
  const filteredContacts = useMemo(
    () => filterOverlayGeoJSON(data.contactsGeoJSON),
    [filterOverlayGeoJSON, data.contactsGeoJSON],
  );
  const filteredVacancies = useMemo(
    () => filterOverlayGeoJSON(data.vacanciesGeoJSON),
    [filterOverlayGeoJSON, data.vacanciesGeoJSON],
  );
  const filteredActivities = useMemo(
    () => filterOverlayGeoJSON(data.activitiesGeoJSON),
    [filterOverlayGeoJSON, data.activitiesGeoJSON],
  );

  // Overlay-derived leaids for the districts tab.
  // Only includes overlays with active filters — not just visible layers.
  const overlayDerivedLeaids = useMemo(() => {
    const leaids = new Set<string>();
    if (planFilterLeaids) planFilterLeaids.forEach((id) => leaids.add(id));
    if (contactsActive && filteredContacts) extractLeaids(filteredContacts).forEach((id) => leaids.add(id));
    if (vacanciesActive && filteredVacancies) extractLeaids(filteredVacancies).forEach((id) => leaids.add(id));
    if (activitiesActive && filteredActivities) extractLeaids(filteredActivities).forEach((id) => leaids.add(id));
    return leaids.size > 0 ? leaids : null;
  }, [planFilterLeaids, contactsActive, vacanciesActive, activitiesActive, filteredContacts, filteredVacancies, filteredActivities]);

  // Stable key for overlayDerivedLeaids — prevents spurious fetches
  const derivedLeaidKey = leaidSetKey(overlayDerivedLeaids);
  const prevKeyRef = useRef(derivedLeaidKey);
  const stableOverlayDerivedLeaids = useMemo(() => {
    if (derivedLeaidKey === prevKeyRef.current) return overlayDerivedLeaids;
    prevKeyRef.current = derivedLeaidKey;
    return overlayDerivedLeaids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedLeaidKey]);

  return {
    // Booleans
    plansActive,
    contactsActive,
    vacanciesActive,
    activitiesActive,
    // Leaid sets
    planFilterLeaids,
    overlayLeaidSet,
    overlayDerivedLeaids: stableOverlayDerivedLeaids,
    // Filtered GeoJSON
    filteredContacts,
    filteredVacancies,
    filteredActivities,
    // Filter function (for MapV2Container to filter before pushing to sources)
    filterOverlayGeoJSON,
  };
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep useCrossFilter`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/map/lib/useCrossFilter.ts
git commit -m "feat: add useCrossFilter hook — single source of truth"
```

---

### Task 3: Wire `SearchResults` to `useCrossFilter`

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx`

Remove all inline cross-filter logic and consume the hook. Fix the feedback loop bug where `fetchResults` writes `searchResultLeaids` during overlay-derived mode.

- [ ] **Step 1: Replace inline cross-filter logic with hook**

In `SearchResults/index.tsx`, find lines 137-194 (everything from "Build leaid filter set" through `overlayDerivedLeaids`). Replace with:

```typescript
  // Cross-filter — single source of truth
  const {
    overlayDerivedLeaids,
    filteredContacts,
    filteredVacancies,
    filteredActivities,
  } = useCrossFilter({
    plansGeoJSON: plansQuery.data,
    contactsGeoJSON: contactsQuery.data,
    vacanciesGeoJSON: vacanciesQuery.data,
    activitiesGeoJSON: activitiesQuery.data,
  });
```

Remove: `focusLeaids`, `searchResultLeaids2`, `plansFiltered`, `planFilterLeaids`, `overlayLeaidSet`, `filterOverlay`, inline `filteredContacts/Vacancies/Activities`, `contactsFiltered`, `vacanciesFiltered`, `activitiesFiltered` — all of these are now in the hook.

Add import at top:
```typescript
import { useCrossFilter } from "@/features/map/lib/useCrossFilter";
```

- [ ] **Step 2: Fix the feedback loop in `fetchResults`**

In `fetchResults`, the line `state.setSearchResultLeaids(json.matchingLeaids ?? [])` writes back to the store even during overlay-derived mode, which feeds back into `overlayLeaidSet`. Fix by checking if this is an overlay-derived fetch:

```typescript
  const fetchResults = useCallback(async (pageNum: number, leaidOverride?: string[]) => {
    const state = useMapV2Store.getState();
    if (!state.isSearchActive && !leaidOverride?.length) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (!leaidOverride && state.searchBounds) {
        params.set("bounds", state.searchBounds.join(","));
      }
      if (state.searchFilters.length > 0) {
        params.set("filters", JSON.stringify(state.searchFilters));
      }
      if (leaidOverride?.length) {
        params.set("leaids", leaidOverride.join(","));
      }
      params.set("sort", state.searchSort.column);
      params.set("order", state.searchSort.direction);
      params.set("page", String(pageNum));
      params.set("limit", "25");

      const res = await fetch(`/api/districts/search?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();

      setDistricts(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);

      // Only update search result leaids for actual searches — not overlay-derived fetches.
      // Writing these during overlay mode creates a feedback loop via overlayLeaidSet.
      if (!leaidOverride) {
        state.setSearchResultLeaids(json.matchingLeaids ?? []);
        state.setSearchResultCentroids(json.matchingCentroids ?? []);
      }

      if (shouldFitBoundsRef.current) {
        shouldFitBoundsRef.current = false;
        // ... existing fitBounds logic unchanged ...
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Search fetch failed:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 3: Hide Save Search / Export CSV during overlay-derived mode**

Find the actions bar section. Wrap Save Search and Export CSV in an `isSearchActive` check:

```tsx
{/* Save Search / Export — only for explicit searches, not overlay-derived */}
{isSearchActive && (
  <>
    {/* existing Save Search button */}
    {/* existing Export CSV button */}
  </>
)}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep SearchResults`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/index.tsx
git commit -m "refactor: SearchResults consumes useCrossFilter, fixes feedback loop"
```

---

### Task 4: Wire `MapV2Container` to `useCrossFilter`

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx`

Remove inline cross-filter logic (lines ~263-302) and consume the hook.

- [ ] **Step 1: Replace inline logic with hook**

Remove: `overlaySearchLeaids`, `overlaySearchActive`, `plansFiltered`, `planFilterLeaids`, `overlayLeaidSet`, `filterOverlayGeoJSON`.

Replace with:

```typescript
import { useCrossFilter } from "@/features/map/lib/useCrossFilter";

// ... inside the component, after overlay query hooks:

const { filterOverlayGeoJSON } = useCrossFilter({
  plansGeoJSON,
  contactsGeoJSON,
  vacanciesGeoJSON,
  activitiesGeoJSON,
});
```

The existing `useEffect` hooks that push to map sources already use `filterOverlayGeoJSON` — they continue to work unchanged since the function signature is identical.

- [ ] **Step 2: Verify build + map rendering**

Run: `npx tsc --noEmit 2>&1 | grep MapV2Container`
Expected: No errors (or only the pre-existing dateRange type errors)

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "refactor: MapV2Container consumes useCrossFilter hook"
```

---

### Task 5: Unify SearchBar filter-active checks

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx` (lines 25-64)

- [ ] **Step 1: Import shared filter-active functions**

```typescript
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
} from "@/features/map/lib/filter-utils";
```

- [ ] **Step 2: Keep count functions, but derive the boolean from shared logic**

The count functions (`countPlanFilters` etc.) are still useful for badge numbers. But anywhere the codebase checks "is this layer filtered?" should use the shared `isXFiltered()` functions. No code changes needed in SearchBar beyond the import — the count functions serve a different purpose (display) and can stay. The shared functions serve the cross-filter purpose.

If in the future the count functions and `isXFiltered` diverge, the count functions are the ones to update — `isXFiltered` is the source of truth.

- [ ] **Step 3: Commit**

```bash
git add src/features/map/components/SearchBar/index.tsx
git commit -m "refactor: import shared filter-active functions in SearchBar"
```

---

### Task 6: Add cross-filter source banner to Districts tab

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx`

When districts are shown via overlay-derived leaids (not explicit search), add a small banner explaining why these districts are showing.

- [ ] **Step 1: Add the banner component**

Above the districts header, when `!isSearchActive && overlayDerivedLeaids`:

```tsx
{/* Cross-filter source indicator */}
{!showingOverlayTab && !isSearchActive && overlayDerivedLeaids && (
  <div className="shrink-0 px-4 py-1.5 border-b border-[#E2DEEC] bg-[#F7F5FA] flex items-center justify-between">
    <span className="text-xs text-[#8A80A8]">
      Showing districts from filtered overlays
    </span>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/map/components/SearchResults/index.tsx
git commit -m "feat: add cross-filter source banner to districts tab"
```

---

### Task 7: Verify end-to-end and clean up

- [ ] **Step 1: Type-check the full project**

Run: `npx tsc --noEmit`
Expected: No new errors from our changes

- [ ] **Step 2: Run all map feature tests**

Run: `npx vitest run src/features/map/`
Expected: All pass

- [ ] **Step 3: Manual smoke test checklist**

Verify in the browser:

1. **Plan filter → districts**: Select an owner in Plans dropdown → Districts tab populates with matching districts → map pins filter to those districts
2. **Remove plan filter**: Clear the owner → Districts tab clears → map shows all pins
3. **Search + plan filter**: Apply a district search AND a plan filter → overlays show intersection
4. **Contact filter → districts**: Enable contacts layer, filter by seniority → Districts tab shows districts with matching contacts
5. **No filters + layers visible**: Have contacts/vacancies visible but no filters → Districts tab shows "No active search" (not filtered to overlay leaids)
6. **Save Search / Export CSV**: Only visible during explicit district searches, not overlay-derived mode
7. **Tab counts**: Badge counts reflect filtered data consistently

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cross-filter improvements complete"
```
