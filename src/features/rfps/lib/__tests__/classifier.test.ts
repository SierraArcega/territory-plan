import { describe, it, expect } from "vitest";
import { parseClassificationResult, MAX_KEYWORDS, MAX_KEYWORD_CHARS } from "../classifier";

describe("parseClassificationResult", () => {
  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult(undefined)).toBeNull();
    expect(parseClassificationResult("string")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });

  it("parses a valid full result", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });

    expect(result).toEqual({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });
  });

  it("falls back to 'none' for invalid relevance tier", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "super_high", // not in enum
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("falls back to 'none' for invalid set-aside type", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "extraterrestrial_owned",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.setAsideType).toBe("none");
  });

  it("filters out invalid funding sources", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: [],
      fundingSources: ["esser", "made_up_source", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fundingSources).toEqual(["esser", "title_i"]);
  });

  it(`truncates keywords beyond MAX_KEYWORDS (${MAX_KEYWORDS})`, () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => `keyword-${i}`);
    const result = parseClassificationResult({
      fullmindRelevance: "medium",
      keywords: tooMany,
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toHaveLength(MAX_KEYWORDS);
    expect(result?.keywords[0]).toBe("keyword-0");
  });

  it("lowercases and trims keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["  High-Dosage Tutoring  ", "ALGEBRA I"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["high-dosage tutoring", "algebra i"]);
  });

  it("filters out empty keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: ["valid", "", "  ", "another"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["valid", "another"]);
  });

  it("validates requiresW9State as 2-letter USPS code or null", () => {
    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "TX",
      })?.requiresW9State,
    ).toBe("TX");

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "Texas", // bad format
      })?.requiresW9State,
    ).toBeNull();

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
        // omitted entirely
      })?.requiresW9State,
    ).toBeNull();
  });

  it("coerces missing booleans to false", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      // inStateOnly + cooperativeEligible omitted
    });
    expect(result?.inStateOnly).toBe(false);
    expect(result?.cooperativeEligible).toBe(false);
  });

  it(`caps each keyword at MAX_KEYWORD_CHARS (${MAX_KEYWORD_CHARS})`, () => {
    const longKeyword = "x".repeat(200);
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: [longKeyword],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toHaveLength(1);
    expect(result?.keywords[0]).toHaveLength(MAX_KEYWORD_CHARS);
  });
});
