# Focus Mode District Target Popover — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When in Focus Mode, clicking a district on the map opens a popover to set renewal, winback, expansion, and new biz targets with contextual spending reference data.

**Architecture:** Add `focusPopover` state to the Zustand store, intercept clicks in Focus Mode before existing handling, render two new popover components (`FocusModeTargetPopover` and `FocusModeAddPopover`) as absolute-positioned overlays inside the map container. Reuse existing `useUpdateDistrictTargets` mutation and `addDistrictToPlan` store action.

**Tech Stack:** React, Zustand, MapLibre GL, Tailwind CSS, React Query (TanStack Query)

**Design Doc:** `Docs/plans/2026-03-09-focus-mode-target-popover-design.md`

---

### Task 1: Add `focusPopover` state to the Zustand store

**Files:**
- Modify: `src/features/map/lib/store.ts:237-239` (state interface, near `focusPlanId`)
- Modify: `src/features/map/lib/store.ts:396-399` (action interface, near `focusPlan`)
- Modify: `src/features/map/lib/store.ts:554-557` (initial state, near `focusPlanId: null`)
- Modify: `src/features/map/lib/store.ts:1143+` (action implementations, near `focusPlan`)

**Step 1: Add the state type and action signatures**

In the state interface (around line 237, after `focusLeaids`), add:

```typescript
  focusPopover: {
    type: "targets" | "add-to-plan";
    leaid: string;
    x: number;
    y: number;
  } | null;
```

In the actions interface (around line 396, after `unfocusPlan`), add:

```typescript
  openFocusPopover: (type: "targets" | "add-to-plan", leaid: string, x: number, y: number) => void;
  closeFocusPopover: () => void;
```

**Step 2: Add initial state and action implementations**

In the initial state (around line 554, after `focusLeaids: []`), add:

```typescript
  focusPopover: null,
```

After the `unfocusPlan` action implementation (around line 1178), add:

```typescript
  openFocusPopover: (type, leaid, x, y) =>
    set(() => ({
      focusPopover: { type, leaid, x, y },
    })),

  closeFocusPopover: () =>
    set(() => ({
      focusPopover: null,
    })),
```

Also update `unfocusPlan` to close any open popover by adding `focusPopover: null` to its set() call.

**Step 3: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | head -20` or `npx tsc --noEmit`
Expected: No type errors related to `focusPopover`

**Step 4: Commit**

```bash
git add src/features/map/lib/store.ts
git commit -m "feat: add focusPopover state to map store"
```

---

### Task 2: Intercept clicks in Focus Mode

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx:749-797` (inside `handleClick`, after the district feature check)

**Step 1: Add Focus Mode branch to handleClick**

In `MapV2Container.tsx`, inside the `handleClick` callback, after the `if (!leaid) return;` guard (line 751) and the `store.addClickRipple(e.point.x, e.point.y, "plum");` line (756), add a new branch BEFORE the `PLAN_ADD` check (line 758):

```typescript
        // Focus Mode — open target popover instead of normal selection
        if (store.focusPlanId) {
          const isInPlan = store.focusLeaids.includes(leaid);
          store.openFocusPopover(
            isInPlan ? "targets" : "add-to-plan",
            leaid,
            e.point.x,
            e.point.y
          );
          return;
        }
```

This goes right after the ripple and before the `PLAN_ADD` mode check. The `return` ensures we skip normal select/zoom behavior.

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "feat: intercept district clicks in Focus Mode for popover"
```

---

### Task 3: Create the `FocusModeAddPopover` component

**Files:**
- Create: `src/features/map/components/FocusModeAddPopover.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";

interface FocusModeAddPopoverProps {
  leaid: string;
  districtName: string;
  enrollment: number | null;
  x: number;
  y: number;
  containerRect: DOMRect;
  onAdd: () => void;
  onClose: () => void;
}

const POPOVER_WIDTH = 240;
const POPOVER_HEIGHT_EST = 120;

export default function FocusModeAddPopover({
  leaid,
  districtName,
  enrollment,
  x,
  y,
  containerRect,
  onAdd,
  onClose,
}: FocusModeAddPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Edge detection: flip position if too close to edges
  const flipX = x + POPOVER_WIDTH > containerRect.width;
  const flipY = y + POPOVER_HEIGHT_EST > containerRect.height;

  const style: React.CSSProperties = {
    position: "absolute",
    left: flipX ? x - POPOVER_WIDTH - 8 : x + 8,
    top: flipY ? y - POPOVER_HEIGHT_EST - 8 : y + 8,
    width: POPOVER_WIDTH,
    zIndex: 50,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#403770] truncate">{districtName}</p>
          {enrollment != null && (
            <p className="text-xs text-gray-500 mt-0.5">
              {enrollment.toLocaleString()} students
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-500 mb-2">
          This district isn&apos;t in your plan yet.
        </p>
        <button
          onClick={onAdd}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
        >
          Add to Plan
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/features/map/components/FocusModeAddPopover.tsx
git commit -m "feat: add FocusModeAddPopover component"
```

---

### Task 4: Create the `FocusModeTargetPopover` component

**Files:**
- Create: `src/features/map/components/FocusModeTargetPopover.tsx`

This is the larger component with 4 accordion sections, reference data, and currency inputs.

**Step 1: Create the component**

Key implementation details:
- Uses `useUpdateDistrictTargets` from `@/features/plans/lib/queries` for saving
- Uses `formatCurrency` from `@/features/shared/lib/format` for reference data display
- Inline `parseCurrency` helper (same as `DistrictTargetEditor.tsx:34-39`) for input parsing
- Fetches competitor spend from `/api/districts/[leaid]/competitor-spend`
- Reads Fullmind revenue from tile properties via `map.queryRenderedFeatures` (passed as props)
- Auto-expands one accordion based on `fullmind_category` tile property

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface CompetitorSpendEntry {
  competitor: string;
  fiscalYear: string;
  totalSpend: number;
  color: string;
}

interface FocusModeTargetPopoverProps {
  planId: string;
  leaid: string;
  districtName: string;
  x: number;
  y: number;
  containerRect: DOMRect;
  /** fullmind_category from tile properties — determines which accordion auto-expands */
  fullmindCategory: string | null;
  /** Fullmind FY25 revenue from tile properties */
  fy25Revenue: number | null;
  /** Fullmind FY26 revenue from tile properties */
  fy26Revenue: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT_EST = 400;

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

type AccordionKey = "renewal" | "winback" | "expansion" | "newBiz";

function categoryToAccordion(category: string | null): AccordionKey {
  switch (category) {
    case "renewal_pipeline":
    case "multi_year":
      return "renewal";
    case "winback_pipeline":
    case "lapsed":
      return "winback";
    case "expansion_pipeline":
      return "expansion";
    default:
      return "newBiz";
  }
}

const SECTIONS: { key: AccordionKey; label: string; description: string }[] = [
  { key: "renewal", label: "Renewal", description: "Expected renewal revenue from existing services" },
  { key: "winback", label: "Winback", description: "Revenue from winning back lapsed business" },
  { key: "expansion", label: "Expansion", description: "Revenue from expanding existing relationships" },
  { key: "newBiz", label: "New Business", description: "Revenue from new customer acquisition" },
];

export default function FocusModeTargetPopover({
  planId,
  leaid,
  districtName,
  x,
  y,
  containerRect,
  fullmindCategory,
  fy25Revenue,
  fy26Revenue,
  onClose,
  onSaved,
}: FocusModeTargetPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<AccordionKey>(categoryToAccordion(fullmindCategory));
  const [values, setValues] = useState<Record<AccordionKey, string>>({
    renewal: "",
    winback: "",
    expansion: "",
    newBiz: "",
  });
  const [competitorSpend, setCompetitorSpend] = useState<CompetitorSpendEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateTargets = useUpdateDistrictTargets();

  // Fetch competitor spend on mount
  useEffect(() => {
    fetch(`/api/districts/${leaid}/competitor-spend`)
      .then((r) => r.json())
      .then((data) => {
        if (data.competitorSpend) setCompetitorSpend(data.competitorSpend);
      })
      .catch(() => {}); // silently fail — reference data is optional
  }, [leaid]);

  // Click outside to close
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setError(null);
    try {
      await updateTargets.mutateAsync({
        planId,
        leaid,
        renewalTarget: parseCurrency(values.renewal),
        winbackTarget: parseCurrency(values.winback),
        expansionTarget: parseCurrency(values.expansion),
        newBusinessTarget: parseCurrency(values.newBiz),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets");
    }
  };

  // Edge detection
  const flipX = x + POPOVER_WIDTH > containerRect.width;
  const flipY = y + POPOVER_HEIGHT_EST > containerRect.height;

  const style: React.CSSProperties = {
    position: "absolute",
    left: flipX ? x - POPOVER_WIDTH - 8 : x + 8,
    top: flipY ? y - POPOVER_HEIGHT_EST - 8 : y + 8,
    width: POPOVER_WIDTH,
    zIndex: 50,
  };

  function renderReference(key: AccordionKey): React.ReactNode {
    switch (key) {
      case "renewal":
        return fy25Revenue != null && fy25Revenue > 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            FY25 Fullmind Revenue: <span className="font-medium text-gray-700">{formatCurrency(fy25Revenue, true)}</span>
          </p>
        ) : null;
      case "winback":
        return fy25Revenue != null && fy25Revenue > 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            Last Fullmind Revenue: <span className="font-medium text-gray-700">{formatCurrency(fy25Revenue, true)}</span>
          </p>
        ) : null;
      case "expansion":
        return fy26Revenue != null && fy26Revenue > 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            Current FY26 Revenue: <span className="font-medium text-gray-700">{formatCurrency(fy26Revenue, true)}</span>
          </p>
        ) : null;
      case "newBiz": {
        // Show latest FY competitor spend, grouped by competitor
        const latestByCompetitor = new Map<string, CompetitorSpendEntry>();
        for (const entry of competitorSpend) {
          if (!latestByCompetitor.has(entry.competitor)) {
            latestByCompetitor.set(entry.competitor, entry);
          }
        }
        const entries = Array.from(latestByCompetitor.values());
        return entries.length > 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            {entries.map((e, i) => (
              <span key={e.competitor}>
                {i > 0 && " · "}
                {e.competitor}: <span className="font-medium text-gray-700">{formatCurrency(e.totalSpend, true)}</span>
              </span>
            ))}
          </p>
        ) : null;
      }
    }
  }

  return (
    <div
      ref={ref}
      style={style}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#403770] truncate">{districtName}</p>
        <button
          onClick={onClose}
          className="ml-2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Accordion body */}
      <div className="max-h-[50vh] overflow-y-auto">
        {SECTIONS.map(({ key, label, description }) => {
          const isExpanded = expanded === key;
          return (
            <div key={key} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? expanded : key)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800">{label}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3">
                  {renderReference(key)}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="text"
                      value={values[key]}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}
        <button
          onClick={handleSave}
          disabled={updateTargets.isPending}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateTargets.isPending ? "Saving..." : "Save Targets"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/features/map/components/FocusModeTargetPopover.tsx
git commit -m "feat: add FocusModeTargetPopover component with accordion and reference data"
```

---

### Task 5: Wire popovers into MapV2Shell

**Files:**
- Modify: `src/features/map/components/MapV2Shell.tsx` (render the popovers conditionally)
- Modify: `src/features/map/components/MapV2Container.tsx` (expose container ref for positioning)

The popovers need to be rendered inside the map container's parent so they can be absolutely positioned relative to the map. `MapV2Shell.tsx` is the right place since it already wraps `MapV2Container`.

**Step 1: Add popover rendering to MapV2Shell**

In `MapV2Shell.tsx`, import the popover components and the store:

```tsx
import FocusModeTargetPopover from "./FocusModeTargetPopover";
import FocusModeAddPopover from "./FocusModeAddPopover";
```

Subscribe to the relevant store state:

```tsx
const focusPopover = useMapV2Store((s) => s.focusPopover);
const focusPlanId = useMapV2Store((s) => s.focusPlanId);
```

Add a ref to the map container wrapper div for `containerRect`:

```tsx
const mapContainerRef = useRef<HTMLDivElement>(null);
```

Inside the JSX, after the `MapV2Container` render and before the floating panel overlay, add the popover rendering:

```tsx
{focusPopover && mapContainerRef.current && (() => {
  const rect = mapContainerRef.current!.getBoundingClientRect();
  const store = useMapV2Store.getState();

  if (focusPopover.type === "add-to-plan") {
    // Query the map for district info from tile properties
    const mapInstance = mapV2Ref();
    const features = mapInstance?.queryRenderedFeatures(undefined, {
      layers: ["district-base-fill"],
      filter: ["==", ["get", "leaid"], focusPopover.leaid],
    });
    const props = features?.[0]?.properties ?? {};

    return (
      <FocusModeAddPopover
        leaid={focusPopover.leaid}
        districtName={props.name || focusPopover.leaid}
        enrollment={props.enrollment ?? null}
        x={focusPopover.x}
        y={focusPopover.y}
        containerRect={rect}
        onAdd={() => {
          store.addDistrictToPlan(focusPopover.leaid);
          // Swap to targets popover
          store.openFocusPopover("targets", focusPopover.leaid, focusPopover.x, focusPopover.y);
        }}
        onClose={() => store.closeFocusPopover()}
      />
    );
  }

  if (focusPopover.type === "targets" && focusPlanId) {
    const mapInstance = mapV2Ref();
    const features = mapInstance?.queryRenderedFeatures(undefined, {
      layers: ["district-base-fill"],
      filter: ["==", ["get", "leaid"], focusPopover.leaid],
    });
    const props = features?.[0]?.properties ?? {};

    return (
      <FocusModeTargetPopover
        planId={focusPlanId}
        leaid={focusPopover.leaid}
        districtName={props.name || focusPopover.leaid}
        x={focusPopover.x}
        y={focusPopover.y}
        containerRect={rect}
        fullmindCategory={props.fullmind_category ?? null}
        fy25Revenue={props.fy25_sessions_revenue != null ? Number(props.fy25_sessions_revenue) : null}
        fy26Revenue={props.fy26_sessions_revenue != null ? Number(props.fy26_sessions_revenue) : null}
        onClose={() => store.closeFocusPopover()}
        onSaved={() => store.closeFocusPopover()}
      />
    );
  }

  return null;
})()}
```

Wrap the map container div with the ref:

```tsx
<div ref={mapContainerRef} className="relative w-full h-full overflow-hidden bg-[#F8F7F4]">
```

**Important:** Check the actual tile property names. The schema fields are `fy25SessionsRevenue` but tile properties use snake_case like `fy25_sessions_revenue`. Verify by checking the tile server or `layers.ts` for property name conventions.

**Step 2: Import `mapV2Ref`**

```tsx
import { mapV2Ref } from "@/features/map/lib/ref";
```

**Step 3: Verify the app compiles and renders**

Run: `npx tsc --noEmit`
Then test manually: enter Focus Mode on a plan, click a district, verify popover appears.

**Step 4: Commit**

```bash
git add src/features/map/components/MapV2Shell.tsx
git commit -m "feat: wire focus mode popovers into MapV2Shell"
```

---

### Task 6: Manual integration testing

**No files to modify.** This is a verification task.

**Step 1: Test in-plan district click**

1. Navigate to a plan with districts
2. Enter Focus Mode
3. Click a district that IS in the plan
4. Verify: target popover appears near click point
5. Verify: correct accordion is auto-expanded based on district category
6. Verify: reference spending data shows (if available)
7. Enter a value, click Save
8. Verify: popover closes, no errors in console
9. Verify: target persisted (check via existing plan detail page or API)

**Step 2: Test out-of-plan district click**

1. While still in Focus Mode, click a district NOT in the plan
2. Verify: "Add to Plan?" popover appears
3. Click "Add to Plan"
4. Verify: popover swaps to target-setting popover
5. Set targets and save
6. Verify: district now in plan with targets set

**Step 3: Test dismissal**

1. Open popover, press Escape → should close
2. Open popover, click outside → should close
3. Open popover, click X → should close
4. All three should discard unsaved changes

**Step 4: Test edge positioning**

1. Click a district near the right edge of the map → popover should flip left
2. Click a district near the bottom edge → popover should flip up

**Step 5: Test Focus Mode exit**

1. Open a popover, then exit Focus Mode
2. Verify: popover closes (unfocusPlan sets `focusPopover: null`)

---

### Task 7: Write tests for store actions

**Files:**
- Create or modify: `src/features/map/lib/__tests__/store.test.ts` (add tests for focusPopover actions)

**Step 1: Write the tests**

```typescript
import { useMapV2Store } from "../store";

describe("focusPopover actions", () => {
  beforeEach(() => {
    useMapV2Store.setState(useMapV2Store.getInitialState());
  });

  it("openFocusPopover sets the popover state", () => {
    useMapV2Store.getState().openFocusPopover("targets", "1234567", 100, 200);
    const state = useMapV2Store.getState();
    expect(state.focusPopover).toEqual({
      type: "targets",
      leaid: "1234567",
      x: 100,
      y: 200,
    });
  });

  it("openFocusPopover with add-to-plan type", () => {
    useMapV2Store.getState().openFocusPopover("add-to-plan", "7654321", 300, 400);
    const state = useMapV2Store.getState();
    expect(state.focusPopover).toEqual({
      type: "add-to-plan",
      leaid: "7654321",
      x: 300,
      y: 400,
    });
  });

  it("closeFocusPopover clears the popover state", () => {
    useMapV2Store.getState().openFocusPopover("targets", "1234567", 100, 200);
    useMapV2Store.getState().closeFocusPopover();
    expect(useMapV2Store.getState().focusPopover).toBeNull();
  });

  it("unfocusPlan clears the popover state", () => {
    useMapV2Store.getState().openFocusPopover("targets", "1234567", 100, 200);
    useMapV2Store.getState().unfocusPlan();
    expect(useMapV2Store.getState().focusPopover).toBeNull();
  });
});
```

**Step 2: Run tests**

Run: `npx jest src/features/map/lib/__tests__/store.test.ts --verbose`
Expected: All 4 tests pass

**Step 3: Commit**

```bash
git add src/features/map/lib/__tests__/store.test.ts
git commit -m "test: add tests for focusPopover store actions"
```
