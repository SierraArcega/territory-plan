import { describe, it, expect, vi, beforeEach } from "vitest";

const districtCount = vi.fn();
const districtGroupBy = vi.fn();
const vacancyCount = vi.fn();
const vacancyGroupBy = vi.fn();
const vacancyScanCount = vi.fn();
const vacancyScanGroupBy = vi.fn();
const vacancyScanFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      count: (...args: unknown[]) => districtCount(...args),
      groupBy: (...args: unknown[]) => districtGroupBy(...args),
    },
    vacancy: {
      count: (...args: unknown[]) => vacancyCount(...args),
      groupBy: (...args: unknown[]) => vacancyGroupBy(...args),
    },
    vacancyScan: {
      count: (...args: unknown[]) => vacancyScanCount(...args),
      groupBy: (...args: unknown[]) => vacancyScanGroupBy(...args),
      findFirst: (...args: unknown[]) => vacancyScanFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ id: "user-1" }),
}));

import { GET } from "../route";

beforeEach(() => {
  districtCount.mockReset();
  districtGroupBy.mockReset();
  vacancyCount.mockReset();
  vacancyGroupBy.mockReset();
  vacancyScanCount.mockReset();
  vacancyScanGroupBy.mockReset();
  vacancyScanFindFirst.mockReset();
});

function setupHappyPath() {
  vacancyCount.mockResolvedValueOnce(120).mockResolvedValueOnce(100); // total, verified
  vacancyGroupBy.mockResolvedValueOnce([{ leaid: "1" }, { leaid: "2" }]); // districts with vacancies
  districtCount
    .mockResolvedValueOnce(1000) // totalDistrictsWithUrl
    .mockResolvedValueOnce(50); // tarpit total
  vacancyScanCount.mockResolvedValueOnce(60).mockResolvedValueOnce(2); // 7d scans, 24h failures
  vacancyScanFindFirst.mockResolvedValueOnce({
    completedAt: new Date("2026-05-03T12:00:00Z"),
    platform: "applitrack",
    districtsMatched: 0,
  });
  vacancyScanGroupBy
    .mockResolvedValueOnce([{ platform: "olas", _count: 10 }]) // by platform
    .mockResolvedValueOnce([
      { leaid: "1" },
      { leaid: "2" },
      { leaid: "3" },
    ]) // scanned districts
    .mockResolvedValueOnce([
      { failureReason: "claude_fallback_failed", _count: 18 },
      { failureReason: "scan_timeout", _count: 6 },
    ]); // 7d failure-reason mix
  districtGroupBy.mockResolvedValueOnce([
    { jobBoardPlatform: "claude", _count: 38 },
    { jobBoardPlatform: null, _count: 12 },
  ]); // tarpit by platform
}

describe("GET /api/admin/vacancy-scan-stats — new fields", () => {
  it("returns tarpit, adjustedCoveragePct, and topFailureReason7d", async () => {
    setupHappyPath();
    const res = await GET();
    const body = await res.json();

    expect(body.tarpit).toEqual({
      total: 50,
      byPlatform: [
        { platform: "claude", count: 38 },
        { platform: "unknown", count: 12 },
      ],
    });
    // adjusted = scannedDistricts(3) / (totalWithUrl(1000) - tarpit(50)) = 3/950 = 0.32% rounded
    expect(body.adjustedCoveragePct).toBe(0);
    expect(body.topFailureReason7d).toEqual({
      reason: "claude_fallback_failed",
      pct: 75, // 18 / (18 + 6) = 0.75
    });
  });

  it("returns adjustedCoveragePct == coveragePct when tarpit is empty", async () => {
    vacancyCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyGroupBy.mockResolvedValueOnce([]);
    districtCount.mockResolvedValueOnce(100).mockResolvedValueOnce(0);
    vacancyScanCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyScanFindFirst.mockResolvedValueOnce(null);
    vacancyScanGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ leaid: "1" }]) // 1 scanned
      .mockResolvedValueOnce([]);
    districtGroupBy.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body.coveragePct).toBe(1);
    expect(body.adjustedCoveragePct).toBe(1);
    expect(body.topFailureReason7d).toBeNull();
    expect(body.tarpit).toEqual({ total: 0, byPlatform: [] });
  });

  it("floors the adjusted denominator at 1 when every district is tarpitted", async () => {
    vacancyCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyGroupBy.mockResolvedValueOnce([]);
    districtCount.mockResolvedValueOnce(50).mockResolvedValueOnce(50);
    vacancyScanCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vacancyScanFindFirst.mockResolvedValueOnce(null);
    vacancyScanGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    districtGroupBy.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();
    // 0 / max(1, 0) = 0%
    expect(body.adjustedCoveragePct).toBe(0);
  });
});
