import { describe, it, expect } from "vitest";
import {
  buildUtilizationRows,
  buildDealTotals,
  buildTargetDetailRows,
  type WonAccountAgg,
  type DoaAccountAgg,
  type PipelineDealRow,
  type BookingDealRow,
  type UtilizationRow,
  type TargetDistrictAgg,
  type TargetDetailRow,
} from "../deals";

const won = (over: Partial<WonAccountAgg>): WonAccountAgg => ({
  leaid: "100", account: "Acct", source: "new", minCommit: 0, maxBudget: 0, ...over,
});
const doa = (over: Partial<DoaAccountAgg>): DoaAccountAgg => ({
  leaid: "100", revenue: 0, take: 0, ...over,
});

describe("buildUtilizationRows", () => {
  it("joins won min/max with DOA delivered revenue/take by district", () => {
    const rows = buildUtilizationRows(
      [won({ leaid: "1", account: "Houston ISD", minCommit: 100, maxBudget: 200 })],
      [doa({ leaid: "1", revenue: 120, take: 36 })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account: "Houston ISD",
      minCommit: 100,
      maxBudget: 200,
      revenue: 120,
      take: 36,
      utilPct: 0.6, // 120 / 200
      underMin: false, // 120 >= 100
      deferred: 0, // max(0, 100 - 120)
    });
  });

  it("computes deferred as the unconsumed floor (minCommit - revenue, clamped at 0)", () => {
    const [row] = buildUtilizationRows(
      [won({ leaid: "1", account: "A", minCommit: 100, maxBudget: 300 })],
      [doa({ leaid: "1", revenue: 40, take: 10 })],
    );
    expect(row.deferred).toBe(60); // 100 - 40
    expect(row.underMin).toBe(true); // 40 < 100
    expect(row.utilPct).toBeCloseTo(40 / 300, 6);
  });

  it("guards utilPct against a zero max budget (returns null, not Infinity/NaN)", () => {
    const [row] = buildUtilizationRows(
      [won({ leaid: "1", account: "A", minCommit: 0, maxBudget: 0 })],
      [doa({ leaid: "1", revenue: 50, take: 5 })],
    );
    expect(row.utilPct).toBeNull();
    expect(row.deferred).toBe(0); // minCommit 0 → nothing deferred
  });

  it("allows revenue to exceed max budget (util over 100%)", () => {
    const [row] = buildUtilizationRows(
      [won({ leaid: "1", account: "A", minCommit: 100, maxBudget: 200 })],
      [doa({ leaid: "1", revenue: 260, take: 78 })],
    );
    expect(row.utilPct).toBeCloseTo(1.3, 6);
    expect(row.deferred).toBe(0);
    expect(row.underMin).toBe(false);
  });

  it("treats an account with won opps but no DOA delivery as zero revenue/take", () => {
    const [row] = buildUtilizationRows(
      [won({ leaid: "1", account: "A", minCommit: 100, maxBudget: 200 })],
      [],
    );
    expect(row.revenue).toBe(0);
    expect(row.take).toBe(0);
    expect(row.deferred).toBe(100);
    expect(row.utilPct).toBe(0); // 0 / 200
    expect(row.underMin).toBe(true);
  });

  it("aggregates multiple won/DOA rows for the same district into one account row", () => {
    const rows = buildUtilizationRows(
      [
        won({ leaid: "1", account: "A", source: "new", minCommit: 60, maxBudget: 100 }),
        won({ leaid: "1", account: "A", source: "expansion", minCommit: 40, maxBudget: 50 }),
      ],
      [
        doa({ leaid: "1", revenue: 30, take: 9 }),
        doa({ leaid: "1", revenue: 20, take: 6 }),
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ minCommit: 100, maxBudget: 150, revenue: 50, take: 15 });
  });

  it("sorts by contracted size (max budget desc), tie-broken by account name", () => {
    const rows = buildUtilizationRows(
      [
        won({ leaid: "1", account: "Small", maxBudget: 100 }),
        won({ leaid: "2", account: "Big", maxBudget: 900 }),
        won({ leaid: "3", account: "Apex", maxBudget: 100 }),
      ],
      [],
    );
    expect(rows.map((r) => r.account)).toEqual(["Big", "Apex", "Small"]);
  });
});

describe("buildDealTotals", () => {
  it("pipeline → count, committed (Σ net booking), max budget", () => {
    const rows: PipelineDealRow[] = [
      { account: "A", state: "TX", stageName: "Discovery", source: "new", committed: 100, maxBudget: 300, closeDate: null, owner: null, lastActivity: null, lastNote: null },
      { account: "B", state: "CA", stageName: "Proposal", source: "return", committed: 50, maxBudget: 80, closeDate: null, owner: null, lastActivity: null, lastNote: null },
    ];
    expect(buildDealTotals("pipeline", rows)).toEqual({ count: 2, committed: 150, maxBudget: 380 });
  });

  it("bookings → count, amount (signed), min commit, max budget", () => {
    const rows: BookingDealRow[] = [
      { account: "A", product: "Renewal", source: "return", amount: 100, minCommit: 80, maxBudget: 200, closedDate: null },
      { account: "B", product: "New", source: "new", amount: 50, minCommit: 40, maxBudget: 60, closedDate: null },
    ];
    expect(buildDealTotals("bookings", rows)).toEqual({ count: 2, amount: 150, minCommit: 120, maxBudget: 260 });
  });

  it("rev/take → count + summed money + blended util (Σrevenue / Σmaxbudget)", () => {
    const rows: UtilizationRow[] = [
      { account: "A", source: "new", minCommit: 100, maxBudget: 200, revenue: 120, take: 36, deferred: 0, utilPct: 0.6, underMin: false },
      { account: "B", source: "return", minCommit: 80, maxBudget: 300, revenue: 40, take: 12, deferred: 40, utilPct: 40 / 300, underMin: true },
    ];
    const totals = buildDealTotals("rev", rows);
    expect(totals).toMatchObject({ count: 2, minCommit: 180, maxBudget: 500, revenue: 160, take: 48, deferred: 40 });
    expect(totals.utilPct).toBeCloseTo(160 / 500, 6); // blended, not the average of row pcts
  });

  it("rev/take → null blended util when there's no budget to divide by", () => {
    const rows: UtilizationRow[] = [
      { account: "A", source: null, minCommit: 0, maxBudget: 0, revenue: 0, take: 0, deferred: 0, utilPct: null, underMin: false },
    ];
    expect(buildDealTotals("take", rows).utilPct).toBeNull();
  });

  it("targets → district count, summed target $/pipeline, converted + active counts", () => {
    const tr = (over: Partial<TargetDetailRow>): TargetDetailRow => ({
      account: "X", state: null, segment: null, targetDollars: 0, openPipe: 0, won: 0, pipeline: 0,
      converted: false, owners: [], lastActivity: null, nextActivity: null, active: false, ...over,
    });
    const rows: TargetDetailRow[] = [
      tr({ account: "A", state: "TX", segment: "new", targetDollars: 100, openPipe: 60, won: 40, pipeline: 100, converted: true, active: true }),
      tr({ account: "B", state: "CA", segment: "expansion", targetDollars: 50, pipeline: 0 }),
      tr({ account: "C", openPipe: 10, pipeline: 10, converted: true }),
    ];
    expect(buildDealTotals("targets", rows)).toEqual({
      count: 3,
      targetDollars: 150,
      openPipe: 70,
      won: 40,
      pipeline: 110,
      converted: 2,
      active: 1,
    });
  });
});

const agg = (over: Partial<TargetDistrictAgg>): TargetDistrictAgg => ({
  leaid: "100", account: "Acct", state: null, segment: null,
  targetDollars: 0, openPipe: 0, won: 0, owners: [], lastActivity: null, nextActivity: null, active: false, ...over,
});

describe("buildTargetDetailRows", () => {
  it("derives pipeline (open + won) and converted (open pipe > 0), passing owners + activity through", () => {
    const [row] = buildTargetDetailRows([
      agg({ leaid: "1", account: "Houston ISD", state: "TX", segment: "new", targetDollars: 100, openPipe: 60, won: 40, owners: ["Sierra"], lastActivity: "2026-06-01", nextActivity: "2026-06-12", active: true }),
    ]);
    expect(row).toEqual({
      account: "Houston ISD",
      state: "TX",
      segment: "new",
      targetDollars: 100,
      openPipe: 60,
      won: 40,
      pipeline: 100, // 60 + 40
      converted: true, // openPipe > 0
      owners: ["Sierra"],
      lastActivity: "2026-06-01",
      nextActivity: "2026-06-12",
      active: true,
    });
  });

  it("is not converted when there's no open pipeline, even if there are bookings", () => {
    const [row] = buildTargetDetailRows([agg({ openPipe: 0, won: 500 })]);
    expect(row.converted).toBe(false);
    expect(row.pipeline).toBe(500);
  });

  it("keeps a worked district with no targets set (segment null) as its own row", () => {
    const [row] = buildTargetDetailRows([agg({ segment: null, targetDollars: 0, openPipe: 0, won: 0 })]);
    expect(row.segment).toBeNull();
    expect(row.converted).toBe(false);
    expect(row.pipeline).toBe(0);
  });

  it("sorts by target $ desc, tie-broken by pipeline desc, then account name", () => {
    const rows = buildTargetDetailRows([
      agg({ leaid: "1", account: "Small", targetDollars: 100, openPipe: 10 }),
      agg({ leaid: "2", account: "Big", targetDollars: 900 }),
      agg({ leaid: "3", account: "Apex", targetDollars: 100, openPipe: 50 }),
      agg({ leaid: "4", account: "Zed", targetDollars: 100, openPipe: 50 }),
    ]);
    // Big (900) leads; among the 100s, higher pipeline first, then name (Apex < Zed > Small).
    expect(rows.map((r) => r.account)).toEqual(["Big", "Apex", "Zed", "Small"]);
  });
});
