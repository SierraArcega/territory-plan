import { describe, it, expect } from "vitest";
import { calculateTier, calculateCombinedScore, calculateEffectivePoints } from "../scoring";

describe("calculateTier", () => {
  const thresholds = [
    { tier: "freshman", minPoints: 0 },
    { tier: "honor_roll", minPoints: 100 },
    { tier: "deans_list", minPoints: 300 },
    { tier: "valedictorian", minPoints: 600 },
  ];

  it("assigns freshman for 0 points", () => {
    expect(calculateTier(0, thresholds)).toBe("freshman");
  });

  it("assigns honor_roll for 150 points", () => {
    expect(calculateTier(150, thresholds)).toBe("honor_roll");
  });

  it("assigns valedictorian for 700 points", () => {
    expect(calculateTier(700, thresholds)).toBe("valedictorian");
  });

  it("assigns deans_list for exactly 300 points", () => {
    expect(calculateTier(300, thresholds)).toBe("deans_list");
  });

  it("assigns freshman for 99 points (just below honor_roll)", () => {
    expect(calculateTier(99, thresholds)).toBe("freshman");
  });
});

describe("calculateCombinedScore", () => {
  it("calculates normalized combined score with 40/20/20/20 weights", () => {
    const score = calculateCombinedScore({
      initiativePoints: 50,
      maxInitiativePoints: 100,
      pipeline: 200000,
      maxPipeline: 400000,
      take: 100000,
      maxTake: 500000,
      revenue: 150000,
      maxRevenue: 300000,
      initiativeWeight: 0.4,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
      revenueWeight: 0.2,
    });
    // initiative: 50/100=50% * 0.4 = 20
    // pipeline:   200k/400k=50% * 0.2 = 10
    // take:       100k/500k=20% * 0.2 = 4
    // revenue:    150k/300k=50% * 0.2 = 10
    // total = 44
    expect(score).toBeCloseTo(44);
  });

  it("handles zero max values gracefully", () => {
    const score = calculateCombinedScore({
      initiativePoints: 50,
      maxInitiativePoints: 100,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      revenue: 0,
      maxRevenue: 0,
      initiativeWeight: 0.4,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
      revenueWeight: 0.2,
    });
    // Only initiative contributes: 50/100=50% * 0.4 = 20
    expect(score).toBeCloseTo(20);
  });

  it("handles all zeros", () => {
    const score = calculateCombinedScore({
      initiativePoints: 0,
      maxInitiativePoints: 0,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      revenue: 0,
      maxRevenue: 0,
      initiativeWeight: 0.4,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
      revenueWeight: 0.2,
    });
    expect(score).toBe(0);
  });
});

describe("calculateEffectivePoints", () => {
  it("returns pointValue * weight rounded to nearest integer", () => {
    expect(calculateEffectivePoints(10, 1.5)).toBe(15);
  });

  it("rounds to nearest integer", () => {
    expect(calculateEffectivePoints(7, 1.3)).toBe(9); // 7 * 1.3 = 9.1 → 9
  });

  it("defaults weight to 1.0 when undefined", () => {
    expect(calculateEffectivePoints(10, undefined)).toBe(10);
  });

  it("handles weight of 0", () => {
    expect(calculateEffectivePoints(10, 0)).toBe(0);
  });
});
