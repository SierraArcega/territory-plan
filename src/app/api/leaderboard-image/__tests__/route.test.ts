import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the fetch function so tests don't hit the DB.
vi.mock("@/features/leaderboard/lib/fetch-leaderboard", () => ({
  fetchLeaderboardData: vi.fn().mockResolvedValue({
    initiative: {
      id: 1, name: "Test Initiative",
      startDate: "2026-01-01T00:00:00.000Z", endDate: null,
      showName: true, showDates: true,
      initiativeWeight: 1, pipelineWeight: 1, takeWeight: 1, revenueWeight: 1, revenueTargetedWeight: 1,
      pipelineFiscalYear: null, takeFiscalYear: null, revenueFiscalYear: null, revenueTargetedFiscalYear: null,
    },
    fiscalYears: { currentFY: "2025-26", nextFY: "2026-27", priorFY: "2024-25" },
    entries: [{
      userId: "u1", fullName: "Test Rep", avatarUrl: null,
      totalPoints: 100, tier: "freshman", rank: 1,
      take: 0, pipeline: 0, pipelineCurrentFY: 0, pipelineNextFY: 50_000,
      revenue: 0, revenueCurrentFY: 100_000, revenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 25_000, minPurchasesPriorFY: 0,
      revenueTargeted: 0, targetedCurrentFY: 0, targetedNextFY: 75_000,
      combinedScore: 50, initiativeScore: 100, pointBreakdown: [],
    }],
    teamTotals: {
      revenue: 0, revenueCurrentFY: 100_000, revenuePriorFY: 0,
      unassignedRevenue: 0, unassignedRevenueCurrentFY: 0, unassignedRevenuePriorFY: 0,
      priorYearRevenue: 0, minPurchasesCurrentFY: 25_000, minPurchasesPriorFY: 0,
      unassignedPriorYearRevenue: 0, unassignedMinPurchasesCurrentFY: 0, unassignedMinPurchasesPriorFY: 0,
      pipelineCurrentFY: 0, pipelineNextFY: 50_000,
      unassignedPipelineCurrentFY: 0, unassignedPipelineNextFY: 0,
      targetedCurrentFY: 0, targetedNextFY: 75_000,
      unassignedTargetedCurrentFY: 0, unassignedTargetedNextFY: 0,
    },
    metrics: [], thresholds: [],
  }),
  NoActiveInitiativeError: class extends Error { constructor() { super("No active initiative"); } },
}));

import { GET } from "../route";

const SECRET = "test-secret-1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

describe("GET /api/leaderboard-image", () => {
  beforeEach(() => {
    process.env.LEADERBOARD_IMAGE_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.LEADERBOARD_IMAGE_SECRET;
  });

  it("returns 401 when authorization header is missing", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token is wrong", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is not Bearer scheme", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Basic ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when LEADERBOARD_IMAGE_SECRET is unset", async () => {
    delete process.env.LEADERBOARD_IMAGE_SECRET;
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 image/png with valid bearer token", async () => {
    const req = new NextRequest("http://localhost:3005/api/leaderboard-image", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^image\/png/);
  });
});
