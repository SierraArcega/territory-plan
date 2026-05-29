import { describe, it, expect } from "vitest";
import { fyMonthIndex, FY_COLUMN_LABELS } from "../monthly";

// FY26 = "2025-26": Jul 1 2025 → Jun 30 2026. 13 columns: Pre-FY + Jul..Jun.
const FY = 2026;

describe("FY_COLUMN_LABELS", () => {
  it("is the 13 trajectory columns: Pre-FY then Jul..Jun", () => {
    expect(FY_COLUMN_LABELS).toEqual([
      "Pre-FY", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    ]);
  });
});

describe("fyMonthIndex", () => {
  it("buckets a date before Jul 1 of the FY start year into Pre-FY (0)", () => {
    expect(fyMonthIndex(new Date("2025-06-30T12:00:00Z"), FY)).toBe(0);
    expect(fyMonthIndex(new Date("2025-01-15T12:00:00Z"), FY)).toBe(0);
  });

  it("buckets Jul of the FY start year into column 1", () => {
    expect(fyMonthIndex(new Date("2025-07-01T00:00:00Z"), FY)).toBe(1);
    expect(fyMonthIndex(new Date("2025-07-31T23:00:00Z"), FY)).toBe(1);
  });

  it("buckets Dec→Jan across the calendar-year boundary into 6 then 7", () => {
    expect(fyMonthIndex(new Date("2025-12-15T12:00:00Z"), FY)).toBe(6);
    expect(fyMonthIndex(new Date("2026-01-15T12:00:00Z"), FY)).toBe(7);
  });

  it("buckets Jun of the FY end year into the final column (12)", () => {
    expect(fyMonthIndex(new Date("2026-06-30T12:00:00Z"), FY)).toBe(12);
  });

  it("clamps a date after the FY ends into the final column (12) so it still counts in YTD", () => {
    expect(fyMonthIndex(new Date("2026-08-01T12:00:00Z"), FY)).toBe(12);
  });
});
