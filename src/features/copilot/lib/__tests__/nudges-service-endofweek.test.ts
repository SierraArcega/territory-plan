import { describe, it, expect } from "vitest";
import { endOfWeek } from "../nudges-service";

describe("endOfWeek", () => {
  it("returns the same Sunday (end of day) when now is already Sunday", () => {
    const sunday = new Date("2026-05-31T09:00:00"); // 2026-05-31 is a Sunday
    const eow = endOfWeek(sunday);
    expect(eow.getFullYear()).toBe(2026);
    expect(eow.getMonth()).toBe(4); // May
    expect(eow.getDate()).toBe(31); // same day, not +7
    expect(eow.getDay()).toBe(0); // Sunday
  });
  it("returns the upcoming Sunday for a weekday", () => {
    const wed = new Date("2026-05-27T09:00:00"); // Wednesday
    const eow = endOfWeek(wed);
    expect(eow.getDate()).toBe(31); // the coming Sunday
    expect(eow.getDay()).toBe(0);
  });
});
