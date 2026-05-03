import { describe, it, expect } from "vitest";
import { NEWS_CATEGORIES } from "../classifier";

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
