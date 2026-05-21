# Views Map — Plan Scoping, Highlight & Add-from-Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Views feature's Map tab, highlight the active plan's districts over the full map, frame the plan's territory on open, and let reps select districts on the map and add them to the plan in one commit.

**Architecture:** A new isolated set of flat fields on the global map store (`useMapV2Store`) carries the Views→map binding (active plan id + an in-plan highlight set + a pending-selection set). The embedded `MapV2Container` paints two highlight layer pairs from those sets (plum = in-plan, coral = pending), branches its district click handler to toggle the pending set when a Views plan is active, and frames the territory with a camera-only `fitBounds`. A Views-native `PlanMapSelectionBar` commits the pending set via the existing bulk-add mutation and invalidates the Views queries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand (`useMapV2Store`), MapLibre GL, TanStack Query, Tailwind 4, Vitest + Testing Library.

**Working directory:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`

**Reference spec:** `Docs/superpowers/specs/2026-05-21-views-map-plan-scoping-design.md`

---

## File Inventory

**Create:**
- `src/features/map/lib/views-plan-bounds.ts` — pure leaids→bbox helper
- `src/features/map/lib/__tests__/views-plan-bounds.test.ts`
- `src/features/map/lib/__tests__/views-plan-store.test.ts`
- `src/features/map/lib/__tests__/views-plan-layers.test.ts`
- `src/features/views/components/views/PlanMapSelectionBar.tsx`
- `src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`

**Modify:**
- `src/features/map/lib/store.ts` — add 3 fields + 5 actions
- `src/features/map/lib/layers.ts` — 4 highlight layer configs + `viewsPlanLeaidFilter`
- `src/features/map/components/MapV2Container.tsx` — register layers, reactive `setFilter` + `fitBounds`, click-handler branch
- `src/features/views/components/views/MapViewContainer.tsx` — `planId` prop, mount/cleanup effect, render the bar, drop the plan-case banner
- `src/features/views/components/GroupCanvas.tsx` — pass `planId` to `MapViewContainer`

---

## Task 1: Pure bbox helper — `boundsForLeaids`

**Files:**
- Create: `src/features/map/lib/views-plan-bounds.ts`
- Create: `src/features/map/lib/__tests__/views-plan-bounds.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/map/lib/__tests__/views-plan-bounds.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { boundsForLeaids } from "../views-plan-bounds";

// Minimal STATE_BBOX stand-in: CA (FIPS 06) and NY (FIPS 36).
const BBOX = {
  CA: [[-124.4, 32.5], [-114.1, 42.0]] as [[number, number], [number, number]],
  NY: [[-79.8, 40.5], [-71.9, 45.0]] as [[number, number], [number, number]],
};

describe("boundsForLeaids", () => {
  it("returns null for an empty leaid list", () => {
    expect(boundsForLeaids([], BBOX)).toBeNull();
  });

  it("returns the single state's bbox for one state", () => {
    // 0601234 → FIPS 06 → CA
    expect(boundsForLeaids(["0601234", "0699999"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-114.1, 42.0],
    ]);
  });

  it("unions bboxes across multiple states", () => {
    // CA (06) + NY (36)
    expect(boundsForLeaids(["0601234", "3600001"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-71.9, 45.0],
    ]);
  });

  it("ignores leaids whose FIPS has no bbox entry", () => {
    // 7800000 → FIPS 78 (VI) not in BBOX → ignored, falls back to CA only
    expect(boundsForLeaids(["0601234", "7800000"], BBOX)).toEqual([
      [-124.4, 32.5],
      [-114.1, 42.0],
    ]);
  });

  it("returns null when no leaid maps to a known bbox", () => {
    expect(boundsForLeaids(["7800000"], BBOX)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-bounds.test.ts`
Expected: FAIL — `Cannot find module '../views-plan-bounds'`.

- [ ] **Step 3: Implement the helper**

Create `src/features/map/lib/views-plan-bounds.ts`:

```typescript
import { fipsToAbbrev } from "@/lib/states";

export type Bbox = [[number, number], [number, number]];

/**
 * Compute a camera bounding box covering the territory of a set of district
 * leaids, by deriving each district's state (first 2 chars = NCES/Census FIPS)
 * and unioning the per-state bounding boxes. The `stateBbox` map is injected by
 * the caller (MapV2Container owns the canonical `STATE_BBOX`) so this module
 * stays free of the heavy map component. Returns null when no leaid resolves to
 * a known state bbox — the caller should fall back to the default US bounds.
 */
export function boundsForLeaids(
  leaids: string[],
  stateBbox: Record<string, Bbox>,
): Bbox | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  const seen = new Set<string>();
  for (const leaid of leaids) {
    if (typeof leaid !== "string" || leaid.length < 2) continue;
    const abbrev = fipsToAbbrev(leaid.slice(0, 2));
    if (!abbrev || seen.has(abbrev)) continue;
    seen.add(abbrev);
    const bbox = stateBbox[abbrev];
    if (!bbox) continue;
    found = true;
    if (bbox[0][0] < minLng) minLng = bbox[0][0];
    if (bbox[0][1] < minLat) minLat = bbox[0][1];
    if (bbox[1][0] > maxLng) maxLng = bbox[1][0];
    if (bbox[1][1] > maxLat) maxLat = bbox[1][1];
  }

  if (!found) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-bounds.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/views-plan-bounds.ts src/features/map/lib/__tests__/views-plan-bounds.test.ts
git commit -m "feat(views): pure leaids->territory bbox helper for plan-map framing"
```

---

## Task 2: Store fields + actions — Views plan map context

**Files:**
- Modify: `src/features/map/lib/store.ts`
- Create: `src/features/map/lib/__tests__/views-plan-store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/map/lib/__tests__/views-plan-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";

function reset() {
  useMapV2Store.setState({
    viewsPlanId: null,
    viewsPlanHighlightLeaids: new Set<string>(),
    viewsPlanSelectedLeaids: new Set<string>(),
  });
}

describe("useMapV2Store — views plan map context", () => {
  beforeEach(reset);

  it("setViewsPlanContext sets id + highlight and clears selection", () => {
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0699999"]));
    const s = useMapV2Store.getState();
    expect(s.viewsPlanId).toBe("plan-1");
    expect([...s.viewsPlanHighlightLeaids]).toEqual(["0699999"]);
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
  });

  it("toggleViewsPlanSelection adds then removes a leaid", () => {
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.has("0601234")).toBe(true);
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.has("0601234")).toBe(false);
  });

  it("toggleViewsPlanSelection is a no-op for in-plan leaids", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0601234");
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.size).toBe(0);
  });

  it("addToViewsPlanHighlight merges leaids into the highlight set", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().addToViewsPlanHighlight(["0699999", "0601234"]);
    expect([...useMapV2Store.getState().viewsPlanHighlightLeaids].sort()).toEqual([
      "0601234",
      "0699999",
    ]);
  });

  it("clearViewsPlanSelection empties only the selection set", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0699999");
    useMapV2Store.getState().clearViewsPlanSelection();
    const s = useMapV2Store.getState();
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
    expect(s.viewsPlanHighlightLeaids.size).toBe(1);
  });

  it("clearViewsPlanContext resets all three fields", () => {
    useMapV2Store.getState().setViewsPlanContext("plan-1", new Set(["0601234"]));
    useMapV2Store.getState().toggleViewsPlanSelection("0699999");
    useMapV2Store.getState().clearViewsPlanContext();
    const s = useMapV2Store.getState();
    expect(s.viewsPlanId).toBeNull();
    expect(s.viewsPlanHighlightLeaids.size).toBe(0);
    expect(s.viewsPlanSelectedLeaids.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-store.test.ts`
Expected: FAIL — `setViewsPlanContext is not a function` (or similar).

- [ ] **Step 3: Add the fields to the state interface**

In `src/features/map/lib/store.ts`, find the state interface block near the
existing `planDistrictLeaids: Set<string>;` declaration (~line 184). Add the
three fields right after it:

```typescript
  // ── Views feature: plan-scoped map (highlight + add-from-map) ──────────────
  /** Active Views plan whose districts the map is scoped to. Null = no scoping. */
  viewsPlanId: string | null;
  /** The active plan's saved districts — plum highlight + "already in plan" test. */
  viewsPlanHighlightLeaids: Set<string>;
  /** Districts clicked but not yet committed — coral highlight, drives the add bar. */
  viewsPlanSelectedLeaids: Set<string>;
```

- [ ] **Step 4: Add the action signatures to the interface**

In the same interface, find the existing plan actions (`addDistrictToPlan: (leaid: string) => void;` ~line 328) and add right after them:

```typescript
  setViewsPlanContext: (planId: string, highlightLeaids: Set<string>) => void;
  clearViewsPlanContext: () => void;
  toggleViewsPlanSelection: (leaid: string) => void;
  clearViewsPlanSelection: () => void;
  addToViewsPlanHighlight: (leaids: string[]) => void;
```

- [ ] **Step 5: Add the default values**

Find the store defaults near `planDistrictLeaids: new Set<string>(),` (~line 531). Add:

```typescript
  viewsPlanId: null,
  viewsPlanHighlightLeaids: new Set<string>(),
  viewsPlanSelectedLeaids: new Set<string>(),
```

- [ ] **Step 6: Implement the actions**

Find the existing `removeDistrictFromPlan:` implementation (~line 739). Add the five new actions right after it:

```typescript
  setViewsPlanContext: (planId, highlightLeaids) =>
    set({
      viewsPlanId: planId,
      viewsPlanHighlightLeaids: new Set(highlightLeaids),
      viewsPlanSelectedLeaids: new Set<string>(),
    }),

  clearViewsPlanContext: () =>
    set({
      viewsPlanId: null,
      viewsPlanHighlightLeaids: new Set<string>(),
      viewsPlanSelectedLeaids: new Set<string>(),
    }),

  toggleViewsPlanSelection: (leaid) =>
    set((s) => {
      if (s.viewsPlanHighlightLeaids.has(leaid)) return s; // in-plan → not selectable
      const next = new Set(s.viewsPlanSelectedLeaids);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return { viewsPlanSelectedLeaids: next };
    }),

  clearViewsPlanSelection: () => set({ viewsPlanSelectedLeaids: new Set<string>() }),

  addToViewsPlanHighlight: (leaids) =>
    set((s) => {
      const next = new Set(s.viewsPlanHighlightLeaids);
      for (const l of leaids) next.add(l);
      return { viewsPlanHighlightLeaids: next };
    }),
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-store.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 8: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/lib/__tests__/views-plan-store.test.ts
git commit -m "feat(views): map store fields for plan-scoped highlight + selection"
```

---

## Task 3: Highlight layer configs + filter helper

**Files:**
- Modify: `src/features/map/lib/layers.ts`
- Create: `src/features/map/lib/__tests__/views-plan-layers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/map/lib/__tests__/views-plan-layers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  viewsPlanLeaidFilter,
  VIEWS_PLAN_HIGHLIGHT_FILL_LAYER,
  VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER,
  VIEWS_PLAN_SELECTION_FILL_LAYER,
  VIEWS_PLAN_SELECTION_OUTLINE_LAYER,
} from "../layers";

describe("viewsPlanLeaidFilter", () => {
  it("wraps a leaid 'in' test that excludes rollups", () => {
    const f = viewsPlanLeaidFilter(["0601234", "3600001"]);
    expect(f[0]).toBe("all");
    // last clause is the leaid membership test
    expect(f[f.length - 1]).toEqual([
      "in",
      ["get", "leaid"],
      ["literal", ["0601234", "3600001"]],
    ]);
  });

  it("matches nothing for an empty list", () => {
    const f = viewsPlanLeaidFilter([]);
    expect(f[f.length - 1]).toEqual(["in", ["get", "leaid"], ["literal", []]]);
  });
});

describe("views plan layer configs", () => {
  it("all four target the districts source layer", () => {
    for (const layer of [
      VIEWS_PLAN_HIGHLIGHT_FILL_LAYER,
      VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER,
      VIEWS_PLAN_SELECTION_FILL_LAYER,
      VIEWS_PLAN_SELECTION_OUTLINE_LAYER,
    ]) {
      expect(layer.source).toBe("districts");
      expect(layer["source-layer"]).toBe("districts");
    }
  });

  it("uses plum for in-plan and coral for selection", () => {
    expect(VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER.paint["line-color"]).toBe("#403770");
    expect(VIEWS_PLAN_SELECTION_OUTLINE_LAYER.paint["line-color"]).toBe("#F37167");
  });

  it("has distinct layer ids", () => {
    const ids = [
      VIEWS_PLAN_HIGHLIGHT_FILL_LAYER.id,
      VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER.id,
      VIEWS_PLAN_SELECTION_FILL_LAYER.id,
      VIEWS_PLAN_SELECTION_OUTLINE_LAYER.id,
    ];
    expect(new Set(ids).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-layers.test.ts`
Expected: FAIL — `viewsPlanLeaidFilter is not exported` / undefined.

- [ ] **Step 3: Implement the helper + layer configs**

In `src/features/map/lib/layers.ts`, append at the end of the file (it already
exports `NOT_ROLLUP_FILTER` used here):

```typescript
// ── Views feature: plan-scoped highlight + selection layers ───────────────────
// Drawn above `district-base-fill`. Filters are applied reactively by
// MapV2Container via setFilter; they start matching nothing. Source mirrors the
// base district fill (districts tiles, rollups excluded).

/** Build a "districts whose leaid is in this set, excluding rollups" filter. */
export function viewsPlanLeaidFilter(leaids: string[]): unknown[] {
  return ["all", NOT_ROLLUP_FILTER, ["in", ["get", "leaid"], ["literal", leaids]]];
}

const VIEWS_PLAN_MATCH_NONE = viewsPlanLeaidFilter([]);

export const VIEWS_PLAN_HIGHLIGHT_FILL_LAYER = {
  id: "views-plan-highlight-fill",
  type: "fill" as const,
  source: "districts",
  "source-layer": "districts",
  filter: VIEWS_PLAN_MATCH_NONE,
  paint: { "fill-color": "#403770", "fill-opacity": 0.22 },
};

export const VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER = {
  id: "views-plan-highlight-outline",
  type: "line" as const,
  source: "districts",
  "source-layer": "districts",
  filter: VIEWS_PLAN_MATCH_NONE,
  paint: { "line-color": "#403770", "line-width": 2 },
};

export const VIEWS_PLAN_SELECTION_FILL_LAYER = {
  id: "views-plan-selection-fill",
  type: "fill" as const,
  source: "districts",
  "source-layer": "districts",
  filter: VIEWS_PLAN_MATCH_NONE,
  paint: { "fill-color": "#F37167", "fill-opacity": 0.18 },
};

export const VIEWS_PLAN_SELECTION_OUTLINE_LAYER = {
  id: "views-plan-selection-outline",
  type: "line" as const,
  source: "districts",
  "source-layer": "districts",
  filter: VIEWS_PLAN_MATCH_NONE,
  paint: { "line-color": "#F37167", "line-width": 2.5 },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/map/lib/__tests__/views-plan-layers.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/lib/layers.ts src/features/map/lib/__tests__/views-plan-layers.test.ts
git commit -m "feat(views): plan highlight + selection layer configs"
```

---

## Task 4: Wire layers + click branch + framing into MapV2Container

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx`

This task is MapLibre integration — not unit-testable in jsdom. Verify with
`npx tsc --noEmit` and the manual smoke test in Task 7.

- [ ] **Step 1: Import the new layer configs + bounds helper**

In `src/features/map/components/MapV2Container.tsx`, extend the existing
`@/features/map/lib/layers` import (line 10) to also pull in the four layer
consts + the filter helper:

```typescript
  VIEWS_PLAN_HIGHLIGHT_FILL_LAYER, VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER,
  VIEWS_PLAN_SELECTION_FILL_LAYER, VIEWS_PLAN_SELECTION_OUTLINE_LAYER,
  viewsPlanLeaidFilter,
```

Add a new import near the other lib imports:

```typescript
import { boundsForLeaids } from "@/features/map/lib/views-plan-bounds";
```

- [ ] **Step 2: Register the four layers after the rollup outline**

Find `map.current.addLayer(DISTRICT_ROLLUP_OUTLINE_LAYER as any);` (~line 574).
Immediately after it, add:

```typescript
      // Views plan-scoping highlight layers (filters applied reactively below).
      map.current.addLayer(VIEWS_PLAN_HIGHLIGHT_FILL_LAYER as any);
      map.current.addLayer(VIEWS_PLAN_HIGHLIGHT_OUTLINE_LAYER as any);
      map.current.addLayer(VIEWS_PLAN_SELECTION_FILL_LAYER as any);
      map.current.addLayer(VIEWS_PLAN_SELECTION_OUTLINE_LAYER as any);
```

- [ ] **Step 3: Subscribe to the new store slices**

Near the other `useMapV2Store((s) => ...)` selector hooks at the top of the
component body (after line 157), add:

```typescript
  const viewsPlanId = useMapV2Store((s) => s.viewsPlanId);
  const viewsPlanHighlightLeaids = useMapV2Store((s) => s.viewsPlanHighlightLeaids);
  const viewsPlanSelectedLeaids = useMapV2Store((s) => s.viewsPlanSelectedLeaids);
```

- [ ] **Step 4: Reactively update the highlight + selection filters**

Add this effect alongside the other layer-sync effects (near the `setFilter`
calls ~line 400). It guards on the map + layer existing:

```typescript
  useEffect(() => {
    const m = map.current;
    if (!m || !m.getLayer("views-plan-highlight-fill")) return;
    const f = viewsPlanLeaidFilter([...viewsPlanHighlightLeaids]) as any;
    m.setFilter("views-plan-highlight-fill", f);
    m.setFilter("views-plan-highlight-outline", f);
  }, [viewsPlanHighlightLeaids]);

  useEffect(() => {
    const m = map.current;
    if (!m || !m.getLayer("views-plan-selection-fill")) return;
    const f = viewsPlanLeaidFilter([...viewsPlanSelectedLeaids]) as any;
    m.setFilter("views-plan-selection-fill", f);
    m.setFilter("views-plan-selection-outline", f);
  }, [viewsPlanSelectedLeaids]);
```

- [ ] **Step 5: Frame the territory when the active plan changes**

Add a ref near the top of the component body (with the other `useRef`s):

```typescript
  const lastFramedPlanId = useRef<string | null>(null);
```

Add this effect (after the filter effects). It fits bounds once per plan change
(not on every highlight add), camera-only, with a US fallback:

```typescript
  useEffect(() => {
    const m = map.current;
    if (!m || !viewsPlanId) {
      if (!viewsPlanId) lastFramedPlanId.current = null;
      return;
    }
    if (lastFramedPlanId.current === viewsPlanId) return;
    const bounds = boundsForLeaids([...viewsPlanHighlightLeaids], STATE_BBOX);
    m.fitBounds((bounds ?? US_BOUNDS) as maplibregl.LngLatBoundsLike, {
      padding: 48,
      duration: 600,
    });
    lastFramedPlanId.current = viewsPlanId;
  }, [viewsPlanId, viewsPlanHighlightLeaids]);
```

- [ ] **Step 6: Branch the district click handler when a Views plan is active**

Find the "Priority 6: District base fill" branch (~line 1226). Just after
`const store = useMapV2Store.getState();` and **before** the existing
`store.addClickRipple(...)` / `if (store.panelState === "PLAN_ADD")` lines,
insert:

```typescript
          // Views plan-scoped mode: clicks build the pending-add selection only.
          // No results panel, no zoom; in-plan districts are ignored (no-op).
          if (store.viewsPlanId) {
            store.addClickRipple(e.point.x, e.point.y, "plum");
            store.toggleViewsPlanSelection(leaid);
            return;
          }
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "MapV2Container|layers.ts|views-plan"`
Expected: no output (no errors in the touched files). Pre-existing errors in
`rfps`/`states` test files are unrelated — ignore them.

- [ ] **Step 8: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "feat(views): paint plan highlight/selection + frame territory + click-to-select"
```

---

## Task 5: PlanMapSelectionBar component

**Files:**
- Create: `src/features/views/components/views/PlanMapSelectionBar.tsx`
- Create: `src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMapV2Store } from "@/features/map/lib/store";
import { PlanMapSelectionBar } from "../PlanMapSelectionBar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useMapV2Store.setState({
    viewsPlanId: "plan-1",
    viewsPlanHighlightLeaids: new Set<string>(),
    viewsPlanSelectedLeaids: new Set<string>(),
  });
});

describe("PlanMapSelectionBar", () => {
  it("renders nothing when no districts are selected", () => {
    const { container } = render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pending-add count", () => {
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234", "0699999"]) });
    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    expect(screen.getByText("2 districts selected")).toBeInTheDocument();
  });

  it("posts the selected leaids, then clears selection and highlights them", async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ added: 2, planId: "plan-1" }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234", "0699999"]) });

    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/territory-plans/plan-1/districts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).leaids.sort()).toEqual(["0601234", "0699999"]);

    await waitFor(() => {
      const s = useMapV2Store.getState();
      expect(s.viewsPlanSelectedLeaids.size).toBe(0);
      expect(s.viewsPlanHighlightLeaids.has("0601234")).toBe(true);
    });
    vi.unstubAllGlobals();
  });

  it("clears the selection without posting when Clear is pressed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234"]) });

    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`
Expected: FAIL — `Cannot find module '../PlanMapSelectionBar'`.

- [ ] **Step 3: Implement the component**

Create `src/features/views/components/views/PlanMapSelectionBar.tsx`:

```typescript
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import { useMapV2Store } from "@/features/map/lib/store";

interface Props {
  planId: string;
}

/**
 * Floating action bar for the Views plan-scoped map. Appears when the rep has
 * clicked one or more not-yet-in-plan districts (the coral selection set) and
 * commits them to the plan in a single bulk add. Add-only — removal lives in
 * the Table/list views.
 */
export function PlanMapSelectionBar({ planId }: Props) {
  const qc = useQueryClient();
  const selected = useMapV2Store((s) => s.viewsPlanSelectedLeaids);
  const clearSelection = useMapV2Store((s) => s.clearViewsPlanSelection);
  const addHighlight = useMapV2Store((s) => s.addToViewsPlanHighlight);
  const addDistricts = useAddDistrictsToPlan();

  const count = selected.size;
  if (count === 0) return null;

  const handleAdd = async () => {
    const leaids = [...selected];
    try {
      await addDistricts.mutateAsync({ planId, leaids });
      addHighlight(leaids); // optimistic plum highlight
      clearSelection();
      qc.invalidateQueries({ queryKey: ["views", "data"] });
      qc.invalidateQueries({ queryKey: ["views", "plans"] });
      qc.invalidateQueries({ queryKey: ["views", "plan", planId] });
    } catch {
      // Selection is preserved for retry; error surfaced below.
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full border border-[#D4CFE2] bg-white px-4 py-2 shadow-md">
      <span className="whitespace-nowrap text-sm font-medium text-[#403770]">
        {count} district{count === 1 ? "" : "s"} selected
      </span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={addDistricts.isPending}
        className="whitespace-nowrap rounded-full bg-[#403770] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#322a5a] disabled:opacity-60"
      >
        {addDistricts.isPending ? "Adding…" : "Add to plan"}
      </button>
      <button
        type="button"
        onClick={clearSelection}
        disabled={addDistricts.isPending}
        className="whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] disabled:opacity-60"
      >
        Clear
      </button>
      {addDistricts.isError && (
        <span className="whitespace-nowrap text-xs text-[#A8281C]">Add failed — try again</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/views/PlanMapSelectionBar.tsx src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx
git commit -m "feat(views): PlanMapSelectionBar — commit selected districts to plan"
```

---

## Task 6: Wire MapViewContainer + GroupCanvas

**Files:**
- Modify: `src/features/views/components/views/MapViewContainer.tsx`
- Modify: `src/features/views/components/GroupCanvas.tsx`

- [ ] **Step 1: Add the `planId` prop + mount/cleanup effect + render the bar**

Replace the entire body of `src/features/views/components/views/MapViewContainer.tsx`
with the following (it keeps the dynamic MapV2 import and the null-plan banner,
drops the banner for the plan case, and binds/unbinds the store context):

```typescript
"use client";

/**
 * MapViewContainer — mounts the embedded MapV2 map inside the saved-views
 * canvas. When the active context is a plan, it binds the map to that plan
 * (highlight + territory framing) and renders the add-from-map selection bar.
 * When there is no active plan (lists / portfolio) it falls back to the global
 * map plus the legacy "showing all districts" banner.
 */
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { useMapV2Store } from "@/features/map/lib/store";
import { PlanMapSelectionBar } from "./PlanMapSelectionBar";

const MapV2Container = dynamic(
  () => import("@/features/map/components/MapV2Container"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#FFFCFA] text-[12px] text-[#8A80A8]">
        Loading map…
      </div>
    ),
  },
);

export interface MapViewContainerProps {
  /** District leaid set for the active context (plan.districtLeaids). */
  leaids: string[] | null;
  /** Active plan id, or null when the context is a list / portfolio. */
  planId: string | null;
  /** Human label for the active plan/list (used by the null-plan banner). */
  contextLabel: string | null;
}

export default function MapViewContainer({
  leaids,
  planId,
  contextLabel,
}: MapViewContainerProps) {
  const setViewsPlanContext = useMapV2Store((s) => s.setViewsPlanContext);
  const clearViewsPlanContext = useMapV2Store((s) => s.clearViewsPlanContext);

  // Bind the embedded map to the active plan; clear on unmount / plan change.
  useEffect(() => {
    if (!planId) return;
    setViewsPlanContext(planId, new Set(leaids ?? []));
    return () => clearViewsPlanContext();
  }, [planId, leaids, setViewsPlanContext, clearViewsPlanContext]);

  // Null-plan path (list / portfolio): keep the legacy "all districts" banner.
  const showBanner = !planId && Array.isArray(leaids) && leaids.length > 0;

  return (
    <div className="relative h-full w-full">
      {showBanner && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white shadow-sm border border-[#D4CFE2] max-w-[90%]"
          role="status"
        >
          <Info className="w-3.5 h-3.5 text-[#6EA3BE] flex-shrink-0" aria-hidden />
          <span className="text-[11px] font-medium text-[#544A78] whitespace-nowrap">
            Showing all districts
            {contextLabel ? ` — ${contextLabel} scoping coming soon` : ""}
          </span>
        </div>
      )}
      <MapV2Container />
      {planId && <PlanMapSelectionBar planId={planId} />}
    </div>
  );
}
```

- [ ] **Step 2: Pass `planId` from GroupCanvas**

In `src/features/views/components/GroupCanvas.tsx`, find the `case "map":` block
(~line 210) and add the `planId` prop:

```typescript
    case "map":
      return (
        <MapViewContainer
          leaids={leaids}
          planId={kind === "plan" ? plan?.id ?? null : null}
          contextLabel={plan?.name ?? list?.name ?? null}
        />
      );
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "MapViewContainer|GroupCanvas|PlanMapSelectionBar"`
Expected: no output.

- [ ] **Step 4: Run the views component tests**

Run: `npx vitest run src/features/views/components/views/__tests__/PlanMapSelectionBar.test.tsx`
Expected: PASS (the bar still mounts/behaves correctly).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/views/MapViewContainer.tsx src/features/views/components/GroupCanvas.tsx
git commit -m "feat(views): bind Views map to active plan + render add bar"
```

---

## Task 7: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full views + map test scope**

Run:
```bash
npx vitest run src/features/views src/features/map/lib
```
Expected: PASS. If any pre-existing failures appear outside the files this plan
touched, note them but do not block on them.

- [ ] **Step 2: Type-check the whole worktree**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `28` (the pre-existing `rfps`/`states` test errors only — same
baseline as before this work). If higher, run without `-c` and fix any error
that names a file this plan touched.

- [ ] **Step 3: Manual smoke test on localhost:3005**

The dev server runs on this worktree (`npm run dev`, port 3005). In the browser:
1. Open a **plan** in the Views feature → **Map** tab.
2. Confirm the map frames the plan's territory and the plan's districts show a
   **plum** fill + outline.
3. Click several non-plan districts → they turn **coral** and the bottom-center
   bar reads "N districts selected".
4. Click an **already-plum** (in-plan) district → nothing is added to the count.
5. Press **Add to plan** → the bar's button shows "Adding…", then the coral
   districts flip to **plum**, the bar disappears, and switching to the **Table**
   tab shows the new districts (grid + GroupHeader stats updated).
6. Open a **list** (not a plan) → the map shows the legacy banner and **no**
   selection bar (scoping does not apply).

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(views): verify plan-scoped map highlight + add-from-map"
```

(If Steps 1–3 passed with no changes, skip this commit.)

---

## Self-Review Notes

- **Spec coverage:** highlight (Task 3/4), territory framing (Task 1/4), select-then-add (Task 4/5), add-only / in-plan-not-selectable (Task 2 `toggleViewsPlanSelection` no-op + Task 4 click branch), all-districts-visible (highlight layers over base fill, no filter hiding), plans-only scope (Task 6 `planId` gating), refresh on add (Task 5 invalidations), edge cases (empty bounds → US fallback Task 4; null plan → banner + no bar Task 6). ✓
- **Type consistency:** action names (`setViewsPlanContext`, `clearViewsPlanContext`, `toggleViewsPlanSelection`, `clearViewsPlanSelection`, `addToViewsPlanHighlight`) and field names (`viewsPlanId`, `viewsPlanHighlightLeaids`, `viewsPlanSelectedLeaids`) are identical across Tasks 2, 4, 5, 6. Layer ids match between Task 3 configs and Task 4 `setFilter`/`getLayer` calls. ✓
- **Out of scope (per spec):** map removal, box/lasso select, list/portfolio scoping, per-district targets at add time.
