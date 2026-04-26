import { describe, it, expect } from "vitest";
import { formatCurrencyShort } from "../format";

describe("formatCurrencyShort", () => {
  it("formats zero as $0", () => {
    expect(formatCurrencyShort(0)).toBe("$0");
  });

  it("formats values under 1000 as exact dollars", () => {
    expect(formatCurrencyShort(450)).toBe("$450");
    expect(formatCurrencyShort(999)).toBe("$999");
  });

  it("formats thousands with K suffix and one decimal", () => {
    expect(formatCurrencyShort(1_000)).toBe("$1.0K");
    expect(formatCurrencyShort(12_300)).toBe("$12.3K");
    expect(formatCurrencyShort(450_000)).toBe("$450.0K");
  });

  it("formats millions with M suffix and one decimal", () => {
    expect(formatCurrencyShort(1_000_000)).toBe("$1.0M");
    expect(formatCurrencyShort(2_350_000)).toBe("$2.4M");
    expect(formatCurrencyShort(99_900_000)).toBe("$99.9M");
  });

  it("formats billions with B suffix and one decimal", () => {
    expect(formatCurrencyShort(1_500_000_000)).toBe("$1.5B");
  });

  it("handles negative values with leading minus", () => {
    expect(formatCurrencyShort(-1_500)).toBe("-$1.5K");
    expect(formatCurrencyShort(-450)).toBe("-$450");
  });

  it("rounds half-up at boundaries", () => {
    expect(formatCurrencyShort(950)).toBe("$950");
    expect(formatCurrencyShort(999_999)).toBe("$1.0M");
  });
});
