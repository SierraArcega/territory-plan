import { describe, it, expect } from "vitest";
import { TARGET_ROLES } from "../contact-types";

describe("TARGET_ROLES", () => {
  it("includes Principal as the 8th role", () => {
    expect(TARGET_ROLES).toContain("Principal");
  });

  it("preserves existing roles in order", () => {
    expect(TARGET_ROLES.slice(0, 7)).toEqual([
      "Superintendent",
      "Assistant Superintendent",
      "Chief Technology Officer",
      "Chief Financial Officer",
      "Curriculum Director",
      "Special Education Director",
      "HR Director",
    ]);
  });
});
