import { describe, it, expect } from "vitest";
import { parseLocalDate } from "../date-utils";

// ===========================================================================
// parseLocalDate
// ===========================================================================

describe("parseLocalDate", () => {
  it("strips timezone and returns local midnight", () => {
    const result = parseLocalDate("2026-02-12T00:00:00.000Z");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("handles ISO string with T separator", () => {
    const result = parseLocalDate("2026-02-12T00:00:00.000Z");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February is month index 1
    expect(result.getDate()).toBe(12);
  });

  it("handles plain date string without T separator", () => {
    const result = parseLocalDate("2026-02-12");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(12);
  });

  it("returns correct date parts (year, month, day)", () => {
    const result = parseLocalDate("2025-11-05T14:30:00.000Z");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(10); // November is month index 10
    expect(result.getDate()).toBe(5);
    expect(result.getHours()).toBe(0);
  });
});
