# Map Explore Selection — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace opt-in multi-select with always-on district selection, adding a dedicated selection list panel where users can explore and add multiple districts to plans.

**Architecture:** Extend the Zustand store's `PanelState` union with `MULTI_DISTRICT`, wire `toggleLeaidSelection` to drive panel transitions, and build a new `SelectionListPanel` component. Map district clicks always call `toggleLeaidSelection`; school clicks remain direct `selectDistrict` calls. The existing `DistrictDetailPanel` gains context-aware back navigation.

**Tech Stack:** React 18, Zustand, React Query (`useDistrictDetail`, `useTerritoryPlans`, `useAddDistrictsToPlan`), TypeScript, Tailwind CSS, Vitest + Testing Library

**Spec:** `Docs/superpowers/specs/2026-03-15-multi-district-selection-panel-design.md`

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/features/map/lib/store.ts` | Add `MULTI_DISTRICT` state, update `toggleLeaidSelection`, `clearSelectedDistricts`, `goBack`, remove `multiSelectMode` |
| Delete | `src/features/map/components/MultiSelectChip.tsx` | Removed — replaced by selection list panel |
| Delete | `src/features/map/components/SelectModePill.tsx` | Removed — multi-select is always on |
| Modify | `src/features/map/components/MapV2Shell.tsx` | Remove `<MultiSelectChip />` and `<SelectModePill />` mount points |
| Modify | `src/features/map/components/FloatingPanel.tsx` | Remove desktop hidden-state recovery button |
| Modify | `src/features/map/components/MapV2Container.tsx` | District click → `toggleLeaidSelection`; update Escape handler; remove `multiSelectMode` cursor effect |
| Modify | `src/features/map/components/PanelContent.tsx` | Add `MULTI_DISTRICT` case |
| Create | `src/features/map/components/panels/SelectionListPanel.tsx` | New selection list panel |
| Modify | `src/features/map/components/panels/district/DistrictDetailPanel.tsx` | Context-aware back arrow label |
| Create | `src/features/map/lib/__tests__/store.multiselect.test.ts` | Store unit tests |
| Create | `src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx` | Component tests |

---

## Chunk 1: Store changes

### Task 1: Add `MULTI_DISTRICT` to PanelState and update store actions

**Files:**
- Modify: `src/features/map/lib/store.ts:15-26` (PanelState union)
- Modify: `src/features/map/lib/store.ts:153` (remove multiSelectMode from state interface)
- Modify: `src/features/map/lib/store.ts:291` (remove toggleMultiSelectMode from actions interface)
- Modify: `src/features/map/lib/store.ts:468` (remove multiSelectMode initial value)
- Modify: `src/features/map/lib/store.ts:566-578` (goBack)
- Modify: `src/features/map/lib/store.ts:618-623` (selectDistrict — nav stack deduplication)
- Modify: `src/features/map/lib/store.ts:710-719` (toggleLeaidSelection)
- Modify: `src/features/map/lib/store.ts:721` (clearSelectedDistricts)
- Modify: `src/features/map/lib/store.ts:730-735` (remove toggleMultiSelectMode implementation)
- Create: `src/features/map/lib/__tests__/store.multiselect.test.ts`

- [ ] **Step 1: Write failing tests for store changes**

Create `src/features/map/lib/__tests__/store.multiselect.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

// Reset store to initial state before each test
beforeEach(() => {
  useMapV2Store.setState({
    selectedLeaids: new Set<string>(),
    panelState: "BROWSE",
    panelHistory: [],
    selectedLeaid: null,
  });
});

describe("toggleLeaidSelection", () => {
  it("adds a leaid to selectedLeaids and switches panelState to MULTI_DISTRICT when BROWSE", () => {
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.has("1234567")).toBe(true);
    expect(s.panelState).toBe("MULTI_DISTRICT");
  });

  it("removes a leaid and returns to BROWSE when the set becomes empty", () => {
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    useMapV2Store.getState().toggleLeaidSelection("1234567");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(0);
    expect(s.panelState).toBe("BROWSE");
  });

  it("stays in MULTI_DISTRICT when removing one of multiple leaids", () => {
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    useMapV2Store.getState().toggleLeaidSelection("bbb");
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("MULTI_DISTRICT");
    expect(s.selectedLeaids.has("bbb")).toBe(true);
  });

  it("enforces a 20-district cap — 21st add is a no-op", () => {
    for (let i = 0; i < 20; i++) {
      useMapV2Store.getState().toggleLeaidSelection(`district-${i}`);
    }
    useMapV2Store.getState().toggleLeaidSelection("district-overflow");
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(20);
    expect(s.selectedLeaids.has("district-overflow")).toBe(false);
  });

  it("does not push MULTI_DISTRICT panelState if already in MULTI_DISTRICT", () => {
    useMapV2Store.getState().toggleLeaidSelection("aaa");
    useMapV2Store.getState().toggleLeaidSelection("bbb");
    const s = useMapV2Store.getState();
    // Should still be MULTI_DISTRICT, not something else
    expect(s.panelState).toBe("MULTI_DISTRICT");
  });
});

describe("clearSelectedDistricts", () => {
  it("clears selectedLeaids and resets panelState to BROWSE", () => {
    useMapV2Store.getState().toggleLeaidSelection("abc");
    expect(useMapV2Store.getState().panelState).toBe("MULTI_DISTRICT");
    useMapV2Store.getState().clearSelectedDistricts();
    const s = useMapV2Store.getState();
    expect(s.selectedLeaids.size).toBe(0);
    expect(s.panelState).toBe("BROWSE");
  });
});

describe("goBack from DISTRICT to MULTI_DISTRICT", () => {
  it("clears selectedLeaid when returning to MULTI_DISTRICT", () => {
    // Simulate: BROWSE → MULTI_DISTRICT (via toggleLeaidSelection) → DISTRICT (via selectDistrict)
    useMapV2Store.getState().toggleLeaidSelection("abc");
    useMapV2Store.getState().selectDistrict("abc"); // pushes MULTI_DISTRICT onto history
    expect(useMapV2Store.getState().selectedLeaid).toBe("abc");
    expect(useMapV2Store.getState().panelState).toBe("DISTRICT");

    useMapV2Store.getState().goBack();
    const s = useMapV2Store.getState();
    expect(s.panelState).toBe("MULTI_DISTRICT");
    expect(s.selectedLeaid).toBeNull();
    // selectedLeaids should still contain the leaid
    expect(s.selectedLeaids.has("abc")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "c:/Users/aston/OneDrive/Desktop/The Laboratory/territory-plan"
npx vitest run src/features/map/lib/__tests__/store.multiselect.test.ts
```

Expected: All tests FAIL (functions don't exist yet or have wrong behavior).

- [ ] **Step 3: Update the store**

In `src/features/map/lib/store.ts`, make the following changes:

**3a. Add `MULTI_DISTRICT` to `PanelState` union (lines 15-26):**
```ts
export type PanelState =
  | "BROWSE"
  | "DISTRICT"
  | "MULTI_DISTRICT"   // ← add this line
  | "STATE"
  | "PLAN_NEW"
  | "PLAN_VIEW"
  | "PLAN_ADD"
  | "PLAN_OVERVIEW"
  | "PLAN_ACTIVITIES"
  | "PLAN_TASKS"
  | "PLAN_CONTACTS"
  | "PLAN_PERF";
```

**3b. Remove `multiSelectMode: boolean` from `MapV2State` interface (line 153):**
Delete the line: `multiSelectMode: boolean;`

**3c. Remove `toggleMultiSelectMode` from `MapV2Actions` interface (line 291):**
Delete the line: `toggleMultiSelectMode: () => void;`

**3d. Remove `multiSelectMode: false` from initial state (line 468):**
Delete the line: `multiSelectMode: false,`

**3e. Update `toggleLeaidSelection` (lines 710-719) — add cap + panel transitions:**
```ts
toggleLeaidSelection: (leaid) =>
  set((s) => {
    const next = new Set(s.selectedLeaids);
    if (next.has(leaid)) {
      next.delete(leaid);
    } else {
      if (next.size >= 20) return s; // hard cap — no-op
      next.add(leaid);
    }
    const panelState =
      next.size === 0 ? "BROWSE"
      : s.panelState === "BROWSE" ? "MULTI_DISTRICT"
      : s.panelState;
    return { selectedLeaids: next, panelState };
  }),
```

**3f. Update `clearSelectedDistricts` (line 721) — also reset panelState:**
```ts
clearSelectedDistricts: () => set({ selectedLeaids: new Set<string>(), panelState: "BROWSE" }),
```

**3g. Delete `toggleMultiSelectMode` implementation (lines 730-735):**
Delete:
```ts
toggleMultiSelectMode: () =>
  set((s) => ({
    multiSelectMode: !s.multiSelectMode,
    ...(!s.multiSelectMode ? {} : { selectedLeaids: new Set<string>() }),
  })),
```

**3h. Update `goBack` (lines 566-578) — clear `selectedLeaid` when returning to `MULTI_DISTRICT`:**
```ts
goBack: () =>
  set((s) => {
    const history = [...s.panelHistory];
    const prev = history.pop() || "BROWSE";
    return {
      panelState: prev,
      panelHistory: history,
      // Clear single-district selection when going back to browse or multi-district list
      ...(prev === "BROWSE" || prev === "MULTI_DISTRICT"
        ? { selectedLeaid: null, selectedStateCode: null }
        : {}),
    };
  }),
```

**3i. Update `selectDistrict` (lines 618-623) — deduplicate `MULTI_DISTRICT` nav stack pushes:**

When the user clicks Explore repeatedly (Explore → Back → Explore → Back), `selectDistrict` would keep pushing `MULTI_DISTRICT` onto `panelHistory`. Deduplicate so only one `MULTI_DISTRICT` entry lives at the top of the stack at any time:

```ts
selectDistrict: (leaid) =>
  set((s) => {
    const topOfHistory = s.panelHistory[s.panelHistory.length - 1];
    const shouldPush = topOfHistory !== s.panelState; // avoid duplicate pushes
    return {
      selectedLeaid: leaid,
      panelState: "DISTRICT",
      panelHistory: shouldPush ? [...s.panelHistory, s.panelState] : s.panelHistory,
    };
  }),
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/features/map/lib/__tests__/store.multiselect.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
npx vitest run
```

Expected: All existing tests still pass. Fix any TypeScript errors referencing `multiSelectMode` or `toggleMultiSelectMode` if they appear (grep first).

- [ ] **Step 6: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/lib/__tests__/store.multiselect.test.ts
git commit -m "feat: add MULTI_DISTRICT panel state, always-on selection logic, 20-district cap"
```

---

## Chunk 2: Remove deprecated UI components

### Task 2: Delete MultiSelectChip and SelectModePill, clean up FloatingPanel

**Files:**
- Delete: `src/features/map/components/MultiSelectChip.tsx`
- Delete: `src/features/map/components/SelectModePill.tsx`
- Modify: `src/features/map/components/MapV2Shell.tsx:6,9,86,89`
- Modify: `src/features/map/components/FloatingPanel.tsx:46-57`

- [ ] **Step 1: Remove MultiSelectChip and SelectModePill from MapV2Shell**

In `src/features/map/components/MapV2Shell.tsx`:

Remove imports (lines 6 and 9):
```ts
// DELETE these two lines:
import MultiSelectChip from "./MultiSelectChip";
import SelectModePill from "./SelectModePill";
```

Remove mount points (lines 85-89):
```tsx
// DELETE these two blocks:
{/* Multi-select action chip */}
<MultiSelectChip />

{/* Multi-select mode toggle */}
<SelectModePill />
```

- [ ] **Step 2: Delete the component files**

```bash
rm "src/features/map/components/MultiSelectChip.tsx"
rm "src/features/map/components/SelectModePill.tsx"
```

- [ ] **Step 3: Remove desktop hidden-state recovery button from FloatingPanel**

In `src/features/map/components/FloatingPanel.tsx`, inside the `{/* Desktop/Tablet */}` div (`hidden sm:block`), replace the conditional:

```tsx
// BEFORE (lines 46-77):
{panelMode === "hidden" ? (
  <button
    onClick={() => setPanelMode("full")}
    className="absolute top-10 left-12 z-10 ..."
    aria-label="Show panel"
  >
    ...Menu button...
  </button>
) : (
  <div className={`absolute top-10 left-12 z-10 ...`}>
    ...panel content...
  </div>
)}

// AFTER — remove the hidden branch entirely, always render the panel:
<div
  className={`
    absolute top-10 left-12 z-10
    bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
    flex flex-row overflow-hidden
    transition-all duration-300 ease-out
    panel-v2-enter
    ${panelWidth} ${hasDistrictDetail ? "bottom-10" : "bottom-[50%]"}
  `}
>
  {/* Icon strip */}
  <IconBar />

  {/* Content area + optional right panel */}
  <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
    <PanelContent />
  </div>
  {isInPlanWorkspace && <RightPanel />}
</div>
```

The mobile hidden-state button (`sm:hidden` section, lines 80-112) is **not changed**.

- [ ] **Step 4: Verify the app builds without errors**

```bash
npx tsc --noEmit
```

Expected: No TypeScript errors. Note: `panelMode` and `setPanelMode` remain in `FloatingPanel` — they are still used by the tablet auto-collapse `useEffect` (line 32) and the mobile bottom-drawer section (lines 80-112). Do not remove them.

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/MapV2Shell.tsx \
        src/features/map/components/FloatingPanel.tsx
git commit -m "feat: remove MultiSelectChip, SelectModePill, and desktop panel collapse button"
```

---

## Chunk 3: MapV2Container click and keyboard changes

### Task 3: Always-on district click selection + updated Escape handler

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx:170` (remove multiSelectMode subscription)
- Modify: `src/features/map/components/MapV2Container.tsx:545-555` (clearHover cursor logic)
- Modify: `src/features/map/components/MapV2Container.tsx:764-771` (district click logic)
- Modify: `src/features/map/components/MapV2Container.tsx:893-901` (remove multiSelectMode cursor effect)
- Modify: `src/features/map/components/MapV2Container.tsx:1237-1257` (Escape handler)

- [ ] **Step 1: Remove `multiSelectMode` subscription (line 170)**

```ts
// DELETE this line:
const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
```

- [ ] **Step 2: Remove all `multiSelectMode` cursor references**

There are five locations total — all must be updated:

**2a. `clearHover` (lines 552-553):**
```ts
// BEFORE:
const isMultiSelect = useMapV2Store.getState().multiSelectMode;
map.current.getCanvas().style.cursor = isMultiSelect ? "crosshair" : "";

// AFTER:
map.current.getCanvas().style.cursor = "";
```

**2b. District hover branch (line 632):**
```ts
// BEFORE:
map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";

// AFTER:
map.current.getCanvas().style.cursor = "pointer";
```

**2c. School hover branch (line 680):**
```ts
// BEFORE:
map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";

// AFTER:
map.current.getCanvas().style.cursor = "pointer";
```

**2d. State hover branch (line 702):**
```ts
// BEFORE:
map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";

// AFTER:
map.current.getCanvas().style.cursor = "pointer";
```

Note: `clearHover` has two statements at lines 552-553 — both are covered by 2a above.

- [ ] **Step 3: Update district click handler (lines 764-771)**

```ts
// BEFORE:
// Multi-select mode or Shift+click toggles selection
if (store.multiSelectMode || e.originalEvent.shiftKey) {
  store.toggleLeaidSelection(leaid);
  return;
}

// Regular click selects district
store.selectDistrict(leaid);

// AFTER — always toggle selection for district clicks:
store.toggleLeaidSelection(leaid);
```

The `PLAN_ADD` block immediately above (lines 759-762) and the zoom-to-district logic below stay unchanged. School clicks (lines 732-739) also stay unchanged — they still call `store.selectDistrict(leaid)`.

- [ ] **Step 4: Remove multiSelectMode cursor effect (lines 893-901)**

```ts
// DELETE this entire useEffect:
useEffect(() => {
  if (!map.current || !mapReady) return;
  if (multiSelectMode) {
    map.current.getCanvas().style.cursor = "crosshair";
  } else {
    map.current.getCanvas().style.cursor = "";
  }
}, [multiSelectMode, mapReady]);
```

- [ ] **Step 5: Update Escape handler (lines 1237-1257)**

```ts
// BEFORE:
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

// AFTER:
if (e.key === "Escape") {
  const store = useMapV2Store.getState();
  // Clear selection if in multi-district list
  if (store.panelState === "MULTI_DISTRICT") {
    store.clearSelectedDistricts();
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

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If any remaining `multiSelectMode` references appear, remove them.

- [ ] **Step 7: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "feat: district clicks always toggle selection, update Escape handler for MULTI_DISTRICT"
```

---

## Chunk 4: SelectionListPanel component

### Task 4: Build the SelectionListPanel

**Files:**
- Create: `src/features/map/components/panels/SelectionListPanel.tsx`
- Create: `src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectionListPanel from "../SelectionListPanel";
import { useMapV2Store } from "@/features/map/lib/store";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  useDistrictDetail: (leaid: string | null) => ({
    data: leaid
      ? {
          district: {
            leaid,
            name: `District ${leaid}`,
            stateAbbrev: "MN",
            enrollment: 1000,
          },
          contacts: [],
          fullmindData: null,
          tags: [],
          trends: null,
        }
      : undefined,
    isLoading: false,
  }),
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Capture store actions for assertion
const mockClearSelectedDistricts = vi.fn();
const mockToggleLeaidSelection = vi.fn();
const mockSelectDistrict = vi.fn();

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: vi.fn(),
}));

function setupStore(leaids: string[]) {
  (useMapV2Store as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        selectedLeaids: new Set(leaids),
        clearSelectedDistricts: mockClearSelectedDistricts,
        toggleLeaidSelection: mockToggleLeaidSelection,
        selectDistrict: mockSelectDistrict,
      })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SelectionListPanel", () => {
  it("renders district count in header", () => {
    setupStore(["aaa", "bbb"]);
    render(<SelectionListPanel />);
    expect(screen.getByText(/2 Districts Selected/i)).toBeInTheDocument();
  });

  it("renders a row for each selected leaid", () => {
    setupStore(["aaa", "bbb", "ccc"]);
    render(<SelectionListPanel />);
    expect(screen.getByText("District aaa")).toBeInTheDocument();
    expect(screen.getByText("District bbb")).toBeInTheDocument();
    expect(screen.getByText("District ccc")).toBeInTheDocument();
  });

  it("calls clearSelectedDistricts when Clear all is clicked", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(mockClearSelectedDistricts).toHaveBeenCalledOnce();
  });

  it("calls toggleLeaidSelection with leaid when checkbox row is clicked", () => {
    setupStore(["aaa", "bbb"]);
    render(<SelectionListPanel />);
    // Each row has a deselect button (the checkbox area)
    const deselect = screen.getAllByRole("button", { name: /deselect/i });
    fireEvent.click(deselect[0]);
    expect(mockToggleLeaidSelection).toHaveBeenCalledWith(expect.any(String));
  });

  it("calls selectDistrict with leaid when Explore is clicked", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    fireEvent.click(screen.getByRole("button", { name: /explore district aaa/i }));
    expect(mockSelectDistrict).toHaveBeenCalledWith("aaa");
  });

  it("shows singular 'District Selected' for count of 1", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    expect(screen.getByText(/1 District Selected/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx
```

Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Create SelectionListPanel**

Create `src/features/map/components/panels/SelectionListPanel.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useDistrictDetail, useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";

// ─── Per-row component ────────────────────────────────────────────────────────

function DistrictSelectionRow({ leaid }: { leaid: string }) {
  const toggleLeaidSelection = useMapV2Store((s) => s.toggleLeaidSelection);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const { data, isLoading } = useDistrictDetail(leaid);
  const district = data?.district;

  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: plans } = useTerritoryPlans({ enabled: planDropdownOpen });
  const addDistricts = useAddDistrictsToPlan();

  // Close plan dropdown on outside click
  useEffect(() => {
    if (!planDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPlanDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [planDropdownOpen]);

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: [leaid] }); // array, not string
      setPlanDropdownOpen(false);
    } catch {
      // silent — user can retry
    }
  };

  if (isLoading || !district) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        {/* Loading skeleton */}
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse" />
          <div className="h-2.5 bg-gray-100 rounded w-1/3 animate-pulse" />
        </div>
      </div>
    );
  }

  const districtName = district.name ?? `District ${leaid}`;
  const meta = [district.stateAbbrev, district.enrollment ? `${district.enrollment.toLocaleString()} students` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50 last:border-0 group">
      {/* Deselect checkbox */}
      <button
        onClick={() => toggleLeaidSelection(leaid)}
        aria-label={`Deselect ${districtName}`}
        className="w-4 h-4 rounded bg-plum flex items-center justify-center flex-shrink-0 hover:bg-plum/80 transition-colors"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* District info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-900 truncate">{districtName}</div>
        {meta && <div className="text-[10px] text-gray-400 mt-0.5">{meta}</div>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* + Plan dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setPlanDropdownOpen((v) => !v)}
            className="text-[10px] font-semibold bg-plum text-white rounded-md px-2 py-1 hover:bg-plum/90 transition-colors"
          >
            + Plan
          </button>

          {planDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="max-h-40 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleAddToPlan(plan.id)}
                      disabled={addDistricts.isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: plan.color || "#403770" }}
                      />
                      <span className="text-xs text-gray-800 truncate">{plan.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">No plans yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Explore button */}
        <button
          onClick={() => selectDistrict(leaid)}
          aria-label={`Explore ${districtName}`}
          className="text-[10px] font-semibold border border-plum text-plum rounded-md px-2 py-1 hover:bg-plum/5 transition-colors"
        >
          Explore
        </button>
      </div>
    </div>
  );
}

// ─── Bulk Add All dropdown ────────────────────────────────────────────────────

function BulkAddBar({ leaids }: { leaids: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: plans } = useTerritoryPlans({ enabled: open });
  const addDistricts = useAddDistrictsToPlan();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAddAll = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids });
      setOpen(false);
    } catch {
      // silent
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f6ff] border-b border-[#ede9fb]" ref={ref}>
      <span className="text-[11px] text-[#5a4e8a] flex-1">
        Add all {leaids.length} to a plan
      </span>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-semibold bg-plum text-white rounded-md px-3 py-1.5 hover:bg-plum/90 transition-colors flex items-center gap-1"
        >
          + Add All
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="max-h-48 overflow-y-auto">
              {plans && plans.length > 0 ? (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleAddAll(plan.id)}
                    disabled={addDistricts.isPending}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: plan.color || "#403770" }}
                    />
                    <span className="text-sm text-gray-800 truncate">{plan.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No plans yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SelectionListPanel() {
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const clearSelectedDistricts = useMapV2Store((s) => s.clearSelectedDistricts);

  // Sort by leaid for stable order while names load; each row displays its own name once fetched
  const leaids = [...selectedLeaids].sort();
  const count = leaids.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <div className="text-sm font-bold text-gray-900">
            {count} {count === 1 ? "District" : "Districts"} Selected
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Click map to add more</div>
        </div>
        <button
          onClick={clearSelectedDistricts}
          aria-label="Clear all"
          className="text-[11px] font-semibold text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Bulk add bar */}
      {count > 0 && <BulkAddBar leaids={leaids} />}

      {/* District list */}
      <div className="flex-1 overflow-y-auto">
        {leaids.map((leaid) => (
          <DistrictSelectionRow key={leaid} leaid={leaid} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/map/components/panels/SelectionListPanel.tsx \
        src/features/map/components/panels/__tests__/SelectionListPanel.test.tsx
git commit -m "feat: add SelectionListPanel with per-row Explore and Add to Plan actions"
```

---

## Chunk 5: Wire panel routing and update DistrictDetailPanel

### Task 5: Add MULTI_DISTRICT to PanelContent, update back arrow in DistrictDetailPanel

**Files:**
- Modify: `src/features/map/components/PanelContent.tsx`
- Modify: `src/features/map/components/panels/district/DistrictDetailPanel.tsx:30-48`

- [ ] **Step 1: Add MULTI_DISTRICT case to PanelContent**

In `src/features/map/components/PanelContent.tsx`, add the import and new case:

```tsx
// Add import after existing panel imports:
import SelectionListPanel from "./panels/SelectionListPanel";

// Add this line before the DISTRICT case (line 31):
if (panelState === "MULTI_DISTRICT") return <PanelContentWrapper><SelectionListPanel /></PanelContentWrapper>;
```

Result — the relevant section should look like:
```tsx
if (panelState === "PLAN_ADD") return <PanelContentWrapper><PlanAddPanel /></PanelContentWrapper>;
if (panelState === "MULTI_DISTRICT") return <PanelContentWrapper><SelectionListPanel /></PanelContentWrapper>;
if (panelState === "DISTRICT") return <PanelContentWrapper><DistrictDetailPanel /></PanelContentWrapper>;
```

- [ ] **Step 2: Update back arrow label in DistrictDetailPanel**

In `src/features/map/components/panels/district/DistrictDetailPanel.tsx`, read `panelHistory` to detect if the origin was `MULTI_DISTRICT`:

```tsx
// Add to store reads at top of component (after existing reads):
const panelHistory = useMapV2Store((s) => s.panelHistory);
const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);

// Derive context-aware label:
const backOrigin = panelHistory[panelHistory.length - 1];
const backLabel = backOrigin === "MULTI_DISTRICT"
  ? `← Back to ${selectedLeaids.size} selected`
  : "DISTRICT";
```

Then replace the static label in the header (line 46):
```tsx
// BEFORE:
<span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
  District
</span>

// AFTER:
<span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
  {backLabel}
</span>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/PanelContent.tsx \
        src/features/map/components/panels/district/DistrictDetailPanel.tsx
git commit -m "feat: wire MULTI_DISTRICT panel state, context-aware back arrow in DistrictDetailPanel"
```

---

## Final verification

- [ ] **Run full test suite one last time**

```bash
npx vitest run
```

Expected: All tests pass, no regressions.

- [ ] **TypeScript final check**

```bash
npx tsc --noEmit
```

Expected: Clean.

- [ ] **Manual smoke test checklist**
  - [ ] Click a district on the map → panel switches to "1 District Selected"
  - [ ] Click a second district → panel shows "2 Districts Selected", both listed
  - [ ] Re-click a selected district → it deselects; panel updates count
  - [ ] Click "Explore" on a district → DistrictDetailPanel opens with "← Back to N selected"
  - [ ] Click back arrow → returns to selection list with selection intact
  - [ ] Click "+ Plan" on a row → plan dropdown opens for that district only
  - [ ] Click "+ Add All" → plan dropdown opens for all selected districts
  - [ ] Click "Clear all" → selection cleared, panel returns to Browse
  - [ ] Press Escape while in selection list → selection cleared, panel returns to Browse
  - [ ] Click a school marker → navigates directly to DistrictDetailPanel (unchanged)
  - [ ] No MultiSelectChip floating bar visible
  - [ ] No SelectModePill toggle visible
  - [ ] Panel cannot be collapsed (no `<` button on desktop)
  - [ ] 21st district click is ignored (cap enforced)
