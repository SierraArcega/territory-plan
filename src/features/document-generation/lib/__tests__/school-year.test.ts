import { describe, it, expect } from "vitest";
import { schoolYearFromDate, defaultSchoolYear, schoolYearOptions } from "../school-year";

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
  it("offers prev + current + next 4 around the FY rule", () => {
    expect(schoolYearOptions(new Date(2026, 5, 11))).toEqual([
      "2024 - 2025", "2025 - 2026", "2026 - 2027",
      "2027 - 2028", "2028 - 2029", "2029 - 2030",
    ]);
  });
  it("always contains the default", () => {
    const today = new Date(2026, 10, 2);
    expect(schoolYearOptions(today)).toContain(defaultSchoolYear(today));
  });
});
