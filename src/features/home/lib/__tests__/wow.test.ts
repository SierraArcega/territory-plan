import { describe, it, expect } from "vitest";
import { buildWowDeltas } from "../wow";

describe("buildWowDeltas", () => {
  it("computes week-over-week deltas from the latest vs the prior snapshot", () => {
    const out = buildWowDeltas([
      { date: "2026-05-22", openPipeline: 400, bookings: 500 },
      { date: "2026-05-29", openPipeline: 480, bookings: 525 },
    ]);
    expect(out.openPipeline).toBeCloseTo((480 - 400) / 400, 5); // +0.20
    expect(out.bookings).toBeCloseTo((525 - 500) / 500, 5); // +0.05
  });

  it("orders by date so input order does not matter", () => {
    const out = buildWowDeltas([
      { date: "2026-05-29", openPipeline: 480, bookings: 0 },
      { date: "2026-05-22", openPipeline: 400, bookings: 0 },
    ]);
    expect(out.openPipeline).toBeCloseTo(0.2, 5);
  });

  it("returns null deltas when there is no prior baseline or it is zero", () => {
    expect(buildWowDeltas([{ date: "2026-05-29", openPipeline: 480, bookings: 525 }])).toEqual({
      openPipeline: null,
      bookings: null,
    });
    const zeroPrior = buildWowDeltas([
      { date: "2026-05-22", openPipeline: 0, bookings: 100 },
      { date: "2026-05-29", openPipeline: 480, bookings: 200 },
    ]);
    expect(zeroPrior.openPipeline).toBeNull(); // prior 0 → undefined %
    expect(zeroPrior.bookings).toBeCloseTo(1, 5);
  });
});
