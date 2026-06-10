import { describe, expect, it } from "vitest";
import { addBizDays, slaState } from "../sla";

// Fixed "now" matching the design prototype: Tue, Jun 2 2026, 10:30 local.
const NOW = new Date("2026-06-02T10:30:00");

const iso = (s: string) => new Date(s).toISOString();

describe("addBizDays", () => {
  it("adds plain weekdays when no weekend intervenes", () => {
    // Mon + 2 biz days = Wed
    const due = addBizDays(new Date("2026-06-01T09:00:00"), 2);
    expect(due.getDay()).toBe(3); // Wednesday
    expect(due.getDate()).toBe(3);
  });

  it("skips Saturday and Sunday", () => {
    // Fri + 2 biz days = Tue (Sat/Sun skipped)
    const due = addBizDays(new Date("2026-05-29T15:00:00"), 2);
    expect(due.getDay()).toBe(2); // Tuesday
    expect(due.getDate()).toBe(2);
    expect(due.getHours()).toBe(15); // time-of-day preserved
  });

  it("starts counting from the next weekday when assigned on a weekend", () => {
    // Sat + 2 biz days = Tue (Sun skipped, Mon=1, Tue=2)
    const due = addBizDays(new Date("2026-05-30T11:00:00"), 2);
    expect(due.getDay()).toBe(2); // Tuesday
    expect(due.getDate()).toBe(2);
  });

  it("does not mutate the input date", () => {
    const start = new Date("2026-06-01T09:00:00");
    addBizDays(start, 2);
    expect(start.toISOString()).toBe(new Date("2026-06-01T09:00:00").toISOString());
  });
});

describe("slaState", () => {
  it("returns null when there is no assignment timestamp", () => {
    expect(slaState(null, NOW)).toBeNull();
    expect(slaState(undefined, NOW)).toBeNull();
    expect(slaState("", NOW)).toBeNull();
  });

  it("is ok with a days+hours label when plenty of time remains", () => {
    // Assigned Tue 03:30 → due Thu 03:30; now Tue 10:30 → 41h left.
    const s = slaState(iso("2026-06-02T03:30:00"), NOW)!;
    expect(s.overdue).toBe(false);
    expect(s.urgency).toBe("ok");
    expect(s.label).toBe("1d 17h left");
    expect(s.ms).toBe(41 * 3.6e6);
  });

  it("spans weekends: assigned Friday is due Tuesday", () => {
    // Assigned Fri 15:00 → due Tue 15:00 (Sat/Sun skipped); now Tue 10:30.
    const s = slaState(iso("2026-05-29T15:00:00"), NOW)!;
    expect(s.overdue).toBe(false);
    expect(s.dueAt.getDay()).toBe(2);
    expect(s.label).toBe("4h left");
    expect(s.urgency).toBe("due-soon"); // 4.5h < 6h
  });

  it("is ok at exactly 6h remaining (boundary is strict)", () => {
    // Due Thu 16:30, now Tue 10:30 → exactly... build directly: assigned so
    // that due - now === 6h. Assigned Fri 16:30 → due Tue 16:30; now 10:30.
    const s = slaState(iso("2026-05-29T16:30:00"), NOW)!;
    expect(s.ms).toBe(6 * 3.6e6);
    expect(s.urgency).toBe("ok");
  });

  it("is due-soon just under 6h remaining", () => {
    const s = slaState(iso("2026-05-29T16:29:00"), NOW)!;
    expect(s.ms).toBe(6 * 3.6e6 - 60_000);
    expect(s.urgency).toBe("due-soon");
    expect(s.label).toBe("5h left");
  });

  it("uses a minutes label under one hour", () => {
    // Assigned Fri 11:00 → due Tue 11:00; now Tue 10:30 → 30m left.
    const s = slaState(iso("2026-05-29T11:00:00"), NOW)!;
    expect(s.urgency).toBe("due-soon");
    expect(s.label).toBe("30m left");
  });

  it("flags overdue with an overdue label", () => {
    // Assigned Thu 11:00 → due Mon 11:00; now Tue 10:30 → 23.5h overdue.
    const s = slaState(iso("2026-05-28T11:00:00"), NOW)!;
    expect(s.overdue).toBe(true);
    expect(s.urgency).toBe("overdue");
    expect(s.label).toBe("23h overdue");
    expect(s.ms).toBe(-23.5 * 3.6e6);
  });

  it("formats multi-day overdue with days and hours", () => {
    // Assigned Mon May 25 09:00 → due Wed May 27 09:00; now Jun 2 10:30
    // → 6d 1h overdue (145.5h → 6d 1h).
    const s = slaState(iso("2026-05-25T09:00:00"), NOW)!;
    expect(s.overdue).toBe(true);
    expect(s.label).toBe("6d 1h overdue");
  });
});
