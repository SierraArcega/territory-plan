import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/features/home/lib/velocity-source", () => ({ fetchVelocity: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { fetchVelocity } from "@/features/home/lib/velocity-source";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);
const mockFetch = vi.mocked(fetchVelocity);

function req(fy?: string): Request {
  return new Request(`http://localhost/api/home/dashboard/velocity${fy != null ? `?fy=${fy}` : ""}`);
}

describe("GET /api/home/dashboard/velocity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("rejects a non-numeric fy", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });

  it("returns the four velocity cells for the caller", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockFetch.mockResolvedValue({
      current: [
        { email: "me@x", wonCount: 6, closedCount: 10, wonBookingSum: 600000, takeSum: 50000, revSum: 100000 },
        { email: "u2@x", wonCount: 9, closedCount: 10, wonBookingSum: 450000, takeSum: 30000, revSum: 100000 },
      ],
      priorCaller: { email: "me@x", wonCount: 5, closedCount: 10, wonBookingSum: 400000, takeSum: 40000, revSum: 100000 },
    });

    const res = await GET(req("2026"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.cells.map((c: { metricKey: string }) => c.metricKey)).toEqual([
      "closeRate", "avgDealSize", "grossMargin", "dealsWon",
    ]);
    const closeRate = body.cells.find((c: { metricKey: string }) => c.metricKey === "closeRate");
    expect(closeRate.value).toBe(0.6);
    expect(closeRate.rank).toBe(2);
    expect(closeRate.delta).toBe(10); // 60% - 50%
    // fetchVelocity called with current + prior school years and the caller email
    expect(mockFetch).toHaveBeenCalledWith("2025-26", "2024-25", "me@x");
  });
});
