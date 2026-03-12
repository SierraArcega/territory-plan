import { describe, it, expect } from "vitest";
import { hexToRgb, withOpacity, contrastRatio } from "../color-utils";

// ===========================================================================
// hexToRgb
// ===========================================================================

describe("hexToRgb", () => {
  it("parses 6-char hex with #", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses 6-char hex without #", () => {
    expect(hexToRgb("403770")).toEqual({ r: 64, g: 55, b: 112 });
  });

  it("parses 3-char hex with #", () => {
    expect(hexToRgb("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses 3-char hex without #", () => {
    expect(hexToRgb("000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("throws on invalid hex", () => {
    expect(() => hexToRgb("#xyz")).toThrow();
    expect(() => hexToRgb("nope")).toThrow();
    expect(() => hexToRgb("#12345")).toThrow();
  });
});

// ===========================================================================
// withOpacity
// ===========================================================================

describe("withOpacity", () => {
  it("returns rgba string", () => {
    expect(withOpacity("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("handles full opacity", () => {
    expect(withOpacity("#403770", 1)).toBe("rgba(64, 55, 112, 1)");
  });

  it("handles zero opacity", () => {
    expect(withOpacity("#FFFFFF", 0)).toBe("rgba(255, 255, 255, 0)");
  });
});

// ===========================================================================
// contrastRatio
// ===========================================================================

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("returns 1 for same color", () => {
    expect(contrastRatio("#403770", "#403770")).toBeCloseTo(1, 0);
  });

  it("Plum on white meets WCAG AA for normal text (>= 4.5)", () => {
    expect(contrastRatio("#403770", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("is symmetric (order does not matter)", () => {
    const r1 = contrastRatio("#403770", "#FFFFFF");
    const r2 = contrastRatio("#FFFFFF", "#403770");
    expect(r1).toBeCloseTo(r2, 5);
  });
});
