import { describe, it, expect } from "vitest";
import {
  fyMonthIndex,
  cumulativeColumns,
  flatCarry,
  todayColumnIndex,
  buildMetricTrajectory,
  buildSegmentedTrajectory,
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

describe("buildMetricTrajectory", () => {
  const d = (iso: string) => new Date(iso + "T12:00:00Z");
  const reps = [
    { id: "me", email: "me@x" },
    { id: "u2", email: "u2@x" },
    { id: "u3", email: "u3@x" },
  ];
  // Jan 15 2026 is inside FY26 → today column = 7 (Jan).
  const now = d("2026-01-15");
  const rows = [
    { email: "me@x", date: d("2025-08-10"), value: 100 }, // Aug (col 2)
    { email: "me@x", date: d("2025-12-05"), value: 100 }, // Dec (col 6)
    { email: "u2@x", date: d("2025-07-15"), value: 150 }, // Jul (col 1)
    { email: "u3@x", date: d("2025-09-20"), value: 500 }, // Sep (col 3)
  ];

  it("ranks every rep per column on cumulative values, flat-carried after today", () => {
    const t = buildMetricTrajectory({ rows, fy: 2026, reps, callerId: "me", now });

    expect(t.todayIndex).toBe(7);
    expect(t.caller.inRoster).toBe(true);
    expect(t.caller.values).toEqual([0, 0, 100, 100, 100, 100, 200, 200, 200, 200, 200, 200, 200]);
    // Pre-FY all tie #1; u3 overtakes at Sep; me passes u2 once Dec lands; flat from Jan on.
    expect(t.caller.ranks).toEqual([1, 2, 2, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("returns all reps for the modal team breakdown", () => {
    const t = buildMetricTrajectory({ rows, fy: 2026, reps, callerId: "me", now });
    expect(t.reps.map((r) => r.email).sort()).toEqual(["me@x", "u2@x", "u3@x"]);
    const u3 = t.reps.find((r) => r.email === "u3@x")!;
    expect(u3.values[12]).toBe(500); // Sep $500 carried to year-end
    expect(u3.ranks[12]).toBe(1); // highest cumulative → #1
  });

  it("reports a caller outside the roster as not in roster, ranked last+1", () => {
    const t = buildMetricTrajectory({ rows, fy: 2026, reps, callerId: "ghost", now });
    expect(t.caller.inRoster).toBe(false);
    expect(t.caller.values).toEqual(new Array(13).fill(0));
    expect(t.caller.ranks).toEqual(new Array(13).fill(reps.length + 1));
  });
});

describe("buildSegmentedTrajectory", () => {
  const d = (iso: string) => new Date(iso + "T12:00:00Z");
  const reps = [
    { id: "me", email: "me@x" },
    { id: "u2", email: "u2@x" },
  ];
  const now = d("2026-06-30"); // end of FY26 → today column 12, no flat-carry
  const rows = [
    { email: "me@x", date: d("2025-08-01"), value: 100, category: "renewal" },
    { email: "me@x", date: d("2025-08-01"), value: 20, category: "new_business" },
    { email: "u2@x", date: d("2025-08-01"), value: 200, category: "new_business" },
  ];

  it("builds an 'all' trajectory plus one per category present", () => {
    const seg = buildSegmentedTrajectory({ rows, fy: 2026, reps, callerId: "me", now });

    // 'all' ranks on the combined total: me=120 vs u2=200 → me #2.
    expect(seg.all.caller.values[12]).toBe(120);
    expect(seg.all.caller.ranks[12]).toBe(2);

    expect([...seg.byCategory.keys()].sort()).toEqual(["new_business", "renewal"]);
  });

  it("ranks within a single category using only that category's rows", () => {
    const seg = buildSegmentedTrajectory({ rows, fy: 2026, reps, callerId: "me", now });

    // renewal: only me has rows (100) → me #1.
    expect(seg.byCategory.get("renewal")!.caller.values[12]).toBe(100);
    expect(seg.byCategory.get("renewal")!.caller.ranks[12]).toBe(1);

    // new_business: u2(200) > me(20) → me #2.
    expect(seg.byCategory.get("new_business")!.caller.values[12]).toBe(20);
    expect(seg.byCategory.get("new_business")!.caller.ranks[12]).toBe(2);
  });
});
