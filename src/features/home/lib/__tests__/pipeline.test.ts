import { describe, it, expect } from "vitest";
import {
  buildStageHealth, buildCoverage, classifyHealth, buildOppViews,
  PIPELINE_STAGES, type OpenOppRow, type PipelineOpp,
} from "../pipeline";

const reps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
];

const opp = (p: Partial<OpenOppRow>): OpenOppRow => ({
  email: "me@x", stagePrefix: 0, netBooking: 0, minPurchase: 0, maxBudget: 0,
  daysInStage: 0, overdueClose: false, ...p,
});

describe("PIPELINE_STAGES", () => {
  it("defines the six open stages with DOA weights and per-stage healthy ages", () => {
    expect(PIPELINE_STAGES.map((s) => s.name)).toEqual([
      "Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment",
    ]);
    expect(PIPELINE_STAGES.map((s) => s.weight)).toEqual([0.05, 0.1, 0.25, 0.5, 0.75, 0.9]);
    expect(PIPELINE_STAGES.map((s) => s.healthyMax)).toEqual([14, 28, 32, 35, 28, 14]);
  });
});

describe("buildStageHealth", () => {
  const opps = [
    opp({ email: "me@x", stagePrefix: 4, netBooking: 100, daysInStage: 10 }), // healthy (≤28)
    opp({ email: "me@x", stagePrefix: 4, netBooking: 50, daysInStage: 40 }), // stalled (>28)
    opp({ email: "u2@x", stagePrefix: 4, netBooking: 300, daysInStage: 5 }),
    opp({ email: "me@x", stagePrefix: 1, netBooking: 20, daysInStage: 3 }),
  ];

  it("returns all six stages in order", () => {
    const out = buildStageHealth(opps, reps, "me");
    expect(out.map((s) => s.name)).toEqual([
      "Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment",
    ]);
  });

  it("rolls up the caller's count, $ at-stake, weighted $, avg age, and stalled count per stage", () => {
    const out = buildStageHealth(opps, reps, "me");
    const neg = out.find((s) => s.name === "Negotiation")!;
    expect(neg).toMatchObject({
      count: 2,
      atStake: 150, // 100 + 50
      weighted: 112.5, // 150 * 0.75
      avgAge: 25, // (10 + 40) / 2
      stalled: 1, // one over the 28d Negotiation healthy age
    });
  });

  it("ranks the caller against the team by $ at-stake within each stage", () => {
    const out = buildStageHealth(opps, reps, "me");
    expect(out.find((s) => s.name === "Negotiation")!.rank).toBe(2); // me 150 < u2 300
    expect(out.find((s) => s.name === "Discovery")!.rank).toBe(1); // me 20 > u2 0
    expect(out.find((s) => s.name === "Negotiation")!.totalReps).toBe(2);
  });
});

describe("buildCoverage", () => {
  const callerOpps = [
    opp({ stagePrefix: 4, netBooking: 100, minPurchase: 80, maxBudget: 200 }),
    opp({ stagePrefix: 1, netBooking: 20, minPurchase: 10, maxBudget: 60 }),
  ];

  it("sums the floor/ceiling/most-likely of the caller's open book and the gap to target", () => {
    const cov = buildCoverage(callerOpps, 600, 1000); // won 600, target 1000
    expect(cov.minCommit).toBe(90); // 80 + 10
    expect(cov.maxBudget).toBe(260); // 200 + 60
    expect(cov.openCount).toBe(2);
    expect(cov.weightedPipeline).toBeCloseTo(100 * 0.75 + 20 * 0.1, 5); // most likely = 77
    expect(cov.gap).toBe(400); // 1000 - 600
    expect(cov.coverageMin).toBeCloseTo(90 / 400, 5);
    expect(cov.coverageMax).toBeCloseTo(260 / 400, 5);
  });

  it("breaks the floor/ceiling down by stage", () => {
    const cov = buildCoverage(callerOpps, 600, 1000);
    expect(cov.byStage.find((s) => s.name === "Negotiation")).toMatchObject({ min: 80, max: 200 });
    expect(cov.byStage.find((s) => s.name === "Discovery")).toMatchObject({ min: 10, max: 60 });
    expect(cov.byStage).toHaveLength(6);
  });

  it("reports coverage as null once the target is met (no gap to cover)", () => {
    const cov = buildCoverage(callerOpps, 1200, 1000); // won exceeds target
    expect(cov.gap).toBe(0);
    expect(cov.coverageMin).toBeNull();
    expect(cov.coverageMax).toBeNull();
  });
});

describe("buildOppViews", () => {
  const pipeOpp = (p: Partial<PipelineOpp>): PipelineOpp => ({
    email: "me@x", stagePrefix: 0, netBooking: 0, minPurchase: 0, maxBudget: 0,
    daysInStage: 0, overdueClose: false, account: null, state: null, closeDate: null, ...p,
  });

  it("sorts the caller's open opps by weighted $ and labels stage/source/health", () => {
    const views = buildOppViews([
      pipeOpp({ account: "B", category: "new_business", stagePrefix: 5, netBooking: 50, daysInStage: 5, overdueClose: true }), // weighted 45, slip
      pipeOpp({ account: "A", category: "renewal", stagePrefix: 4, netBooking: 100, daysInStage: 40 }), // weighted 75, stall (>28)
    ]);
    expect(views.map((v) => v.account)).toEqual(["A", "B"]); // 75 before 45
    expect(views[0]).toMatchObject({ stageName: "Negotiation", source: "return", health: "stall" });
    expect(views[1]).toMatchObject({ stageName: "Commitment", source: "new", health: "slip" });
  });

  it("leaves source null when the opp has no category", () => {
    const views = buildOppViews([pipeOpp({ account: "X", category: undefined, stagePrefix: 1, netBooking: 10 })]);
    expect(views[0].source).toBeNull();
  });
});

describe("classifyHealth", () => {
  it("flags an overdue close date as 'slip' (highest priority, even if young)", () => {
    expect(classifyHealth(opp({ stagePrefix: 4, daysInStage: 2, overdueClose: true }))).toBe("slip");
  });

  it("flags a deal past its stage's healthy age as 'stall'", () => {
    expect(classifyHealth(opp({ stagePrefix: 4, daysInStage: 40, overdueClose: false }))).toBe("stall"); // >28
    expect(classifyHealth(opp({ stagePrefix: 0, daysInStage: 20, overdueClose: false }))).toBe("stall"); // >14
  });

  it("flags a deal within its stage's healthy age as 'on'", () => {
    expect(classifyHealth(opp({ stagePrefix: 4, daysInStage: 20, overdueClose: false }))).toBe("on"); // ≤28
    expect(classifyHealth(opp({ stagePrefix: 0, daysInStage: 10, overdueClose: false }))).toBe("on"); // ≤14
  });
});
