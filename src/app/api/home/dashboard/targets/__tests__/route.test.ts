import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlanDistrict: { findMany: vi.fn() },
    activityDistrict: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import prisma from "@/lib/prisma";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);
const mockPlanDistricts = vi.mocked(prisma.territoryPlanDistrict.findMany);
const mockActivityDistricts = vi.mocked(prisma.activityDistrict.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

function req(fy?: string): Request {
  return new Request(`http://localhost/api/home/dashboard/targets${fy != null ? `?fy=${fy}` : ""}`);
}

describe("GET /api/home/dashboard/targets", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("returns the Targets card: worked count, segments, rank by target $, and sub-counts", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockPlanDistricts.mockResolvedValue([
      { districtLeaid: "A", newBusinessTarget: 30, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0, plan: { ownerId: "me", userId: null } },
      { districtLeaid: "B", newBusinessTarget: 0, winbackTarget: 50, expansionTarget: 0, renewalTarget: 0, plan: { ownerId: "me", userId: null } },
      // untargeted (no New/Win-back/Expansion target) — still counted as worked
      { districtLeaid: "C", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0, plan: { ownerId: "me", userId: null } },
      { districtLeaid: "D", newBusinessTarget: 200, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0, plan: { ownerId: "u2", userId: null } },
    ] as never);
    // Converted-to-pipeline: district A has open pipeline.
    mockQueryRaw.mockResolvedValue([{ district_lea_id: "A" }] as never);
    // Active in last 90d: district A.
    mockActivityDistricts.mockResolvedValue([{ districtLeaid: "A" }] as never);

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.card).toMatchObject({
      metricKey: "targets",
      label: "Targets",
      value: 3, // me works A + B + C (all plan districts count now)
      rank: 2, // me target$ = 80, u2 = 200 → me is #2
      totalReps: 2,
      inRoster: true,
      segments: { new: 1, winback: 1, expansion: 0 },
      untargeted: 1, // C has no New/Win-back/Expansion target
      convertedToPipeline: 1,
      active90: 1,
      stale: 2, // workedCount(3) - active90(1)
    });
  });

  it("includes the caller's own plan even when they aren't a rep (admin viewing own dashboard)", async () => {
    mockGetUser.mockResolvedValue({ id: "adminUser" } as never);
    // Roster has no reps including the caller.
    mockGetActiveReps.mockResolvedValue([{ id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null }]);
    mockPlanDistricts.mockResolvedValue([
      { districtLeaid: "A", newBusinessTarget: 0, winbackTarget: 0, expansionTarget: 0, renewalTarget: 0, plan: { ownerId: "adminUser", userId: null } },
    ] as never);
    mockQueryRaw.mockResolvedValue([] as never);
    mockActivityDistricts.mockResolvedValue([] as never);

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(body.card.value).toBe(1); // admin's own plan district shows
    expect(body.card.untargeted).toBe(1);
    expect(body.card.inRoster).toBe(false); // not ranked, but count still shows
  });

  it("rejects a non-numeric fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });
});
