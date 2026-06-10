import { describe, expect, it } from "vitest";
import { matchByName, normalizeOrgName, orgNameSimilarity } from "../district-name-match";

const TX = [
  { leaid: "4849530", name: "United Independent School District" },
  { leaid: "4823610", name: "Houston Independent School District" },
  { leaid: "4814310", name: "Donna ISD" },
];

describe("normalizeOrgName", () => {
  it("strips K-12 suffix stop-words and punctuation", () => {
    expect(normalizeOrgName("Alamo Heights Independent School District")).toBe("alamo heights");
    expect(normalizeOrgName("Florence School District One")).toBe("florence");
  });
});

describe("orgNameSimilarity", () => {
  it("scores exact and stop-word-normalized equality as 1", () => {
    expect(orgNameSimilarity("Donna ISD", "donna isd")).toBe(1);
    // "school" is a stop word — the marketing-export shape vs the NCES shape.
    expect(orgNameSimilarity("A P Solis Middle School", "A P SOLIS MIDDLE")).toBe(1);
  });

  it("scores unrelated school names low", () => {
    expect(orgNameSimilarity("A P Solis Middle School", "AD WHEAT MIDDLE")).toBeLessThan(0.5);
  });

  it("scores same-school name variants high without reaching 1", () => {
    const score = orgNameSimilarity("Truman High School", "Harry S Truman High School");
    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 for blank inputs", () => {
    expect(orgNameSimilarity("", "Anything")).toBe(0);
    expect(orgNameSimilarity("  ", "")).toBe(0);
  });
});

describe("matchByName", () => {
  it("tier 1: case-insensitive exact match", () => {
    const m = matchByName("united independent school district", TX);
    expect(m).toEqual({ kind: "match", candidate: TX[0] });
  });

  it("tier 2: stop-word-normalized match", () => {
    const m = matchByName("United ISD", TX);
    expect(m).toEqual({ kind: "match", candidate: TX[0] });
  });

  it("tier 3: Dice fuzzy match on a near-typo", () => {
    const m = matchByName("Dalls Independent School District", [
      { leaid: "4900000", name: "Dallas Independent School District" },
    ]);
    expect(m.kind).toBe("match");
  });

  it("reports ambiguous when multiple candidates tie at the matched tier", () => {
    const m = matchByName("Springfield", [
      { leaid: "1", name: "Springfield Public Schools" },
      { leaid: "2", name: "Springfield Independent School District" },
    ]);
    expect(m).toEqual({ kind: "ambiguous" });
  });

  it("returns none when nothing clears the bar", () => {
    expect(matchByName("Wholly Unrelated Charter", TX)).toEqual({ kind: "none" });
    expect(matchByName("", TX)).toEqual({ kind: "none" });
    expect(matchByName("Anything", [])).toEqual({ kind: "none" });
  });

  it("fuzzy: false disables the Dice tier (exact/normalized only)", () => {
    const candidates = [{ leaid: "4900000", name: "Dallas Independent School District" }];
    expect(matchByName("Dalls Independent School District", candidates, { fuzzy: false })).toEqual(
      { kind: "none" },
    );
    expect(matchByName("Dallas ISD", candidates, { fuzzy: false })).toEqual({
      kind: "match",
      candidate: candidates[0],
    });
  });
});
