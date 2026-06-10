import { describe, it, expect } from "vitest";
import { parseLocalDate, fmtDate, fmtRel } from "../date-utils";

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

// ===========================================================================
// fmtDate
// ===========================================================================

describe("fmtDate", () => {
  const NOW = new Date(2026, 5, 10); // June 10, 2026

  it("omits the year for dates in the current year", () => {
    expect(fmtDate("2026-02-12", NOW)).toBe("Feb 12");
  });

  it("includes the year for dates in another year", () => {
    expect(fmtDate("2025-12-31", NOW)).toBe("Dec 31, 2025");
  });

  it("handles the year boundary in both directions", () => {
    const newYearsEve = new Date(2025, 11, 31);
    expect(fmtDate("2025-12-31", newYearsEve)).toBe("Dec 31");
    expect(fmtDate("2026-01-01", newYearsEve)).toBe("Jan 1, 2026");
  });

  it("does not shift date-only strings across timezones", () => {
    // UTC-midnight ISO strings would render a day early via new Date()
    expect(fmtDate("2026-02-12T00:00:00.000Z", NOW)).toBe("Feb 12");
  });

  it("accepts Date objects", () => {
    expect(fmtDate(new Date(2026, 2, 5, 14, 30), NOW)).toBe("Mar 5");
  });
});

// ===========================================================================
// fmtRel
// ===========================================================================

describe("fmtRel", () => {
  const NOW = new Date("2026-06-10T12:00:00");
  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

  it("returns 'just now' under ~30 minutes", () => {
    expect(fmtRel(minutesAgo(0), NOW)).toBe("just now");
    expect(fmtRel(minutesAgo(20), NOW)).toBe("just now");
  });

  it("rounds up to '1h ago' from ~30 minutes", () => {
    expect(fmtRel(minutesAgo(45), NOW)).toBe("1h ago");
  });

  it("uses hours below a day", () => {
    expect(fmtRel(minutesAgo(2 * 60), NOW)).toBe("2h ago");
    expect(fmtRel(minutesAgo(23 * 60), NOW)).toBe("23h ago");
  });

  it("transitions from hours to 'yesterday' at ~24h", () => {
    // 23h40m rounds to 24h -> day bucket -> "yesterday"
    expect(fmtRel(minutesAgo(23 * 60 + 40), NOW)).toBe("yesterday");
    expect(fmtRel(minutesAgo(30 * 60), NOW)).toBe("yesterday");
  });

  it("uses days beyond yesterday", () => {
    expect(fmtRel(minutesAgo(48 * 60), NOW)).toBe("2d ago");
    expect(fmtRel(minutesAgo(72 * 60), NOW)).toBe("3d ago");
  });

  it("clamps future timestamps to 'just now'", () => {
    expect(fmtRel(minutesAgo(-90), NOW)).toBe("just now");
  });

  it("accepts ISO strings", () => {
    expect(fmtRel("2026-06-10T10:00:00", NOW)).toBe("2h ago");
  });
});
