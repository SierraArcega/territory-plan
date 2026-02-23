import { describe, it, expect } from "vitest";
import {
  buildVendorFillExpression,
  buildSignalFillExpression,
  buildVendorFillExpressionFromCategories,
  buildSignalFillExpressionFromCategories,
  buildCategoryOpacityExpression,
  buildAccountPointLayer,
  engagementToCategories,
  buildFilterExpression,
  VENDOR_CONFIGS,
  SIGNAL_CONFIGS,
} from "../layers";
import type { VendorPalette, SignalPalette } from "../palettes";

// ---------------------------------------------------------------------------
// Mock palettes
// ---------------------------------------------------------------------------

const mockVendorPalette: VendorPalette = {
  id: "test",
  label: "Test",
  baseColor: "#000000",
  dotColor: "#000000",
  stops: ["#s0", "#s1", "#s2", "#s3", "#s4", "#s5", "#s6"],
};

const mockSignalPalette: SignalPalette = {
  id: "test",
  label: "Test",
  growthStops: ["#g0", "#g1", "#g2", "#g3", "#g4"],
  expenditureStops: ["#e0", "#e1", "#e2", "#e3"],
  dotColor: "#000000",
};

// ---------------------------------------------------------------------------
// Helper: cast expression to any[] for easy indexed access
// ---------------------------------------------------------------------------
const asArr = (expr: unknown) => expr as any[];

// ============================================
// VENDOR_CONFIGS / SIGNAL_CONFIGS sanity
// ============================================

describe("VENDOR_CONFIGS", () => {
  it("defines all four vendors", () => {
    expect(Object.keys(VENDOR_CONFIGS)).toEqual(
      expect.arrayContaining(["fullmind", "proximity", "elevate", "tbt"]),
    );
  });

  it("each vendor has a tileProperty of the form <id>_category", () => {
    for (const [id, cfg] of Object.entries(VENDOR_CONFIGS)) {
      expect(cfg.tileProperty).toBe(`${id}_category`);
    }
  });

  it("elevate has fillOpacity 0.8; others are 0.75", () => {
    expect(VENDOR_CONFIGS.elevate.fillOpacity).toBe(0.8);
    expect(VENDOR_CONFIGS.fullmind.fillOpacity).toBe(0.75);
    expect(VENDOR_CONFIGS.proximity.fillOpacity).toBe(0.75);
    expect(VENDOR_CONFIGS.tbt.fillOpacity).toBe(0.75);
  });
});

describe("SIGNAL_CONFIGS", () => {
  it("defines enrollment, ell, swd, expenditure", () => {
    expect(Object.keys(SIGNAL_CONFIGS)).toEqual(
      expect.arrayContaining(["enrollment", "ell", "swd", "expenditure"]),
    );
  });

  it("each signal has a tileProperty of the form <id>_signal", () => {
    for (const [id, cfg] of Object.entries(SIGNAL_CONFIGS)) {
      expect(cfg.tileProperty).toBe(`${id}_signal`);
    }
  });

  it("all signal layers have fillOpacity 0.55", () => {
    for (const cfg of Object.values(SIGNAL_CONFIGS)) {
      expect(cfg.fillOpacity).toBe(0.55);
    }
  });
});

// ============================================
// buildVendorFillExpression
// ============================================

describe("buildVendorFillExpression", () => {
  describe("fullmind (10 categories)", () => {
    const expr = buildVendorFillExpression("fullmind", mockVendorPalette);
    const arr = asArr(expr);

    it("is a match expression", () => {
      expect(arr[0]).toBe("match");
    });

    it("uses the correct tileProperty", () => {
      expect(arr[1]).toEqual(["get", "fullmind_category"]);
    });

    it("maps target to stops[0]", () => {
      const idx = arr.indexOf("target");
      expect(idx).toBeGreaterThan(1);
      expect(arr[idx + 1]).toBe("#s0");
    });

    it("maps lapsed to stops[1]", () => {
      const idx = arr.indexOf("lapsed");
      expect(arr[idx + 1]).toBe("#s1");
    });

    it("maps new_business_pipeline to stops[2]", () => {
      const idx = arr.indexOf("new_business_pipeline");
      expect(arr[idx + 1]).toBe("#s2");
    });

    it("maps new to stops[3]", () => {
      const idx = arr.indexOf("new");
      expect(arr[idx + 1]).toBe("#s3");
    });

    it("maps renewal_pipeline to stops[4]", () => {
      const idx = arr.indexOf("renewal_pipeline");
      expect(arr[idx + 1]).toBe("#s4");
    });

    it("maps expansion_pipeline to stops[5]", () => {
      const idx = arr.indexOf("expansion_pipeline");
      expect(arr[idx + 1]).toBe("#s5");
    });

    it("maps multi_year_flat to stops[6]", () => {
      const idx = arr.indexOf("multi_year_flat");
      expect(arr[idx + 1]).toBe("#s6");
    });

    it("hardcodes winback_pipeline to #FFB347", () => {
      const idx = arr.indexOf("winback_pipeline");
      expect(arr[idx + 1]).toBe("#FFB347");
    });

    it("hardcodes multi_year_growing to #4ECDC4", () => {
      const idx = arr.indexOf("multi_year_growing");
      expect(arr[idx + 1]).toBe("#4ECDC4");
    });

    it("hardcodes multi_year_shrinking to #F37167", () => {
      const idx = arr.indexOf("multi_year_shrinking");
      expect(arr[idx + 1]).toBe("#F37167");
    });

    it("ends with transparent fallback", () => {
      expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
    });

    it("contains all 10 categories", () => {
      const expected = [
        "target", "new_business_pipeline", "winback_pipeline",
        "renewal_pipeline", "expansion_pipeline", "lapsed", "new",
        "multi_year_growing", "multi_year_flat", "multi_year_shrinking",
      ];
      for (const cat of expected) {
        expect(arr).toContain(cat);
      }
    });
  });

  describe.each(["proximity", "elevate", "tbt"] as const)(
    "competitor vendor: %s (9 categories)",
    (vendorId) => {
      const expr = buildVendorFillExpression(vendorId, mockVendorPalette);
      const arr = asArr(expr);

      it("is a match expression", () => {
        expect(arr[0]).toBe("match");
      });

      it(`uses the correct tileProperty: ${vendorId}_category`, () => {
        expect(arr[1]).toEqual(["get", `${vendorId}_category`]);
      });

      it("maps churned to stops[0]", () => {
        const idx = arr.indexOf("churned");
        expect(idx).toBeGreaterThan(1);
        expect(arr[idx + 1]).toBe("#s0");
      });

      it("maps new_business_pipeline to stops[2]", () => {
        const idx = arr.indexOf("new_business_pipeline");
        expect(arr[idx + 1]).toBe("#s2");
      });

      it("maps renewal_pipeline to stops[4]", () => {
        const idx = arr.indexOf("renewal_pipeline");
        expect(arr[idx + 1]).toBe("#s4");
      });

      it("maps expansion_pipeline to stops[5]", () => {
        const idx = arr.indexOf("expansion_pipeline");
        expect(arr[idx + 1]).toBe("#s5");
      });

      it("maps new to stops[4]", () => {
        const idx = arr.indexOf("new");
        expect(arr[idx + 1]).toBe("#s4");
      });

      it("maps multi_year_flat to stops[5]", () => {
        const idx = arr.indexOf("multi_year_flat");
        expect(arr[idx + 1]).toBe("#s5");
      });

      it("hardcodes winback_pipeline to #FFB347", () => {
        const idx = arr.indexOf("winback_pipeline");
        expect(arr[idx + 1]).toBe("#FFB347");
      });

      it("hardcodes multi_year_growing to #4ECDC4", () => {
        const idx = arr.indexOf("multi_year_growing");
        expect(arr[idx + 1]).toBe("#4ECDC4");
      });

      it("hardcodes multi_year_shrinking to #F37167", () => {
        const idx = arr.indexOf("multi_year_shrinking");
        expect(arr[idx + 1]).toBe("#F37167");
      });

      it("does NOT contain target or lapsed (fullmind-only)", () => {
        expect(arr).not.toContain("target");
        expect(arr).not.toContain("lapsed");
      });

      it("ends with transparent fallback", () => {
        expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
      });
    },
  );
});

// ============================================
// buildSignalFillExpression
// ============================================

describe("buildSignalFillExpression", () => {
  describe("growth signals (enrollment, ell, swd)", () => {
    it.each(["enrollment", "ell", "swd"] as const)(
      "%s uses growthStops and <id>_signal tileProperty",
      (signalId) => {
        const expr = buildSignalFillExpression(signalId, mockSignalPalette);
        const arr = asArr(expr);

        expect(arr[0]).toBe("match");
        expect(arr[1]).toEqual(["get", `${signalId}_signal`]);

        // 5 category pairs + match header + fallback = 13 elements
        expect(arr).toContain("strong_growth");
        expect(arr).toContain("growth");
        expect(arr).toContain("stable");
        expect(arr).toContain("decline");
        expect(arr).toContain("strong_decline");

        const sgIdx = arr.indexOf("strong_growth");
        expect(arr[sgIdx + 1]).toBe("#g0");
        const gIdx = arr.indexOf("growth");
        expect(arr[gIdx + 1]).toBe("#g1");
        const stIdx = arr.indexOf("stable");
        expect(arr[stIdx + 1]).toBe("#g2");
        const dIdx = arr.indexOf("decline");
        expect(arr[dIdx + 1]).toBe("#g3");
        const sdIdx = arr.indexOf("strong_decline");
        expect(arr[sdIdx + 1]).toBe("#g4");

        expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
      },
    );
  });

  describe("expenditure signal", () => {
    const expr = buildSignalFillExpression("expenditure", mockSignalPalette);
    const arr = asArr(expr);

    it("is a match expression", () => {
      expect(arr[0]).toBe("match");
    });

    it("uses expenditure_signal tileProperty", () => {
      expect(arr[1]).toEqual(["get", "expenditure_signal"]);
    });

    it("maps the 4 expenditure stops correctly", () => {
      const waIdx = arr.indexOf("well_above");
      expect(arr[waIdx + 1]).toBe("#e0");
      const aIdx = arr.indexOf("above");
      expect(arr[aIdx + 1]).toBe("#e1");
      const bIdx = arr.indexOf("below");
      expect(arr[bIdx + 1]).toBe("#e2");
      const wbIdx = arr.indexOf("well_below");
      expect(arr[wbIdx + 1]).toBe("#e3");
    });

    it("does NOT contain growth categories", () => {
      expect(arr).not.toContain("strong_growth");
      expect(arr).not.toContain("strong_decline");
    });

    it("ends with transparent fallback", () => {
      expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
    });
  });
});

// ============================================
// buildVendorFillExpressionFromCategories
// ============================================

describe("buildVendorFillExpressionFromCategories", () => {
  describe("fullmind with all keys provided", () => {
    const colors: Record<string, string> = {
      "fullmind:target": "#c_target",
      "fullmind:new_business_pipeline": "#c_nbp",
      "fullmind:winback_pipeline": "#c_wbp",
      "fullmind:renewal_pipeline": "#c_rp",
      "fullmind:expansion_pipeline": "#c_ep",
      "fullmind:lapsed": "#c_lapsed",
      "fullmind:new": "#c_new",
      "fullmind:multi_year_growing": "#c_myg",
      "fullmind:multi_year_flat": "#c_myf",
      "fullmind:multi_year_shrinking": "#c_mys",
    };
    const expr = buildVendorFillExpressionFromCategories("fullmind", colors);
    const arr = asArr(expr);

    it("is a match expression using fullmind_category", () => {
      expect(arr[0]).toBe("match");
      expect(arr[1]).toEqual(["get", "fullmind_category"]);
    });

    it("uses provided color for each category", () => {
      expect(arr[arr.indexOf("target") + 1]).toBe("#c_target");
      expect(arr[arr.indexOf("new_business_pipeline") + 1]).toBe("#c_nbp");
      expect(arr[arr.indexOf("winback_pipeline") + 1]).toBe("#c_wbp");
      expect(arr[arr.indexOf("renewal_pipeline") + 1]).toBe("#c_rp");
      expect(arr[arr.indexOf("expansion_pipeline") + 1]).toBe("#c_ep");
      expect(arr[arr.indexOf("lapsed") + 1]).toBe("#c_lapsed");
      expect(arr[arr.indexOf("new") + 1]).toBe("#c_new");
      expect(arr[arr.indexOf("multi_year_growing") + 1]).toBe("#c_myg");
      expect(arr[arr.indexOf("multi_year_flat") + 1]).toBe("#c_myf");
      expect(arr[arr.indexOf("multi_year_shrinking") + 1]).toBe("#c_mys");
    });

    it("ends with transparent fallback", () => {
      expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
    });
  });

  describe("fullmind with no keys (falls back to defaults)", () => {
    const expr = buildVendorFillExpressionFromCategories("fullmind", {});
    const arr = asArr(expr);

    it("falls back to default target color", () => {
      expect(arr[arr.indexOf("target") + 1]).toBe("#ecebf1");
    });

    it("falls back to default new_business_pipeline color", () => {
      expect(arr[arr.indexOf("new_business_pipeline") + 1]).toBe("#b3afc6");
    });

    it("falls back to default winback_pipeline color (#FFB347)", () => {
      expect(arr[arr.indexOf("winback_pipeline") + 1]).toBe("#FFB347");
    });

    it("falls back to default renewal_pipeline color", () => {
      expect(arr[arr.indexOf("renewal_pipeline") + 1]).toBe("#665f8d");
    });

    it("falls back to default expansion_pipeline color", () => {
      expect(arr[arr.indexOf("expansion_pipeline") + 1]).toBe("#403770");
    });

    it("falls back to default lapsed color", () => {
      expect(arr[arr.indexOf("lapsed") + 1]).toBe("#d9d7e2");
    });

    it("falls back to default new color", () => {
      expect(arr[arr.indexOf("new") + 1]).toBe("#8c87a9");
    });

    it("falls back to default multi_year_growing (#4ECDC4)", () => {
      expect(arr[arr.indexOf("multi_year_growing") + 1]).toBe("#4ECDC4");
    });

    it("falls back to default multi_year_flat color", () => {
      expect(arr[arr.indexOf("multi_year_flat") + 1]).toBe("#403770");
    });

    it("falls back to default multi_year_shrinking (#F37167)", () => {
      expect(arr[arr.indexOf("multi_year_shrinking") + 1]).toBe("#F37167");
    });
  });

  describe("fullmind with partial keys", () => {
    const colors: Record<string, string> = {
      "fullmind:target": "#custom",
    };
    const expr = buildVendorFillExpressionFromCategories("fullmind", colors);
    const arr = asArr(expr);

    it("uses provided color where key exists", () => {
      expect(arr[arr.indexOf("target") + 1]).toBe("#custom");
    });

    it("falls back to default for missing keys", () => {
      expect(arr[arr.indexOf("lapsed") + 1]).toBe("#d9d7e2");
      expect(arr[arr.indexOf("winback_pipeline") + 1]).toBe("#FFB347");
    });
  });

  describe.each(["proximity", "elevate", "tbt"] as const)(
    "competitor vendor %s with all keys provided",
    (vendorId) => {
      const colors: Record<string, string> = {
        [`${vendorId}:churned`]: "#c_churned",
        [`${vendorId}:new_business_pipeline`]: "#c_nbp",
        [`${vendorId}:winback_pipeline`]: "#c_wbp",
        [`${vendorId}:renewal_pipeline`]: "#c_rp",
        [`${vendorId}:expansion_pipeline`]: "#c_ep",
        [`${vendorId}:new`]: "#c_new",
        [`${vendorId}:multi_year_growing`]: "#c_myg",
        [`${vendorId}:multi_year_flat`]: "#c_myf",
        [`${vendorId}:multi_year_shrinking`]: "#c_mys",
      };
      const expr = buildVendorFillExpressionFromCategories(vendorId, colors);
      const arr = asArr(expr);

      it(`uses ${vendorId}_category tileProperty`, () => {
        expect(arr[1]).toEqual(["get", `${vendorId}_category`]);
      });

      it("uses provided colors for all categories", () => {
        expect(arr[arr.indexOf("churned") + 1]).toBe("#c_churned");
        expect(arr[arr.indexOf("new_business_pipeline") + 1]).toBe("#c_nbp");
        expect(arr[arr.indexOf("winback_pipeline") + 1]).toBe("#c_wbp");
        expect(arr[arr.indexOf("renewal_pipeline") + 1]).toBe("#c_rp");
        expect(arr[arr.indexOf("expansion_pipeline") + 1]).toBe("#c_ep");
        expect(arr[arr.indexOf("new") + 1]).toBe("#c_new");
        expect(arr[arr.indexOf("multi_year_growing") + 1]).toBe("#c_myg");
        expect(arr[arr.indexOf("multi_year_flat") + 1]).toBe("#c_myf");
        expect(arr[arr.indexOf("multi_year_shrinking") + 1]).toBe("#c_mys");
      });
    },
  );

  describe("competitor with no keys (falls back to defaults)", () => {
    const expr = buildVendorFillExpressionFromCategories("proximity", {});
    const arr = asArr(expr);

    it("falls back to default churned color", () => {
      expect(arr[arr.indexOf("churned") + 1]).toBe("#fef1f0");
    });

    it("falls back to default new_business_pipeline color", () => {
      expect(arr[arr.indexOf("new_business_pipeline") + 1]).toBe("#f9b5b0");
    });

    it("falls back to default winback_pipeline (#FFB347)", () => {
      expect(arr[arr.indexOf("winback_pipeline") + 1]).toBe("#FFB347");
    });

    it("falls back to default renewal_pipeline color", () => {
      expect(arr[arr.indexOf("renewal_pipeline") + 1]).toBe("#f58d85");
    });

    it("falls back to default expansion_pipeline color", () => {
      expect(arr[arr.indexOf("expansion_pipeline") + 1]).toBe("#F37167");
    });

    it("falls back to default new color", () => {
      expect(arr[arr.indexOf("new") + 1]).toBe("#e06b5e");
    });

    it("falls back to default multi_year_growing (#4ECDC4)", () => {
      expect(arr[arr.indexOf("multi_year_growing") + 1]).toBe("#4ECDC4");
    });

    it("falls back to default multi_year_flat (#F37167)", () => {
      expect(arr[arr.indexOf("multi_year_flat") + 1]).toBe("#F37167");
    });

    it("falls back to default multi_year_shrinking (#F37167)", () => {
      expect(arr[arr.indexOf("multi_year_shrinking") + 1]).toBe("#F37167");
    });
  });

  it("ignores keys belonging to a different vendor", () => {
    const colors: Record<string, string> = {
      "fullmind:target": "#wrong_vendor",
      "proximity:churned": "#correct",
    };
    const expr = buildVendorFillExpressionFromCategories("proximity", colors);
    const arr = asArr(expr);

    expect(arr[arr.indexOf("churned") + 1]).toBe("#correct");
    // The "target" key from fullmind should not appear in a proximity expression
    expect(arr).not.toContain("target");
  });
});

// ============================================
// buildSignalFillExpressionFromCategories
// ============================================

describe("buildSignalFillExpressionFromCategories", () => {
  describe("growth signal with all keys provided", () => {
    const colors: Record<string, string> = {
      "enrollment:strong_growth": "#sg",
      "enrollment:growth": "#g",
      "enrollment:stable": "#st",
      "enrollment:decline": "#d",
      "enrollment:strong_decline": "#sd",
    };
    const expr = buildSignalFillExpressionFromCategories("enrollment", colors);
    const arr = asArr(expr);

    it("is a match expression using enrollment_signal", () => {
      expect(arr[0]).toBe("match");
      expect(arr[1]).toEqual(["get", "enrollment_signal"]);
    });

    it("uses provided colors", () => {
      expect(arr[arr.indexOf("strong_growth") + 1]).toBe("#sg");
      expect(arr[arr.indexOf("growth") + 1]).toBe("#g");
      expect(arr[arr.indexOf("stable") + 1]).toBe("#st");
      expect(arr[arr.indexOf("decline") + 1]).toBe("#d");
      expect(arr[arr.indexOf("strong_decline") + 1]).toBe("#sd");
    });

    it("ends with transparent fallback", () => {
      expect(arr[arr.length - 1]).toBe("rgba(0,0,0,0)");
    });
  });

  describe("growth signal with no keys (fallback defaults)", () => {
    const expr = buildSignalFillExpressionFromCategories("ell", {});
    const arr = asArr(expr);

    it("uses ell_signal tileProperty", () => {
      expect(arr[1]).toEqual(["get", "ell_signal"]);
    });

    it("falls back to default growth colors", () => {
      expect(arr[arr.indexOf("strong_growth") + 1]).toBe("#4ECDC4");
      expect(arr[arr.indexOf("growth") + 1]).toBe("#a3e6e1");
      expect(arr[arr.indexOf("stable") + 1]).toBe("#f0f0e8");
      expect(arr[arr.indexOf("decline") + 1]).toBe("#f5a3a0");
      expect(arr[arr.indexOf("strong_decline") + 1]).toBe("#F37167");
    });
  });

  describe("expenditure signal with all keys provided", () => {
    const colors: Record<string, string> = {
      "expenditure:well_above": "#wa",
      "expenditure:above": "#a",
      "expenditure:below": "#b",
      "expenditure:well_below": "#wb",
    };
    const expr = buildSignalFillExpressionFromCategories("expenditure", colors);
    const arr = asArr(expr);

    it("is a match expression using expenditure_signal", () => {
      expect(arr[0]).toBe("match");
      expect(arr[1]).toEqual(["get", "expenditure_signal"]);
    });

    it("uses provided colors", () => {
      expect(arr[arr.indexOf("well_above") + 1]).toBe("#wa");
      expect(arr[arr.indexOf("above") + 1]).toBe("#a");
      expect(arr[arr.indexOf("below") + 1]).toBe("#b");
      expect(arr[arr.indexOf("well_below") + 1]).toBe("#wb");
    });

    it("does NOT contain growth categories", () => {
      expect(arr).not.toContain("strong_growth");
      expect(arr).not.toContain("strong_decline");
    });
  });

  describe("expenditure signal with no keys (fallback defaults)", () => {
    const expr = buildSignalFillExpressionFromCategories("expenditure", {});
    const arr = asArr(expr);

    it("falls back to default expenditure colors", () => {
      expect(arr[arr.indexOf("well_above") + 1]).toBe("#4ECDC4");
      expect(arr[arr.indexOf("above") + 1]).toBe("#a3e6e1");
      expect(arr[arr.indexOf("below") + 1]).toBe("#f5a3a0");
      expect(arr[arr.indexOf("well_below") + 1]).toBe("#F37167");
    });
  });

  it.each(["enrollment", "ell", "swd"] as const)(
    "%s uses the correct tileProperty",
    (signalId) => {
      const expr = buildSignalFillExpressionFromCategories(signalId, {});
      const arr = asArr(expr);
      expect(arr[1]).toEqual(["get", `${signalId}_signal`]);
    },
  );
});

// ============================================
// buildCategoryOpacityExpression
// ============================================

describe("buildCategoryOpacityExpression", () => {
  it("returns literal default when no matching entries exist", () => {
    const expr = buildCategoryOpacityExpression("fullmind", {});
    const arr = asArr(expr);
    expect(arr[0]).toBe("literal");
    expect(arr[1]).toBe(0.75);
  });

  it("returns literal with elevate default (0.8) when no entries match", () => {
    const expr = buildCategoryOpacityExpression("elevate", {});
    const arr = asArr(expr);
    expect(arr[0]).toBe("literal");
    expect(arr[1]).toBe(0.8);
  });

  it("returns literal with signal default (0.55) for signal layers", () => {
    const expr = buildCategoryOpacityExpression("enrollment", {});
    const arr = asArr(expr);
    expect(arr[0]).toBe("literal");
    expect(arr[1]).toBe(0.55);
  });

  it("ignores entries from other layer IDs", () => {
    const opacities: Record<string, number> = {
      "proximity:churned": 0.3,
      "elevate:churned": 0.4,
    };
    const expr = buildCategoryOpacityExpression("fullmind", opacities);
    const arr = asArr(expr);
    // No fullmind entries, so should return literal default
    expect(arr[0]).toBe("literal");
    expect(arr[1]).toBe(0.75);
  });

  it("builds a match expression when entries exist", () => {
    const opacities: Record<string, number> = {
      "fullmind:target": 0.5,
      "fullmind:lapsed": 0.3,
    };
    const expr = buildCategoryOpacityExpression("fullmind", opacities);
    const arr = asArr(expr);

    expect(arr[0]).toBe("match");
    expect(arr[1]).toEqual(["get", "fullmind_category"]);

    // Should contain the stripped category names and their opacity values
    const targetIdx = arr.indexOf("target");
    expect(targetIdx).toBeGreaterThan(1);
    expect(arr[targetIdx + 1]).toBe(0.5);

    const lapsedIdx = arr.indexOf("lapsed");
    expect(lapsedIdx).toBeGreaterThan(1);
    expect(arr[lapsedIdx + 1]).toBe(0.3);

    // Default fallback at the end
    expect(arr[arr.length - 1]).toBe(0.75);
  });

  it("builds a match expression for a signal layer with entries", () => {
    const opacities: Record<string, number> = {
      "enrollment:strong_growth": 1.0,
      "enrollment:stable": 0.2,
    };
    const expr = buildCategoryOpacityExpression("enrollment", opacities);
    const arr = asArr(expr);

    expect(arr[0]).toBe("match");
    expect(arr[1]).toEqual(["get", "enrollment_signal"]);

    const sgIdx = arr.indexOf("strong_growth");
    expect(arr[sgIdx + 1]).toBe(1.0);

    const stIdx = arr.indexOf("stable");
    expect(arr[stIdx + 1]).toBe(0.2);

    // signal default fallback
    expect(arr[arr.length - 1]).toBe(0.55);
  });

  it("builds match for competitor vendors with correct tileProperty", () => {
    const opacities: Record<string, number> = {
      "tbt:churned": 0.6,
    };
    const expr = buildCategoryOpacityExpression("tbt", opacities);
    const arr = asArr(expr);

    expect(arr[0]).toBe("match");
    expect(arr[1]).toEqual(["get", "tbt_category"]);
    expect(arr[arr.length - 1]).toBe(0.75);
  });

  it("strips the layerId: prefix from category keys in the output", () => {
    const opacities: Record<string, number> = {
      "proximity:new_business_pipeline": 0.9,
    };
    const expr = buildCategoryOpacityExpression("proximity", opacities);
    const arr = asArr(expr);

    // The match key should be the stripped category name, not the full prefixed key
    expect(arr).toContain("new_business_pipeline");
    expect(arr).not.toContain("proximity:new_business_pipeline");
  });

  it("uses all matching entries in the output", () => {
    const opacities: Record<string, number> = {
      "fullmind:target": 0.1,
      "fullmind:lapsed": 0.2,
      "fullmind:new": 0.3,
      "fullmind:renewal_pipeline": 0.4,
      "fullmind:expansion_pipeline": 0.5,
      "fullmind:new_business_pipeline": 0.6,
      "fullmind:winback_pipeline": 0.7,
      "fullmind:multi_year_growing": 0.8,
      "fullmind:multi_year_flat": 0.85,
      "fullmind:multi_year_shrinking": 0.9,
    };
    const expr = buildCategoryOpacityExpression("fullmind", opacities);
    const arr = asArr(expr);

    // 10 category-value pairs = 20 entries + "match" + ["get", ...] + default fallback = 23
    // Each pair is (category, opacity), so 10 * 2 = 20 entries after the header
    expect(arr[0]).toBe("match");

    // Verify every category is present
    for (const cat of [
      "target", "lapsed", "new", "renewal_pipeline",
      "expansion_pipeline", "new_business_pipeline", "winback_pipeline",
      "multi_year_growing", "multi_year_flat", "multi_year_shrinking",
    ]) {
      expect(arr).toContain(cat);
    }
  });
});

// ============================================
// buildAccountPointLayer
// ============================================

describe("buildAccountPointLayer", () => {
  it("returns a CircleLayerSpecification with correct id and type", () => {
    const layer = buildAccountPointLayer(new Set());
    expect(layer.id).toBe("account-points");
    expect(layer.type).toBe("circle");
    expect(layer.source).toBe("districts");
    expect(layer["source-layer"]).toBe("districts");
  });

  it("uses fallback color #8B7AB8 when no vendors active", () => {
    const layer = buildAccountPointLayer(new Set());
    expect(layer.paint!["circle-color"]).toBe("#8B7AB8");
  });

  it("uses first active vendor fill color when vendors are active", () => {
    const layer = buildAccountPointLayer(new Set(["fullmind" as const]));
    expect(layer.paint!["circle-color"]).toEqual(
      VENDOR_CONFIGS.fullmind.fillColor,
    );
  });

  it("uses the first vendor from the set when multiple are active", () => {
    // Sets iterate in insertion order
    const layer = buildAccountPointLayer(
      new Set(["proximity" as const, "fullmind" as const]),
    );
    expect(layer.paint!["circle-color"]).toEqual(
      VENDOR_CONFIGS.proximity.fillColor,
    );
  });

  it("has the expected filter for non-district accounts", () => {
    const layer = buildAccountPointLayer(new Set());
    expect(layer.filter).toEqual([
      "all",
      ["has", "account_type"],
      ["!=", ["get", "account_type"], "district"],
    ]);
  });

  it("includes circle styling properties", () => {
    const layer = buildAccountPointLayer(new Set());
    expect(layer.paint!["circle-stroke-color"]).toBe("#ffffff");
    expect(layer.paint!["circle-stroke-width"]).toBe(1.5);
    expect(layer.paint!["circle-opacity"]).toBe(0.9);
  });

  it("has interpolated circle-radius based on zoom", () => {
    const layer = buildAccountPointLayer(new Set());
    const radius = layer.paint!["circle-radius"] as any[];
    expect(radius[0]).toBe("interpolate");
    expect(radius[1]).toEqual(["linear"]);
    expect(radius[2]).toEqual(["zoom"]);
  });
});

// ============================================
// engagementToCategories
// ============================================

describe("engagementToCategories", () => {
  it("maps known fullmind engagement IDs to tile category values", () => {
    expect(engagementToCategories(["target"])).toEqual(["target"]);
    expect(engagementToCategories(["first_year"])).toEqual(["new"]);
    expect(engagementToCategories(["renewal_pipeline"])).toEqual([
      "renewal_pipeline",
    ]);
    expect(engagementToCategories(["expansion_pipeline"])).toEqual([
      "expansion_pipeline",
    ]);
    expect(engagementToCategories(["new_business_pipeline"])).toEqual([
      "new_business_pipeline",
    ]);
    expect(engagementToCategories(["winback_pipeline"])).toEqual([
      "winback_pipeline",
    ]);
    expect(engagementToCategories(["multi_year_growing"])).toEqual([
      "multi_year_growing",
    ]);
    expect(engagementToCategories(["multi_year_flat"])).toEqual([
      "multi_year_flat",
    ]);
    expect(engagementToCategories(["multi_year_shrinking"])).toEqual([
      "multi_year_shrinking",
    ]);
    expect(engagementToCategories(["lapsed"])).toEqual(["lapsed"]);
  });

  it("passes unknown engagements through as-is", () => {
    expect(engagementToCategories(["churned"])).toEqual(["churned"]);
    expect(engagementToCategories(["new"])).toEqual(["new"]);
    expect(engagementToCategories(["unknown_value"])).toEqual([
      "unknown_value",
    ]);
  });

  it("handles multiple engagements at once", () => {
    expect(
      engagementToCategories(["target", "first_year", "churned"]),
    ).toEqual(["target", "new", "churned"]);
  });

  it("returns empty array for empty input", () => {
    expect(engagementToCategories([])).toEqual([]);
  });

  it("flattens multi-value mappings if any exist", () => {
    // All current mappings are single-element arrays, but the flatMap
    // implementation handles arrays of any length
    const result = engagementToCategories(["target", "lapsed"]);
    expect(result).toEqual(["target", "lapsed"]);
  });
});

// ============================================
// buildFilterExpression
// ============================================

describe("buildFilterExpression", () => {
  it("returns null when no filters are active", () => {
    expect(buildFilterExpression(null, null, [])).toBeNull();
  });

  describe("single filter conditions", () => {
    it("returns state filter directly (not wrapped in all)", () => {
      const expr = buildFilterExpression(null, null, ["TX", "CA"]);
      const arr = asArr(expr);

      expect(arr[0]).toBe("in");
      expect(arr[1]).toEqual(["get", "state_abbrev"]);
      expect(arr[2]).toEqual(["literal", ["TX", "CA"]]);
    });

    it("returns owner filter directly", () => {
      const expr = buildFilterExpression("John Doe", null, []);
      const arr = asArr(expr);

      expect(arr[0]).toBe("==");
      expect(arr[1]).toEqual(["get", "sales_executive"]);
      expect(arr[2]).toBe("John Doe");
    });

    it("returns plan filter directly using index-of", () => {
      const expr = buildFilterExpression(null, "plan-123", []);
      const arr = asArr(expr);

      expect(arr[0]).toBe("!=");
      // The index-of expression should search plan_ids for the planId
      expect(arr[1][0]).toBe("index-of");
      expect(arr[1][1]).toBe("plan-123");
      expect(arr[1][2]).toEqual(["coalesce", ["get", "plan_ids"], ""]);
      expect(arr[2]).toBe(-1);
    });
  });

  describe("multiple filter conditions", () => {
    it("wraps two conditions in [all, ...]", () => {
      const expr = buildFilterExpression("Jane Smith", null, ["NY"]);
      const arr = asArr(expr);

      expect(arr[0]).toBe("all");
      expect(arr.length).toBe(3); // "all" + state condition + owner condition
    });

    it("wraps all three conditions in [all, ...]", () => {
      const expr = buildFilterExpression("Jane Smith", "plan-456", [
        "NY",
        "CA",
      ]);
      const arr = asArr(expr);

      expect(arr[0]).toBe("all");
      expect(arr.length).toBe(4); // "all" + 3 conditions
    });

    it("includes state filter in combined expression", () => {
      const expr = buildFilterExpression("Owner", "plan-1", ["TX"]);
      const arr = asArr(expr);

      expect(arr[0]).toBe("all");
      // Find the state condition
      const stateCondition = arr.find(
        (c: any) => Array.isArray(c) && c[0] === "in",
      );
      expect(stateCondition).toBeDefined();
      expect(stateCondition[1]).toEqual(["get", "state_abbrev"]);
      expect(stateCondition[2]).toEqual(["literal", ["TX"]]);
    });

    it("includes owner filter in combined expression", () => {
      const expr = buildFilterExpression("Owner", "plan-1", ["TX"]);
      const arr = asArr(expr);

      const ownerCondition = arr.find(
        (c: any) => Array.isArray(c) && c[0] === "==",
      );
      expect(ownerCondition).toBeDefined();
      expect(ownerCondition[2]).toBe("Owner");
    });

    it("includes plan filter in combined expression", () => {
      const expr = buildFilterExpression("Owner", "plan-1", ["TX"]);
      const arr = asArr(expr);

      const planCondition = arr.find(
        (c: any) => Array.isArray(c) && c[0] === "!=",
      );
      expect(planCondition).toBeDefined();
      expect(planCondition[1][1]).toBe("plan-1");
    });
  });

  describe("edge cases", () => {
    it("treats empty string owner as falsy (no filter)", () => {
      const expr = buildFilterExpression("", null, []);
      expect(expr).toBeNull();
    });

    it("treats empty string planId as falsy (no filter)", () => {
      const expr = buildFilterExpression(null, "", []);
      expect(expr).toBeNull();
    });

    it("handles single-state array", () => {
      const expr = buildFilterExpression(null, null, ["OH"]);
      const arr = asArr(expr);
      expect(arr[0]).toBe("in");
      expect(arr[2]).toEqual(["literal", ["OH"]]);
    });

    it("handles many states", () => {
      const states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
      ];
      const expr = buildFilterExpression(null, null, states);
      const arr = asArr(expr);
      expect(arr[0]).toBe("in");
      expect(arr[2]).toEqual(["literal", states]);
    });

    it("plan filter uses coalesce to handle missing plan_ids", () => {
      const expr = buildFilterExpression(null, "abc", []);
      const arr = asArr(expr);
      // Verify the coalesce wraps the get expression
      const indexOfExpr = arr[1];
      expect(indexOfExpr[2][0]).toBe("coalesce");
      expect(indexOfExpr[2][1]).toEqual(["get", "plan_ids"]);
      expect(indexOfExpr[2][2]).toBe("");
    });
  });
});
