import { describe, it, expect } from "vitest";
import { isPlanStale } from "../plan-alerts";

describe("isPlanStale", () => {
  const since = new Date("2026-04-27T00:00:00Z"); // 30d before "now"
  it("is stale when there are no activity dates", () => {
    expect(isPlanStale([], since)).toBe(true);
  });
  it("is stale when the latest date is before the cutoff", () => {
    expect(isPlanStale([new Date("2026-03-01")], since)).toBe(true);
  });
  it("is not stale when any date is on/after the cutoff", () => {
    expect(isPlanStale([new Date("2026-03-01"), new Date("2026-05-01")], since)).toBe(false);
  });
});
