import { describe, it, expect } from "vitest";
import { NEWS_CATEGORIES, parseClassificationResult } from "../classifier";

describe("NEWS_CATEGORIES", () => {
  it("contains the 5 expanded categories", () => {
    expect(NEWS_CATEGORIES).toContain("vacancies_staffing");
    expect(NEWS_CATEGORIES).toContain("school_choice");
    expect(NEWS_CATEGORIES).toContain("procurement_rfp");
    expect(NEWS_CATEGORIES).toContain("tutoring_intervention");
    expect(NEWS_CATEGORIES).toContain("homeschool");
  });

  it("has exactly 16 categories", () => {
    expect(NEWS_CATEGORIES).toHaveLength(16);
  });
});

describe("parseClassificationResult", () => {
  it("returns a typed result for valid input (no sentiment field)", () => {
    const result = parseClassificationResult({
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
    expect(result).toEqual({
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
  });

  it("ignores sentiment if the LLM returns it", () => {
    const result = parseClassificationResult({
      sentiment: "positive",
      categories: [],
      fullmindRelevance: "high",
    });
    expect(result).not.toHaveProperty("sentiment");
  });

  it("defaults invalid fullmindRelevance to 'none'", () => {
    const result = parseClassificationResult({
      categories: [],
      fullmindRelevance: "super-high",
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("filters out categories not in the enum", () => {
    const result = parseClassificationResult({
      categories: ["budget_funding", "not_a_real_category", "homeschool"],
      fullmindRelevance: "medium",
    });
    expect(result?.categories).toEqual(["budget_funding", "homeschool"]);
  });

  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult("nope")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });
});
