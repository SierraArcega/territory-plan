import { describe, it, expect } from "vitest";
import {
  ACTIVITY_CATEGORIES,
  ALL_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_TYPE_FOR_CATEGORY,
  getCategoryForType,
} from "../types";

describe("outreach activity category", () => {
  it("registers email and cold_call under the outreach category", () => {
    expect(ACTIVITY_CATEGORIES.outreach).toEqual(["email", "cold_call"]);
  });

  it("includes both types in ALL_ACTIVITY_TYPES", () => {
    expect(ALL_ACTIVITY_TYPES).toContain("email");
    expect(ALL_ACTIVITY_TYPES).toContain("cold_call");
  });

  it("resolves the category for each new type", () => {
    expect(getCategoryForType("email")).toBe("outreach");
    expect(getCategoryForType("cold_call")).toBe("outreach");
  });

  it("has labels and icons for both types", () => {
    expect(ACTIVITY_TYPE_LABELS.email).toBe("Email");
    expect(ACTIVITY_TYPE_LABELS.cold_call).toBe("Cold Call");
    expect(ACTIVITY_TYPE_ICONS.email).toBeTruthy();
    expect(ACTIVITY_TYPE_ICONS.cold_call).toBeTruthy();
  });

  it("has category metadata and a default type", () => {
    expect(CATEGORY_LABELS.outreach).toBe("Outreach");
    expect(CATEGORY_ICONS.outreach).toBeTruthy();
    expect(CATEGORY_DESCRIPTIONS.outreach).toBeTruthy();
    expect(DEFAULT_TYPE_FOR_CATEGORY.outreach).toBe("email");
  });
});
