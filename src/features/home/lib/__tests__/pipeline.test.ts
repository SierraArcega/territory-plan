import { describe, it, expect } from "vitest";
import {
  buildCoverage, buildOppViews,
  buildFunnel, buildTargetsRow, classifyTier,
  buildThisWeek,
  PIPELINE_STAGES, type OpenOppRow, type PipelineOpp, type OppView, type TargetRepAgg,
  type AgeTier, type StageBenchmark, type BenchmarkMap, type ThisWeekDealRow,
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

  it("sorts the caller's open opps by weighted $ and grades tier + overdue", () => {
    const benchmarks: BenchmarkMap = new Map([
      [4, { wonMedian: 20, lostMedian: 35, lostP75: 50 }],
      [5, { wonMedian: 7, lostMedian: 14, lostP75: 21 }],
    ]);
    const views = buildOppViews([
      pipeOpp({ account: "B", category: "new_business", stagePrefix: 5, netBooking: 50, daysInStage: 5, overdueClose: true }), // weighted 45, on but overdue
      pipeOpp({ account: "A", category: "renewal", stagePrefix: 4, netBooking: 100, daysInStage: 40 }), // weighted 75, concerning (35<40<=50)
    ], benchmarks);
    expect(views.map((v) => v.account)).toEqual(["A", "B"]); // 75 before 45
    expect(views[0]).toMatchObject({ stageName: "Negotiation", source: "return", tier: "concerning", overdue: false });
    expect(views[1]).toMatchObject({ stageName: "Commitment", source: "new", tier: "on", overdue: true });
  });

  it("leaves source null when the opp has no category", () => {
    const views = buildOppViews([pipeOpp({ account: "X", category: undefined, stagePrefix: 1, netBooking: 10 })], new Map());
    expect(views[0].source).toBeNull();
  });

  it("threads the LMS detailsLink through to the view", () => {
    const link = "https://lms.fullmindlearning.com/opportunities/opp-1";
    const views = buildOppViews([pipeOpp({ account: "X", detailsLink: link })], new Map());
    expect(views[0].detailsLink).toBe(link);
  });
});

describe("classifyTier", () => {
  const bench: StageBenchmark = { wonMedian: 30, lostMedian: 60, lostP75: 90 };

  it("returns 'on' at or below the won median", () => {
    expect(classifyTier(20, 3, bench)).toBe("on");
    expect(classifyTier(30, 3, bench)).toBe("on");
  });

  it("returns 'watch' past the won median up to the lost median", () => {
    expect(classifyTier(45, 3, bench)).toBe("watch");
    expect(classifyTier(60, 3, bench)).toBe("watch");
  });

  it("returns 'concerning' past the lost median up to the lost p75", () => {
    expect(classifyTier(75, 3, bench)).toBe("concerning");
    expect(classifyTier(90, 3, bench)).toBe("concerning");
  });

  it("returns 'stale' past the lost p75", () => {
    expect(classifyTier(120, 3, bench)).toBe("stale");
  });

  it("treats null lost benchmarks as escalating straight to 'stale' past the won median", () => {
    const wonOnly: StageBenchmark = { wonMedian: 30, lostMedian: null, lostP75: null };
    expect(classifyTier(20, 3, wonOnly)).toBe("on");
    expect(classifyTier(50, 3, wonOnly)).toBe("stale");
  });

  it("falls back to the hardcoded healthy age when a stage has no benchmark", () => {
    // stagePrefix 0 -> healthyMax 14
    expect(classifyTier(10, 0, undefined)).toBe("on");
    expect(classifyTier(20, 0, undefined)).toBe("stale");
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

describe("buildThisWeek", () => {
  // Fixed clock: 2026-06-03T12:00:00Z. Window start = 7 days earlier.
  const NOW = Date.UTC(2026, 5, 3, 12, 0, 0);
  const day = (n: number) => new Date(NOW + n * 86_400_000);

  const row = (over: Partial<ThisWeekDealRow>): ThisWeekDealRow => ({
    account: "Acct",
    value: 1000,
    category: null,
    contractType: null,
    stagePrefix: 0,
    createdAt: day(-1),
    closeDate: null,
    ...over,
  });

  it("buckets won / lost / created and computes count + total", () => {
    const rows = [
      row({ account: "Won A", value: 50000, stagePrefix: 6, createdAt: day(-30), closeDate: day(-2) }),
      row({ account: "Lost A", value: 40000, stagePrefix: -1, createdAt: day(-20), closeDate: day(-1) }),
      row({ account: "New A", value: 30000, stagePrefix: 1, createdAt: day(-3), closeDate: null }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(1);
    expect(w.won.total).toBe(50000);
    expect(w.won.deals[0].account).toBe("Won A");
    expect(w.lost.count).toBe(1);
    expect(w.lost.deals[0].account).toBe("Lost A");
    expect(w.created.count).toBe(1);
    expect(w.created.deals[0].account).toBe("New A");
  });

  it("sorts deals within a column by value desc", () => {
    const rows = [
      row({ account: "Small", value: 10000, stagePrefix: 1, createdAt: day(-1) }),
      row({ account: "Big", value: 90000, stagePrefix: 1, createdAt: day(-1) }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.created.deals.map((d) => d.account)).toEqual(["Big", "Small"]);
  });

  it("places a deal created AND won in the same window in both columns", () => {
    const rows = [row({ account: "Fast", value: 20000, stagePrefix: 6, createdAt: day(-3), closeDate: day(-1) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(1);
    expect(w.created.count).toBe(1);
  });

  it("excludes a deal closed before the window", () => {
    const rows = [row({ account: "Old Win", value: 20000, stagePrefix: 6, createdAt: day(-40), closeDate: day(-10) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(0);
    expect(w.created.count).toBe(0);
  });

  it("maps motion via segment labels, passes product through, omits nulls", () => {
    const rows = [row({ category: "renewal", contractType: "Tutoring", stagePrefix: 1, createdAt: day(-1) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.created.deals[0].motion).toBe("Return");
    expect(w.created.deals[0].product).toBe("Tutoring");

    const rows2 = [row({ category: "new_business", stagePrefix: 1, createdAt: day(-1) })];
    const w2 = buildThisWeek(rows2, NOW);
    expect(w2.created.deals[0].motion).toBe("New biz");

    const rows3 = [row({ category: null, contractType: null, stagePrefix: 1, createdAt: day(-1) })];
    const w3 = buildThisWeek(rows3, NOW);
    expect(w3.created.deals[0].motion).toBeNull();
    expect(w3.created.deals[0].product).toBeNull();
  });

  it("sets daysToClose on won deals and stage label on created deals", () => {
    const rows = [
      row({ account: "Won", value: 1, stagePrefix: 6, createdAt: day(-28), closeDate: day(-1) }),
      row({ account: "New", value: 1, stagePrefix: 0, createdAt: day(-1) }),
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.deals[0].daysToClose).toBe(27);
    expect(w.created.deals[0].stage).toBe("Meeting Booked");
  });

  it("carries prior-window (days 8-14) count + total for week-over-week", () => {
    const rows = [
      // current window
      row({ value: 50000, stagePrefix: 6, createdAt: day(-30), closeDate: day(-2) }), // won now
      row({ value: 30000, stagePrefix: 1, createdAt: day(-1) }), // created now
      // prior window (days 8-14)
      row({ value: 20000, stagePrefix: 6, createdAt: day(-40), closeDate: day(-10) }), // won prior
      row({ value: 15000, stagePrefix: 1, createdAt: day(-9), closeDate: null }), // created prior
    ];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(1);
    expect(w.won.total).toBe(50000);
    expect(w.won.prevCount).toBe(1);
    expect(w.won.prevTotal).toBe(20000);
    expect(w.created.count).toBe(1);
    expect(w.created.total).toBe(30000);
    expect(w.created.prevCount).toBe(1);
    expect(w.created.prevTotal).toBe(15000);
  });

  it("does not count a closed deal with a future close_date as won/lost this week", () => {
    const rows = [row({ account: "Future", value: 99000, stagePrefix: 6, createdAt: day(-3), closeDate: day(5) })];
    const w = buildThisWeek(rows, NOW);
    expect(w.won.count).toBe(0); // closes later — not won this week
    expect(w.created.count).toBe(1); // but it was created this week
  });
});
