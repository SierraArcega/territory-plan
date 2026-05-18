import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeLabelsFromRows,
  __resetCacheForTests,
  type GlobalLabel,
} from "../global-customer-labels";

describe("computeLabelsFromRows", () => {
  it("ranks districts with FY26 revenue descending and labels as 'rank'", () => {
    const rows = [
      { leaid: "A", fy26: 1000, fy25: 0, fy24: 0 },
      { leaid: "B", fy26: 5000, fy25: 0, fy24: 0 },
      { leaid: "C", fy26: 2500, fy25: 0, fy24: 0 },
    ];
    const out = computeLabelsFromRows(rows);
    expect(out.get("B")).toEqual<GlobalLabel>({ rank: 1, label: "rank" });
    expect(out.get("C")).toEqual<GlobalLabel>({ rank: 2, label: "rank" });
    expect(out.get("A")).toEqual<GlobalLabel>({ rank: 3, label: "rank" });
  });

  it("labels districts with FY25 revenue but no FY26 as 'win_back'", () => {
    const rows = [{ leaid: "D", fy26: 0, fy25: 500, fy24: 0 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("D")).toEqual<GlobalLabel>({ rank: null, label: "win_back" });
  });

  it("labels districts with FY24 revenue but no FY25/FY26 as 'win_back'", () => {
    const rows = [{ leaid: "E", fy26: 0, fy25: 0, fy24: 800 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("E")).toEqual<GlobalLabel>({ rank: null, label: "win_back" });
  });

  it("labels districts with no FY24/FY25/FY26 revenue as 'new'", () => {
    const rows = [{ leaid: "F", fy26: 0, fy25: 0, fy24: 0 }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("F")).toEqual<GlobalLabel>({ rank: null, label: "new" });
  });

  it("treats null revenue same as zero", () => {
    const rows = [{ leaid: "G", fy26: null, fy25: null, fy24: null }];
    const out = computeLabelsFromRows(rows);
    expect(out.get("G")).toEqual<GlobalLabel>({ rank: null, label: "new" });
  });

  it("handles ties — both get the same rank", () => {
    const rows = [
      { leaid: "H", fy26: 100, fy25: 0, fy24: 0 },
      { leaid: "I", fy26: 100, fy25: 0, fy24: 0 },
      { leaid: "J", fy26: 50, fy25: 0, fy24: 0 },
    ];
    const out = computeLabelsFromRows(rows);
    expect(out.get("H")?.rank).toBe(1);
    expect(out.get("I")?.rank).toBe(1);
    expect(out.get("J")?.rank).toBe(3);
  });
});

describe("getGlobalCustomerLabels caching", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
  });

  it("calls fetcher on first request and serves from cache for 5 minutes", async () => {
    const { getGlobalCustomerLabels } = await import("../global-customer-labels");
    const fetcher = vi.fn().mockResolvedValue(new Map([["X", { rank: 1, label: "rank" as const }]]));

    const m1 = await getGlobalCustomerLabels(fetcher);
    expect(m1.get("X")?.rank).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 4 minutes later — still cached
    vi.setSystemTime(new Date("2026-05-18T12:04:00Z"));
    await getGlobalCustomerLabels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 6 minutes after the first call — refetches
    vi.setSystemTime(new Date("2026-05-18T12:06:00Z"));
    await getGlobalCustomerLabels(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does NOT cache when the fetcher fails — next call retries", async () => {
    const { getGlobalCustomerLabels } = await import("../global-customer-labels");
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const failingFetcher = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const m1 = await getGlobalCustomerLabels(failingFetcher);
    expect(m1.size).toBe(0);
    expect(failingFetcher).toHaveBeenCalledTimes(1);

    // Immediately retry — the failure should not have been cached.
    const ok = new Map([["Z", { rank: 1, label: "rank" as const }]]);
    const succeedingFetcher = vi.fn().mockResolvedValueOnce(ok);
    const m2 = await getGlobalCustomerLabels(succeedingFetcher);
    expect(m2.get("Z")?.rank).toBe(1);
    expect(succeedingFetcher).toHaveBeenCalledTimes(1);

    consoleErr.mockRestore();
  });
});
