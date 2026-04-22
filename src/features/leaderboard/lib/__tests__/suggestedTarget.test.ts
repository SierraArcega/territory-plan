import { describe, it, expect } from "vitest";
import { computeSuggestedTarget } from "../suggestedTarget";

describe("computeSuggestedTarget", () => {
  it("returns fy26 × 1.05 rounded to $5K for missing_renewal", () => {
    expect(computeSuggestedTarget("missing_renewal", 320_000, 0)).toBe(335_000);
    expect(computeSuggestedTarget("missing_renewal", 100_000, 0)).toBe(105_000);
  });

  it("returns priorYear × 0.90 rounded to $5K for winbacks", () => {
    expect(computeSuggestedTarget("fullmind_winback", 0, 180_000)).toBe(160_000);
    expect(computeSuggestedTarget("ek12_winback", 0, 240_000)).toBe(215_000);
  });

  it("returns null when the relevant revenue signal is 0", () => {
    expect(computeSuggestedTarget("missing_renewal", 0, 0)).toBeNull();
    expect(computeSuggestedTarget("fullmind_winback", 0, 0)).toBeNull();
  });
});
