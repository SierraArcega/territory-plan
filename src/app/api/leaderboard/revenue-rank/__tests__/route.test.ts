import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/opportunity-actuals", () => ({
  getRepActualsBatch: vi.fn(),
}));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getRepActualsBatch } from "@/lib/opportunity-actuals";

const mockGetUser = vi.mocked(getUser);
const mockUserProfile = vi.mocked(prisma.userProfile.findMany);
const mockGetRepActualsBatch = vi.mocked(getRepActualsBatch);

const ZERO_ACTUALS = {
  totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
  weightedPipeline: 0, openPipeline: 0, bookings: 0,
  minPurchaseBookings: 0, invoiced: 0,
};

/** Build the Map<email, Map<schoolYr, RepActuals>> shape getRepActualsBatch returns. */
function batchOf(byEmail: Record<string, Record<string, { totalRevenue: number; bookings?: number }>>) {
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

function makeRequest(fy: string): Request {
  return new Request(`http://localhost/api/leaderboard/revenue-rank?fy=${fy}`);
}

describe("GET /api/leaderboard/revenue-rank", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("current"));
    expect(res.status).toBe(401);
  });

  it("returns rank+revenue for known rep with fy=current", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
      { id: "u2", email: "u2@x.com", role: "rep" },
    ] as never);
    // school year for fy=current with mocked Date is "<currentFY-1>-<currentFY%100>".
    // Match every key — the helper's inner map lookup falls back to undefined → 0.
    mockGetRepActualsBatch.mockImplementation(async (_emails, schoolYrs) => {
      const yr = schoolYrs[0];
      return batchOf({
        "u1@x.com": { [yr]: { totalRevenue: 100 } },
        "u2@x.com": { [yr]: { totalRevenue: 500 } },
      });
    });

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe("current");
    expect(body.rank).toBe(2); // u2 has 500, u1 has 100 → u1 is rank 2
    expect(body.totalReps).toBe(2);
    expect(body.revenue).toBe(100);
    expect(body.inRoster).toBe(true);
  });

  it("returns rank+revenue for known rep with fy=next", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockImplementation(async (_emails, schoolYrs) => {
      return batchOf({ "u1@x.com": { [schoolYrs[0]]: { totalRevenue: 250 } } });
    });

    const res = await GET(makeRequest("next"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe("next");
    expect(body.rank).toBe(1);
    expect(body.revenue).toBe(250);
  });

  it("returns inRoster: false for an admin caller", async () => {
    mockGetUser.mockResolvedValue({ id: "admin1" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockResolvedValue(new Map());

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(body.inRoster).toBe(false);
    expect(body.rank).toBe(2);
    expect(body.totalReps).toBe(1);
  });

  it("returns rank: N+1 with revenue: 0 for caller not in profile list", async () => {
    mockGetUser.mockResolvedValue({ id: "ghost" } as never);
    mockUserProfile.mockResolvedValue([
      { id: "u1", email: "u1@x.com", role: "rep" },
    ] as never);
    mockGetRepActualsBatch.mockImplementation(async (_emails, schoolYrs) => {
      return batchOf({ "u1@x.com": { [schoolYrs[0]]: { totalRevenue: 100 } } });
    });

    const res = await GET(makeRequest("current"));
    const body = await res.json();

    expect(body.inRoster).toBe(false);
    expect(body.revenue).toBe(0);
    expect(body.rank).toBe(2);
  });

  it("rejects invalid fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" } as never);
    const res = await GET(makeRequest("invalid"));
    expect(res.status).toBe(400);
  });
});
