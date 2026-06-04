import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/features/home/lib/deals-source", () => ({
  fetchPipelineDeals: vi.fn(),
  fetchBookingDeals: vi.fn(),
  fetchUtilizationSource: vi.fn(),
}));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { fetchPipelineDeals, fetchBookingDeals, fetchUtilizationSource } from "@/features/home/lib/deals-source";

const mockGetUser = vi.mocked(getUser);
const mockReps = vi.mocked(getActiveReps);
const mockPipeline = vi.mocked(fetchPipelineDeals);
const mockBookings = vi.mocked(fetchBookingDeals);
const mockUtil = vi.mocked(fetchUtilizationSource);

const REPS = [
  { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
  { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
];

const req = (qs: string) => new Request(`http://localhost/api/home/dashboard/deals?${qs}`);

describe("GET /api/home/dashboard/deals", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    mockReps.mockResolvedValue(REPS);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("fy=2026&metric=pipeline"))).status).toBe(401);
  });

  it("rejects a non-numeric fy", async () => {
    expect((await GET(req("fy=abc&metric=pipeline"))).status).toBe(400);
  });

  it("rejects a missing or unknown metric", async () => {
    expect((await GET(req("fy=2026"))).status).toBe(400);
    expect((await GET(req("fy=2026&metric=bogus"))).status).toBe(400);
  });

  it("rejects an unknown rep id", async () => {
    expect((await GET(req("fy=2026&metric=pipeline&rep=ghost"))).status).toBe(400);
  });

  it("pipeline → rows + computed totals, scoped to the caller (rep mode)", async () => {
    mockPipeline.mockResolvedValue([
      { account: "Houston ISD", state: "TX", stageName: "Discovery", source: "new", committed: 100, maxBudget: 300, closeDate: null },
      { account: "Austin ISD", state: "TX", stageName: "Proposal", source: "return", committed: 50, maxBudget: 80, closeDate: null },
    ]);
    const res = await GET(req("fy=2026&metric=pipeline"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ fy: 2026, schoolYr: "2025-26", mode: "rep", metric: "pipeline" });
    expect(body.rows).toHaveLength(2);
    expect(body.totals).toEqual({ count: 2, committed: 150, maxBudget: 380 });
    // scoped to the caller: rep mode passes the single-email scope
    expect(mockPipeline).toHaveBeenCalledWith("2025-26", {
      mode: "rep",
      rep: { id: "me", email: "me@x" },
      emails: ["me@x"],
    });
  });

  it("bookings → rows + signed/min/max totals", async () => {
    mockBookings.mockResolvedValue([
      { account: "A", product: "Renewal", source: "return", amount: 100, minCommit: 80, maxBudget: 200, closedDate: null },
      { account: "B", product: "New", source: "new", amount: 50, minCommit: 40, maxBudget: 60, closedDate: null },
    ]);
    const body = await (await GET(req("fy=2026&metric=bookings"))).json();
    expect(body.metric).toBe("bookings");
    expect(body.totals).toEqual({ count: 2, amount: 150, minCommit: 120, maxBudget: 260 });
  });

  it("rev → builds utilization rows from won + DOA source and blends util in totals", async () => {
    mockUtil.mockResolvedValue({
      won: [
        { leaid: "1", account: "Big ISD", source: "new", minCommit: 100, maxBudget: 200 },
        { leaid: "2", account: "Small ISD", source: "return", minCommit: 80, maxBudget: 300 },
      ],
      doa: [
        { leaid: "1", revenue: 120, take: 36 },
        { leaid: "2", revenue: 40, take: 12 },
      ],
    });
    const body = await (await GET(req("fy=2026&metric=rev"))).json();
    expect(body.metric).toBe("rev");
    expect(body.rows).toHaveLength(2);
    // sorted by max budget desc → Small ISD (300) first
    expect(body.rows[0].account).toBe("Small ISD");
    expect(body.rows[0]).toMatchObject({ revenue: 40, deferred: 40, underMin: true });
    expect(body.totals).toMatchObject({ count: 2, revenue: 160, maxBudget: 500, deferred: 40 });
    expect(body.totals.utilPct).toBeCloseTo(160 / 500, 6);
  });

  it("take reuses the same utilization source", async () => {
    mockUtil.mockResolvedValue({ won: [], doa: [] });
    const body = await (await GET(req("fy=2026&metric=take"))).json();
    expect(body.metric).toBe("take");
    expect(body.rows).toEqual([]);
    expect(mockUtil).toHaveBeenCalledTimes(1);
  });

  it("rep=team threads the whole-book scope to the source query", async () => {
    mockPipeline.mockResolvedValue([]);
    const body = await (await GET(req("fy=2026&metric=pipeline&rep=team"))).json();
    expect(body.mode).toBe("team");
    expect(mockPipeline).toHaveBeenCalledWith("2025-26", { mode: "team" });
  });
});
