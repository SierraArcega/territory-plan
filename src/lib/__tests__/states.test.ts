import { describe, it, expect } from "vitest";
import {
  normalizeState,
  isValidState,
  stateDisplayName,
  US_STATES,
  USPS_TO_FIPS,
  FIPS_TO_USPS,
  abbrevToFips,
  fipsToAbbrev,
} from "../states";

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

describe("USPS_TO_FIPS / FIPS_TO_USPS", () => {
  it("contains all 52 jurisdictions covered by US_STATES", () => {
    expect(Object.keys(USPS_TO_FIPS).sort()).toEqual([...US_STATES].sort());
  });

  it("FIPS values are 2-digit zero-padded strings", () => {
    for (const fips of Object.values(USPS_TO_FIPS)) {
      expect(fips).toMatch(/^\d{2}$/);
    }
  });

  it("round-trips USPS -> FIPS -> USPS for all entries", () => {
    for (const usps of Object.keys(USPS_TO_FIPS)) {
      const fips = USPS_TO_FIPS[usps];
      expect(FIPS_TO_USPS[fips]).toBe(usps);
    }
  });

  it("known mappings", () => {
    expect(USPS_TO_FIPS.CA).toBe("06");
    expect(USPS_TO_FIPS.TX).toBe("48");
    expect(USPS_TO_FIPS.AL).toBe("01");
    expect(USPS_TO_FIPS.DC).toBe("11");
    expect(USPS_TO_FIPS.PR).toBe("72");
  });
});

describe("abbrevToFips", () => {
  it("returns FIPS for valid USPS (case-insensitive)", () => {
    expect(abbrevToFips("CA")).toBe("06");
    expect(abbrevToFips("ca")).toBe("06");
    expect(abbrevToFips("Tx")).toBe("48");
  });
  it("returns null for unknown abbreviations", () => {
    expect(abbrevToFips("ZZ")).toBeNull();
    expect(abbrevToFips("")).toBeNull();
    // @ts-expect-error testing runtime behavior with non-string input
    expect(abbrevToFips(undefined)).toBeNull();
  });
});

describe("fipsToAbbrev", () => {
  it("returns USPS for valid FIPS", () => {
    expect(fipsToAbbrev("06")).toBe("CA");
    expect(fipsToAbbrev("48")).toBe("TX");
  });
  it("returns null for unknown FIPS", () => {
    expect(fipsToAbbrev("99")).toBeNull();
    expect(fipsToAbbrev("")).toBeNull();
  });
});
