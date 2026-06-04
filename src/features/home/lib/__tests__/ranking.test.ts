import { describe, it, expect } from "vitest";
import { rankReps, rankForRep } from "../ranking";

describe("rankReps", () => {
  it("ranks reps by value descending, #1 = highest", () => {
    const { ranked, totalReps } = rankReps([
      { id: "a", email: "a@x", value: 100 },
      { id: "b", email: "b@x", value: 300 },
      { id: "c", email: "c@x", value: 200 },
    ]);

    expect(totalReps).toBe(3);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("uses competition ranking for ties (1, 2, 2, 4)", () => {
    const { ranked } = rankReps([
      { id: "a", email: "a@x", value: 500 },
      { id: "b", email: "b@x", value: 300 },
      { id: "c", email: "c@x", value: 300 },
      { id: "d", email: "d@x", value: 100 },
    ]);

    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });
});

describe("rankForRep", () => {
  const ranking = rankReps([
    { id: "a", email: "a@x", value: 100 },
    { id: "b", email: "b@x", value: 300 },
  ]);

  it("returns the rep's rank and value", () => {
    expect(rankForRep(ranking, "a")).toEqual({ rank: 2, value: 100, inRoster: true });
  });

  it("treats an unranked caller as last+1, value 0, not in roster", () => {
    expect(rankForRep(ranking, "zzz")).toEqual({ rank: 3, value: 0, inRoster: false });
  });
});
