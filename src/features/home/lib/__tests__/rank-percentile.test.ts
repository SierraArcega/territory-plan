import { describe, it, expect } from "vitest";
import { rankPercentile } from "../rank-percentile";

describe("rankPercentile", () => {
  it("returns the rounded top percentile", () => {
    expect(rankPercentile(3, 12)).toBe(25); // 3/12 = 25%
    expect(rankPercentile(2, 39)).toBe(5);  // 2/39 = 5.1 → 5
    expect(rankPercentile(1, 39)).toBe(3);  // leader still computes (3%)
  });
  it("clamps to at least 1% and guards a zero/!finite total", () => {
    expect(rankPercentile(1, 1000)).toBe(1); // 0.1% rounds to 0 → clamp to 1
    expect(rankPercentile(5, 0)).toBe(0);
  });
});
