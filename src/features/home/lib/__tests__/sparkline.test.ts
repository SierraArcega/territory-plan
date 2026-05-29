import { describe, it, expect } from "vitest";
import { buildSparklines } from "../sparkline";
import type { DatedValueRow } from "../monthly";

const d = (iso: string) => new Date(iso + "T12:00:00Z");
const empty = () => ({ targets: [], openPipeline: [], bookings: [], revenue: [], take: [] }) as Record<string, DatedValueRow[]>;
const now = d("2026-01-15"); // FY26 today column = 7 (Jan)

describe("buildSparklines", () => {
  it("returns caller cumulative monthly series for the current and prior FY per metric", () => {
    const current = empty();
    current.bookings = [
      { email: "me@x", date: d("2025-08-01"), value: 100 }, // Aug col 2
      { email: "me@x", date: d("2025-12-01"), value: 50 },  // Dec col 6
    ];
    const prior = empty();
    prior.bookings = [{ email: "me@x", date: d("2024-08-01"), value: 80 }]; // prior FY Aug

    const out = buildSparklines({ currentRows: current, priorRows: prior, email: "me@x", fy: 2026, now });

    expect(out.bookings.current).toEqual([0, 0, 100, 100, 100, 100, 150, 150, 150, 150, 150, 150, 150]);
    expect(out.bookings.prior).toEqual([0, 0, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80]);
    // YoY same-point: current cum at today (col 7 = 150) vs prior at col 7 (80) → +0.875
    expect(out.bookings.yoy).toBeCloseTo((150 - 80) / 80, 5);
  });

  it("reports yoy as null when the prior year has nothing to date", () => {
    const current = empty();
    current.revenue = [{ email: "me@x", date: d("2025-09-01"), value: 200 }];
    const out = buildSparklines({ currentRows: current, priorRows: empty(), email: "me@x", fy: 2026, now });
    expect(out.revenue.yoy).toBeNull();
    expect(out.revenue.current[12]).toBe(200);
  });

  it("produces an entry for every metric", () => {
    const out = buildSparklines({ currentRows: empty(), priorRows: empty(), email: "me@x", fy: 2026, now });
    expect(Object.keys(out).sort()).toEqual(["bookings", "openPipeline", "revenue", "take", "targets"]);
  });
});
