import { describe, it, expect } from "vitest";
import { formatSchoolYearShort, isoDate, buildExecutedPdfName } from "../naming";

describe("formatSchoolYearShort", () => {
  it("shortens the canonical form", () => {
    expect(formatSchoolYearShort("2026 - 2027")).toBe("SY26-27");
  });
  it("tolerates missing spaces and en-dashes", () => {
    expect(formatSchoolYearShort("2026-2027")).toBe("SY26-27");
    expect(formatSchoolYearShort("2026 – 2027")).toBe("SY26-27");
  });
  it("returns null for null, empty, and unparseable input", () => {
    expect(formatSchoolYearShort(null)).toBeNull();
    expect(formatSchoolYearShort("")).toBeNull();
    expect(formatSchoolYearShort("twenty-six")).toBeNull();
  });
});

describe("isoDate", () => {
  it("formats local YYYY-MM-DD with zero padding", () => {
    expect(isoDate(new Date(2026, 5, 10))).toBe("2026-06-10");
    expect(isoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("buildExecutedPdfName", () => {
  const base = {
    companyName: "Gary Community Schools",
    schoolYear: "2026 - 2027",
    signatureRequestId: "a1b2c3d4e5f6a7b8",
    date: new Date(2026, 5, 10),
  };
  it("builds the full school-year-first name", () => {
    expect(buildExecutedPdfName(base)).toBe(
      "SY26-27 — Gary Community Schools — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
  it("omits the school-year segment when school year is null", () => {
    expect(buildExecutedPdfName({ ...base, schoolYear: null })).toBe(
      "Gary Community Schools — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
  it("omits the company segment when companyName is empty", () => {
    expect(buildExecutedPdfName({ ...base, companyName: "" })).toBe(
      "SY26-27 — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
});
