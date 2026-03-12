import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo, timeUntil } from "../pretty-duration";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates within 30 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:30Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:05Z"))).toBe("just now");
    vi.useRealTimers();
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:05:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("5m ago");
    vi.useRealTimers();
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T15:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("3h ago");
    vi.useRealTimers();
  });

  it("returns 'yesterday' for 1 day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("yesterday");
    vi.useRealTimers();
  });

  it("returns days ago for 2-7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("5 days ago");
    vi.useRealTimers();
  });

  it("returns absolute date after 7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("Mar 11");
    vi.useRealTimers();
  });

  it("accepts ISO string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:05:00Z"));
    expect(timeAgo("2026-03-11T12:00:00Z")).toBe("5m ago");
    vi.useRealTimers();
  });

  it("accepts YYYY-MM-DD string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00Z"));
    expect(timeAgo("2026-03-11")).toBe("5 days ago");
    vi.useRealTimers();
  });

  it("returns '1m ago' at exactly 30 seconds (boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:30Z"));
    expect(timeAgo(new Date("2026-03-11T12:00:00Z"))).toBe("1m ago");
    vi.useRealTimers();
  });

  it("throws on invalid string format", () => {
    expect(() => timeAgo("March 11 2026")).toThrow();
  });
});

describe("timeUntil", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates within 30 seconds in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T12:00:25Z"))).toBe("just now");
    vi.useRealTimers();
  });

  it("returns 'in X minutes'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T12:10:00Z"))).toBe("in 10m");
    vi.useRealTimers();
  });

  it("returns 'tomorrow' for 1 day in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-12T12:00:00Z"))).toBe("tomorrow");
    vi.useRealTimers();
  });

  it("returns 'in Xh'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-11T15:00:00Z"))).toBe("in 3h");
    vi.useRealTimers();
  });

  it("returns 'in X days' for 2-7 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-16T12:00:00Z"))).toBe("in 5 days");
    vi.useRealTimers();
  });

  it("returns absolute date after 7 days in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil(new Date("2026-03-25T12:00:00Z"))).toBe("Mar 25");
    vi.useRealTimers();
  });

  it("accepts ISO string input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00Z"));
    expect(timeUntil("2026-03-11T12:10:00Z")).toBe("in 10m");
    vi.useRealTimers();
  });

  it("throws on invalid string format", () => {
    expect(() => timeUntil("March 25 2026")).toThrow();
  });
});
