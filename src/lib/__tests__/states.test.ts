import { describe, it, expect } from "vitest";
import { normalizeState, isValidState, stateDisplayName, US_STATES } from "../states";

describe("normalizeState", () => {
  it("returns abbreviation as-is", () => {
    expect(normalizeState("PA")).toBe("PA");
    expect(normalizeState("CA")).toBe("CA");
  });

  it("handles lowercase abbreviations", () => {
    expect(normalizeState("pa")).toBe("PA");
    expect(normalizeState("ca")).toBe("CA");
  });

  it("normalizes full state names", () => {
    expect(normalizeState("Pennsylvania")).toBe("PA");
    expect(normalizeState("PENNSYLVANIA")).toBe("PA");
    expect(normalizeState("california")).toBe("CA");
  });

  it("normalizes multi-word state names", () => {
    expect(normalizeState("New York")).toBe("NY");
    expect(normalizeState("NORTH CAROLINA")).toBe("NC");
    expect(normalizeState("west virginia")).toBe("WV");
    expect(normalizeState("District of Columbia")).toBe("DC");
  });

  it("trims whitespace", () => {
    expect(normalizeState(" pa ")).toBe("PA");
    expect(normalizeState("  Pennsylvania  ")).toBe("PA");
  });

  it("returns null for unrecognizable input", () => {
    expect(normalizeState("gibberish")).toBeNull();
    expect(normalizeState("XX")).toBeNull();
    expect(normalizeState("")).toBeNull();
    expect(normalizeState("   ")).toBeNull();
  });
});

describe("isValidState", () => {
  it("returns true for valid states", () => {
    expect(isValidState("PA")).toBe(true);
    expect(isValidState("Pennsylvania")).toBe(true);
  });

  it("returns false for invalid states", () => {
    expect(isValidState("XX")).toBe(false);
    expect(isValidState("")).toBe(false);
  });
});

describe("stateDisplayName", () => {
  it("returns display name for abbreviation", () => {
    expect(stateDisplayName("PA")).toBe("Pennsylvania");
    expect(stateDisplayName("NY")).toBe("New York");
  });

  it("returns input if abbreviation not found", () => {
    expect(stateDisplayName("XX")).toBe("XX");
  });
});

describe("US_STATES", () => {
  it("contains all 52 entries (50 states + DC + PR)", () => {
    expect(US_STATES).toHaveLength(52);
  });

  it("is sorted alphabetically", () => {
    const sorted = [...US_STATES].sort();
    expect(US_STATES).toEqual(sorted);
  });

  it("contains only 2-letter strings", () => {
    for (const s of US_STATES) {
      expect(s).toMatch(/^[A-Z]{2}$/);
    }
  });
});
