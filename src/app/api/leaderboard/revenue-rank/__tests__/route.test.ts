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
  getRepActuals: vi.fn(),
}));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getRepActuals } from "@/lib/opportunity-actuals";

const mockGetUser = vi.mocked(getUser);
const mockUserProfile = vi.mocked(prisma.userProfile.findMany);
const mockGetRepActuals = vi.mocked(getRepActuals);

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
    mockGetRepActuals.mockImplementation(async (email: string) => {
      const rev = email === "u1@x.com" ? 100 : 500;
      return { totalRevenue: rev } as never;
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
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 250 } as never);

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
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 0 } as never);

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
    mockGetRepActuals.mockResolvedValue({ totalRevenue: 100 } as never);

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
