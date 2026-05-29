import { describe, it, expect } from "vitest";
import { districtSegment, buildTargetsRollups, workedLeaidsForRep } from "../targets";

describe("districtSegment", () => {
  it("returns the largest of new/winback/expansion", () => {
    expect(districtSegment({ newBusinessTarget: 30, winbackTarget: 10, expansionTarget: 5 })).toBe("new");
    expect(districtSegment({ newBusinessTarget: 10, winbackTarget: 40, expansionTarget: 5 })).toBe("winback");
    expect(districtSegment({ newBusinessTarget: 10, winbackTarget: 5, expansionTarget: 90 })).toBe("expansion");
  });

  it("excludes renewal-only districts (returns null)", () => {
    expect(districtSegment({ newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 0 })).toBeNull();
  });

  it("breaks ties in order new > winback > expansion", () => {
    expect(districtSegment({ newBusinessTarget: 20, winbackTarget: 20, expansionTarget: 0 })).toBe("new");
    expect(districtSegment({ newBusinessTarget: 0, winbackTarget: 20, expansionTarget: 20 })).toBe("winback");
  });
});

describe("buildTargetsRollups", () => {
  it("counts worked districts per rep, buckets by segment, sums target $ (renewal excluded)", () => {
    const rollups = buildTargetsRollups([
      { repId: "me", leaid: "A", newBusinessTarget: 30, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0 },
      { repId: "me", leaid: "B", newBusinessTarget: 0, winbackTarget: 50, expansionTarget: 0, renewalTarget: 0 },
      // renewal-only — excluded from the count and $
      { repId: "me", leaid: "C", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 0, renewalTarget: 100 },
      { repId: "u2", leaid: "D", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 25, renewalTarget: 0 },
    ]);

    expect(rollups.get("me")).toEqual({
      workedCount: 2,
      targetDollars: 80,
      segments: { new: 1, winback: 1, expansion: 0 },
    });
    expect(rollups.get("u2")).toEqual({
      workedCount: 1,
      targetDollars: 25,
      segments: { new: 0, winback: 0, expansion: 1 },
    });
  });

  it("dedupes a district appearing in multiple plans for the same rep (sums its targets, counts once)", () => {
    const rollups = buildTargetsRollups([
      { repId: "me", leaid: "A", newBusinessTarget: 30, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0 },
      { repId: "me", leaid: "A", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 40, renewalTarget: 0 },
    ]);
    // A is counted once; combined targets new=30, expansion=40 → expansion wins; $ = 70
    expect(rollups.get("me")).toEqual({
      workedCount: 1,
      targetDollars: 70,
      segments: { new: 0, winback: 0, expansion: 1 },
    });
  });
});

describe("workedLeaidsForRep", () => {
  const rows = [
    { repId: "me", leaid: "A", newBusinessTarget: 30, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0 },
    { repId: "me", leaid: "C", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 0, renewalTarget: 100 },
    { repId: "u2", leaid: "D", newBusinessTarget: 10, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0 },
  ];

  it("returns only the rep's non-renewal-only worked leaids", () => {
    expect(workedLeaidsForRep(rows, "me")).toEqual(["A"]); // C is renewal-only → excluded
    expect(workedLeaidsForRep(rows, "u2")).toEqual(["D"]);
  });
});
