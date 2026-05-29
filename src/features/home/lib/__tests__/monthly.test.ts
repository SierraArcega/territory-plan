import { describe, it, expect } from "vitest";
import {
  fyMonthIndex,
  cumulativeColumns,
  flatCarry,
  todayColumnIndex,
  FY_COLUMN_LABELS,
} from "../monthly";

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

describe("cumulativeColumns", () => {
  const d = (iso: string) => new Date(iso + "T12:00:00Z");

  it("accumulates each rep's values by source date, monotonic across the 13 columns", () => {
    const byRep = cumulativeColumns(
      [
        { email: "me@x", date: d("2025-08-10"), value: 100 }, // Aug (col 2)
        { email: "me@x", date: d("2025-11-05"), value: 50 },  // Nov (col 5)
        { email: "me@x", date: d("2026-02-20"), value: 25 },  // Feb (col 8)
      ],
      FY,
    );
    // Pre-FY=0, Jul=0, Aug=100, Sep=100, Oct=100, Nov=150, Dec..Jan=150, Feb=175, ...Jun=175
    expect(byRep.get("me@x")).toEqual([0, 0, 100, 100, 100, 150, 150, 150, 175, 175, 175, 175, 175]);
  });

  it("places rows dated before Jul 1 in the Pre-FY column and carries them forward", () => {
    const byRep = cumulativeColumns(
      [
        { email: "me@x", date: d("2025-05-01"), value: 40 }, // Pre-FY
        { email: "me@x", date: d("2025-07-15"), value: 10 }, // Jul
      ],
      FY,
    );
    expect(byRep.get("me@x")).toEqual([40, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);
  });

  it("keeps reps independent", () => {
    const byRep = cumulativeColumns(
      [
        { email: "a@x", date: d("2025-07-15"), value: 10 },
        { email: "b@x", date: d("2025-07-15"), value: 99 },
      ],
      FY,
    );
    expect(byRep.get("a@x")![12]).toBe(10);
    expect(byRep.get("b@x")![12]).toBe(99);
  });

  it("returns an empty map for no rows", () => {
    expect(cumulativeColumns([], FY).size).toBe(0);
  });
});

describe("todayColumnIndex", () => {
  it("returns the current month's column when 'now' is inside the FY", () => {
    // May 2026 is inside FY26 → column 11 (May).
    expect(todayColumnIndex(2026, new Date("2026-05-29T12:00:00Z"))).toBe(11);
  });

  it("returns the final column (12) for a fully-elapsed past FY", () => {
    expect(todayColumnIndex(2025, new Date("2026-05-29T12:00:00Z"))).toBe(12);
  });

  it("returns the Pre-FY column (0) for a not-yet-started future FY", () => {
    expect(todayColumnIndex(2027, new Date("2026-05-29T12:00:00Z"))).toBe(0);
  });
});

describe("flatCarry", () => {
  it("holds the today-column value flat across all future columns", () => {
    const carried = flatCarry([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], 8);
    // columns 0..8 unchanged; 9..12 carry column-8's value (80)
    expect(carried).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 80, 80, 80, 80]);
  });

  it("leaves the array unchanged when today is the final column", () => {
    const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    expect(flatCarry(cols, 12)).toEqual(cols);
  });
});
