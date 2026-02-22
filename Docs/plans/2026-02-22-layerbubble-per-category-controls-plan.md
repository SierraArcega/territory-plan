# LayerBubble Per-Category Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give users direct color and opacity control over every individual map category with inline controls, keep palettes as presets, scale up the UI, and warn on unsaved changes.

**Architecture:** New `categoryColors` and `categoryOpacities` state in Zustand keyed by `"vendorOrSignalId:categoryName"`. Expression builders take per-category maps instead of palette stops. Palettes become presets that populate category state. MapLibre `fill-opacity` uses match expressions for per-category opacity. Unsaved-changes detection via snapshot comparison.

**Tech Stack:** React 19, Zustand, MapLibre GL 5, Tailwind CSS 4, Vitest, localStorage

---

### Task 1: Per-Category Defaults Helper + Store State

Add a helper that derives default per-category colors from a palette, then add `categoryColors`, `categoryOpacities`, and setters to the store.

**Files:**
- Modify: `src/features/map/lib/palettes.ts:229-255`
- Modify: `src/features/map/lib/store.ts:90-191` (state), `193-321` (actions), `333-419` (defaults), `~700` (implementations)
- Test: `src/features/map/lib/__tests__/palettes.test.ts`
- Test: `src/lib/__tests__/map-v2-store.test.ts`

**Step 1: Write failing tests for defaults helper**

In `src/features/map/lib/__tests__/palettes.test.ts`, add:

```ts
import {
  // existing imports...
  deriveVendorCategoryColors,
  deriveSignalCategoryColors,
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_OPACITIES,
} from "../palettes";

describe("deriveVendorCategoryColors", () => {
  it("returns 7 keyed entries for fullmind", () => {
    const plum = VENDOR_PALETTES.find((p) => p.id === "plum")!;
    const result = deriveVendorCategoryColors("fullmind", plum);
    expect(result).toEqual({
      "fullmind:target": plum.stops[0],
      "fullmind:new_pipeline": plum.stops[2],
      "fullmind:renewal_pipeline": plum.stops[4],
      "fullmind:expansion_pipeline": plum.stops[5],
      "fullmind:lapsed": plum.stops[1],
      "fullmind:new": plum.stops[3],
      "fullmind:multi_year": plum.stops[6],
    });
  });

  it("returns 3 keyed entries for competitor", () => {
    const coral = VENDOR_PALETTES.find((p) => p.id === "coral")!;
    const result = deriveVendorCategoryColors("proximity", coral);
    expect(result).toEqual({
      "proximity:churned": coral.stops[0],
      "proximity:new": coral.stops[4],
      "proximity:multi_year": coral.stops[5],
    });
  });
});

describe("deriveSignalCategoryColors", () => {
  it("returns 5 keyed entries for growth signal", () => {
    const palette = SIGNAL_PALETTES.find((p) => p.id === "mint-coral")!;
    const result = deriveSignalCategoryColors("enrollment", palette);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result["enrollment:strong_growth"]).toBe(palette.growthStops[0]);
    expect(result["enrollment:strong_decline"]).toBe(palette.growthStops[4]);
  });

  it("returns 4 keyed entries for expenditure signal", () => {
    const palette = SIGNAL_PALETTES.find((p) => p.id === "mint-coral")!;
    const result = deriveSignalCategoryColors("expenditure", palette);
    expect(Object.keys(result)).toHaveLength(4);
    expect(result["expenditure:well_above"]).toBe(palette.expenditureStops[0]);
  });
});

describe("DEFAULT_CATEGORY_COLORS", () => {
  it("has entries for all vendors and signals", () => {
    // Fullmind: 7, proximity/elevate/tbt: 3 each = 16 vendor keys
    // 3 growth signals x 5 + 1 expenditure x 4 = 19 signal keys
    expect(Object.keys(DEFAULT_CATEGORY_COLORS).length).toBe(16 + 19);
  });
});

describe("DEFAULT_CATEGORY_OPACITIES", () => {
  it("has same keys as DEFAULT_CATEGORY_COLORS", () => {
    const colorKeys = Object.keys(DEFAULT_CATEGORY_COLORS).sort();
    const opacityKeys = Object.keys(DEFAULT_CATEGORY_OPACITIES).sort();
    expect(opacityKeys).toEqual(colorKeys);
  });

  it("uses vendor config fillOpacity as default", () => {
    expect(DEFAULT_CATEGORY_OPACITIES["fullmind:target"]).toBe(0.75);
    expect(DEFAULT_CATEGORY_OPACITIES["elevate:churned"]).toBe(0.8);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: FAIL — `deriveVendorCategoryColors` not exported

**Step 3: Implement helpers in palettes.ts**

At the bottom of `src/features/map/lib/palettes.ts` (after the existing helpers), add:

```ts
// ============================================
// Per-category color derivation
// ============================================

/** Derive per-category color map from a vendor palette */
export function deriveVendorCategoryColors(
  vendorId: VendorId,
  palette: VendorPalette,
): Record<string, string> {
  const s = palette.stops;
  if (vendorId === "fullmind") {
    return {
      [`fullmind:target`]: s[0],
      [`fullmind:new_pipeline`]: s[2],
      [`fullmind:renewal_pipeline`]: s[4],
      [`fullmind:expansion_pipeline`]: s[5],
      [`fullmind:lapsed`]: s[1],
      [`fullmind:new`]: s[3],
      [`fullmind:multi_year`]: s[6],
    };
  }
  return {
    [`${vendorId}:churned`]: s[0],
    [`${vendorId}:new`]: s[4],
    [`${vendorId}:multi_year`]: s[5],
  };
}

/** Derive per-category color map from a signal palette */
export function deriveSignalCategoryColors(
  signalId: string,
  palette: SignalPalette,
): Record<string, string> {
  if (signalId === "expenditure") {
    const s = palette.expenditureStops;
    return {
      [`${signalId}:well_above`]: s[0],
      [`${signalId}:above`]: s[1],
      [`${signalId}:below`]: s[2],
      [`${signalId}:well_below`]: s[3],
    };
  }
  const s = palette.growthStops;
  return {
    [`${signalId}:strong_growth`]: s[0],
    [`${signalId}:growth`]: s[1],
    [`${signalId}:stable`]: s[2],
    [`${signalId}:decline`]: s[3],
    [`${signalId}:strong_decline`]: s[4],
  };
}

/** Build complete default category colors from all default palettes */
function buildDefaultCategoryColors(): Record<string, string> {
  const colors: Record<string, string> = {};
  const vendorIds: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];
  for (const vid of vendorIds) {
    Object.assign(colors, deriveVendorCategoryColors(vid, getVendorPalette(DEFAULT_VENDOR_PALETTE[vid])));
  }
  const signalIds = ["enrollment", "ell", "swd", "expenditure"];
  const sigPalette = getSignalPalette(DEFAULT_SIGNAL_PALETTE);
  for (const sid of signalIds) {
    Object.assign(colors, deriveSignalCategoryColors(sid, sigPalette));
  }
  return colors;
}

/** Build default per-category opacities from vendor config defaults */
function buildDefaultCategoryOpacities(): Record<string, number> {
  const opacities: Record<string, number> = {};
  const VENDOR_OPACITIES: Record<string, number> = {
    fullmind: 0.75, proximity: 0.75, elevate: 0.8, tbt: 0.75,
  };
  const SIGNAL_OPACITY = 0.55;
  // Vendor categories
  const defaults = buildDefaultCategoryColors();
  for (const key of Object.keys(defaults)) {
    const vendorId = key.split(":")[0];
    opacities[key] = VENDOR_OPACITIES[vendorId] ?? SIGNAL_OPACITY;
  }
  return opacities;
}

export const DEFAULT_CATEGORY_COLORS = buildDefaultCategoryColors();
export const DEFAULT_CATEGORY_OPACITIES = buildDefaultCategoryOpacities();
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: All PASS

**Step 5: Add state + setters to store**

In `src/features/map/lib/store.ts`:

Add to state interface (after line ~163):
```ts
  // Per-category color + opacity overrides
  categoryColors: Record<string, string>;
  categoryOpacities: Record<string, number>;
```

Add to actions interface (after line ~285):
```ts
  setCategoryColor: (key: string, color: string) => void;
  setCategoryOpacity: (key: string, opacity: number) => void;
  setCategoryColorsForVendor: (vendorId: VendorId, colors: Record<string, string>) => void;
  setCategoryColorsForSignal: (signalId: string, colors: Record<string, string>) => void;
```

Add to initial state (after line ~366):
```ts
  categoryColors: { ...DEFAULT_CATEGORY_COLORS },
  categoryOpacities: { ...DEFAULT_CATEGORY_OPACITIES },
```

Add implementations (after the `setVendorOpacity` implementation):
```ts
  setCategoryColor: (key, color) =>
    set((s) => ({ categoryColors: { ...s.categoryColors, [key]: color } })),
  setCategoryOpacity: (key, opacity) =>
    set((s) => ({ categoryOpacities: { ...s.categoryOpacities, [key]: opacity } })),
  setCategoryColorsForVendor: (vendorId, colors) =>
    set((s) => ({ categoryColors: { ...s.categoryColors, ...colors } })),
  setCategoryColorsForSignal: (signalId, colors) =>
    set((s) => ({ categoryColors: { ...s.categoryColors, ...colors } })),
```

Add import at top of store.ts:
```ts
import { DEFAULT_CATEGORY_COLORS, DEFAULT_CATEGORY_OPACITIES } from "@/features/map/lib/palettes";
```

**Step 6: Write store tests**

In `src/lib/__tests__/map-v2-store.test.ts`, add:

```ts
  it("initializes with default category colors and opacities", () => {
    const state = useMapV2Store.getState();
    expect(Object.keys(state.categoryColors).length).toBeGreaterThan(30);
    expect(state.categoryColors["fullmind:target"]).toBeDefined();
    expect(state.categoryOpacities["fullmind:target"]).toBe(0.75);
  });

  it("setCategoryColor updates a single category", () => {
    useMapV2Store.getState().setCategoryColor("fullmind:target", "#ff0000");
    expect(useMapV2Store.getState().categoryColors["fullmind:target"]).toBe("#ff0000");
    // Other keys unchanged
    expect(useMapV2Store.getState().categoryColors["fullmind:pipeline"]).not.toBe("#ff0000");
  });

  it("setCategoryOpacity updates a single category", () => {
    useMapV2Store.getState().setCategoryOpacity("fullmind:target", 0.5);
    expect(useMapV2Store.getState().categoryOpacities["fullmind:target"]).toBe(0.5);
  });

  it("setCategoryColorsForVendor overwrites all keys for that vendor", () => {
    const colors = { "fullmind:target": "#aaa", "fullmind:lapsed": "#bbb" };
    useMapV2Store.getState().setCategoryColorsForVendor("fullmind", colors);
    expect(useMapV2Store.getState().categoryColors["fullmind:target"]).toBe("#aaa");
    expect(useMapV2Store.getState().categoryColors["fullmind:lapsed"]).toBe("#bbb");
  });
```

**Step 7: Run store tests**

Run: `npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: All PASS

**Step 8: Commit**

```bash
git add src/features/map/lib/palettes.ts src/features/map/lib/store.ts src/features/map/lib/__tests__/palettes.test.ts src/lib/__tests__/map-v2-store.test.ts
git commit -m "feat: add per-category color/opacity state and defaults helpers"
```

---

### Task 2: Expression Builders — Per-Category Colors + Opacity Expressions

Refactor `buildVendorFillExpression` and `buildSignalFillExpression` to accept a category color map. Add a new `buildCategoryOpacityExpression` that produces a MapLibre `match` expression for `fill-opacity`.

**Files:**
- Modify: `src/features/map/lib/layers.ts:245-311`
- Test: `src/features/map/lib/__tests__/palettes.test.ts`

**Step 1: Write failing tests**

In `src/features/map/lib/__tests__/palettes.test.ts`, add new describe blocks:

```ts
import {
  buildVendorFillExpressionFromCategories,
  buildSignalFillExpressionFromCategories,
  buildCategoryOpacityExpression,
} from "@/features/map/lib/layers";

describe("buildVendorFillExpressionFromCategories", () => {
  it("builds fullmind expression from category colors", () => {
    const colors: Record<string, string> = {
      "fullmind:target": "#aaa",
      "fullmind:new_pipeline": "#bbb",
      "fullmind:renewal_pipeline": "#ccc",
      "fullmind:expansion_pipeline": "#ddd",
      "fullmind:lapsed": "#eee",
      "fullmind:new": "#fff",
      "fullmind:multi_year": "#111",
    };
    const expr = buildVendorFillExpressionFromCategories("fullmind", colors);
    expect(expr[0]).toBe("match");
    // Should contain "target" → "#aaa"
    const idx = expr.indexOf("target");
    expect(expr[idx + 1]).toBe("#aaa");
  });

  it("builds competitor expression from category colors", () => {
    const colors: Record<string, string> = {
      "proximity:churned": "#aaa",
      "proximity:new": "#bbb",
      "proximity:multi_year": "#ccc",
    };
    const expr = buildVendorFillExpressionFromCategories("proximity", colors);
    expect(expr[0]).toBe("match");
    const idx = expr.indexOf("churned");
    expect(expr[idx + 1]).toBe("#aaa");
  });
});

describe("buildSignalFillExpressionFromCategories", () => {
  it("builds growth signal expression from category colors", () => {
    const colors: Record<string, string> = {
      "enrollment:strong_growth": "#a",
      "enrollment:growth": "#b",
      "enrollment:stable": "#c",
      "enrollment:decline": "#d",
      "enrollment:strong_decline": "#e",
    };
    const expr = buildSignalFillExpressionFromCategories("enrollment", colors);
    expect(expr[0]).toBe("match");
    const idx = expr.indexOf("strong_growth");
    expect(expr[idx + 1]).toBe("#a");
  });

  it("builds expenditure signal expression from category colors", () => {
    const colors: Record<string, string> = {
      "expenditure:well_above": "#a",
      "expenditure:above": "#b",
      "expenditure:below": "#c",
      "expenditure:well_below": "#d",
    };
    const expr = buildSignalFillExpressionFromCategories("expenditure", colors);
    expect(expr[0]).toBe("match");
    const idx = expr.indexOf("well_above");
    expect(expr[idx + 1]).toBe("#a");
  });
});

describe("buildCategoryOpacityExpression", () => {
  it("builds match expression mapping categories to opacities", () => {
    const opacities: Record<string, number> = {
      "fullmind:target": 0.5,
      "fullmind:lapsed": 0.3,
      "fullmind:new_pipeline": 0.8,
      "fullmind:renewal_pipeline": 0.7,
      "fullmind:expansion_pipeline": 0.9,
      "fullmind:new": 0.6,
      "fullmind:multi_year": 1.0,
    };
    const expr = buildCategoryOpacityExpression("fullmind", opacities);
    expect(expr[0]).toBe("match");
    const idx = expr.indexOf("target");
    expect(expr[idx + 1]).toBe(0.5);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: FAIL — functions not exported

**Step 3: Implement in layers.ts**

Add after the existing `buildSignalFillExpression` (after line ~311):

```ts
/**
 * Build a MapLibre match expression for a vendor layer using per-category colors.
 * Keys in `categoryColors` are "vendorId:categoryName".
 */
export function buildVendorFillExpressionFromCategories(
  vendorId: VendorId,
  categoryColors: Record<string, string>,
): ExpressionSpecification {
  const tileProperty = VENDOR_CONFIGS[vendorId].tileProperty;

  if (vendorId === "fullmind") {
    return [
      "match",
      ["get", tileProperty],
      "target", categoryColors[`fullmind:target`] ?? "#ecebf1",
      "new_pipeline", categoryColors[`fullmind:new_pipeline`] ?? "#b3afc6",
      "renewal_pipeline", categoryColors[`fullmind:renewal_pipeline`] ?? "#665f8d",
      "expansion_pipeline", categoryColors[`fullmind:expansion_pipeline`] ?? "#403770",
      "lapsed", categoryColors[`fullmind:lapsed`] ?? "#d9d7e2",
      "new", categoryColors[`fullmind:new`] ?? "#8c87a9",
      "multi_year", categoryColors[`fullmind:multi_year`] ?? "#403770",
      "rgba(0,0,0,0)",
    ];
  }

  return [
    "match",
    ["get", tileProperty],
    "churned", categoryColors[`${vendorId}:churned`] ?? "#fef1f0",
    "new", categoryColors[`${vendorId}:new`] ?? "#e06b5e",
    "multi_year", categoryColors[`${vendorId}:multi_year`] ?? "#F37167",
    "rgba(0,0,0,0)",
  ];
}

/**
 * Build a MapLibre match expression for a signal layer using per-category colors.
 */
export function buildSignalFillExpressionFromCategories(
  signalId: SignalId,
  categoryColors: Record<string, string>,
): ExpressionSpecification {
  const tileProperty = SIGNAL_CONFIGS[signalId].tileProperty;

  if (signalId === "expenditure") {
    return [
      "match",
      ["get", tileProperty],
      "well_above", categoryColors[`${signalId}:well_above`] ?? "#4ECDC4",
      "above", categoryColors[`${signalId}:above`] ?? "#a3e6e1",
      "below", categoryColors[`${signalId}:below`] ?? "#f5a3a0",
      "well_below", categoryColors[`${signalId}:well_below`] ?? "#F37167",
      "rgba(0,0,0,0)",
    ];
  }

  return [
    "match",
    ["get", tileProperty],
    "strong_growth", categoryColors[`${signalId}:strong_growth`] ?? "#4ECDC4",
    "growth", categoryColors[`${signalId}:growth`] ?? "#a3e6e1",
    "stable", categoryColors[`${signalId}:stable`] ?? "#f0f0e8",
    "decline", categoryColors[`${signalId}:decline`] ?? "#f5a3a0",
    "strong_decline", categoryColors[`${signalId}:strong_decline`] ?? "#F37167",
    "rgba(0,0,0,0)",
  ];
}

/**
 * Build a MapLibre match expression for per-category fill-opacity.
 * Returns a ["match", ...] expression so each tile category gets its own opacity.
 */
export function buildCategoryOpacityExpression(
  layerId: string,
  categoryOpacities: Record<string, number>,
): ExpressionSpecification {
  const config = VENDOR_CONFIGS[layerId as VendorId];
  const tileProperty = config?.tileProperty ?? SIGNAL_CONFIGS[layerId as SignalId]?.tileProperty;
  const defaultOpacity = config?.fillOpacity ?? 0.55;

  // Collect all category entries for this layer
  const prefix = `${layerId}:`;
  const entries: (string | number)[] = [];
  for (const [key, opacity] of Object.entries(categoryOpacities)) {
    if (key.startsWith(prefix)) {
      entries.push(key.slice(prefix.length), opacity);
    }
  }

  if (entries.length === 0) return ["literal", defaultOpacity] as any;

  return [
    "match",
    ["get", tileProperty],
    ...entries,
    defaultOpacity,
  ] as ExpressionSpecification;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/layers.ts src/features/map/lib/__tests__/palettes.test.ts
git commit -m "feat: add per-category expression builders for color and opacity"
```

---

### Task 3: Persistence — Per-Category State in localStorage

Update `palette-storage.ts` to save/load `categoryColors` and `categoryOpacities`, and update `MapV2Shell.tsx` to load/subscribe them.

**Files:**
- Modify: `src/features/map/lib/palette-storage.ts`
- Modify: `src/features/map/components/MapV2Shell.tsx`
- Test: `src/features/map/lib/__tests__/palettes.test.ts`

**Step 1: Update PalettePrefs interface and load/save**

In `src/features/map/lib/palette-storage.ts`, add to the `PalettePrefs` interface:

```ts
  categoryColors: Record<string, string>;
  categoryOpacities: Record<string, number>;
```

In `loadPalettePrefs()`, add to both the empty and parsed return paths:

```ts
  categoryColors: { ...DEFAULT_CATEGORY_COLORS, ...parsed.categoryColors },
  categoryOpacities: { ...DEFAULT_CATEGORY_OPACITIES, ...parsed.categoryOpacities },
```

And the fallback:
```ts
  categoryColors: { ...DEFAULT_CATEGORY_COLORS },
  categoryOpacities: { ...DEFAULT_CATEGORY_OPACITIES },
```

Import `DEFAULT_CATEGORY_COLORS` and `DEFAULT_CATEGORY_OPACITIES` from palettes.

**Step 2: Update MapV2Shell.tsx load + subscribe**

In the mount useEffect, after loading palette prefs:
```ts
  store.setCategoryColorsForVendor("fullmind" as any, {}); // Clear first
  // Actually, just set the whole maps:
  // Add a new store action: initCategoryState
```

Simpler approach — add a bulk setter to the store:
```ts
  initCategoryState: (colors: Record<string, string>, opacities: Record<string, number>) => void;
```

Implementation:
```ts
  initCategoryState: (colors, opacities) => set({ categoryColors: colors, categoryOpacities: opacities }),
```

Then in MapV2Shell mount:
```ts
  store.initCategoryState(prefs.categoryColors, prefs.categoryOpacities);
```

In the subscribe callback, add to the change detection:
```ts
  state.categoryColors !== prevState.categoryColors ||
  state.categoryOpacities !== prevState.categoryOpacities
```

And include in the save call:
```ts
  categoryColors: state.categoryColors,
  categoryOpacities: state.categoryOpacities,
```

**Step 3: Update round-trip test**

In `src/features/map/lib/__tests__/palettes.test.ts`, update the round-trip test to include the new fields:

```ts
  it("round-trips palette preferences including category overrides", () => {
    const prefs = {
      vendorPalettes: { fullmind: "ocean", proximity: "coral", elevate: "steel-blue", tbt: "forest" },
      signalPalette: "blue-orange",
      vendorOpacities: { fullmind: 0.5, proximity: 0.6, elevate: 0.7, tbt: 0.8 },
      categoryColors: { "fullmind:target": "#ff0000", "proximity:churned": "#00ff00" },
      categoryOpacities: { "fullmind:target": 0.3, "proximity:churned": 0.9 },
    };
    savePalettePrefs(prefs as any);
    const loaded = loadPalettePrefs();
    expect(loaded.categoryColors["fullmind:target"]).toBe("#ff0000");
    expect(loaded.categoryOpacities["fullmind:target"]).toBe(0.3);
  });
```

**Step 4: Run tests**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/palette-storage.ts src/features/map/components/MapV2Shell.tsx src/features/map/lib/store.ts src/features/map/lib/__tests__/palettes.test.ts
git commit -m "feat: persist per-category colors and opacities to localStorage"
```

---

### Task 4: Wire Palette-as-Preset

When the user picks a palette, derive per-category colors from it and write them to `categoryColors`. This makes palettes act as presets.

**Files:**
- Modify: `src/features/map/lib/store.ts`
- Test: `src/lib/__tests__/map-v2-store.test.ts`

**Step 1: Write failing test**

```ts
  it("setVendorPalette also updates categoryColors for that vendor", () => {
    const store = useMapV2Store.getState();
    store.setVendorPalette("fullmind", "coral");
    const state = useMapV2Store.getState();
    // After switching to coral, fullmind:target should be coral's stops[0]
    const coralPalette = getVendorPalette("coral");
    expect(state.categoryColors["fullmind:target"]).toBe(coralPalette.stops[0]);
  });

  it("setSignalPalette also updates categoryColors for all signals", () => {
    const store = useMapV2Store.getState();
    store.setSignalPalette("blue-orange");
    const state = useMapV2Store.getState();
    const palette = getSignalPalette("blue-orange");
    expect(state.categoryColors["enrollment:strong_growth"]).toBe(palette.growthStops[0]);
    expect(state.categoryColors["expenditure:well_above"]).toBe(palette.expenditureStops[0]);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: FAIL

**Step 3: Update setVendorPalette and setSignalPalette**

In `src/features/map/lib/store.ts`, modify the existing implementations:

```ts
  setVendorPalette: (vendorId, paletteId) =>
    set((s) => ({
      vendorPalettes: { ...s.vendorPalettes, [vendorId]: paletteId },
      categoryColors: {
        ...s.categoryColors,
        ...deriveVendorCategoryColors(vendorId, getVendorPalette(paletteId)),
      },
    })),
  setSignalPalette: (paletteId) => {
    const palette = getSignalPalette(paletteId);
    const signalColors: Record<string, string> = {};
    for (const sid of ["enrollment", "ell", "swd", "expenditure"]) {
      Object.assign(signalColors, deriveSignalCategoryColors(sid, palette));
    }
    return set((s) => ({
      signalPalette: paletteId,
      categoryColors: { ...s.categoryColors, ...signalColors },
    }));
  },
```

Add imports:
```ts
import { deriveVendorCategoryColors, deriveSignalCategoryColors, getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/map-v2-store.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/features/map/lib/store.ts src/lib/__tests__/map-v2-store.test.ts
git commit -m "feat: palettes as presets — setting a palette populates category colors"
```

---

### Task 5: Wire MapV2Container to Per-Category State

Update the initial layer setup and useEffects in `MapV2Container.tsx` to use `categoryColors` and `categoryOpacities` (via the new expression builders) instead of the palette-based expressions.

**Files:**
- Modify: `src/features/map/components/MapV2Container.tsx:155-157` (selectors), `331-349` (init), `895-933` (vendor effects), `935-971` (signal effect)

**Step 1: Add store selectors**

After the existing `vendorOpacities` selector (~line 156), add:
```ts
  const categoryColors = useMapV2Store((s) => s.categoryColors);
  const categoryOpacities = useMapV2Store((s) => s.categoryOpacities);
```

**Step 2: Update initial vendor layer setup (lines 331-349)**

Replace the `fill-color` and `fill-opacity` paint properties:

```ts
  "fill-color": buildVendorFillExpressionFromCategories(
    vendorId,
    useMapV2Store.getState().categoryColors,
  ) as any,
  "fill-opacity": buildCategoryOpacityExpression(
    vendorId,
    useMapV2Store.getState().categoryOpacities,
  ) as any,
```

Import the new functions from layers.ts:
```ts
import {
  buildVendorFillExpressionFromCategories,
  buildSignalFillExpressionFromCategories,
  buildCategoryOpacityExpression,
} from "@/features/map/lib/layers";
```

**Step 3: Replace the vendorPalettes useEffect (lines 895-921)**

Replace with a new effect that reacts to `categoryColors`:

```ts
  // Update vendor layer colors when per-category colors change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      map.current.setPaintProperty(
        layerId,
        "fill-color",
        buildVendorFillExpressionFromCategories(vendorId, categoryColors) as any,
      );
    }

    // Update account point layer too
    if (map.current.getLayer(ACCOUNT_POINT_LAYER_ID)) {
      const firstVendor = [...useMapV2Store.getState().activeVendors][0];
      if (firstVendor) {
        map.current.setPaintProperty(
          ACCOUNT_POINT_LAYER_ID,
          "circle-color",
          buildVendorFillExpressionFromCategories(firstVendor, categoryColors) as any,
        );
      }
    }
  }, [categoryColors, mapReady]);
```

**Step 4: Replace the vendorOpacities useEffect (lines 924-933)**

Replace with per-category opacity:

```ts
  // Update vendor layer opacity when per-category opacities change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      map.current.setPaintProperty(
        layerId,
        "fill-opacity",
        buildCategoryOpacityExpression(vendorId, categoryOpacities) as any,
      );
    }
  }, [categoryOpacities, mapReady]);
```

**Step 5: Update the signal layer useEffect (lines 935-971)**

In the signal effect, replace the fill-color and fill-opacity lines:

```ts
  map.current.setPaintProperty(
    "district-signal-fill",
    "fill-color",
    buildSignalFillExpressionFromCategories(activeSignal, categoryColors) as any,
  );
  map.current.setPaintProperty(
    "district-signal-fill",
    "fill-opacity",
    buildCategoryOpacityExpression(activeSignal, categoryOpacities) as any,
  );
```

Add `categoryColors` and `categoryOpacities` to the dependency array.

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep MapV2Container`
Expected: No errors

**Step 7: Commit**

```bash
git add src/features/map/components/MapV2Container.tsx
git commit -m "feat: wire MapV2Container to per-category color and opacity state"
```

---

### Task 6: Scale Increase

Bump all sizing in LayerBubble.tsx per the design spec.

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx`

**Step 1: Apply sizing changes**

These are all find-and-replace operations in `LayerBubble.tsx`:

| Find | Replace | Notes |
|------|---------|-------|
| `w-[320px]` | `w-[380px]` | Popover width |
| `text-[10px]` | `text-xs` | Section headers, sub-labels |
| `text-[11px]` | `text-xs` | Small action text |
| `w-3.5 h-3.5` (on checkboxes) | `w-4 h-4` | Checkbox size |
| `w-2.5 h-2.5` (default ColorDot) | `w-3 h-3` | Dot size |
| `px-3` | `px-4` | Row horizontal padding (on section divs) |
| `py-1.5` (on row labels) | `py-2` | Row vertical padding (selective — apply to label rows, not sub-elements) |
| `text-sm` (on labels/text) | `text-[15px]` | Body text size |

**Important:** Be selective with replacements — `text-sm` on `<select>` and `<input>` elements should also change to `text-[15px]`. But `text-sm` on the collapsed pill label should change too. Do NOT change `text-sm` inside the dropdown option elements.

Also update the `ColorDot` default:
```ts
function ColorDot({ color, size = "w-3 h-3" }: { color: string; size?: string }) {
```

**Step 2: Verify visually**

Run the dev server and check the LayerBubble opens at the new size. All text should be visibly larger and more readable.

**Step 3: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "style: scale up LayerBubble for readability"
```

---

### Task 7: Inline Per-Category Controls — Swatch Picker + Opacity Slider

Replace the current category rows with the new layout: clickable color dot + inline swatch row + opacity slider.

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx`

**Step 1: Create the CategorySwatchPicker component**

Add inside `LayerBubble.tsx` (after the existing `SignalPalettePicker` component, before `export default`):

```tsx
/* ─── Color swatch presets ─── */
const SWATCH_COLORS = [
  "#403770", "#665f8d", "#8c87a9", "#b3afc6", "#ecebf1", // Plum ramp
  "#F37167", "#e06b5e", "#c44f44", "#fde3e1",             // Coral ramp
  "#6EA3BE", "#4a8ba8", "#a3c9db",                         // Steel Blue
  "#FFCF70", "#ffd98d", "#FFB347",                         // Golden
  "#4ECDC4", "#3ab0a7", "#a3e6e1",                         // Mint
  "#E74C3C", "#2ECC71", "#3498DB", "#9B59B6",              // Vivid accents
  "#95A5A6", "#BDC3C7", "#ECF0F1",                         // Grays
];

function CategorySwatchPicker({
  activeColor,
  onSelect,
}: {
  activeColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 pl-10 pr-2 py-1.5">
      {SWATCH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`w-5 h-5 rounded-full transition-all ${
            c.toLowerCase() === activeColor.toLowerCase()
              ? "ring-2 ring-offset-1 ring-plum scale-110"
              : "hover:scale-110 ring-1 ring-black/10"
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}
```

**Step 2: Create the CategoryRow component**

This is the reusable row with checkbox, clickable dot, label, opacity slider:

```tsx
function CategoryRow({
  categoryKey,
  label,
  checked,
  onToggle,
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  swatchOpen,
  onToggleSwatch,
}: {
  categoryKey: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  swatchOpen: boolean;
  onToggleSwatch: () => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2.5 pl-8 pr-4 py-1.5 rounded-lg transition-colors ${
          checked ? "bg-plum/5" : "hover:bg-gray-50"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
        />
        <button
          type="button"
          onClick={onToggleSwatch}
          className="shrink-0 group"
          title="Change color"
        >
          <span
            className="w-3 h-3 rounded-full block ring-1 ring-black/5 group-hover:ring-2 group-hover:ring-plum/40 transition-all"
            style={{ backgroundColor: color }}
          />
        </button>
        <span className={`text-[15px] flex-1 ${checked ? "font-medium text-gray-800" : "text-gray-600"}`}>
          {label}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="w-16 h-1 accent-plum cursor-pointer shrink-0"
        />
        <span className="text-xs text-gray-400 w-7 text-right tabular-nums shrink-0">
          {Math.round(opacity * 100)}%
        </span>
      </div>
      {swatchOpen && (
        <CategorySwatchPicker activeColor={color} onSelect={onColorChange} />
      )}
    </div>
  );
}
```

**Step 3: Replace Fullmind engagement rows**

Replace the current `ALL_FULLMIND_ENGAGEMENTS.map(...)` block (lines ~651-673) with:

```tsx
  {ALL_FULLMIND_ENGAGEMENTS.map((level) => {
    const meta = FULLMIND_ENGAGEMENT_META[level];
    const key = `fullmind:${level}`;
    const isActive = fullmindEngagement.includes(level);
    return (
      <CategoryRow
        key={level}
        categoryKey={key}
        label={meta.label}
        checked={isActive}
        onToggle={() => toggleFullmindEngagement(level)}
        color={categoryColors[key] ?? meta.color}
        opacity={categoryOpacities[key] ?? 0.75}
        onColorChange={(c) => setCategoryColor(key, c)}
        onOpacityChange={(o) => setCategoryOpacity(key, o)}
        swatchOpen={palettePickerOpen === key}
        onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === key ? null : key)}
      />
    );
  })}
```

Add the new store selectors at the top of `LayerBubble()`:
```ts
  const categoryColors = useMapV2Store((s) => s.categoryColors);
  const categoryOpacities = useMapV2Store((s) => s.categoryOpacities);
  const setCategoryColor = useMapV2Store((s) => s.setCategoryColor);
  const setCategoryOpacity = useMapV2Store((s) => s.setCategoryOpacity);
```

**Step 4: Move palette picker to vendor header**

Move the `VendorPalettePicker` from inside the engagement list to the Fullmind section header area (next to the "FULLMIND" label):

```tsx
  <button
    type="button"
    onClick={() => setFullmindOpen(!fullmindOpen)}
    className="w-full flex items-center gap-1.5 mt-2 mb-1 group"
  >
    <ChevronDown open={fullmindOpen} className="text-gray-400 group-hover:text-gray-600" />
    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
      Fullmind
    </span>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPalettePickerOpen(palettePickerOpen === "fullmind" ? null : "fullmind");
      }}
      className="ml-auto text-xs text-gray-400 hover:text-plum transition-colors"
    >
      Palette
    </button>
  </button>
  {palettePickerOpen === "fullmind" && (
    <VendorPalettePicker ... />
  )}
```

**Step 5: Remove the old per-vendor opacity slider**

Delete the `<label className="flex items-center gap-2 pl-6 pr-2 mt-0.5 mb-1">` opacity slider that was at the vendor level (for Fullmind and each competitor).

**Step 6: Apply same pattern to competitor engagement rows**

Replace `ALL_COMPETITOR_ENGAGEMENTS.map(...)` with `CategoryRow` using keys like `"proximity:churned"`, `"proximity:new"`, `"proximity:multi_year"`.

Move competitor palette picker to the competitor header row.

**Step 7: Apply same pattern to signal legend items**

Replace the signal legend `items.map(...)` with `CategoryRow` components using keys like `"enrollment:strong_growth"` etc. The signals currently use radio buttons (only one active at a time) so keep that behavior for the signal selector, but within the active signal's legend, each category item gets `CategoryRow`.

Move the signal palette picker to the signal section header.

**Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep LayerBubble`
Expected: No errors

**Step 9: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: inline per-category color swatch and opacity slider in LayerBubble"
```

---

### Task 8: Unsaved Changes Warning

Add snapshot comparison and an inline warning bar when closing the LayerBubble with unsaved changes.

**Files:**
- Modify: `src/features/map/lib/store.ts`
- Modify: `src/features/map/components/LayerBubble.tsx`

**Step 1: Add snapshot state to store**

In the state interface:
```ts
  /** Serialized snapshot of map state at last save/load. null = never saved. */
  lastSavedSnapshot: string | null;
```

In actions:
```ts
  captureSnapshot: () => void;
  hasUnsavedChanges: () => boolean;
```

Default:
```ts
  lastSavedSnapshot: null,
```

**Step 2: Implement snapshot helpers**

```ts
function serializeMapState(s: MapV2State): string {
  return JSON.stringify({
    activeVendors: [...s.activeVendors].sort(),
    filterOwner: s.filterOwner,
    filterPlanId: s.filterPlanId,
    filterStates: [...s.filterStates].sort(),
    activeSignal: s.activeSignal,
    visibleLocales: [...s.visibleLocales].sort(),
    filterAccountTypes: [...s.filterAccountTypes].sort(),
    fullmindEngagement: [...s.fullmindEngagement].sort(),
    competitorEngagement: s.competitorEngagement,
    selectedFiscalYear: s.selectedFiscalYear,
    categoryColors: s.categoryColors,
    categoryOpacities: s.categoryOpacities,
    vendorPalettes: s.vendorPalettes,
    signalPalette: s.signalPalette,
  });
}
```

Action implementations:
```ts
  captureSnapshot: () => set((s) => ({ lastSavedSnapshot: serializeMapState(s) })),
  hasUnsavedChanges: () => {
    const s = get();
    if (!s.lastSavedSnapshot) return false; // Never saved = nothing to warn about
    return serializeMapState(s) !== s.lastSavedSnapshot;
  },
```

**Step 3: Capture snapshot on load/save**

In `MapV2Shell.tsx`, after loading prefs in the mount effect:
```ts
  // Capture initial snapshot after state is loaded
  requestAnimationFrame(() => store.captureSnapshot());
```

In `LayerBubble.tsx`, in `handleSaveView`, after `persistViews(next)`:
```ts
  useMapV2Store.getState().captureSnapshot();
```

In `handleLoadView`, at the end:
```ts
  store.captureSnapshot();
```

**Step 4: Add unsaved changes bar to LayerBubble**

Add a state variable:
```ts
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
```

Modify the close-on-outside-click handler:
```ts
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      if (useMapV2Store.getState().hasUnsavedChanges()) {
        setShowUnsavedWarning(true);
        return; // Don't close
      }
      setLayerBubbleOpen(false);
    }
  };
```

Same for the Escape handler:
```ts
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (showUnsavedWarning) {
        // Second Escape dismisses the warning and closes
        setShowUnsavedWarning(false);
        setLayerBubbleOpen(false);
        return;
      }
      if (useMapV2Store.getState().hasUnsavedChanges()) {
        setShowUnsavedWarning(true);
        return;
      }
      setLayerBubbleOpen(false);
    }
  };
```

Add the warning bar at the bottom of the popover (before the closing `</div>` of the popover, after the save section):

```tsx
  {showUnsavedWarning && (
    <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
      <span className="text-xs text-amber-800 flex-1">Unsaved changes</span>
      <button
        type="button"
        onClick={() => {
          setShowUnsavedWarning(false);
          setSaveDialogOpen(true);
        }}
        className="px-2.5 py-1 text-xs font-medium bg-plum text-white rounded-md hover:bg-plum/90 transition-colors"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setShowUnsavedWarning(false);
          setLayerBubbleOpen(false);
        }}
        className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        Dismiss
      </button>
    </div>
  )}
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "LayerBubble|store\.ts|MapV2Shell"`
Expected: No errors

**Step 6: Commit**

```bash
git add src/features/map/lib/store.ts src/features/map/components/LayerBubble.tsx src/features/map/components/MapV2Shell.tsx
git commit -m "feat: unsaved changes warning when closing LayerBubble"
```

---

### Task 9: Integration Verification

Run all tests, verify the dev server works, check for regressions.

**Step 1: Run all palette and store tests**

Run: `npx vitest run src/features/map/lib/__tests__/palettes.test.ts src/lib/__tests__/map-v2-store.test.ts`
Expected: All pass

**Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E "LayerBubble|MapV2Container|MapV2Shell|store\.ts|palettes|layers|palette-storage"`
Expected: No errors in our files

**Step 3: Visual smoke test**

1. Open localhost:3005
2. Open Build View → Fullmind → Show on Map
3. Verify each engagement row (Target, Pipeline, etc.) has a color dot + opacity slider
4. Click a color dot → swatch row appears
5. Pick a new color → map updates immediately
6. Drag an opacity slider → that category's fill opacity changes on the map
7. Click "Palette" in the Fullmind header → pick a different palette → all category colors reset
8. Close the popover → unsaved changes warning appears
9. Click Save → save dialog opens
10. Click Dismiss → popover closes without saving

**Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: final integration verification for per-category controls"
```
