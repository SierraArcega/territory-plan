# Focus Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle "Focus Map" button on PlanOverviewSection that filters the map to the plan's states, highlights plan districts, dims non-plan districts, and zooms to fit.

**Architecture:** New `focusPlanId` + `preFocusFilters` + `pendingFitBounds` fields in the Zustand store. A `focusPlan()` action saves current filters, applies plan filters, and queues a fitBounds. MapV2Container watches `pendingFitBounds` via useEffect and calls `map.fitBounds()`. The button in PlanOverviewSection toggles between focus/unfocus.

**Tech Stack:** Zustand store, MapLibre GL fitBounds, React components (PlanOverviewSection)

---

### Task 1: Add focus state and actions to Zustand store

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Add state fields to `MapV2State` interface (after line 176)**

Add these three fields after the `selectAllMatchingFilters` line:

```typescript
  // Focus Map — zooms + filters to a specific plan's footprint
  focusPlanId: string | null;
  preFocusFilters: { filterStates: string[]; filterPlanId: string | null } | null;
  pendingFitBounds: [[number, number], [number, number]] | null;
```

**Step 2: Add actions to `MapV2Actions` interface (after line 296)**

Add after `setSelectAllMatchingFilters`:

```typescript
  // Focus Map
  focusPlan: (planId: string, stateAbbrevs: string[], bounds: [[number, number], [number, number]]) => void;
  unfocusPlan: () => void;
  clearPendingFitBounds: () => void;
```

**Step 3: Add initial state values (after line 386)**

After the `selectAllMatchingFilters: false` line:

```typescript
  // Focus Map
  focusPlanId: null,
  preFocusFilters: null,
  pendingFitBounds: null,
```

**Step 4: Add action implementations (after line 821)**

Before the closing `}));`:

```typescript
  // Focus Map — saves current filters, applies plan filters, queues fitBounds
  focusPlan: (planId, stateAbbrevs, bounds) =>
    set((s) => ({
      focusPlanId: planId,
      preFocusFilters: {
        filterStates: s.filterStates,
        filterPlanId: s.filterPlanId,
      },
      filterStates: stateAbbrevs,
      filterPlanId: planId,
      pendingFitBounds: bounds,
    })),

  unfocusPlan: () =>
    set((s) => ({
      focusPlanId: null,
      filterStates: s.preFocusFilters?.filterStates ?? [],
      filterPlanId: s.preFocusFilters?.filterPlanId ?? null,
      preFocusFilters: null,
    })),

  clearPendingFitBounds: () => set({ pendingFitBounds: null }),
```

**Step 5: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat(map-v2): add focusPlan/unfocusPlan store state and actions"
```

---

### Task 2: Handle pendingFitBounds in MapV2Container

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Subscribe to pendingFitBounds in the component**

Near the other store subscriptions at the top of the component, add:

```typescript
const pendingFitBounds = useMapV2Store((s) => s.pendingFitBounds);
const clearPendingFitBounds = useMapV2Store((s) => s.clearPendingFitBounds);
```

**Step 2: Add a useEffect to execute the fitBounds**

After the existing useEffects (around the filter-application effects), add:

```typescript
  // Focus Map — fly to bounds when a focus action queues one
  useEffect(() => {
    if (!pendingFitBounds || !map.current) return;
    map.current.fitBounds(pendingFitBounds, {
      padding: { top: 50, bottom: 50, left: 380, right: 50 },
      duration: 800,
    });
    clearPendingFitBounds();
  }, [pendingFitBounds, clearPendingFitBounds]);
```

**Step 3: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat(map-v2): watch pendingFitBounds and fly map to focus bounds"
```

---

### Task 3: Add Focus Map button to PlanOverviewSection

**Files:**
- Modify: `src/components/map-v2/panels/PlanOverviewSection.tsx`

**Step 1: Import STATE_BBOX**

The `STATE_BBOX` constant lives in `MapV2Container.tsx` and isn't exported. Rather than importing from a component, create a small helper inline (or we can extract STATE_BBOX later). The simplest approach: import the store actions, and compute the combined bounding box from `plan.states` in the component using a local copy of the needed state bboxes.

Actually, the better approach: export `STATE_BBOX` from MapV2Container as a named export so we can reuse it.

In `MapV2Container.tsx`, change:
```typescript
const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
```
to:
```typescript
export const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
```

**Step 2: Add the Focus button to PlanOverviewSection**

At the top of PlanOverviewSection, add store subscriptions:

```typescript
const focusPlanId = useMapV2Store((s) => s.focusPlanId);
const focusPlan = useMapV2Store((s) => s.focusPlan);
const unfocusPlan = useMapV2Store((s) => s.unfocusPlan);
```

Add the import for STATE_BBOX:

```typescript
import { STATE_BBOX } from "@/components/map-v2/MapV2Container";
```

Add a handler function inside the component:

```typescript
  // Compute combined bounding box for all states in the plan
  const handleFocusMap = () => {
    if (!plan) return;
    const isFocused = focusPlanId === plan.id;

    if (isFocused) {
      unfocusPlan();
      return;
    }

    // Compute combined bbox from all plan states
    const abbrevs = plan.states.map((s) => s.abbrev);
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const abbrev of abbrevs) {
      const bbox = STATE_BBOX[abbrev];
      if (!bbox) continue;
      if (bbox[0][0] < minLng) minLng = bbox[0][0];
      if (bbox[0][1] < minLat) minLat = bbox[0][1];
      if (bbox[1][0] > maxLng) maxLng = bbox[1][0];
      if (bbox[1][1] > maxLat) maxLat = bbox[1][1];
    }

    if (minLng > maxLng) return; // no valid bboxes found
    focusPlan(plan.id, abbrevs, [[minLng, minLat], [maxLng, maxLat]]);
  };

  const isFocused = focusPlanId === plan?.id;
```

**Step 3: Add the button to the JSX**

Place the button between the stats grid and the Sort + Add row (after the `TargetSummary` block, before the sort row). This puts it in a natural "actions" position:

```tsx
      {/* Focus Map toggle */}
      {plan.districts.length > 0 && (
        <button
          onClick={handleFocusMap}
          className={`
            w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all
            ${isFocused
              ? "bg-plum text-white hover:bg-plum/90"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-plum"
            }
          `}
        >
          {/* Crosshairs icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1V4M8 12V15M1 8H4M12 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {isFocused ? "Exit Focus" : "Focus Map"}
        </button>
      )}
```

**Step 4: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx src/components/map-v2/panels/PlanOverviewSection.tsx
git commit -m "feat(map-v2): add Focus Map toggle button to plan overview"
```

---

### Task 4: Manual testing and verification

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Test the feature**

1. Open the app, navigate to a plan with districts in multiple states
2. Click "Focus Map" — verify:
   - Map zooms to fit the plan's states
   - State filter narrows to only the plan's states
   - Plan districts are highlighted, non-plan districts are dimmed
   - Button shows "Exit Focus" with plum fill
3. Click "Exit Focus" — verify:
   - Previous filter state is restored
   - Button returns to "Focus Map" with gray style
   - Map stays at current position (no zoom-back)
4. Test edge cases:
   - Plan with 0 districts → button should be hidden
   - Plan with districts in only 1 state → should zoom to that state
   - Apply manual filters, then focus, then unfocus → original filters restored

**Step 3: Check build**

```bash
npm run build
```

**Step 4: Commit any fixes if needed**
