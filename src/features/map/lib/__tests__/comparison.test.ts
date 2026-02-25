import { describe, it, expect } from "vitest";
import {
  classifyTransition,
  CATEGORY_RANK,
  TRANSITION_BUCKETS,
  TRANSITION_BUCKET_MAP,
  type TransitionBucket,
} from "../comparison";

// ===========================================================================
// 1. Core transition classification
// ===========================================================================

describe("classifyTransition", () => {
  // --- Churned ---

  it("1. Customer in A, null in B = Churned", () => {
    expect(classifyTransition("multi_year_growing", null)).toBe("churned");
  });

  it("2. Customer in A, lapsed in B = Churned (Fullmind variant)", () => {
    expect(classifyTransition("multi_year_flat", "lapsed")).toBe("churned");
  });

  it("3. Customer in A, churned in B = Churned (competitor variant)", () => {
    expect(classifyTransition("new", "churned")).toBe("churned");
  });

  it("4. Pipeline in A, null in B = Churned", () => {
    expect(classifyTransition("renewal_pipeline", null)).toBe("churned");
  });

  // --- New Customer ---

  it("5. Null in A, customer category in B = New Customer", () => {
    expect(classifyTransition(null, "new")).toBe("new_customer");
  });

  it("6. Target in A, new in B = New Customer", () => {
    expect(classifyTransition("target", "new")).toBe("new_customer");
  });

  it("7. Lapsed in A, new in B = New Customer (Fullmind winback)", () => {
    expect(classifyTransition("lapsed", "new")).toBe("new_customer");
  });

  it("8. Churned in A, new in B = New Customer (competitor winback)", () => {
    expect(classifyTransition("churned", "new")).toBe("new_customer");
  });

  // --- Upgraded ---

  it("9. Pipeline in A, multi_year in B = New Customer (pipeline-to-revenue)", () => {
    // Pipeline -> customer is classified as New Customer (not Upgraded)
    // because pipeline categories are included in the "null/target/lapsed/churned/pipeline" check
    expect(classifyTransition("renewal_pipeline", "multi_year_growing")).toBe("new_customer");
  });

  it("10. multi_year_shrinking in A, multi_year_growing in B = Upgraded", () => {
    expect(classifyTransition("multi_year_shrinking", "multi_year_growing")).toBe("upgraded");
  });

  // --- Downgraded ---

  it("11. multi_year_growing in A, multi_year_shrinking in B = Downgraded", () => {
    expect(classifyTransition("multi_year_growing", "multi_year_shrinking")).toBe("downgraded");
  });

  it("12. expansion_pipeline in A, new_business_pipeline in B = Downgraded", () => {
    expect(classifyTransition("expansion_pipeline", "new_business_pipeline")).toBe("downgraded");
  });

  // --- New Pipeline ---

  it("13. Null in A, pipeline in B = New Pipeline", () => {
    expect(classifyTransition(null, "new_business_pipeline")).toBe("new_pipeline");
  });

  it("14. Lapsed in A, pipeline in B = New Pipeline (Fullmind winback pipeline)", () => {
    expect(classifyTransition("lapsed", "renewal_pipeline")).toBe("new_pipeline");
  });

  it("15. Churned in A, pipeline in B = New Pipeline (competitor winback pipeline)", () => {
    expect(classifyTransition("churned", "winback_pipeline")).toBe("new_pipeline");
  });

  // --- Unchanged ---

  it("16. Same category in both = Unchanged", () => {
    expect(classifyTransition("multi_year_flat", "multi_year_flat")).toBe("unchanged");
  });

  it("17. Both null = Unchanged", () => {
    expect(classifyTransition(null, null)).toBe("unchanged");
  });

  // --- Edge cases ---

  it("21. Empty string treated same as null", () => {
    expect(classifyTransition("", null)).toBe("unchanged");
    expect(classifyTransition(null, "")).toBe("unchanged");
    expect(classifyTransition("", "")).toBe("unchanged");
    // Empty string in A, customer in B = New Customer
    expect(classifyTransition("", "new")).toBe("new_customer");
  });
});

// ===========================================================================
// 2. CATEGORY_RANK consistency
// ===========================================================================

describe("CATEGORY_RANK", () => {
  it("18. Rank ordering forms a valid hierarchy", () => {
    // Verify rank order: no data < pipeline < customer
    expect(CATEGORY_RANK[""]).toBeLessThan(CATEGORY_RANK["target"]);
    expect(CATEGORY_RANK["target"]).toBeLessThan(CATEGORY_RANK["new_business_pipeline"]);
    expect(CATEGORY_RANK["new_business_pipeline"]).toBeLessThan(CATEGORY_RANK["winback_pipeline"]);
    expect(CATEGORY_RANK["winback_pipeline"]).toBeLessThan(CATEGORY_RANK["renewal_pipeline"]);
    expect(CATEGORY_RANK["renewal_pipeline"]).toBeLessThan(CATEGORY_RANK["expansion_pipeline"]);
    expect(CATEGORY_RANK["expansion_pipeline"]).toBeLessThan(CATEGORY_RANK["new"]);
    expect(CATEGORY_RANK["new"]).toBeLessThan(CATEGORY_RANK["multi_year_shrinking"]);
    expect(CATEGORY_RANK["multi_year_shrinking"]).toBeLessThan(CATEGORY_RANK["multi_year_flat"]);
    expect(CATEGORY_RANK["multi_year_flat"]).toBeLessThan(CATEGORY_RANK["multi_year_growing"]);
  });

  it("19. lapsed and churned both rank 0 (same as no data)", () => {
    expect(CATEGORY_RANK["lapsed"]).toBe(0);
    expect(CATEGORY_RANK["churned"]).toBe(0);
    expect(CATEGORY_RANK[""]).toBe(0);
  });

  it("20. All known categories have a rank (including churned)", () => {
    const expectedCategories = [
      "",
      "lapsed",
      "churned",
      "target",
      "new_business_pipeline",
      "winback_pipeline",
      "renewal_pipeline",
      "expansion_pipeline",
      "new",
      "multi_year_shrinking",
      "multi_year_flat",
      "multi_year_growing",
    ];
    for (const cat of expectedCategories) {
      expect(CATEGORY_RANK[cat]).toBeDefined();
      expect(typeof CATEGORY_RANK[cat]).toBe("number");
    }
  });
});

// ===========================================================================
// 3. TRANSITION_BUCKETS config
// ===========================================================================

describe("TRANSITION_BUCKETS", () => {
  it("defines all 6 buckets", () => {
    expect(TRANSITION_BUCKETS).toHaveLength(6);
    const ids = TRANSITION_BUCKETS.map((b) => b.id);
    expect(ids).toContain("churned");
    expect(ids).toContain("new_customer");
    expect(ids).toContain("upgraded");
    expect(ids).toContain("downgraded");
    expect(ids).toContain("new_pipeline");
    expect(ids).toContain("unchanged");
  });

  it("each bucket has a label, color, and description", () => {
    for (const bucket of TRANSITION_BUCKETS) {
      expect(bucket.label).toBeTruthy();
      expect(bucket.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(bucket.description).toBeTruthy();
    }
  });

  it("TRANSITION_BUCKET_MAP provides quick lookup", () => {
    for (const bucket of TRANSITION_BUCKETS) {
      expect(TRANSITION_BUCKET_MAP[bucket.id]).toBe(bucket);
    }
  });
});
