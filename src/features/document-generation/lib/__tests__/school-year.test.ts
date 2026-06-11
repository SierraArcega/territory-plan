import { describe, it, expect } from "vitest";
import {
  schoolYearFromDate,
  defaultSchoolYear,
  schoolYearOptions,
  splitSchoolYear,
  joinSchoolYear,
  startYearOptions,
} from "../school-year";

describe("schoolYearFromDate", () => {
  it("maps a fall start to the SY it opens (July-1 boundary)", () => {
    expect(schoolYearFromDate("2026-09-01")).toBe("2026 - 2027");
  });
  it("maps a mid-year (spring) start into the SY in progress", () => {
    expect(schoolYearFromDate("2027-03-01")).toBe("2026 - 2027");
  });
  it("July 1 starts the new SY; June 30 belongs to the old one", () => {
    expect(schoolYearFromDate("2026-07-01")).toBe("2026 - 2027");
    expect(schoolYearFromDate("2026-06-30")).toBe("2025 - 2026");
  });
  it("returns null for empty/invalid input", () => {
    expect(schoolYearFromDate("")).toBeNull();
    expect(schoolYearFromDate("not-a-date")).toBeNull();
  });
});

describe("defaultSchoolYear", () => {
  it("is the SY starting in the current calendar year, all year long", () => {
    expect(defaultSchoolYear(new Date(2026, 5, 11))).toBe("2026 - 2027"); // June
    expect(defaultSchoolYear(new Date(2026, 9, 1))).toBe("2026 - 2027"); // October
  });
});

describe("schoolYearOptions", () => {
  it("offers the current SY + next 4 — never a past year", () => {
    expect(schoolYearOptions(new Date(2026, 5, 11))).toEqual([
      "2025 - 2026", "2026 - 2027", "2027 - 2028",
      "2028 - 2029", "2029 - 2030",
    ]);
  });
  it("rolls the window forward at the July-1 FY boundary", () => {
    expect(schoolYearOptions(new Date(2026, 6, 1))[0]).toBe("2026 - 2027");
    expect(schoolYearOptions(new Date(2026, 5, 30))[0]).toBe("2025 - 2026");
  });
  it("always contains the default", () => {
    const today = new Date(2026, 10, 2);
    expect(schoolYearOptions(today)).toContain(defaultSchoolYear(today));
  });
});

describe("splitSchoolYear", () => {
  it("parses a standard hyphen-separated SY string", () => {
    expect(splitSchoolYear("2026 - 2027")).toEqual({ start: 2026, end: 2027 });
  });
  it("round-trips a joined value", () => {
    const sy = "2025 - 2026";
    const split = splitSchoolYear(sy);
    expect(split).not.toBeNull();
    expect(joinSchoolYear(split!.start, split!.end)).toBe(sy);
  });
  it("accepts an en-dash separator", () => {
    expect(splitSchoolYear("2026 – 2027")).toEqual({ start: 2026, end: 2027 });
  });
  it("accepts a multi-year span", () => {
    expect(splitSchoolYear("2026 - 2028")).toEqual({ start: 2026, end: 2028 });
  });
  it("returns null for junk input", () => {
    expect(splitSchoolYear("not-a-year")).toBeNull();
    expect(splitSchoolYear("")).toBeNull();
    expect(splitSchoolYear("2026")).toBeNull();
  });
});

describe("joinSchoolYear", () => {
  it("produces the canonical '<start> - <end>' format", () => {
    expect(joinSchoolYear(2026, 2027)).toBe("2026 - 2027");
  });
  it("handles multi-year spans", () => {
    expect(joinSchoolYear(2026, 2028)).toBe("2026 - 2028");
  });
});

describe("startYearOptions", () => {
  it("returns 5 consecutive start years matching the schoolYearOptions window", () => {
    const today = new Date(2026, 5, 11);
    const starts = startYearOptions(today);
    expect(starts).toHaveLength(5);
    // Should be consecutive integers
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBe(starts[i - 1] + 1);
    }
  });
  it("each start year in the result matches the start of the corresponding schoolYearOptions entry", () => {
    const today = new Date(2026, 5, 11);
    const starts = startYearOptions(today);
    const syOpts = schoolYearOptions(today);
    expect(starts).toEqual(syOpts.map((sy) => splitSchoolYear(sy)!.start));
  });
  it("works for a different date (year-proof)", () => {
    const today = new Date(2028, 2, 15); // March 2028
    const starts = startYearOptions(today);
    expect(starts).toHaveLength(5);
    // All should be integers
    for (const s of starts) {
      expect(Number.isInteger(s)).toBe(true);
    }
  });
});
