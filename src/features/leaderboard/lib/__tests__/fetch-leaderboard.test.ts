import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: { findMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/opportunity-actuals", () => ({
  getRepActualsBatch: vi.fn(),
}));

vi.mock("@/lib/unmatched-counts", () => ({
  getUnmatchedCountsByRep: vi.fn(),
}));

import { fetchLeaderboardData } from "../fetch-leaderboard";
import prisma from "@/lib/prisma";
import { getRepActualsBatch } from "@/lib/opportunity-actuals";
import { getUnmatchedCountsByRep } from "@/lib/unmatched-counts";

const mockGetUnmatchedCountsByRep = vi.mocked(getUnmatchedCountsByRep);

const mockUserProfile = vi.mocked(prisma.userProfile.findMany);
const mockTerritoryPlanDistrict = vi.mocked(prisma.territoryPlanDistrict.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);
const mockGetRepActualsBatch = vi.mocked(getRepActualsBatch);

const ZERO_ACTUALS = {
  totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
  weightedPipeline: 0, openPipeline: 0, bookings: 0,
  minPurchaseBookings: 0, invoiced: 0,
};

/** Build the Map<email, Map<schoolYr, RepActuals>> shape getRepActualsBatch returns. */
function batchOf(byEmail: Record<string, Record<string, Partial<typeof ZERO_ACTUALS>>>) {
  const outer = new Map();
  for (const [email, byYear] of Object.entries(byEmail)) {
    const inner = new Map();
    for (const [yr, partial] of Object.entries(byYear)) {
      inner.set(yr, { ...ZERO_ACTUALS, ...partial });
    }
    outer.set(email, inner);
  }
  return outer;
}

describe("fetchLeaderboardData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTerritoryPlanDistrict.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    mockGetUnmatchedCountsByRep.mockResolvedValue(new Map());
    mockGetRepActualsBatch.mockResolvedValue(new Map());
  });

  it("sources roster from UserProfile (rep + manager), excludes admin", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice Rep", avatarUrl: null, email: "alice@x.com", role: "rep" },
      { id: "u2", fullName: "Bob Manager", avatarUrl: null, email: "bob@x.com", role: "manager" },
      { id: "u3", fullName: "Carol Admin", avatarUrl: null, email: "carol@x.com", role: "admin" },
    ] as never);

    const payload = await fetchLeaderboardData();

    expect(mockUserProfile).toHaveBeenCalledWith({
      where: { role: { in: ["rep", "manager", "admin"] } },
      select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
    });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries.map((e) => e.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("returns entries without tier/totalPoints/combinedScore/pointBreakdown", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockResolvedValue(batchOf({
      "alice@x.com": {
        "2025-26": { openPipeline: 100, totalTake: 200, totalRevenue: 300, minPurchaseBookings: 50 },
      },
    }));

    const payload = await fetchLeaderboardData();
    const entry = payload.entries[0];

    expect(entry).not.toHaveProperty("tier");
    expect(entry).not.toHaveProperty("totalPoints");
    expect(entry).not.toHaveProperty("combinedScore");
    expect(entry).not.toHaveProperty("pointBreakdown");
    expect(entry).not.toHaveProperty("initiativeScore");
  });

  it("sorts entries by revenueCurrentFY desc by default", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "low", fullName: "Low", avatarUrl: null, email: "l@x.com", role: "rep" },
      { id: "high", fullName: "High", avatarUrl: null, email: "h@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockResolvedValue(batchOf({
      "h@x.com": { "2025-26": { totalRevenue: 5000 } },
      "l@x.com": { "2025-26": { totalRevenue: 1000 } },
    }));

    const payload = await fetchLeaderboardData();

    expect(payload.entries[0].userId).toBe("high");
    expect(payload.entries[1].userId).toBe("low");
    expect(payload.entries[0].rank).toBe(1);
    expect(payload.entries[1].rank).toBe(2);
  });

  it("returns payload without initiative/metrics/thresholds fields", async () => {
    mockUserProfile.mockResolvedValue([] as never);

    const payload = await fetchLeaderboardData();

    expect(payload).not.toHaveProperty("initiative");
    expect(payload).not.toHaveProperty("metrics");
    expect(payload).not.toHaveProperty("thresholds");
    expect(payload).toHaveProperty("entries");
    expect(payload).toHaveProperty("teamTotals");
    expect(payload).toHaveProperty("fiscalYears");
  });

  it("includes admin actuals in teamTotals.unassigned* but excludes from entries", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "rep1", fullName: "Rep", avatarUrl: null, email: "r@x.com", role: "rep" },
      { id: "admin1", fullName: "Admin", avatarUrl: null, email: "a@x.com", role: "admin" },
    ] as never);
    mockGetRepActualsBatch.mockResolvedValue(batchOf({
      "r@x.com": { "2025-26": { totalRevenue: 100 } },
      "a@x.com": { "2025-26": { totalRevenue: 999 } },
    }));

    const payload = await fetchLeaderboardData();

    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].userId).toBe("rep1");
    expect(payload.teamTotals.revenueCurrentFY).toBe(1099);
    expect(payload.teamTotals.unassignedRevenueCurrentFY).toBe(999);
  });

  it("populates unmatchedOppCount and unmatchedRevenue from getUnmatchedCountsByRep", async () => {
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
      { id: "u2", fullName: "Bob", avatarUrl: null, email: "bob@x.com", role: "rep" },
    ] as never);
    mockGetUnmatchedCountsByRep.mockResolvedValue(new Map([
      ["alice@x.com", { count: 3, revenue: 12500 }],
    ]));

    const payload = await fetchLeaderboardData();

    const alice = payload.entries.find((e) => e.userId === "u1")!;
    const bob = payload.entries.find((e) => e.userId === "u2")!;
    expect(alice.unmatchedOppCount).toBe(3);
    expect(alice.unmatchedRevenue).toBe(12500);
    expect(bob.unmatchedOppCount).toBe(0); // not in the map → defaults
    expect(bob.unmatchedRevenue).toBe(0);
  });

  it("propagates errors from the actuals batch instead of silently zeroing reps", async () => {
    // Regression: the previous per-rep try/catch swallowed pool-pressure
    // timeouts and showed reps at $0 on the leaderboard. With one batched
    // query, the only correct response to a fetch error is to surface it.
    mockUserProfile.mockResolvedValue([
      { id: "u1", fullName: "Alice", avatarUrl: null, email: "alice@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockRejectedValue(new Error("connection pool exhausted"));

    await expect(fetchLeaderboardData()).rejects.toThrow("connection pool exhausted");
  });
});
