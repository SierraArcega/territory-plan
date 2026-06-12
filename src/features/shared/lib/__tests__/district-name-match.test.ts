import { describe, expect, it } from "vitest";
import {
  canonicalizeSchoolName,
  matchByName,
  normalizeOrgName,
  normalizeSchoolName,
  orgNameSimilarity,
  schoolNameSimilarity,
} from "../district-name-match";

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

  it("normalize option swaps the tier-2 normalizer (school abbreviations)", () => {
    const schools = [
      { ncessch: "1", name: "MANVEL H S" },
      { ncessch: "2", name: "MANVEL J H" },
    ];
    // Default district normalizer can't see through "H S".
    expect(matchByName("Manvel High School", schools, { fuzzy: false })).toEqual({
      kind: "none",
    });
    expect(
      matchByName("Manvel High School", schools, { fuzzy: false, normalize: normalizeSchoolName }),
    ).toEqual({ kind: "match", candidate: schools[0] });
    expect(
      matchByName("Manvel Junior High", schools, { fuzzy: false, normalize: normalizeSchoolName }),
    ).toEqual({ kind: "match", candidate: schools[1] });
  });
});

// ---- School-name canonicalization -------------------------------------------

describe("canonicalizeSchoolName / normalizeSchoolName", () => {
  it("expands NCES school-type abbreviations to full words", () => {
    expect(canonicalizeSchoolName("MANVEL H S")).toBe("manvel high school");
    expect(canonicalizeSchoolName("Manvel H.S.")).toBe("manvel high school");
    expect(canonicalizeSchoolName("SALYARDS MS")).toBe("salyards middle school");
    expect(canonicalizeSchoolName("CEDAR PARK J H")).toBe("cedar park junior high");
    expect(canonicalizeSchoolName("Cedar Park Jr High")).toBe("cedar park junior high");
    expect(canonicalizeSchoolName("WESTWOOD INT")).toBe("westwood intermediate");
    expect(canonicalizeSchoolName("LINCOLN ACAD")).toBe("lincoln academy");
  });

  it("expands a TRAILING 'el' but preserves leading Spanish 'El'", () => {
    expect(canonicalizeSchoolName("JOWELL EL")).toBe("jowell elementary");
    expect(canonicalizeSchoolName("EL PASO H S")).toBe("el paso high school");
    expect(canonicalizeSchoolName("El Campo EL")).toBe("el campo elementary");
  });

  it("normalizeSchoolName keeps type words but drops generic filler", () => {
    expect(normalizeSchoolName("Manvel High School")).toBe("manvel high");
    expect(normalizeSchoolName("MANVEL H S")).toBe("manvel high");
    expect(normalizeSchoolName("Jowell Elementary")).toBe("jowell elementary");
    // Type words stay distinguishable — never stripped like district suffixes.
    expect(normalizeSchoolName("Jowell Middle School")).toBe("jowell middle");
  });
});

describe("schoolNameSimilarity", () => {
  it("scores abbreviation variants of the SAME school as 1", () => {
    expect(schoolNameSimilarity("Manvel High School", "MANVEL H S")).toBe(1);
    expect(schoolNameSimilarity("Jowell Elementary", "JOWELL EL")).toBe(1);
    expect(schoolNameSimilarity("Salyards Middle School", "SALYARDS MS")).toBe(1);
  });

  it("keeps unrelated names firmly below the 0.8 agreement bar", () => {
    expect(schoolNameSimilarity("Jowell Elementary", "Alternative Learning Center")).toBeLessThan(
      0.8,
    );
    // Different names, SAME type — the shared "Elementary" must not rescue it.
    expect(schoolNameSimilarity("Clear Creek Elementary", "KOSTORYZ EL")).toBeLessThan(0.8);
    // Same proper name, DIFFERENT type — type tokens carry signal.
    expect(schoolNameSimilarity("Manvel High School", "Manvel Middle School")).toBeLessThan(0.8);
  });

  it("preserves the borderline behavior the 0.8 cross-check bar was tuned on", () => {
    expect(
      schoolNameSimilarity("Truman High School", "Harry S Truman High School"),
    ).toBeGreaterThanOrEqual(0.8);
    expect(
      schoolNameSimilarity("Memorial High School", "Memorial Senior High School"),
    ).toBeGreaterThanOrEqual(0.8);
    expect(schoolNameSimilarity("Riverside High School", "Lakeside High School")).toBeLessThan(0.8);
    expect(schoolNameSimilarity("Jefferson Elementary", "Jackson Elementary")).toBeLessThan(0.8);
  });

  it("returns 0 for blank inputs", () => {
    expect(schoolNameSimilarity("", "MANVEL H S")).toBe(0);
    expect(schoolNameSimilarity("  ", "")).toBe(0);
  });
});
