import { describe, it, expect } from "vitest";
import { computeRange, takeRate, mergeMotionRows, utilization, deferred } from "../sched-delivered";

describe("computeRange", () => {
  it("scales revenue/take/floor as a percent of the ceiling", () => {
    const g = computeRange({ revenue: 748, take: 224, floor: 650, ceiling: 1100 });
    expect(g.hasRange).toBe(true);
    expect(g.revenuePct).toBeCloseTo(68, 0);
    expect(g.takePct).toBeCloseTo(20.36, 1);
    expect(g.floorPct).toBeCloseTo(59.09, 1);
    expect(g.overage).toBe(false);
  });

  it("flags overage and clamps the fill at 100% when revenue exceeds the ceiling", () => {
    const g = computeRange({ revenue: 1300, take: 400, floor: 600, ceiling: 1100 });
    expect(g.revenuePct).toBe(100);
    expect(g.overage).toBe(true);
  });

  it("reports no range when the ceiling is zero (no won contracts)", () => {
    const g = computeRange({ revenue: 0, take: 0, floor: 0, ceiling: 0 });
    expect(g).toEqual({ hasRange: false, revenuePct: 0, takePct: 0, floorPct: 0, overage: false });
  });

  it("clamps a floor that exceeds the ceiling (data anomaly) to 100%", () => {
    const g = computeRange({ revenue: 200, take: 50, floor: 1500, ceiling: 1100 });
    expect(g.floorPct).toBe(100);
  });

  it("caps takePct at revenuePct so the take slice never overruns the fill", () => {
    // Pathological: take exceeds revenue. The slice must not extend past the fill.
    const g = computeRange({ revenue: 600, take: 800, floor: 0, ceiling: 1000 });
    expect(g.revenuePct).toBeCloseTo(60, 5);
    expect(g.takePct).toBeCloseTo(60, 5);
  });
});

describe("takeRate", () => {
  it("returns take / revenue", () => {
    expect(takeRate(1000, 300)).toBeCloseTo(0.3, 5);
  });
  it("returns null when revenue is zero or negative", () => {
    expect(takeRate(0, 0)).toBeNull();
    expect(takeRate(-5, 1)).toBeNull();
  });
});

describe("mergeMotionRows", () => {
  it("zips revenue + take by motion in segment order, with per-row take rate", () => {
    const rows = mergeMotionRows(
      [
        { key: "return", label: "Return", value: 600 },
        { key: "new", label: "New biz", value: 100 },
      ],
      [
        { key: "return", label: "Return", value: 180 },
        { key: "new", label: "New biz", value: 30 },
      ],
    );
    expect(rows).toEqual([
      { key: "return", label: "Return", revenue: 600, take: 180, rate: 0.3 },
      { key: "new", label: "New biz", revenue: 100, take: 30, rate: 0.3 },
    ]);
  });

  it("includes a motion present in only one of the two inputs", () => {
    const rows = mergeMotionRows(
      [{ key: "winback", label: "Win-back", value: 50 }],
      [],
    );
    expect(rows).toEqual([{ key: "winback", label: "Win-back", revenue: 50, take: 0, rate: 0 }]);
  });

  it("drops motions with neither revenue nor take", () => {
    const rows = mergeMotionRows([], []);
    expect(rows).toEqual([]);
  });

  it("returns a null rate when take exists but revenue is zero", () => {
    const rows = mergeMotionRows([], [{ key: "new", label: "New biz", value: 40 }]);
    expect(rows).toEqual([{ key: "new", label: "New biz", revenue: 0, take: 40, rate: null }]);
  });
});

describe("utilization", () => {
  it("returns money / maxBudget", () => {
    expect(utilization(748, 1100)).toBeCloseTo(0.68, 2);
  });
  it("returns null when there's no budget to measure against", () => {
    expect(utilization(0, 0)).toBeNull();
    expect(utilization(50, 0)).toBeNull();
  });
  it("can exceed 1 on overage", () => {
    expect(utilization(1300, 1100)).toBeGreaterThan(1);
  });
});

describe("deferred", () => {
  it("returns the commitment not yet delivered", () => {
    expect(deferred(88, 650)).toBe(562); // 650 floor − 88 delivered
  });
  it("is 0 once delivered clears the commitment", () => {
    expect(deferred(748, 650)).toBe(0);
  });
});
