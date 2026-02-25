import { describe, it, expect, beforeEach } from "vitest";
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
    expect(DEFAULT_VENDOR_PALETTE.fullmind).toBe("steel-blue");
    expect(DEFAULT_VENDOR_PALETTE.proximity).toBe("coral");
    expect(DEFAULT_VENDOR_PALETTE.elevate).toBe("steel-blue");
    expect(DEFAULT_VENDOR_PALETTE.tbt).toBe("golden");
    expect(DEFAULT_VENDOR_PALETTE.educere).toBe("plum");
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

  it("works for competitor vendors (5-category)", () => {
    const palette = getVendorPalette("coral");
    const expr = buildVendorFillExpression("proximity", palette);

    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "proximity_category"]);
    expect(expr).toContain("churned");
    expect(expr).toContain("new");
    expect(expr).toContain("multi_year_growing");
    expect(expr).toContain("multi_year_flat");
    expect(expr).toContain("multi_year_shrinking");
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

describe("educere palette integration", () => {
  it("deriveVendorCategoryColors returns 9 keyed entries for educere", () => {
    const plum = VENDOR_PALETTES.find((p) => p.id === "plum")!;
    const result = deriveVendorCategoryColors("educere", plum);
    expect(Object.keys(result)).toHaveLength(9);
    expect(result["educere:churned"]).toBe("#FFB347");
    expect(result["educere:new"]).toBe(plum.stops[4]);
    expect(result["educere:multi_year_growing"]).toBe(plum.stops[3]);
    expect(result["educere:multi_year_flat"]).toBe(plum.stops[5]);
    expect(result["educere:multi_year_shrinking"]).toBe(plum.stops[4]);
  });

  it("DEFAULT_CATEGORY_COLORS includes educere keys", () => {
    expect(DEFAULT_CATEGORY_COLORS["educere:churned"]).toBeDefined();
    expect(DEFAULT_CATEGORY_COLORS["educere:new"]).toBeDefined();
    expect(DEFAULT_CATEGORY_COLORS["educere:multi_year_growing"]).toBeDefined();
  });
});

describe("deriveVendorCategoryColors", () => {
  it("returns 10 keyed entries for fullmind", () => {
    const plum = VENDOR_PALETTES.find((p) => p.id === "plum")!;
    const result = deriveVendorCategoryColors("fullmind", plum);
    expect(Object.keys(result)).toHaveLength(10);
    expect(result["fullmind:target"]).toBe(plum.stops[0]);
    expect(result["fullmind:new_business_pipeline"]).toBe(plum.stops[2]);
    expect(result["fullmind:winback_pipeline"]).toBe(plum.stops[1]);
    expect(result["fullmind:multi_year_growing"]).toBe(plum.stops[3]);
    expect(result["fullmind:multi_year_flat"]).toBe(plum.stops[6]);
    expect(result["fullmind:multi_year_shrinking"]).toBe(plum.stops[4]);
  });

  it("returns 9 keyed entries for competitor (5 spend + 4 pipeline)", () => {
    const coral = VENDOR_PALETTES.find((p) => p.id === "coral")!;
    const result = deriveVendorCategoryColors("proximity", coral);
    expect(Object.keys(result)).toHaveLength(9);
    expect(result["proximity:churned"]).toBe("#FFB347");
    expect(result["proximity:new_business_pipeline"]).toBe(coral.stops[2]);
    expect(result["proximity:winback_pipeline"]).toBe(coral.stops[1]);
    expect(result["proximity:renewal_pipeline"]).toBe(coral.stops[4]);
    expect(result["proximity:expansion_pipeline"]).toBe(coral.stops[5]);
    expect(result["proximity:multi_year_growing"]).toBe(coral.stops[3]);
    expect(result["proximity:multi_year_flat"]).toBe(coral.stops[5]);
    expect(result["proximity:multi_year_shrinking"]).toBe(coral.stops[4]);
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
    // Fullmind: 10, proximity/elevate/tbt/educere: 9 each = 46 vendor keys
    // 3 growth signals x 5 + 1 expenditure x 4 = 19 signal keys
    expect(Object.keys(DEFAULT_CATEGORY_COLORS).length).toBe(46 + 19);
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
      "fullmind:new_business_pipeline": "#bbb",
      "fullmind:winback_pipeline": "#b0b",
      "fullmind:renewal_pipeline": "#ccc",
      "fullmind:expansion_pipeline": "#ddd",
      "fullmind:lapsed": "#eee",
      "fullmind:new": "#fff",
      "fullmind:multi_year_growing": "#111",
      "fullmind:multi_year_flat": "#222",
      "fullmind:multi_year_shrinking": "#333",
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
      "proximity:multi_year_growing": "#ccc",
      "proximity:multi_year_flat": "#ddd",
      "proximity:multi_year_shrinking": "#eee",
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
      "fullmind:new_business_pipeline": 0.8,
      "fullmind:winback_pipeline": 0.75,
      "fullmind:renewal_pipeline": 0.7,
      "fullmind:expansion_pipeline": 0.9,
      "fullmind:new": 0.6,
      "fullmind:multi_year_growing": 1.0,
      "fullmind:multi_year_flat": 0.9,
      "fullmind:multi_year_shrinking": 0.8,
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
    expect(prefs.vendorPalettes.fullmind).toBe("steel-blue");
    expect(prefs.signalPalette).toBe("mint-coral");
    expect(prefs.categoryColors).toEqual(DEFAULT_CATEGORY_COLORS);
    expect(prefs.categoryOpacities).toEqual(DEFAULT_CATEGORY_OPACITIES);
  });

  it("round-trips palette preferences", () => {
    const prefs = {
      vendorPalettes: {
        fullmind: "ocean",
        proximity: "coral",
        elevate: "steel-blue",
        tbt: "forest",
        educere: "plum",
      },
      signalPalette: "blue-orange",
      vendorOpacities: {
        fullmind: 0.5,
        proximity: 0.6,
        elevate: 0.7,
        tbt: 0.8,
        educere: 0.75,
      },
      categoryColors: {
        ...DEFAULT_CATEGORY_COLORS,
        "fullmind:target": "#ff0000",
        "proximity:new": "#00ff00",
      },
      categoryOpacities: {
        ...DEFAULT_CATEGORY_OPACITIES,
        "fullmind:target": 0.4,
        "proximity:new": 0.9,
      },
    };
    savePalettePrefs(prefs);
    expect(loadPalettePrefs()).toEqual(prefs);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("territory-plan:palette-prefs", "not-json");
    const prefs = loadPalettePrefs();
    expect(prefs.vendorPalettes.fullmind).toBe("steel-blue");
    expect(prefs.vendorOpacities.fullmind).toBe(0.75);
    expect(prefs.categoryColors).toEqual(DEFAULT_CATEGORY_COLORS);
    expect(prefs.categoryOpacities).toEqual(DEFAULT_CATEGORY_OPACITIES);
  });
});
