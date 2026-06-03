import { describe, it, expect } from "vitest";
import { median } from "../velocity";

describe("median", () => {
  it("returns the middle value for odd-length input", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values for even-length input", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns 0 for empty input", () => {
    expect(median([])).toBe(0);
  });
});

import { buildVelocity, type RepVelocityAgg } from "../velocity";

const reps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
  { id: "u3", email: "u3@x" },
];

function agg(p: Partial<RepVelocityAgg>): RepVelocityAgg {
  return { wonCount: 0, closedCount: 0, wonBookingSum: 0, takeSum: 0, revSum: 0, ...p };
}

describe("buildVelocity", () => {
  it("derives the four metrics, ranks them, and computes medians", () => {
    const current = new Map<string, RepVelocityAgg>([
      // me: 6 won / 10 closed = 60% close rate; $600k/6 = $100k deal; 50% margin; 6 deals
      ["me@x", agg({ wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 50000, revSum: 100000 })],
      ["u2@x", agg({ wonCount: 9, closedCount: 10, wonBookingSum: 450000, takeSum: 30000, revSum: 100000 })],
      ["u3@x", agg({ wonCount: 3, closedCount: 10, wonBookingSum: 150000, takeSum: 90000, revSum: 100000 })],
    ]);
    const cells = buildVelocity(reps, current, null, "me");
    const byKey = Object.fromEntries(cells.map((c) => [c.metricKey, c]));

    expect(cells.map((c) => c.metricKey)).toEqual(["closeRate", "avgDealSize", "grossMargin", "dealsWon"]);
    // close rate: u2 90% > me 60% > u3 30% → me #2
    expect(byKey.closeRate).toMatchObject({ value: 0.6, rank: 2, totalReps: 3, inRoster: true, deltaUnit: "pts" });
    expect(byKey.closeRate.teamMedian).toBe(0.6); // median(0.9,0.6,0.3)
    // avg deal size: me $100k > u2 $50k > u3 $50k → me #1
    expect(byKey.avgDealSize).toMatchObject({ value: 100000, rank: 1, deltaUnit: "pct", format: "currency" });
    // gross margin: u3 0.9 > me 0.5 > u2 0.3 → me #2
    expect(byKey.grossMargin).toMatchObject({ value: 0.5, rank: 2, deltaUnit: "pts" });
    // deals won: u2 9 > me 6 > u3 3 → me #2
    expect(byKey.dealsWon).toMatchObject({ value: 6, rank: 2, deltaUnit: "count", format: "count" });
  });

  it("computes prior-FY deltas in each unit (pts / pct / count)", () => {
    const current = new Map<string, RepVelocityAgg>([
      ["me@x", agg({ wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 60000, revSum: 100000 })],
    ]);
    // prior: 50% close, $80k deal (5 won/$400k), 40% margin, 5 won
    const prior = agg({ wonCount: 5, closedCount: 10, wonBookingSum: 400000, takeSum: 40000, revSum: 100000 });
    const byKey = Object.fromEntries(buildVelocity(reps, current, prior, "me").map((c) => [c.metricKey, c]));
    expect(byKey.closeRate.delta).toBe(10);   // 60% - 50% = +10 pts
    expect(byKey.avgDealSize.delta).toBe(25);  // (100k-80k)/80k = +25%
    expect(byKey.grossMargin.delta).toBe(20);  // 60% - 40% = +20 pts
    expect(byKey.dealsWon.delta).toBe(1);      // 6 - 5
  });

  it("marks a caller not in the roster as not-ranked with null delta", () => {
    const cells = buildVelocity(reps, new Map(), agg({ wonCount: 5, closedCount: 5 }), "ghost");
    for (const c of cells) {
      expect(c.inRoster).toBe(false);
      expect(c.delta).toBeNull();
    }
  });

  it("returns a null avg-deal-size delta when the prior value is zero", () => {
    const current = new Map<string, RepVelocityAgg>([["me@x", agg({ wonCount: 2, wonBookingSum: 100000 })]]);
    const byKey = Object.fromEntries(buildVelocity(reps, current, agg({}), "me").map((c) => [c.metricKey, c]));
    expect(byKey.avgDealSize.delta).toBeNull(); // prior avg deal = 0 → no % change
  });
});
