import { describe, it, expect } from "vitest";
import { computeStaleInStageCount, type StageOpp } from "../stale-in-stage";

const now = new Date("2026-05-27T00:00:00Z");
function daysAgo(n: number): string {
  return new Date(now.getTime() - n * 86400000).toISOString();
}

describe("computeStaleInStageCount", () => {
  it("counts opps whose time-in-stage exceeds their stage average (min 3 per stage)", () => {
    const opps: StageOpp[] = [
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(10) }], createdAt: daysAgo(40) },
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(12) }], createdAt: daysAgo(40) },
      { stage: "Negotiation", stageHistory: [{ stage: "Negotiation", changed_at: daysAgo(60) }], createdAt: daysAgo(90) },
    ];
    // avg ≈ 27.3d; only the 60d opp exceeds it.
    expect(computeStaleInStageCount(opps, now)).toBe(1);
  });

  it("ignores stages with fewer than 3 opps (too little signal)", () => {
    const opps: StageOpp[] = [
      { stage: "Proposal", stageHistory: [{ stage: "Proposal", changed_at: daysAgo(100) }], createdAt: daysAgo(120) },
      { stage: "Proposal", stageHistory: [{ stage: "Proposal", changed_at: daysAgo(1) }], createdAt: daysAgo(2) },
    ];
    expect(computeStaleInStageCount(opps, now)).toBe(0);
  });

  it("falls back to createdAt when no matching stage_history entry exists", () => {
    const opps: StageOpp[] = [
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(5) },
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(5) },
      { stage: "Discovery", stageHistory: [], createdAt: daysAgo(50) },
    ];
    expect(computeStaleInStageCount(opps, now)).toBe(1);
  });
});
