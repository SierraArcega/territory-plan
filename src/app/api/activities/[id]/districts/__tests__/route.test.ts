import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    activity: { findUnique: vi.fn() },
    district: { findMany: vi.fn() },
    activityDistrict: { createMany: vi.fn() },
    activityState: { findMany: vi.fn(), createMany: vi.fn() },
    activityPlan: { createMany: vi.fn() },
    territoryPlanDistrict: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { POST } from "../route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/activities/act-1/districts", "http://localhost:3000"),
    { method: "POST", body: JSON.stringify(body) } as never,
  );
}

const params = Promise.resolve({ id: "act-1" });

describe("POST /api/activities/[id]/districts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "act-1",
      createdByUserId: "user-1",
    });
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0601234", stateFips: "06" },
    ]);
    mockPrisma.activityDistrict.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityState.findMany.mockResolvedValue([]);
    mockPrisma.activityState.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.activityPlan.createMany.mockResolvedValue({ count: 2 });
  });

  it("auto-links plans containing the added district", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { planId: "plan-1" },
      { planId: "plan-2" },
    ]);

    const res = await POST(makeRequest({ leaids: ["0601234"] }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plansLinked).toBe(2);
    expect(mockPrisma.activityPlan.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: "act-1", planId: "plan-1" },
        { activityId: "act-1", planId: "plan-2" },
      ],
      skipDuplicates: true,
    });
  });

  it("links no plans when the district is in no plan", async () => {
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([]);

    const res = await POST(makeRequest({ leaids: ["0601234"] }), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plansLinked).toBe(0);
    expect(mockPrisma.activityPlan.createMany).not.toHaveBeenCalled();
  });
});
