# Tab Switching Performance Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate lag when switching between layer tabs (Districts, Contacts, Vacancies, Activities, Plans) on the Maps tab.

**Architecture:** Stabilize TanStack Query keys to prevent phantom refetches, batch multiple store mutations into a single React render, and isolate each tab's data subscriptions so switching tabs is a lightweight conditional swap instead of a full re-evaluation of all overlay queries.

**Tech Stack:** React 19, Zustand, TanStack Query, TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/features/map/lib/queries.ts` | Modify | Fix query keys for all 4 overlay hooks |
| `src/features/map/lib/store.ts` | Modify | Add `switchToLayer` action, add `overlayGeoJSON` slice |
| `src/features/map/lib/__tests__/store.overlays.test.ts` | Modify | Add tests for `switchToLayer` |
| `src/features/map/components/SearchBar/index.tsx` | Modify | Use `switchToLayer` instead of `toggleLayer` + `openResultsPanel` |
| `src/features/map/components/SearchResults/ContactsTabContainer.tsx` | Create | Isolated container owning contacts query |
| `src/features/map/components/SearchResults/VacanciesTabContainer.tsx` | Create | Isolated container owning vacancies query |
| `src/features/map/components/SearchResults/ActivitiesTabContainer.tsx` | Create | Isolated container owning activities query |
| `src/features/map/components/SearchResults/PlansTabContainer.tsx` | Create | Isolated container owning plans query |
| `src/features/map/components/SearchResults/index.tsx` | Modify | Remove per-layer queries, delegate to tab containers |

---

### Task 1: Stabilize Query Keys

**Files:**
- Modify: `src/features/map/lib/queries.ts:240-346`

- [ ] **Step 1: Fix `useMapContacts` query key**

In `src/features/map/lib/queries.ts`, replace the query key at line 241:

```ts
// Before
queryKey: ["mapContacts", qBounds, filters, geoStates],

// After
queryKey: ["mapContacts", queryString],
```

- [ ] **Step 2: Fix `useMapVacancies` query key**

In `src/features/map/lib/queries.ts`, replace the query key at line 274:

```ts
// Before
queryKey: ["mapVacancies", qBounds, filters, dateRange, geoStates],

// After
queryKey: ["mapVacancies", queryString],
```

- [ ] **Step 3: Fix `useMapActivities` query key**

In `src/features/map/lib/queries.ts`, replace the query key at line 310:

```ts
// Before
queryKey: ["mapActivities", qBounds, filters, dateRange, geoStates],

// After
queryKey: ["mapActivities", queryString],
```

- [ ] **Step 4: Fix `useMapPlans` query key**

In `src/features/map/lib/queries.ts`, replace the query key at line 338. Plans doesn't use `buildOverlayParams`, so use the locally built `queryString`:

```ts
// Before
queryKey: ["mapPlans", filters],

// After
queryKey: ["mapPlans", queryString],
```

- [ ] **Step 5: Verify no regressions**

Run: `npm test -- --run`
Expected: All existing tests pass. The query key change is internal to TanStack Query — no consumer API changes.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/queries.ts
git commit -m "perf(map): stabilize overlay query keys to prevent phantom refetches"
```

---

### Task 2: Add `switchToLayer` Store Action

**Files:**
- Modify: `src/features/map/lib/store.ts:437-446` (action types), `src/features/map/lib/store.ts:1141-1176` (action implementations)
- Modify: `src/features/map/lib/__tests__/store.overlays.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/map/lib/__tests__/store.overlays.test.ts`:

```ts
describe("switchToLayer", () => {
  it("activates the layer, sets the results tab, and opens the results panel", () => {
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("vacancies")).toBe(true);
    expect(s.activeResultsTab).toBe("vacancies");
    expect(s.searchResultsVisible).toBe(true);
  });

  it("does not remove the districts layer", () => {
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("districts")).toBe(true);
  });

  it("preserves other active layers", () => {
    useMapV2Store.getState().toggleLayer("contacts");
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("contacts")).toBe(true);
    expect(s.activeLayers.has("vacancies")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/map/lib/__tests__/store.overlays.test.ts`
Expected: FAIL — `switchToLayer` is not a function.

- [ ] **Step 3: Add the type declaration**

In `src/features/map/lib/store.ts`, in the `MapV2Actions` interface (around line 437), add after `toggleLayer`:

```ts
  switchToLayer: (layer: OverlayLayerType) => void;
```

- [ ] **Step 4: Add the implementation**

In `src/features/map/lib/store.ts`, after the `toggleLayer` implementation (after line 1152), add:

```ts
  switchToLayer: (layer) =>
    set((s) => {
      const next = new Set(s.activeLayers);
      next.add(layer);
      return {
        activeLayers: next,
        activeResultsTab: layer,
        searchResultsVisible: true,
      };
    }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --run src/features/map/lib/__tests__/store.overlays.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/lib/__tests__/store.overlays.test.ts
git commit -m "feat(map): add switchToLayer action for batched tab switching"
```

---

### Task 3: Wire `switchToLayer` into SearchBar

**Files:**
- Modify: `src/features/map/components/SearchBar/index.tsx:215-233`

- [ ] **Step 1: Subscribe to `switchToLayer` instead of separate actions**

In `src/features/map/components/SearchBar/index.tsx`, add a new store subscription (near line 127):

```ts
const switchToLayer = useMapV2Store((s) => s.switchToLayer);
```

- [ ] **Step 2: Replace `handleEntityChevronClick`**

Replace the `handleEntityChevronClick` callback (lines 221-233) with:

```ts
  const handleEntityChevronClick = useCallback((layerName: string, layerType: OverlayLayerType) => {
    const store = useMapV2Store.getState();
    if (!store.activeLayers.has(layerType)) {
      switchToLayer(layerType);
      setOpenDropdown((prev) => (prev === layerName ? null : layerName));
    } else {
      setOpenDropdown((prev) => {
        const isOpening = prev !== layerName;
        if (isOpening) {
          useMapV2Store.getState().openResultsPanel(layerType as LayerType);
        }
        return isOpening ? layerName : null;
      });
    }
  }, [switchToLayer]);
```

This uses `switchToLayer` (single mutation) when the layer isn't active, and falls back to `openResultsPanel` when the layer is already active (no toggle needed).

- [ ] **Step 3: Verify no regressions**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/SearchBar/index.tsx
git commit -m "perf(map): use switchToLayer for batched tab switching in SearchBar"
```

---

### Task 4: Add `overlayGeoJSON` Store Slice

**Files:**
- Modify: `src/features/map/lib/store.ts`

This slice allows tab containers to report their query data up to the shell for cross-filtering.

- [ ] **Step 1: Add state type and initial state**

In the `MapV2State` interface (around line 283, after `dateRange`), add:

```ts
  overlayGeoJSON: {
    contacts: FeatureCollection<Point> | null;
    vacancies: FeatureCollection<Point> | null;
    activities: FeatureCollection<Point> | null;
    plans: FeatureCollection<Geometry> | null;
  };
```

Add imports at the top of the file if not already present:

```ts
import type { FeatureCollection, Point, Geometry } from "geojson";
```

In the initial state (around line 593, after `mapBounds: null`), add:

```ts
  overlayGeoJSON: {
    contacts: null,
    vacancies: null,
    activities: null,
    plans: null,
  },
```

- [ ] **Step 2: Add action type**

In `MapV2Actions` (around line 440, after `setMapBounds`), add:

```ts
  setOverlayGeoJSON: (layer: keyof MapV2State["overlayGeoJSON"], data: FeatureCollection | null) => void;
```

- [ ] **Step 3: Add action implementation**

After `setMapBounds` implementation (around line 1170), add:

```ts
  setOverlayGeoJSON: (layer, data) =>
    set((s) => ({
      overlayGeoJSON: { ...s.overlayGeoJSON, [layer]: data },
    })),
```

- [ ] **Step 4: Verify no regressions**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/store.ts
git commit -m "feat(map): add overlayGeoJSON store slice for tab container data flow"
```

---

### Task 5: Create Tab Containers

**Files:**
- Create: `src/features/map/components/SearchResults/ContactsTabContainer.tsx`
- Create: `src/features/map/components/SearchResults/VacanciesTabContainer.tsx`
- Create: `src/features/map/components/SearchResults/ActivitiesTabContainer.tsx`
- Create: `src/features/map/components/SearchResults/PlansTabContainer.tsx`

Each container owns its query hook, reports raw GeoJSON to the store, and renders the existing presentation component with filtered data.

- [ ] **Step 1: Create `ContactsTabContainer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapContacts } from "@/features/map/lib/queries";
import ContactsTab from "./ContactsTab";
import type { FeatureCollection, Point } from "geojson";

interface ContactsTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function ContactsTabContainer({ filteredData, geoStates }: ContactsTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.contacts);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapContacts(mapBounds, filters, true, geoStates);

  // Report raw GeoJSON to store for cross-filtering
  useEffect(() => {
    setOverlayGeoJSON("contacts", data ?? null);
  }, [data, setOverlayGeoJSON]);

  return <ContactsTab data={filteredData} isLoading={isLoading} />;
}
```

- [ ] **Step 2: Create `VacanciesTabContainer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapVacancies } from "@/features/map/lib/queries";
import VacanciesTab from "./VacanciesTab";
import type { FeatureCollection, Point } from "geojson";

interface VacanciesTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function VacanciesTabContainer({ filteredData, geoStates }: VacanciesTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.vacancies);
  const dateRange = useMapV2Store((s) => s.dateRange.vacancies);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapVacancies(mapBounds, filters, dateRange, true, geoStates);

  useEffect(() => {
    setOverlayGeoJSON("vacancies", data ?? null);
  }, [data, setOverlayGeoJSON]);

  return <VacanciesTab data={filteredData} isLoading={isLoading} />;
}
```

- [ ] **Step 3: Create `ActivitiesTabContainer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapActivities } from "@/features/map/lib/queries";
import ActivitiesTab from "./ActivitiesTab";
import type { FeatureCollection, Point } from "geojson";

interface ActivitiesTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function ActivitiesTabContainer({ filteredData, geoStates }: ActivitiesTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.activities);
  const dateRange = useMapV2Store((s) => s.dateRange.activities);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapActivities(mapBounds, filters, dateRange, true, geoStates);

  useEffect(() => {
    setOverlayGeoJSON("activities", data ?? null);
  }, [data, setOverlayGeoJSON]);

  return <ActivitiesTab data={filteredData} isLoading={isLoading} />;
}
```

- [ ] **Step 4: Create `PlansTabContainer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapPlans } from "@/features/map/lib/queries";
import PlansTab from "./PlansTab";
import type { FeatureCollection, Geometry } from "geojson";

interface PlansTabContainerProps {
  geoStates: string[] | undefined;
}

export default function PlansTabContainer({ geoStates }: PlansTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.plans);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapPlans(filters, true);

  useEffect(() => {
    setOverlayGeoJSON("plans", data ?? null);
  }, [data, setOverlayGeoJSON]);

  // PlansTab receives raw data (not cross-filtered) — plans are the cross-filter source
  return <PlansTab data={data} isLoading={isLoading} />;
}
```

- [ ] **Step 5: Verify no regressions**

Run: `npm test -- --run`
Expected: All tests pass. Containers are not yet wired in.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/SearchResults/ContactsTabContainer.tsx \
  src/features/map/components/SearchResults/VacanciesTabContainer.tsx \
  src/features/map/components/SearchResults/ActivitiesTabContainer.tsx \
  src/features/map/components/SearchResults/PlansTabContainer.tsx
git commit -m "feat(map): add isolated tab container components"
```

---

### Task 6: Slim Down SearchResults

**Files:**
- Modify: `src/features/map/components/SearchResults/index.tsx`

This is the integration task — wire tab containers in, remove redundant subscriptions and queries.

- [ ] **Step 1: Add container imports**

At the top of `src/features/map/components/SearchResults/index.tsx`, add:

```ts
import ContactsTabContainer from "./ContactsTabContainer";
import VacanciesTabContainer from "./VacanciesTabContainer";
import ActivitiesTabContainer from "./ActivitiesTabContainer";
import PlansTabContainer from "./PlansTabContainer";
```

- [ ] **Step 2: Remove redundant store subscriptions**

Remove these lines from the `SearchResults` component (around lines 89-91):

```ts
// REMOVE these — tab containers own their own subscriptions
const layerFilters = useMapV2Store((s) => s.layerFilters);
const dateRange = useMapV2Store((s) => s.dateRange);
const mapBounds = useMapV2Store((s) => s.mapBounds);
```

Replace with a subscription to the overlayGeoJSON slice:

```ts
const overlayGeoJSON = useMapV2Store((s) => s.overlayGeoJSON);
```

- [ ] **Step 3: Remove redundant query hooks**

Remove the overlay query hook calls (around lines 116-139):

```ts
// REMOVE — moved into tab containers
const contactsQuery = useMapContacts(...);
const vacanciesQuery = useMapVacancies(...);
const activitiesQuery = useMapActivities(...);
const plansQuery = useMapPlans(...);
```

Also remove their imports from the top of the file.

- [ ] **Step 4: Update useCrossFilter to read from store**

Replace the `useCrossFilter` call (around lines 142-152):

```ts
// Before
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

// After
const {
  overlayDerivedLeaids,
  filteredContacts,
  filteredVacancies,
  filteredActivities,
} = useCrossFilter({
  plansGeoJSON: overlayGeoJSON.plans,
  contactsGeoJSON: overlayGeoJSON.contacts,
  vacanciesGeoJSON: overlayGeoJSON.vacancies,
  activitiesGeoJSON: overlayGeoJSON.activities,
});
```

- [ ] **Step 5: Update tabCounts to use overlayGeoJSON**

Update the `tabCounts` computation (around lines 483-505) to use `overlayGeoJSON` instead of query results:

```ts
const tabCounts = useMemo((): Partial<Record<LayerType, number>> => {
  const counts: Partial<Record<LayerType, number>> = {};
  counts.districts = total;
  if (activeLayers.has("plans") && overlayGeoJSON.plans) {
    const planIds = new Set<string>();
    for (const f of overlayGeoJSON.plans.features) {
      const pid = f.properties?.planId;
      if (pid) planIds.add(pid);
    }
    counts.plans = planIds.size;
  }
  if (activeLayers.has("contacts") && filteredContacts) {
    counts.contacts = filteredContacts.features.length;
  }
  if (activeLayers.has("vacancies") && filteredVacancies) {
    counts.vacancies = filteredVacancies.features.length;
  }
  if (activeLayers.has("activities") && filteredActivities) {
    counts.activities = filteredActivities.features.length;
  }
  return counts;
}, [total, activeLayers, overlayGeoJSON.plans, filteredContacts, filteredVacancies, filteredActivities]);
```

- [ ] **Step 6: Replace inline tab rendering with containers**

Replace the overlay tab rendering block (around lines 835-854):

```tsx
{/* Before */}
{showingOverlayTab && activeResultsTab === "plans" && (
  activeLayers.has("plans")
    ? <PlansTab data={plansQuery.data} isLoading={plansQuery.isLoading} />
    : <LayerOffPrompt layer="Plans" />
)}
{showingOverlayTab && activeResultsTab === "contacts" && (
  activeLayers.has("contacts")
    ? <ContactsTab data={filteredContacts} isLoading={contactsQuery.isLoading} />
    : <LayerOffPrompt layer="Contacts" />
)}
{showingOverlayTab && activeResultsTab === "vacancies" && (
  activeLayers.has("vacancies")
    ? <VacanciesTab data={filteredVacancies} isLoading={vacanciesQuery.isLoading} />
    : <LayerOffPrompt layer="Vacancies" />
)}
{showingOverlayTab && activeResultsTab === "activities" && (
  activeLayers.has("activities")
    ? <ActivitiesTab data={filteredActivities} isLoading={activitiesQuery.isLoading} />
    : <LayerOffPrompt layer="Activities" />
)}

{/* After */}
{showingOverlayTab && activeResultsTab === "plans" && (
  activeLayers.has("plans")
    ? <PlansTabContainer geoStates={geoStates} />
    : <LayerOffPrompt layer="Plans" />
)}
{showingOverlayTab && activeResultsTab === "contacts" && (
  activeLayers.has("contacts")
    ? <ContactsTabContainer filteredData={filteredContacts} geoStates={geoStates} />
    : <LayerOffPrompt layer="Contacts" />
)}
{showingOverlayTab && activeResultsTab === "vacancies" && (
  activeLayers.has("vacancies")
    ? <VacanciesTabContainer filteredData={filteredVacancies} geoStates={geoStates} />
    : <LayerOffPrompt layer="Vacancies" />
)}
{showingOverlayTab && activeResultsTab === "activities" && (
  activeLayers.has("activities")
    ? <ActivitiesTabContainer filteredData={filteredActivities} geoStates={geoStates} />
    : <LayerOffPrompt layer="Activities" />
)}
```

- [ ] **Step 7: Clean up unused imports**

Remove now-unused imports from `index.tsx`:
- `useMapContacts`, `useMapVacancies`, `useMapActivities`, `useMapPlans` (moved to containers)
- `ContactsTab`, `VacanciesTab`, `ActivitiesTab`, `PlansTab` (rendered by containers)

Keep imports for: `useCrossFilter`, `ResultsTabStrip`, `LayerOffPrompt`, `DistrictExploreModal`, and all the container imports added in Step 1.

- [ ] **Step 8: Verify no regressions**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/features/map/components/SearchResults/index.tsx
git commit -m "perf(map): isolate tab rendering in SearchResults for fast tab switching"
```

---

### Task 7: Manual Smoke Test

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify tab switching is snappy**

On the Maps tab:
1. Click Vacancies → should activate layer and show results panel
2. Click Contacts → should switch immediately, no visible lag
3. Click Districts → should switch immediately
4. Click Activities → should switch immediately
5. Click back to Vacancies → should switch immediately with cached data
6. Rapidly click between all tabs — should feel instant

- [ ] **Step 3: Verify cross-filtering still works**

1. Apply a vacancy filter (e.g., category = SPED)
2. Switch to Districts tab — should show districts filtered by vacancy overlay
3. Switch back to Vacancies — filter should still be applied

- [ ] **Step 4: Verify map layers still render**

1. Activate Vacancies layer — pins should appear on the map
2. Activate Contacts layer — contact pins should appear
3. Pan/zoom — new data should load for visible layers
4. Deactivate a layer — pins should disappear

- [ ] **Step 5: Final commit if any adjustments were needed**
