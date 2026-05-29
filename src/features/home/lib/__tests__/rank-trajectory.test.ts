import { describe, it, expect } from "vitest";
import { buildRankTrajectoryPayload, TRAJECTORY_METRICS } from "../rank-trajectory";
import type { DatedValueRow } from "../monthly";

const d = (iso: string) => new Date(iso + "T12:00:00Z");
const reps = [
  { id: "me", email: "me@x", fullName: "Me Rep" },
  { id: "u2", email: "u2@x", fullName: "Other Rep" },
];
const now = d("2026-06-30"); // end of FY26 → today column 12

describe("TRAJECTORY_METRICS", () => {
  it("defines the five trajectory lines with prototype colors, Targets first", () => {
    expect(TRAJECTORY_METRICS.map((m) => m.metricKey)).toEqual([
      "targets", "openPipeline", "bookings", "revenue", "take",
    ]);
    const byKey = Object.fromEntries(TRAJECTORY_METRICS.map((m) => [m.metricKey, m]));
    expect(byKey.bookings.color).toBe("#F37167");
    expect(byKey.openPipeline.color).toBe("#403770");
  });
});

describe("buildRankTrajectoryPayload", () => {
  const rowsByMetric: Record<string, DatedValueRow[]> = {
    targets: [],
    openPipeline: [],
    bookings: [
      { email: "me@x", date: d("2025-08-01"), value: 100, category: "renewal" },
      { email: "u2@x", date: d("2025-08-01"), value: 300, category: "new_business" },
    ],
    revenue: [],
    take: [],
  };

  it("returns FY meta, the 13 columns, todayIndex, and one entry per metric", () => {
    const p = buildRankTrajectoryPayload({ rowsByMetric, fy: 2026, reps, callerId: "me", now });

    expect(p.fy).toBe(2026);
    expect(p.schoolYr).toBe("2025-26");
    expect(p.columns).toHaveLength(13);
    expect(p.columns[0]).toBe("Pre-FY");
    expect(p.todayIndex).toBe(12);
    expect(p.metrics.map((m) => m.metricKey)).toEqual([
      "targets", "openPipeline", "bookings", "revenue", "take",
    ]);
  });

  it("carries the caller's per-column rank + value for a metric", () => {
    const p = buildRankTrajectoryPayload({ rowsByMetric, fy: 2026, reps, callerId: "me", now });
    const bookings = p.metrics.find((m) => m.metricKey === "bookings")!;

    expect(bookings.caller.inRoster).toBe(true);
    expect(bookings.caller.values[12]).toBe(100);
    expect(bookings.caller.ranks[12]).toBe(2); // u2(300) > me(100)
    // all reps surfaced for the modal, with display names
    expect(bookings.reps.map((r) => r.name).sort()).toEqual(["Me Rep", "Other Rep"]);
    expect(bookings.reps.find((r) => r.name === "Me Rep")!.isCaller).toBe(true);
  });

  it("exposes per-segment sub-series keyed by design segment (renewal→return etc.)", () => {
    const p = buildRankTrajectoryPayload({ rowsByMetric, fy: 2026, reps, callerId: "me", now });
    const bookings = p.metrics.find((m) => m.metricKey === "bookings")!;

    // renewal rows only me → me #1 in the "return" segment
    expect(bookings.segments.return!.caller.values[12]).toBe(100);
    expect(bookings.segments.return!.caller.ranks[12]).toBe(1);
    // new_business rows only u2 → me #2 with $0 in the "new" segment
    expect(bookings.segments.new!.caller.values[12]).toBe(0);
    expect(bookings.segments.new!.caller.ranks[12]).toBe(2);
  });
});
