import { describe, it, expect } from "vitest";
import {
  VENDOR_PALETTES,
  SIGNAL_PALETTES,
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
  type VendorPalette,
  type SignalPalette,
} from "@/features/map/lib/palettes";
import {
  buildVendorFillExpression,
  buildSignalFillExpression,
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
