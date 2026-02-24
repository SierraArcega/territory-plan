import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber } from "../format";

// ===========================================================================
// formatCurrency
// ===========================================================================

describe("formatCurrency", () => {
  // ----- null / undefined -----

  it("returns '-' for null", () => {
    expect(formatCurrency(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(formatCurrency(undefined)).toBe("-");
  });

  // ----- standard (non-compact) mode -----

  it("formats a standard number with $ and commas", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("formats zero as '$0'", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("standard mode formats large numbers with commas (ignores compact thresholds)", () => {
    expect(formatCurrency(5000000)).toBe("$5,000,000");
  });

  // ----- compact mode -----

  it("compact mode: >= 1M shows $XM format", () => {
    expect(formatCurrency(1200000, true)).toBe("$1.2M");
  });

  it("compact mode: >= 1K shows $XK format", () => {
    expect(formatCurrency(450000, true)).toBe("$450K");
  });

  it("compact mode: < 1K shows standard format", () => {
    expect(formatCurrency(500, true)).toBe("$500");
  });

  it("compact mode: exactly 1M shows '$1M'", () => {
    expect(formatCurrency(1000000, true)).toBe("$1M");
  });

  it("compact mode: negative value >= 1M in absolute value uses M suffix", () => {
    // Math.abs(-2500000) = 2500000 >= 1000000
    // -2500000 / 1000000 = -2.5
    expect(formatCurrency(-2500000, true)).toBe("$-2.5M");
  });
});

// ===========================================================================
// formatNumber
// ===========================================================================

describe("formatNumber", () => {
  it("returns '-' for null", () => {
    expect(formatNumber(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(formatNumber(undefined)).toBe("-");
  });

  it("formats with commas", () => {
    expect(formatNumber(4832100)).toBe("4,832,100");
  });

  it("formats zero as '0'", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats small numbers without commas", () => {
    expect(formatNumber(100)).toBe("100");
  });
});
