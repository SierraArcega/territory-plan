import { describe, it, expect } from "vitest";
import { calculateTier, calculateCombinedScore } from "../scoring";

describe("calculateTier", () => {
  const thresholds = [
    { tier: "freshman", minPoints: 0 },
    { tier: "honor_roll", minPoints: 100 },
    { tier: "deans_list", minPoints: 300 },
    { tier: "valedictorian", minPoints: 600 },
  ];

  it("assigns freshman for 0 points", () => {
    expect(calculateTier(0, thresholds, [])).toBe("freshman_3");
  });

  it("assigns honor_roll for 150 points", () => {
    expect(calculateTier(150, thresholds, [])).toBe("honor_roll_3");
  });

  it("assigns valedictorian for 700 points", () => {
    expect(calculateTier(700, thresholds, [])).toBe("valedictorian_3");
  });

  it("calculates sub-rank based on percentile within tier", () => {
    const peersInTier = [100, 150, 200];
    expect(calculateTier(100, thresholds, peersInTier)).toBe("honor_roll_3");
    expect(calculateTier(150, thresholds, peersInTier)).toBe("honor_roll_2");
    expect(calculateTier(200, thresholds, peersInTier)).toBe("honor_roll_1");
  });

  it("handles single rep in tier as sub-rank 3", () => {
    expect(calculateTier(150, thresholds, [150])).toBe("honor_roll_3");
  });
});

describe("calculateCombinedScore", () => {
  it("calculates normalized combined score with 60/20/20 weights", () => {
    const score = calculateCombinedScore({
      seasonPoints: 50,
      maxSeasonPoints: 100,
      pipeline: 200000,
      maxPipeline: 400000,
      take: 100000,
      maxTake: 500000,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    expect(score).toBeCloseTo(44);
  });

  it("handles zero max values gracefully", () => {
    const score = calculateCombinedScore({
      seasonPoints: 50,
      maxSeasonPoints: 100,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    expect(score).toBeCloseTo(30);
  });

  it("handles all zeros", () => {
    const score = calculateCombinedScore({
      seasonPoints: 0,
      maxSeasonPoints: 0,
      pipeline: 0,
      maxPipeline: 0,
      take: 0,
      maxTake: 0,
      seasonWeight: 0.6,
      pipelineWeight: 0.2,
      takeWeight: 0.2,
    });
    expect(score).toBe(0);
  });
});
