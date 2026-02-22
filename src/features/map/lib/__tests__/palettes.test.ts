import { describe, it, expect } from "vitest";
import {
  VENDOR_PALETTES,
  SIGNAL_PALETTES,
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
  type VendorPalette,
  type SignalPalette,
  deriveVendorCategoryColors,
  deriveSignalCategoryColors,
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_OPACITIES,
} from "@/features/map/lib/palettes";
import {
  buildVendorFillExpression,
  buildSignalFillExpression,
  buildVendorFillExpressionFromCategories,
  buildSignalFillExpressionFromCategories,
  buildCategoryOpacityExpression,
} from "@/features/map/lib/layers";
import { getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";

describe("palettes", () => {
  it("exports at least 8 vendor palettes", () => {
    expect(VENDOR_PALETTES.length).toBeGreaterThanOrEqual(8);
  });

  it("each vendor palette has 7 stops (lightest to darkest)", () => {
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

describe("buildVendorFillExpression", () => {
  it("returns a match expression using the palette stops", () => {
    const palette = getVendorPalette("plum");
    const expr = buildVendorFillExpression("fullmind", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "fullmind_category"]);
    expect(expr).toContain(palette.stops[5]);
    expect(expr[expr.length - 1]).toBe("rgba(0,0,0,0)");
  });

  it("works for competitor vendors (3-category)", () => {
    const palette = getVendorPalette("coral");
    const expr = buildVendorFillExpression("proximity", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "proximity_category"]);
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
    expect(expr).toContain(palette.growthStops[0]);
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

describe("deriveVendorCategoryColors", () => {
  it("returns 7 keyed entries for fullmind", () => {
    const plum = VENDOR_PALETTES.find((p) => p.id === "plum")!;
    const result = deriveVendorCategoryColors("fullmind", plum);
    expect(Object.keys(result)).toHaveLength(7);
    expect(result["fullmind:target"]).toBe(plum.stops[0]);
    expect(result["fullmind:multi_year"]).toBe(plum.stops[6]);
  });

  it("returns 3 keyed entries for competitor", () => {
    const coral = VENDOR_PALETTES.find((p) => p.id === "coral")!;
    const result = deriveVendorCategoryColors("proximity", coral);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["proximity:churned"]).toBe(coral.stops[0]);
    expect(result["proximity:multi_year"]).toBe(coral.stops[5]);
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
    const idx = (expr as any[]).indexOf("target");
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
    const idx = (expr as any[]).indexOf("churned");
    expect(expr[idx + 1]).toBe("#aaa");
  });
});

describe("buildSignalFillExpressionFromCategories", () => {
  it("builds growth signal expression", () => {
    const colors: Record<string, string> = {
      "enrollment:strong_growth": "#a1",
      "enrollment:growth": "#b1",
      "enrollment:stable": "#c1",
      "enrollment:decline": "#d1",
      "enrollment:strong_decline": "#e1",
    };
    const expr = buildSignalFillExpressionFromCategories("enrollment", colors);
    expect(expr[0]).toBe("match");
    const idx = (expr as any[]).indexOf("strong_growth");
    expect(expr[idx + 1]).toBe("#a1");
  });

  it("builds expenditure signal expression", () => {
    const colors: Record<string, string> = {
      "expenditure:well_above": "#a2",
      "expenditure:above": "#b2",
      "expenditure:below": "#c2",
      "expenditure:well_below": "#d2",
    };
    const expr = buildSignalFillExpressionFromCategories("expenditure", colors);
    expect(expr[0]).toBe("match");
    const idx = (expr as any[]).indexOf("well_above");
    expect(expr[idx + 1]).toBe("#a2");
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
    const idx = (expr as any[]).indexOf("target");
    expect(expr[idx + 1]).toBe(0.5);
  });

  it("returns literal for empty opacities", () => {
    const expr = buildCategoryOpacityExpression("fullmind", {});
    expect(expr[0]).toBe("literal");
  });
});

// ============================================
// palette-storage tests
// ============================================

import {
  loadPalettePrefs,
  savePalettePrefs,
} from "@/features/map/lib/palette-storage";

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
      vendorPalettes: {
        fullmind: "ocean",
        proximity: "coral",
        elevate: "steel-blue",
        tbt: "forest",
      },
      signalPalette: "blue-orange",
      vendorOpacities: {
        fullmind: 0.5,
        proximity: 0.6,
        elevate: 0.7,
        tbt: 0.8,
      },
    };
    savePalettePrefs(prefs);
    expect(loadPalettePrefs()).toEqual(prefs);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("territory-plan:palette-prefs", "not-json");
    const prefs = loadPalettePrefs();
    expect(prefs.vendorPalettes.fullmind).toBe("plum");
    expect(prefs.vendorOpacities.fullmind).toBe(0.75);
  });
});
