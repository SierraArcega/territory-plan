# Category Color Palettes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users pick curated color palettes for vendor engagement layers and signal layers on the map.

**Architecture:** Add a palette registry in `layers.ts` with expression builder functions. Store palette selections in Zustand + localStorage. Wire palette changes to MapLibre `setPaintProperty()`. Add inline palette picker UI in `LayerBubble`.

**Tech Stack:** React 19, Zustand, MapLibre GL, Tailwind CSS, Vitest

---

### Task 1: Define Palette Registry and Types

**Files:**
- Create: `src/features/map/lib/palettes.ts`
- Test: `src/features/map/lib/__tests__/palettes.test.ts`

**Step 1: Write the failing test**

```ts
// src/features/map/lib/__tests__/palettes.test.ts
import { describe, it, expect } from "vitest";
import {
  VENDOR_PALETTES,
  SIGNAL_PALETTES,
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
  type VendorPalette,
  type SignalPalette,
} from "@/features/map/lib/palettes";

describe("palettes", () => {
  it("exports at least 8 vendor palettes", () => {
    expect(VENDOR_PALETTES.length).toBeGreaterThanOrEqual(8);
  });

  it("each vendor palette has 7 stops (lightest → darkest)", () => {
    for (const p of VENDOR_PALETTES) {
      expect(p.stops).toHaveLength(7);
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.baseColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.dotColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("exports at least 4 signal palettes", () => {
    expect(SIGNAL_PALETTES.length).toBeGreaterThanOrEqual(4);
  });

  it("each signal palette has correct stop counts", () => {
    for (const p of SIGNAL_PALETTES) {
      // Growth signals need 5 stops, expenditure needs 4
      // Use the larger: 5 stops for diverging, plus a neutral midpoint
      expect(p.growthStops).toHaveLength(5);
      expect(p.expenditureStops).toHaveLength(4);
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
    }
  });

  it("default vendor palettes match current brand colors", () => {
    expect(DEFAULT_VENDOR_PALETTE.fullmind).toBe("plum");
    expect(DEFAULT_VENDOR_PALETTE.proximity).toBe("coral");
    expect(DEFAULT_VENDOR_PALETTE.elevate).toBe("steel-blue");
    expect(DEFAULT_VENDOR_PALETTE.tbt).toBe("golden");
  });

  it("default signal palette is mint-coral", () => {
    expect(DEFAULT_SIGNAL_PALETTE).toBe("mint-coral");
  });

  it("all palette IDs are unique (vendor)", () => {
    const ids = VENDOR_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all palette IDs are unique (signal)", () => {
    const ids = SIGNAL_PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/features/map/lib/palettes.ts
import type { VendorId } from "@/features/map/lib/layers";

export interface VendorPalette {
  id: string;
  label: string;
  baseColor: string;
  dotColor: string;
  /** 7 stops ordered lightest → darkest, mapping to:
   * [0] target (90% tint)
   * [1] lapsed (80% tint)
   * [2] new_pipeline (50% tint)
   * [3] new/first_year (40% tint)
   * [4] renewal_pipeline (20% shade)
   * [5] expansion_pipeline / multi_year (full)
   * [6] multi_year (full, duplicate of [5] for Fullmind)
   *
   * For competitors (3 categories): churned=[0], new=[4], multi_year=[5]
   */
  stops: [string, string, string, string, string, string, string];
}

export interface SignalPalette {
  id: string;
  label: string;
  /** 5 stops: strong_growth, growth, stable, decline, strong_decline */
  growthStops: [string, string, string, string, string];
  /** 4 stops: well_above, above, below, well_below */
  expenditureStops: [string, string, string, string];
  /** Primary dot color for signal toggles */
  dotColor: string;
}

// ── Vendor Palettes ──────────────────────────────────────────────

export const VENDOR_PALETTES: VendorPalette[] = [
  {
    id: "plum",
    label: "Plum",
    baseColor: "#403770",
    dotColor: "#403770",
    stops: ["#ecebf1", "#d9d7e2", "#b3afc6", "#8c87a9", "#665f8d", "#403770", "#403770"],
  },
  {
    id: "coral",
    label: "Coral",
    baseColor: "#F37167",
    dotColor: "#F37167",
    stops: ["#fef1f0", "#fde3e1", "#f9b5b0", "#f69d96", "#f58d85", "#F37167", "#F37167"],
  },
  {
    id: "steel-blue",
    label: "Steel Blue",
    baseColor: "#6EA3BE",
    dotColor: "#6EA3BE",
    stops: ["#e8f1f5", "#d1e3ec", "#c4dae6", "#a6c9da", "#8bb5cb", "#6EA3BE", "#6EA3BE"],
  },
  {
    id: "golden",
    label: "Golden",
    baseColor: "#FFCF70",
    dotColor: "#FFCF70",
    stops: ["#fffaf1", "#fff5e2", "#ffe9b8", "#ffe1a2", "#ffd98d", "#FFCF70", "#FFCF70"],
  },
  {
    id: "mint",
    label: "Mint",
    baseColor: "#4ECDC4",
    dotColor: "#4ECDC4",
    stops: ["#e5f7f6", "#ccf0ed", "#a6e5e1", "#8EDDD7", "#6ED5CD", "#4ECDC4", "#4ECDC4"],
  },
  {
    id: "ocean",
    label: "Ocean",
    baseColor: "#2E6B8A",
    dotColor: "#2E6B8A",
    stops: ["#e6eff4", "#c0d7e3", "#93bad0", "#6fa4be", "#4e8fad", "#2E6B8A", "#2E6B8A"],
  },
  {
    id: "forest",
    label: "Forest",
    baseColor: "#2D6A4F",
    dotColor: "#2D6A4F",
    stops: ["#e6f0eb", "#bfd9cc", "#8fbfaa", "#6faa8f", "#4f9575", "#2D6A4F", "#2D6A4F"],
  },
  {
    id: "rose",
    label: "Rose",
    baseColor: "#B5485A",
    dotColor: "#B5485A",
    stops: ["#f5e8eb", "#e6c7cd", "#d49da8", "#c6848f", "#bd6b79", "#B5485A", "#B5485A"],
  },
  {
    id: "slate",
    label: "Slate",
    baseColor: "#4A5568",
    dotColor: "#4A5568",
    stops: ["#edf0f2", "#d3d9df", "#b0bac4", "#96a3b0", "#7d8d9c", "#4A5568", "#4A5568"],
  },
  {
    id: "amber",
    label: "Amber",
    baseColor: "#D97706",
    dotColor: "#D97706",
    stops: ["#fef3e2", "#fde6c0", "#fbd08a", "#f9c36d", "#f0a933", "#D97706", "#D97706"],
  },
];

// ── Signal Palettes ──────────────────────────────────────────────

export const SIGNAL_PALETTES: SignalPalette[] = [
  {
    id: "mint-coral",
    label: "Mint → Coral",
    growthStops: ["#4ECDC4", "#8EDDD7", "#6EA3BE", "#f58d85", "#F37167"],
    expenditureStops: ["#F37167", "#FFCF70", "#6EA3BE", "#4ECDC4"],
    dotColor: "#4ECDC4",
  },
  {
    id: "green-red",
    label: "Green → Red",
    growthStops: ["#22C55E", "#6EE7A0", "#94A3B8", "#F87171", "#EF4444"],
    expenditureStops: ["#EF4444", "#F59E0B", "#94A3B8", "#22C55E"],
    dotColor: "#22C55E",
  },
  {
    id: "blue-orange",
    label: "Blue → Orange",
    growthStops: ["#3B82F6", "#7CAFF8", "#94A3B8", "#FDBA74", "#F97316"],
    expenditureStops: ["#F97316", "#FBBF24", "#94A3B8", "#3B82F6"],
    dotColor: "#3B82F6",
  },
  {
    id: "purple-gold",
    label: "Purple → Gold",
    growthStops: ["#8B5CF6", "#B197F8", "#94A3B8", "#FCD34D", "#EAB308"],
    expenditureStops: ["#EAB308", "#F97316", "#94A3B8", "#8B5CF6"],
    dotColor: "#8B5CF6",
  },
];

// ── Defaults ─────────────────────────────────────────────────────

export const DEFAULT_VENDOR_PALETTE: Record<VendorId, string> = {
  fullmind: "plum",
  proximity: "coral",
  elevate: "steel-blue",
  tbt: "golden",
};

export const DEFAULT_SIGNAL_PALETTE = "mint-coral";

// ── Lookup helpers ───────────────────────────────────────────────

const vendorPaletteMap = new Map(VENDOR_PALETTES.map((p) => [p.id, p]));
const signalPaletteMap = new Map(SIGNAL_PALETTES.map((p) => [p.id, p]));

export function getVendorPalette(id: string): VendorPalette {
  return vendorPaletteMap.get(id) ?? vendorPaletteMap.get("plum")!;
}

export function getSignalPalette(id: string): SignalPalette {
  return signalPaletteMap.get(id) ?? signalPaletteMap.get("mint-coral")!;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/palettes.ts src/features/map/lib/__tests__/palettes.test.ts
git commit -m "feat: add curated palette registry for vendor and signal layers"
```

---

### Task 2: Expression Builder Functions

**Files:**
- Modify: `src/features/map/lib/layers.ts`
- Test: `src/features/map/lib/__tests__/palettes.test.ts` (append)

**Step 1: Write the failing tests**

Append to `src/features/map/lib/__tests__/palettes.test.ts`:

```ts
import {
  buildVendorFillExpression,
  buildSignalFillExpression,
} from "@/features/map/lib/layers";
import { getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";

describe("buildVendorFillExpression", () => {
  it("returns a match expression using the palette stops", () => {
    const palette = getVendorPalette("plum");
    const expr = buildVendorFillExpression("fullmind", palette);

    // Should be a MapLibre match expression: ["match", ["get", prop], ...pairs, fallback]
    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "fullmind_category"]);
    // Should contain the palette's base color for "expansion_pipeline"
    expect(expr).toContain(palette.stops[5]);
    // Fallback should be transparent
    expect(expr[expr.length - 1]).toBe("rgba(0,0,0,0)");
  });

  it("works for competitor vendors (3-category)", () => {
    const palette = getVendorPalette("coral");
    const expr = buildVendorFillExpression("proximity", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "proximity_category"]);
    // Competitors have: churned, new, multi_year
    expect(expr).toContain("churned");
    expect(expr).toContain("new");
    expect(expr).toContain("multi_year");
  });
});

describe("buildSignalFillExpression", () => {
  it("builds growth signal expression with 5 category stops", () => {
    const palette = getSignalPalette("mint-coral");
    const expr = buildSignalFillExpression("enrollment", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "enrollment_signal"]);
    expect(expr).toContain("strong_growth");
    expect(expr).toContain("strong_decline");
    expect(expr).toContain(palette.growthStops[0]); // strong_growth color
  });

  it("builds expenditure signal expression with 4 category stops", () => {
    const palette = getSignalPalette("mint-coral");
    const expr = buildSignalFillExpression("expenditure", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "expenditure_signal"]);
    expect(expr).toContain("well_above");
    expect(expr).toContain("well_below");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: FAIL — functions not exported

**Step 3: Write minimal implementation**

Add to `src/features/map/lib/layers.ts` (after existing imports, before `VENDOR_CONFIGS`):

```ts
import type { VendorPalette, SignalPalette } from "@/features/map/lib/palettes";

/**
 * Build a MapLibre match expression for a vendor layer using a color palette.
 * Category-to-stop mapping is positional (same engagement levels, different colors).
 */
export function buildVendorFillExpression(
  vendorId: VendorId,
  palette: VendorPalette,
): ExpressionSpecification {
  const tileProperty = VENDOR_CONFIGS[vendorId].tileProperty;
  const s = palette.stops;

  if (vendorId === "fullmind") {
    return [
      "match",
      ["get", tileProperty],
      "target", s[0],             // lightest
      "new_pipeline", s[2],       // 50% tint
      "renewal_pipeline", s[4],   // 20% shade
      "expansion_pipeline", s[5], // full
      "lapsed", s[1],             // 80% tint
      "new", s[3],                // 40% tint
      "multi_year", s[6],         // full
      "rgba(0,0,0,0)",
    ];
  }

  // Competitor vendors: 3 categories
  return [
    "match",
    ["get", tileProperty],
    "churned", s[0],    // lightest
    "new", s[4],         // 20% shade
    "multi_year", s[5],  // full
    "rgba(0,0,0,0)",
  ];
}

/**
 * Build a MapLibre match expression for a signal layer using a color palette.
 */
export function buildSignalFillExpression(
  signalId: SignalId,
  palette: SignalPalette,
): ExpressionSpecification {
  const tileProperty = SIGNAL_CONFIGS[signalId].tileProperty;

  if (signalId === "expenditure") {
    const s = palette.expenditureStops;
    return [
      "match",
      ["get", tileProperty],
      "well_above", s[0],
      "above", s[1],
      "below", s[2],
      "well_below", s[3],
      "rgba(0,0,0,0)",
    ];
  }

  // Growth signals: 5 stops
  const s = palette.growthStops;
  return [
    "match",
    ["get", tileProperty],
    "strong_growth", s[0],
    "growth", s[1],
    "stable", s[2],
    "decline", s[3],
    "strong_decline", s[4],
    "rgba(0,0,0,0)",
  ];
}
```

Note: `buildVendorFillExpression` references `VENDOR_CONFIGS[vendorId].tileProperty` — this creates a circular reference since `VENDOR_CONFIGS` uses the old hardcoded fills. That's fine: the `tileProperty` field is independent of the fill colors. The old `fillColor` fields remain as legacy defaults until Task 4 wires up the dynamic path.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/layers.ts src/features/map/lib/__tests__/palettes.test.ts
git commit -m "feat: add expression builders for dynamic vendor/signal palettes"
```

---

### Task 3: Add Palette State to Zustand Store

**Files:**
- Modify: `src/features/map/lib/store.ts`
- Test: `src/lib/__tests__/map-v2-store.test.ts` (append)

**Step 1: Write the failing test**

Append to `src/lib/__tests__/map-v2-store.test.ts`:

```ts
import { DEFAULT_VENDOR_PALETTE, DEFAULT_SIGNAL_PALETTE } from "@/features/map/lib/palettes";

describe("useMapV2Store - Palette Preferences", () => {
  beforeEach(() => {
    useMapV2Store.setState({
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
      signalPalette: DEFAULT_SIGNAL_PALETTE,
    });
  });

  it("initializes with default vendor palettes", () => {
    const state = useMapV2Store.getState();
    expect(state.vendorPalettes.fullmind).toBe("plum");
    expect(state.vendorPalettes.proximity).toBe("coral");
    expect(state.vendorPalettes.elevate).toBe("steel-blue");
    expect(state.vendorPalettes.tbt).toBe("golden");
  });

  it("initializes with default signal palette", () => {
    expect(useMapV2Store.getState().signalPalette).toBe("mint-coral");
  });

  it("setVendorPalette updates a single vendor", () => {
    useMapV2Store.getState().setVendorPalette("fullmind", "ocean");
    expect(useMapV2Store.getState().vendorPalettes.fullmind).toBe("ocean");
    // Others unchanged
    expect(useMapV2Store.getState().vendorPalettes.proximity).toBe("coral");
  });

  it("setSignalPalette updates the signal palette", () => {
    useMapV2Store.getState().setSignalPalette("blue-orange");
    expect(useMapV2Store.getState().signalPalette).toBe("blue-orange");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: FAIL — properties don't exist on store

**Step 3: Write minimal implementation**

In `src/features/map/lib/store.ts`:

1. Add import at top:
```ts
import { DEFAULT_VENDOR_PALETTE, DEFAULT_SIGNAL_PALETTE } from "@/features/map/lib/palettes";
```

2. Add to `MapV2State` interface (after `selectedFiscalYear`):
```ts
  // Color palette preferences
  vendorPalettes: Record<VendorId, string>;
  signalPalette: string;
```

3. Add to `MapV2Actions` interface (after `setSelectedFiscalYear`):
```ts
  // Color palette preferences
  setVendorPalette: (vendorId: VendorId, paletteId: string) => void;
  setSignalPalette: (paletteId: string) => void;
```

4. Add initial state (after `selectedFiscalYear: "fy26"`):
```ts
  vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
  signalPalette: DEFAULT_SIGNAL_PALETTE,
```

5. Add actions (after `setSelectedFiscalYear`):
```ts
  // Color palette preferences
  setVendorPalette: (vendorId, paletteId) =>
    set((s) => ({
      vendorPalettes: { ...s.vendorPalettes, [vendorId]: paletteId },
    })),
  setSignalPalette: (paletteId) => set({ signalPalette: paletteId }),
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/store.ts src/lib/__tests__/map-v2-store.test.ts
git commit -m "feat: add palette preference state to map store"
```

---

### Task 4: Wire Palette to MapV2Container

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx`

This task has no unit tests — it's MapLibre integration code that requires a running browser context. We verify manually.

**Step 1: Add imports**

At the top of `MapV2Container.tsx`, add:
```ts
import { getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";
import { buildVendorFillExpression, buildSignalFillExpression } from "@/features/map/lib/layers";
```

**Step 2: Subscribe to palette state**

Near the other `useMapV2Store` selectors (around line 20-30), add:
```ts
const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
const signalPalette = useMapV2Store((s) => s.signalPalette);
```

**Step 3: Use dynamic fill in initial layer setup**

Find the loop at ~line 328 that creates vendor fill layers:
```ts
for (const vendorId of ["fullmind", "proximity", "elevate", "tbt"] as const) {
  const config = VENDOR_CONFIGS[vendorId];
  map.current.addLayer({
    ...
    paint: {
      "fill-color": config.fillColor as any,
```

Replace `config.fillColor` with the dynamic expression:
```ts
"fill-color": buildVendorFillExpression(vendorId, getVendorPalette(vendorPalettes[vendorId])) as any,
```

**Step 4: Add useEffect to update paint on palette change**

Add a new `useEffect` that updates vendor layer paint when palettes change:

```ts
// Update vendor layer colors when palette changes
useEffect(() => {
  if (!map.current?.isStyleLoaded()) return;

  for (const vendorId of VENDOR_IDS) {
    const layerId = `district-${vendorId}-fill`;
    if (!map.current.getLayer(layerId)) continue;
    const palette = getVendorPalette(vendorPalettes[vendorId]);
    map.current.setPaintProperty(
      layerId,
      "fill-color",
      buildVendorFillExpression(vendorId, palette) as any,
    );
  }

  // Update account point layer too
  if (map.current.getLayer(ACCOUNT_POINT_LAYER_ID)) {
    const firstVendor = [...activeVendors][0];
    if (firstVendor) {
      const palette = getVendorPalette(vendorPalettes[firstVendor]);
      map.current.setPaintProperty(
        ACCOUNT_POINT_LAYER_ID,
        "circle-color",
        buildVendorFillExpression(firstVendor, palette) as any,
      );
    }
  }
}, [vendorPalettes]);
```

**Step 5: Update signal layer paint on palette change**

Find the existing signal `useEffect` (around line 898) that calls `setPaintProperty` for `"district-signal-fill"`. Update the `fill-color` line:

```ts
// Before:
map.current.setPaintProperty("district-signal-fill", "fill-color", config.fillColor as any);

// After:
const sigPalette = getSignalPalette(signalPalette);
map.current.setPaintProperty(
  "district-signal-fill",
  "fill-color",
  buildSignalFillExpression(activeSignal, sigPalette) as any,
);
```

Add `signalPalette` to the dependency array of that `useEffect`.

**Step 6: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "feat: wire dynamic palettes to MapLibre layer paint"
```

---

### Task 5: localStorage Persistence for Palette Preferences

**Files:**
- Create: `src/features/map/lib/palette-storage.ts`
- Modify: `src/features/map/components/MapV2Shell.tsx` (load on mount)
- Test: `src/features/map/lib/__tests__/palettes.test.ts` (append)

**Step 1: Write the failing test**

```ts
import { loadPalettePrefs, savePalettePrefs } from "@/features/map/lib/palette-storage";

describe("palette-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing stored", () => {
    const prefs = loadPalettePrefs();
    expect(prefs.vendorPalettes.fullmind).toBe("plum");
    expect(prefs.signalPalette).toBe("mint-coral");
  });

  it("round-trips palette preferences", () => {
    const prefs = {
      vendorPalettes: { fullmind: "ocean", proximity: "coral", elevate: "steel-blue", tbt: "forest" },
      signalPalette: "blue-orange",
    };
    savePalettePrefs(prefs);
    expect(loadPalettePrefs()).toEqual(prefs);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("territory-plan:palette-prefs", "not-json");
    const prefs = loadPalettePrefs();
    expect(prefs.vendorPalettes.fullmind).toBe("plum");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```ts
// src/features/map/lib/palette-storage.ts
import type { VendorId } from "@/features/map/lib/layers";
import { DEFAULT_VENDOR_PALETTE, DEFAULT_SIGNAL_PALETTE } from "@/features/map/lib/palettes";

const STORAGE_KEY = "territory-plan:palette-prefs";

interface PalettePrefs {
  vendorPalettes: Record<VendorId, string>;
  signalPalette: string;
}

export function loadPalettePrefs(): PalettePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { vendorPalettes: { ...DEFAULT_VENDOR_PALETTE }, signalPalette: DEFAULT_SIGNAL_PALETTE };
    const parsed = JSON.parse(raw);
    return {
      vendorPalettes: { ...DEFAULT_VENDOR_PALETTE, ...parsed.vendorPalettes },
      signalPalette: parsed.signalPalette ?? DEFAULT_SIGNAL_PALETTE,
    };
  } catch {
    return { vendorPalettes: { ...DEFAULT_VENDOR_PALETTE }, signalPalette: DEFAULT_SIGNAL_PALETTE };
  }
}

export function savePalettePrefs(prefs: PalettePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
```

**Step 4: Wire loading into MapV2Shell**

In `src/features/map/components/MapV2Shell.tsx`, add an `useEffect` on mount:

```ts
import { loadPalettePrefs } from "@/features/map/lib/palette-storage";

// Inside component, after other hooks:
useEffect(() => {
  const prefs = loadPalettePrefs();
  const store = useMapV2Store.getState();
  store.setVendorPalette("fullmind", prefs.vendorPalettes.fullmind);
  store.setVendorPalette("proximity", prefs.vendorPalettes.proximity);
  store.setVendorPalette("elevate", prefs.vendorPalettes.elevate);
  store.setVendorPalette("tbt", prefs.vendorPalettes.tbt);
  store.setSignalPalette(prefs.signalPalette);
}, []);
```

**Step 5: Wire saving — subscribe in MapV2Shell**

Add a Zustand subscription to persist on change:

```ts
import { savePalettePrefs } from "@/features/map/lib/palette-storage";

useEffect(() => {
  const unsub = useMapV2Store.subscribe(
    (state) => ({ vendorPalettes: state.vendorPalettes, signalPalette: state.signalPalette }),
    (curr) => savePalettePrefs(curr),
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  return unsub;
}, []);
```

Note: Zustand `subscribe` with a selector requires `zustand/middleware`. If that's not available, use `useEffect` watching `vendorPalettes` and `signalPalette` from the store.

**Step 6: Run tests**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/features/map/lib/palette-storage.ts src/features/map/components/MapV2Shell.tsx src/features/map/lib/__tests__/palettes.test.ts
git commit -m "feat: persist palette preferences to localStorage"
```

---

### Task 6: Palette Picker UI in LayerBubble

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx`

**Step 1: Add imports and store selectors**

```ts
import { VENDOR_PALETTES, SIGNAL_PALETTES, getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";
import type { VendorId } from "@/features/map/lib/layers";

// Inside component, add selectors:
const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
const setVendorPalette = useMapV2Store((s) => s.setVendorPalette);
const signalPalette = useMapV2Store((s) => s.signalPalette);
const setSignalPalette = useMapV2Store((s) => s.setSignalPalette);
```

**Step 2: Add PalettePickerRow component**

Add inside `LayerBubble.tsx` (before the main component or as a local component):

```tsx
function VendorPalettePicker({ vendorId, activePaletteId, onSelect }: {
  vendorId: VendorId;
  activePaletteId: string;
  onSelect: (paletteId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-6 pr-2 py-1.5">
      {VENDOR_PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`w-5 h-5 rounded-full transition-all ${
            p.id === activePaletteId
              ? "ring-2 ring-offset-1 ring-plum scale-110"
              : "hover:scale-110 ring-1 ring-black/10"
          }`}
          style={{ backgroundColor: p.baseColor }}
          title={p.label}
          aria-label={`${p.label} palette`}
        />
      ))}
    </div>
  );
}

function SignalPalettePicker({ activePaletteId, onSelect }: {
  activePaletteId: string;
  onSelect: (paletteId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-[52px] pr-2 py-1.5">
      {SIGNAL_PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`flex gap-0.5 items-center px-1.5 py-1 rounded-md transition-all ${
            p.id === activePaletteId
              ? "ring-2 ring-offset-1 ring-plum bg-plum/5"
              : "hover:bg-gray-100 ring-1 ring-black/5"
          }`}
          title={p.label}
          aria-label={`${p.label} palette`}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[0] }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[2] }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[4] }} />
        </button>
      ))}
    </div>
  );
}
```

**Step 3: Add palette picker toggle state**

```ts
const [palettePickerOpen, setPalettePickerOpen] = useState<string | null>(null);
// string = vendorId or "signal", null = closed
```

**Step 4: Wire into Fullmind section**

Find the `ColorDot` next to Fullmind's "Show on Map" label (~line 558). Replace the static `<ColorDot color="#403770" />` with a clickable version:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    setPalettePickerOpen(palettePickerOpen === "fullmind" ? null : "fullmind");
  }}
  className="shrink-0"
  title="Change color palette"
>
  <ColorDot color={getVendorPalette(vendorPalettes.fullmind).dotColor} />
</button>
```

After the engagement filter section (but still inside the `activeVendors.has("fullmind")` block), add:

```tsx
{palettePickerOpen === "fullmind" && (
  <VendorPalettePicker
    vendorId="fullmind"
    activePaletteId={vendorPalettes.fullmind}
    onSelect={(id) => setVendorPalette("fullmind", id)}
  />
)}
```

**Step 5: Wire into Competitor section**

Find the competitor `ColorDot` (~line 644). Replace:

```tsx
<ColorDot color={VENDOR_DOT_COLORS[vendorId]} />
```

With:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    setPalettePickerOpen(palettePickerOpen === vendorId ? null : vendorId);
  }}
  className="shrink-0"
  title="Change color palette"
>
  <ColorDot color={getVendorPalette(vendorPalettes[vendorId]).dotColor} />
</button>
```

And add after the engagement filter block inside each competitor:

```tsx
{palettePickerOpen === vendorId && (
  <VendorPalettePicker
    vendorId={vendorId}
    activePaletteId={vendorPalettes[vendorId]}
    onSelect={(id) => setVendorPalette(vendorId, id)}
  />
)}
```

**Step 6: Wire into Signals section**

After the existing legend items render (inside the `isActive` block for each signal, ~line 757-769), add:

```tsx
<SignalPalettePicker
  activePaletteId={signalPalette}
  onSelect={setSignalPalette}
/>
```

**Step 7: Update VENDOR_DOT_COLORS to be dynamic**

The collapsed pill at the bottom (~line 1103-1111) uses `VENDOR_DOT_COLORS`. Update to use the palette:

```tsx
{VENDOR_IDS.filter((v) => activeVendors.has(v)).map((vendorId) => (
  <span
    key={vendorId}
    className="w-2.5 h-2.5 rounded-full border border-white"
    style={{ backgroundColor: getVendorPalette(vendorPalettes[vendorId]).dotColor }}
  />
))}
```

Also update the Fullmind engagement `FULLMIND_ENGAGEMENT_META` colors to reflect the active palette. The simplest approach: compute them dynamically from `vendorPalettes.fullmind` using `getVendorPalette()`.stops.

**Step 8: Manual verification**

1. Open the app, open LayerBubble
2. Click the color dot next to Fullmind — palette row appears
3. Click a different palette — map polygons change color
4. Refresh — palette persists
5. Try competitor vendors and signals

**Step 9: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: add inline palette picker to LayerBubble"
```

---

### Task 7: Update Saved Views to Include Palettes

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx`

**Step 1: Update SavedMapView interface**

Add optional fields to `SavedMapView` (around line 47-61):

```ts
vendorPalettes?: Record<string, string>;
signalPalette?: string;
```

**Step 2: Update handleSaveView**

In the `handleSaveView` callback, add to the view object:

```ts
vendorPalettes: { ...vendorPalettes },
signalPalette,
```

**Step 3: Update handleLoadView**

In the `handleLoadView` callback, add after the existing state restoration:

```ts
// Restore palette preferences if present
if (view.vendorPalettes) {
  for (const [vid, pid] of Object.entries(view.vendorPalettes)) {
    store.setVendorPalette(vid as VendorId, pid);
  }
}
if (view.signalPalette) {
  store.setSignalPalette(view.signalPalette);
}
```

**Step 4: Manual verification**

1. Set custom palettes for vendors
2. Save a view
3. Change palettes to something else
4. Load the saved view — palettes should restore

**Step 5: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: include palette preferences in saved map views"
```

---

### Task 8: Update Legend Items to Reflect Active Palette

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx`

The Fullmind engagement level colors in `FULLMIND_ENGAGEMENT_META` and the signal `legendItems` in `SIGNAL_CONFIGS` are hardcoded. They should reflect the active palette.

**Step 1: Make Fullmind engagement colors dynamic**

Replace the static `FULLMIND_ENGAGEMENT_META` color references. Inside the component, compute dynamic colors:

```ts
const fullmindPalette = getVendorPalette(vendorPalettes.fullmind);
const dynamicFullmindMeta: Record<string, { label: string; color: string }> = {
  target:     { label: "Target",              color: fullmindPalette.stops[0] },
  pipeline:   { label: "Pipeline",            color: fullmindPalette.stops[2] },
  first_year: { label: "First Year Customer", color: fullmindPalette.stops[3] },
  multi_year: { label: "Multi-Year Customer", color: fullmindPalette.stops[5] },
  lapsed:     { label: "Churned",             color: "#F37167" }, // Always coral for churned
};
```

Use `dynamicFullmindMeta` instead of `FULLMIND_ENGAGEMENT_META` in the render.

**Step 2: Make signal legend colors dynamic**

When rendering signal legend items, build them from the active palette instead of `config.legendItems`:

```ts
const sigPalette = getSignalPalette(signalPalette);
const dynamicLegend = signalId === "expenditure"
  ? [
      { label: "Well Above Avg", color: sigPalette.expenditureStops[0] },
      { label: "Above Avg",      color: sigPalette.expenditureStops[1] },
      { label: "Below Avg",      color: sigPalette.expenditureStops[2] },
      { label: "Well Below Avg", color: sigPalette.expenditureStops[3] },
    ]
  : [
      { label: "Strong Growth",  color: sigPalette.growthStops[0] },
      { label: "Growth",         color: sigPalette.growthStops[1] },
      { label: "Stable",         color: sigPalette.growthStops[2] },
      { label: "Decline",        color: sigPalette.growthStops[3] },
      { label: "Strong Decline", color: sigPalette.growthStops[4] },
    ];
```

Also update `SIGNAL_DOT_COLORS` usage to use `sigPalette.dotColor`.

**Step 3: Manual verification**

1. Change Fullmind palette — engagement level color dots in the layer bubble update
2. Change signal palette — legend items update to new colors
3. Collapsed pill dots reflect new vendor palette colors

**Step 4: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: update legend/engagement colors to reflect active palette"
```

---

### Task 9: Final Integration Test

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 2: Manual end-to-end verification**

1. Open the app, navigate to map
2. Open LayerBubble → Fullmind section → click color dot → pick "Ocean"
3. Map polygons transition to blue tones
4. Toggle a competitor → pick "Forest" → green tones
5. Open Signals → Enrollment → pick "Blue → Orange" palette
6. Legend and map update to blue-orange diverging scale
7. Save a view with custom palettes → change palettes → load view → palettes restore
8. Refresh page → palettes persist from localStorage
9. Check the collapsed pill — dots show the active palette colors

**Step 3: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for category color palettes feature"
```
