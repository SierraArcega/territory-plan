import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/lib/opportunity-actuals", () => ({ getRepActualsBatch: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getRepActualsBatch } from "@/lib/opportunity-actuals";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);
const mockBatch = vi.mocked(getRepActualsBatch);

const ZERO = {
  totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
  weightedPipeline: 0, openPipeline: 0, bookings: 0, minPurchaseBookings: 0, invoiced: 0,
};

function batchOf(byEmail: Record<string, Record<string, Partial<typeof ZERO>>>) {
  const outer = new Map();
  for (const [email, byYear] of Object.entries(byEmail)) {
    const inner = new Map();
    for (const [yr, partial] of Object.entries(byYear)) inner.set(yr, { ...ZERO, ...partial });
    outer.set(email, inner);
  }
  return outer;
}

function req(fy?: string): Request {
  return new Request(`http://localhost/api/home/dashboard/topline${fy != null ? `?fy=${fy}` : ""}`);
}

describe("GET /api/home/dashboard/topline", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("returns the four financial cards with the caller's rank for the requested FY", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockBatch.mockImplementation(async (_emails, yrs) =>
      batchOf({
        "me@x": { [yrs[0]]: { openPipeline: 200 } },
        "u2@x": { [yrs[0]]: { openPipeline: 300 } },
      }),
    );

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.schoolYr).toBe("2025-26");
    expect(body.cards).toHaveLength(4);
    expect(body.cards.find((c: { metricKey: string }) => c.metricKey === "openPipeline")).toMatchObject({
      value: 200,
      rank: 2,
      totalReps: 2,
    });
  });

  it("rejects a non-numeric fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });
});
