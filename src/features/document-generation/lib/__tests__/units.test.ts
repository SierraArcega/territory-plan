import { describe, it, expect } from "vitest";
import { LINE_UNITS, canonicalUnit } from "../units";

describe("canonicalUnit", () => {
  it("maps pricebook unit strings to a canonical LINE_UNIT", () => {
    expect(canonicalUnit("Hour")).toBe("Hour");
    expect(canonicalUnit("hrs")).toBe("Hour");
    expect(canonicalUnit("days")).toBe("Day");
    expect(canonicalUnit("Session")).toBe("Session");
    expect(canonicalUnit("Year")).toBe("Year");
    expect(canonicalUnit(null)).toBe("Day");
    expect(canonicalUnit("weird")).toBe("Flat");
  });
  it("LINE_UNITS contains Hour and Day", () => {
    expect(LINE_UNITS).toContain("Hour");
    expect(LINE_UNITS).toContain("Day");
  });
});
