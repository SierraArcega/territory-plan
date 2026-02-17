# Multi-Select Mode & Add-to-Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a multi-select mode toggle button and an "Add to Plan" dropdown so users can click-select multiple districts and assign them to territory plans without Shift-clicking.

**Architecture:** Extend the existing Zustand store with a `multiSelectMode` boolean. Modify the MapV2Container click handler to route clicks through `toggleDistrictSelection` when mode is active. Add a `SelectModePill` button next to the LayerBubble. Enhance the existing `MultiSelectChip` with a plan picker dropdown. All API hooks (`useTerritoryPlans`, `useAddDistrictsToPlan`) already exist.

**Tech Stack:** React 19, Zustand, Next.js App Router, existing API hooks from `src/lib/api.ts`

---

### Task 1: Add `multiSelectMode` to Zustand store

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Add state and action types**

In the `MapV2State` interface (after line 85 `selectedLeaids`), add:

```typescript
// Multi-select mode (click-to-select without Shift)
multiSelectMode: boolean;
```

In the `MapV2Actions` interface (after line 149 `createPlanFromSelection`), add:

```typescript
toggleMultiSelectMode: () => void;
```

**Step 2: Add initial state and action implementation**

In the store initial state (after line 209 `selectedLeaids`), add:

```typescript
multiSelectMode: false,
```

After the `createPlanFromSelection` action (after line 374), add:

```typescript
toggleMultiSelectMode: () =>
  set((s) => ({
    multiSelectMode: !s.multiSelectMode,
    // Clear selection when turning off
    ...(!s.multiSelectMode ? {} : { selectedLeaids: new Set<string>() }),
  })),
```

**Step 3: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "feat: add multiSelectMode to map-v2 store"
```

---

### Task 2: Modify MapV2Container click handler

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Update the district click branch in `handleClick`**

In `MapV2Container.tsx`, the district click handler (around line 606-654) currently does:
1. PLAN_ADD check
2. Shift+click check
3. Regular click → selectDistrict + zoom

Insert a multi-select mode check **after** the PLAN_ADD check and **before** the Shift+click check. Replace lines 621-625:

```typescript
// Shift+click toggles multi-select
if (e.originalEvent.shiftKey) {
  store.toggleDistrictSelection(leaid);
  return;
}
```

With:

```typescript
// Multi-select mode or Shift+click toggles selection
if (store.multiSelectMode || e.originalEvent.shiftKey) {
  store.toggleDistrictSelection(leaid);
  return;
}
```

This is a one-line change — adding `store.multiSelectMode ||` to the existing condition. Shift+click continues to work as before.

**Step 2: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: route clicks through multi-select when mode is active"
```

---

### Task 3: Create SelectModePill component

**Files:**
- Create: `src/components/map-v2/SelectModePill.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useMapV2Store } from "@/lib/map-v2-store";

export default function SelectModePill() {
  const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
  const toggleMultiSelectMode = useMapV2Store((s) => s.toggleMultiSelectMode);
  const selectedCount = useMapV2Store((s) => s.selectedLeaids.size);

  return (
    <div className="absolute bottom-6 right-6 z-10 mr-[140px]">
      <button
        onClick={toggleMultiSelectMode}
        className={`
          flex items-center gap-2 px-3 py-2
          backdrop-blur-sm rounded-xl shadow-lg border transition-all duration-150
          ${
            multiSelectMode
              ? "bg-plum text-white border-plum/60 ring-2 ring-plum/20 shadow-plum/20"
              : "bg-white/95 text-gray-700 border-gray-200/60 hover:shadow-xl"
          }
        `}
        aria-label={multiSelectMode ? "Exit multi-select mode" : "Enter multi-select mode"}
      >
        {/* Cursor-click icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9l-2 12 4.5-3.5L15 22l2-7 7-2-12-4z" />
          <path d="M1 1l6.5 6.5" />
          <path d="M7 1h-6v6" />
        </svg>
        <span className="text-sm font-medium">
          {multiSelectMode
            ? selectedCount > 0
              ? `${selectedCount} selected`
              : "Selecting..."
            : "Select"}
        </span>
      </button>
    </div>
  );
}
```

**Design notes:**
- Positioned with `mr-[140px]` to sit left of the LayerBubble (which is ~130px wide at `right-6`)
- Active state uses plum background matching the brand
- Shows count when districts are selected during active mode
- Same styling pattern as LayerBubble collapsed state (backdrop-blur, rounded-xl, shadow-lg)

**Step 2: Commit**

```bash
git add src/components/map-v2/SelectModePill.tsx
git commit -m "feat: add SelectModePill toggle component"
```

---

### Task 4: Add SelectModePill to MapV2Shell

**Files:**
- Modify: `src/components/map-v2/MapV2Shell.tsx`

**Step 1: Import and render SelectModePill**

Add import after line 6:

```typescript
import SelectModePill from "./SelectModePill";
```

Add the component inside the shell div, after `<LayerBubble />` (line 34):

```tsx
{/* Multi-select mode toggle */}
<SelectModePill />
```

**Step 2: Commit**

```bash
git add src/components/map-v2/MapV2Shell.tsx
git commit -m "feat: render SelectModePill in map shell"
```

---

### Task 5: Enhance MultiSelectChip with Add-to-Plan dropdown

**Files:**
- Modify: `src/components/map-v2/MultiSelectChip.tsx`

**Step 1: Replace the current component with the enhanced version**

The current `MultiSelectChip` is a simple chip with "Create Plan" button. Replace it with a version that has an "Add to Plan" dropdown listing existing plans.

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";

export default function MultiSelectChip() {
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);
  const createPlanFromSelection = useMapV2Store((s) => s.createPlanFromSelection);
  const toggleMultiSelectMode = useMapV2Store((s) => s.toggleMultiSelectMode);
  const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: plans } = useTerritoryPlans({ enabled: dropdownOpen });
  const addDistricts = useAddDistrictsToPlan();

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (selectedLeaids.size === 0) return null;

  const handleAddToPlan = async (planId: string, planName: string) => {
    const leaids = [...selectedLeaids];
    try {
      const result = await addDistricts.mutateAsync({ planId, leaids });
      setDropdownOpen(false);
      setToast(`Added ${result.added} district${result.added !== 1 ? "s" : ""} to ${planName}`);
      clearSelectedDistricts();
      if (multiSelectMode) toggleMultiSelectMode();
    } catch {
      setToast("Failed to add districts");
    }
  };

  const handleCreateNew = () => {
    setDropdownOpen(false);
    createPlanFromSelection();
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 chip-enter" ref={dropdownRef}>
      {/* Toast */}
      {toast && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2.5 border border-gray-100">
        <span className="text-sm font-medium text-gray-700">
          {selectedLeaids.size} district{selectedLeaids.size !== 1 ? "s" : ""}{" "}
          selected
        </span>

        {/* Add to Plan dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-xl transition-all hover:scale-105
              flex items-center gap-1.5
              ${dropdownOpen
                ? "bg-plum/90 text-white"
                : "bg-plum text-white hover:bg-plum/90"}
            `}
          >
            Add to Plan
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              className={`transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
            >
              <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="max-h-48 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleAddToPlan(plan.id, plan.name)}
                      disabled={addDistricts.isPending}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: plan.color || "#403770" }}
                        />
                        <span className="text-sm text-gray-800 truncate">{plan.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {plan.districtCount} dist.
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">
                    No existing plans
                  </div>
                )}
              </div>

              {/* Divider + Create New */}
              <div className="border-t border-gray-100">
                <button
                  onClick={handleCreateNew}
                  className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-plum">
                    <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-sm font-medium text-plum">Create New Plan</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Clear selection */}
        <button
          onClick={() => {
            clearSelectedDistricts();
            if (multiSelectMode) toggleMultiSelectMode();
          }}
          className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Clear selection"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2L8 8M8 2L2 8"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Key changes from original:**
- "Create Plan" button → "Add to Plan" dropdown
- Dropdown fetches plans via `useTerritoryPlans` (only when open)
- Each plan shows color dot + name + district count
- Bottom option: "+ Create New Plan" (uses existing flow)
- Success toast with auto-dismiss
- Clearing selection also exits multi-select mode
- Outside click closes dropdown

**Step 2: Commit**

```bash
git add src/components/map-v2/MultiSelectChip.tsx
git commit -m "feat: enhance MultiSelectChip with add-to-plan dropdown"
```

---

### Task 6: Add multi-select highlight layer to map

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Add a map layer to highlight all multi-selected districts**

Currently, only the single `selectedLeaid` gets a highlight. We need to visually show all districts in `selectedLeaids`. After the `district-selected` layer setup (around line 369), add a new layer:

```typescript
// Multi-selected districts fill
map.current.addLayer({
  id: "district-multiselect-fill",
  type: "fill",
  source: "districts",
  "source-layer": "districts",
  filter: ["in", ["get", "leaid"], ["literal", [""]]],
  paint: {
    "fill-color": "#403770",
    "fill-opacity": 0.18,
  },
});

// Multi-selected districts outline
map.current.addLayer({
  id: "district-multiselect-outline",
  type: "line",
  source: "districts",
  "source-layer": "districts",
  filter: ["in", ["get", "leaid"], ["literal", [""]]],
  paint: {
    "line-color": "#403770",
    "line-width": 2,
    "line-dasharray": [2, 1],
  },
});
```

**Step 2: Subscribe to `selectedLeaids` and update the filter**

Add a new `useEffect` (after the selected district highlight effect, around line 719):

```typescript
// Subscribe to selectedLeaids for multi-select rendering
const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
```

Add this as a subscriber at the top of the component (around line 128), then add the effect:

```typescript
// Update multi-select highlight
useEffect(() => {
  if (!map.current || !mapReady) return;
  const leaidArray = [...selectedLeaids];
  const filter: any = leaidArray.length > 0
    ? ["in", ["get", "leaid"], ["literal", leaidArray]]
    : ["in", ["get", "leaid"], ["literal", [""]]];
  if (map.current.getLayer("district-multiselect-fill")) {
    map.current.setFilter("district-multiselect-fill", filter);
  }
  if (map.current.getLayer("district-multiselect-outline")) {
    map.current.setFilter("district-multiselect-outline", filter);
  }
}, [selectedLeaids, mapReady]);
```

**Step 3: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: add multi-select district highlight layer"
```

---

### Task 7: Handle Escape key for multi-select mode

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Update the Escape key handler**

In the existing Escape key handler (around line 869-883), add multi-select mode exit. Replace:

```typescript
if (e.key === "Escape") {
  const { panelState, goBack, clearSelection } = useMapV2Store.getState();
  if (panelState !== "BROWSE") {
    goBack();
  } else {
    clearSelection();
    // Zoom back to US
    map.current?.fitBounds(US_BOUNDS, { padding: 50, duration: 600 });
  }
}
```

With:

```typescript
if (e.key === "Escape") {
  const store = useMapV2Store.getState();
  // Exit multi-select mode first
  if (store.multiSelectMode) {
    store.toggleMultiSelectMode();
    return;
  }
  if (store.panelState !== "BROWSE") {
    store.goBack();
  } else {
    store.clearSelection();
    map.current?.fitBounds(US_BOUNDS, { padding: 50, duration: 600 });
  }
}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: escape key exits multi-select mode"
```

---

### Task 8: Visual polish — cursor change in multi-select mode

**Files:**
- Modify: `src/components/map-v2/MapV2Container.tsx`

**Step 1: Add an effect to change the map cursor when multi-select mode is active**

Subscribe to `multiSelectMode` at the top of the component:

```typescript
const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
```

Add an effect:

```typescript
// Change cursor in multi-select mode
useEffect(() => {
  if (!map.current || !mapReady) return;
  if (multiSelectMode) {
    map.current.getCanvas().style.cursor = "crosshair";
  } else {
    map.current.getCanvas().style.cursor = "";
  }
}, [multiSelectMode, mapReady]);
```

**Step 2: Commit**

```bash
git add src/components/map-v2/MapV2Container.tsx
git commit -m "feat: crosshair cursor in multi-select mode"
```

---

### Task 9: Manual smoke test

**Step 1: Run the dev server**

```bash
cd territory-plan && npm run dev
```

**Step 2: Test the following flows**

1. Navigate to `/map-v2`
2. Verify the "Select" pill appears to the left of "Build View"
3. Click "Select" → pill turns plum, cursor becomes crosshair
4. Click several districts → they highlight with dashed plum outline
5. MultiSelectChip shows count + "Add to Plan" button
6. Click "Add to Plan" → dropdown shows existing plans
7. Select a plan → districts are added, toast shows, selection clears, mode exits
8. Re-enter select mode, select districts, click "Create New Plan" → PlanFormPanel opens
9. Press Escape while in select mode → mode exits, selection clears
10. Shift+click still works when NOT in select mode (regression check)
11. Click the X on the MultiSelectChip → clears selection and exits mode

**Step 3: Commit any fixes**
