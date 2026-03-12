import { describe, it, expect } from "vitest";
import { truncateEnd, truncateMiddle } from "../truncate";

// ===========================================================================
// truncateEnd
// ===========================================================================

describe("truncateEnd", () => {
  it("returns original string if within maxLength", () => {
    expect(truncateEnd("Hello", 10)).toBe("Hello");
  });

  it("truncates and adds ellipsis", () => {
    expect(truncateEnd("Springfield School District", 20)).toBe(
      "Springfield School D\u2026",
    );
  });

  it("handles maxLength equal to string length", () => {
    expect(truncateEnd("Hello", 5)).toBe("Hello");
  });

  it("handles maxLength of 1", () => {
    expect(truncateEnd("Hello", 1)).toBe("H\u2026");
  });

  it("returns empty string for empty input", () => {
    expect(truncateEnd("", 10)).toBe("");
  });

  it("handles Unicode characters", () => {
    expect(truncateEnd("Héllo Wörld", 7)).toBe("Héllo W\u2026");
  });
});

// ===========================================================================
// truncateMiddle
// ===========================================================================

describe("truncateMiddle", () => {
  it("returns original string if within maxLength", () => {
    expect(truncateMiddle("Hello", 10)).toBe("Hello");
  });

  it("truncates middle and keeps start + end", () => {
    // 27 chars, maxLength 20 → startLen=10, endLen=10
    // "Springfiel" + "…" + "l District" = 21 chars (maxLength + ellipsis)
    expect(truncateMiddle("Springfield School District", 20)).toBe(
      "Springfiel\u2026l District",
    );
  });

  it("returns empty string for empty input", () => {
    expect(truncateMiddle("", 10)).toBe("");
  });

  it("handles maxLength equal to string length", () => {
    expect(truncateMiddle("Hello", 5)).toBe("Hello");
  });

  it("handles very short maxLength", () => {
    const result = truncateMiddle("Hello World", 3);
    expect(result).toContain("\u2026");
    expect(result.length).toBeLessThanOrEqual(4);
  });
});
