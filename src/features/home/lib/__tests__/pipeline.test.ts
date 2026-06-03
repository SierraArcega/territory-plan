import { describe, it, expect } from "vitest";
import {
  buildCoverage, classifyHealth, buildOppViews,
  buildFunnel, buildTargetsRow,
  PIPELINE_STAGES, type OpenOppRow, type PipelineOpp, type OppView, type TargetRepAgg,
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
    daysInStage: 0, overdueClose: false, account: null, state: null, closeDate: null, detailsLink: null, ...p,
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

  it("threads the LMS detailsLink through to the view", () => {
    const link = "https://lms.fullmindlearning.com/opportunities/opp-1";
    const views = buildOppViews([pipeOpp({ account: "X", detailsLink: link })]);
    expect(views[0].detailsLink).toBe(link);
  });
});

describe("classifyHealth", () => {
  it("flags an overdue close date as 'slip' (highest priority, even if young)", () => {
    expect(classifyHealth(opp({ stagePrefix: 4, daysInStage: 2, overdueClose: true }))).toBe("slip");
  });

  it("prefers 'slip' over 'stall' when a deal is BOTH overdue and past its healthy age", () => {
    expect(classifyHealth(opp({ stagePrefix: 4, daysInStage: 40, overdueClose: true }))).toBe("slip"); // 40 > 28 AND overdue → slip wins
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

describe("buildFunnel", () => {
  const reps = [
    { id: "me", email: "me@x" },
    { id: "u2", email: "u2@x" },
  ];
  // me: Meeting(min30/max100, return), Negotiation(min80/max200, new)
  // u2: Meeting(min10/max40, return)
  const teamOpps: OpenOppRow[] = [
    { email: "me@x", stagePrefix: 0, netBooking: 0, minPurchase: 30, maxBudget: 100, daysInStage: 5, overdueClose: false, category: "renewal" },
    { email: "me@x", stagePrefix: 4, netBooking: 0, minPurchase: 80, maxBudget: 200, daysInStage: 5, overdueClose: false, category: "new_business" },
    { email: "u2@x", stagePrefix: 0, netBooking: 0, minPurchase: 10, maxBudget: 40, daysInStage: 5, overdueClose: false, category: "renewal" },
  ];

  it("returns the six open stages in order with caller min/max/count and team min", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    expect(f.stages.map((s) => s.name)).toEqual([
      "Meeting Booked", "Discovery", "Presentation", "Proposal", "Negotiation", "Commitment",
    ]);
    const meeting = f.stages[0];
    expect(meeting).toMatchObject({ count: 1, min: 30, max: 100, teamMin: 40 });
    expect(meeting.sharePct).toBe(75); // 30 / 40
    expect(f.stages[4]).toMatchObject({ count: 1, min: 80, max: 200, teamMin: 80, sharePct: 100 });
  });

  it("rolls up caller totals, spread, overall team share and rank", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    expect(f.openCount).toBe(2);
    expect(f.totalMin).toBe(110);
    expect(f.totalMax).toBe(300);
    expect(f.spread).toBe(190);
    expect(f.teamMinTotal).toBe(120);
    expect(f.overallSharePct).toBe(92); // round(110/120*100)
    expect(f.rank).toBe(1);
    expect(f.totalReps).toBe(2);
  });

  it("splits the caller-vs-team min commit by deal source", () => {
    const f = buildFunnel(teamOpps, reps, "me", "all");
    const ret = f.sources.find((s) => s.key === "return")!;
    expect(ret).toMatchObject({ you: 30, team: 40, pct: 75 });
    const neu = f.sources.find((s) => s.key === "new")!;
    expect(neu).toMatchObject({ you: 80, team: 80, pct: 100 });
  });

  it("source filter scopes both caller and team to that source", () => {
    const f = buildFunnel(teamOpps, reps, "me", "return");
    expect(f.totalMin).toBe(30);
    expect(f.stages[0]).toMatchObject({ min: 30, teamMin: 40, sharePct: 75 });
    expect(f.stages[4]).toMatchObject({ min: 0, teamMin: 0, sharePct: 0 });
  });

  it("reports 0% share when the team has no min commit in a stage", () => {
    const f = buildFunnel([], reps, "me", "all");
    expect(f.stages[0]).toMatchObject({ min: 0, teamMin: 0, sharePct: 0 });
    expect(f.overallSharePct).toBe(0);
  });

  it("returns zero caller metrics when callerId is not in reps", () => {
    const f = buildFunnel(teamOpps, reps, "unknown-id", "all");
    expect(f.openCount).toBe(0);
    expect(f.totalMin).toBe(0);
    expect(f.rank).toBe(3); // totalReps + 1
  });
});

describe("buildTargetsRow", () => {
  // value = Σ all four target columns over targeted pre-pipe districts.
  const byRep: TargetRepAgg[] = [
    { email: "me@x", count: 3, value: 500 },
    { email: "u2@x", count: 2, value: 300 },
  ];

  it("returns the caller's pre-pipe target value with team share", () => {
    const t = buildTargetsRow(byRep, "me@x");
    expect(t).toMatchObject({ count: 3, value: 500, teamValue: 800 });
    expect(t.sharePct).toBe(63); // round(500/800*100)
  });

  it("zeros out a caller with no plan targets but still reports team value", () => {
    const t = buildTargetsRow(byRep, "ghost@x");
    expect(t).toMatchObject({ count: 0, value: 0, teamValue: 800, sharePct: 0 });
  });

  it("handles an empty roster", () => {
    expect(buildTargetsRow([], "me@x")).toMatchObject({ count: 0, value: 0, teamValue: 0, sharePct: 0 });
  });
});
