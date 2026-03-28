import { describe, it, expect } from "vitest";
import { calculateTier, calculateCombinedScore } from "../scoring";

describe("calculateTier", () => {
  const thresholds = [
    { tier: "iron", minPoints: 0 },
    { tier: "bronze", minPoints: 100 },
    { tier: "silver", minPoints: 300 },
    { tier: "gold", minPoints: 600 },
  ];

  it("assigns iron for 0 points", () => {
    expect(calculateTier(0, thresholds, [])).toBe("iron_3");
  });

  it("assigns bronze for 150 points", () => {
    expect(calculateTier(150, thresholds, [])).toBe("bronze_3");
  });

  it("assigns gold for 700 points", () => {
    expect(calculateTier(700, thresholds, [])).toBe("gold_3");
  });

  it("calculates sub-rank based on percentile within tier", () => {
    const peersInTier = [100, 150, 200];
    expect(calculateTier(100, thresholds, peersInTier)).toBe("bronze_3");
    expect(calculateTier(150, thresholds, peersInTier)).toBe("bronze_2");
    expect(calculateTier(200, thresholds, peersInTier)).toBe("bronze_1");
  });

  it("handles single rep in tier as sub-rank 3", () => {
    expect(calculateTier(150, thresholds, [150])).toBe("bronze_3");
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
    // season: (50/100)*100 = 50, pipeline: (200k/400k)*100 = 50, take: (100k/500k)*100 = 20
    // combined: 50*0.6 + 50*0.2 + 20*0.2 = 30 + 10 + 4 = 44
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
