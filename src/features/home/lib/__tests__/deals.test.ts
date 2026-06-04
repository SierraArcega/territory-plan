import { describe, it, expect } from "vitest";
import {
  buildUtilizationRows,
  buildDealTotals,
  type WonAccountAgg,
  type DoaAccountAgg,
  type PipelineDealRow,
  type BookingDealRow,
  type UtilizationRow,
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
      { account: "A", state: "TX", stageName: "Discovery", source: "new", committed: 100, maxBudget: 300, closeDate: null },
      { account: "B", state: "CA", stageName: "Proposal", source: "return", committed: 50, maxBudget: 80, closeDate: null },
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
});
