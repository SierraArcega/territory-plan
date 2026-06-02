import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/features/home/lib/pipeline-source", () => ({ fetchPipelineData: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { fetchPipelineData } from "@/features/home/lib/pipeline-source";

const mockGetUser = vi.mocked(getUser);
const mockReps = vi.mocked(getActiveReps);
const mockFetch = vi.mocked(fetchPipelineData);

const oppRow = (p: Record<string, unknown>) => ({
  email: "me@x", account: "Acct", state: "NY", netBooking: 0, minPurchase: 0, maxBudget: 0,
  daysInStage: 0, overdueClose: false, closeDate: null, category: "renewal", ...p,
});
const req = (fy?: string) => new Request(`http://localhost/api/home/dashboard/pipeline${fy != null ? `?fy=${fy}` : ""}`);

describe("GET /api/home/dashboard/pipeline", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("rejects a non-numeric fy", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });

  it("assembles coverage, stage health, top opps, and at-risk for the caller", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    mockReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockFetch.mockResolvedValue({
      openOpps: [
        oppRow({ email: "me@x", stagePrefix: 4, netBooking: 100, minPurchase: 80, maxBudget: 200, daysInStage: 40 }), // stall
        oppRow({ email: "me@x", stagePrefix: 1, netBooking: 20, minPurchase: 10, maxBudget: 60, daysInStage: 3 }), // on
        oppRow({ email: "u2@x", stagePrefix: 4, netBooking: 300, minPurchase: 0, maxBudget: 0, daysInStage: 5 }),
      ],
      wonBookings: 600,
      fyTarget: 1000,
      thisWeek: { won: 1, lost: 0, created: 2 },
    } as never);

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.coverage).toMatchObject({ minCommit: 90, maxBudget: 260, gap: 400, wonBookings: 600, fyTarget: 1000 });
    expect(body.stageHealth).toHaveLength(6);
    // caller is #2 in Negotiation (100 < u2 300)
    expect(body.stageHealth.find((s: { name: string }) => s.name === "Negotiation").rank).toBe(2);
    expect(body.opps).toHaveLength(2); // caller-only
    expect(body.opps[0].stageName).toBe("Negotiation"); // weighted 75 > 2
    expect(body.atRisk.map((o: { health: string }) => o.health)).toEqual(["stall"]); // the 40d Negotiation opp
    expect(body.thisWeek).toEqual({ won: 1, lost: 0, created: 2 });
    expect(body.inRoster).toBe(true);
  });

  it("derives at-risk from the full book, not just the top-50 displayed opps", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    mockReps.mockResolvedValue([{ id: "me", email: "me@x", fullName: "Me", avatarUrl: null }]);
    const healthy = Array.from({ length: 50 }, () =>
      oppRow({ email: "me@x", stagePrefix: 5, netBooking: 1000, daysInStage: 1 }), // high weighted, on-track
    );
    const lowValueAtRisk = oppRow({ email: "me@x", stagePrefix: 0, netBooking: 1, daysInStage: 1, overdueClose: true }); // sorts last, slip
    mockFetch.mockResolvedValue({ openOpps: [...healthy, lowValueAtRisk], wonBookings: 0, fyTarget: 1000, thisWeek: { won: 0, lost: 0, created: 0 } } as never);

    const body = await (await GET(req("2026"))).json();
    expect(body.opps).toHaveLength(50); // capped
    expect(body.atRisk.map((o: { health: string }) => o.health)).toEqual(["slip"]); // still surfaced despite being 51st
  });

  it("flags a caller outside the active-rep roster as not in roster", async () => {
    mockGetUser.mockResolvedValue({ id: "admin", email: "admin@x" } as never);
    mockReps.mockResolvedValue([{ id: "me", email: "me@x", fullName: "Me", avatarUrl: null }]);
    mockFetch.mockResolvedValue({ openOpps: [], wonBookings: 0, fyTarget: 0, thisWeek: { won: 0, lost: 0, created: 0 } } as never);
    const body = await (await GET(req("2026"))).json();
    expect(body.inRoster).toBe(false);
  });

  it("omits this-week movement for a non-current fiscal year", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    mockReps.mockResolvedValue([{ id: "me", email: "me@x", fullName: "Me", avatarUrl: null }]);
    mockFetch.mockResolvedValue({ openOpps: [], wonBookings: 0, fyTarget: 0, thisWeek: { won: 5, lost: 2, created: 9 } } as never);
    const body = await (await GET(req("2024"))).json(); // past FY
    expect(body.thisWeek).toBeNull();
  });
});
