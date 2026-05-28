import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/features/shared/lib/auto-tags", () => ({
  syncClassificationTagsForDistrict: vi.fn().mockResolvedValue(undefined),
  syncMissingRenewalOppTagForDistrict: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/plans/lib/rollup-sync", () => ({
  syncPlanRollups: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlanDistrict: {
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { DELETE } from "../route";

const mockPrisma = prisma as unknown as {
  territoryPlanDistrict: { deleteMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/territory-plans/[id]/districts", () => {
  it("removes the given leaids and returns count", async () => {
    mockPrisma.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 3 });

    const req = new Request("http://test/api/territory-plans/plan-1/districts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaids: ["A", "B", "C"] }),
    });
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: "plan-1" }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(3);
    expect(mockPrisma.territoryPlanDistrict.deleteMany).toHaveBeenCalledWith({
      where: { planId: "plan-1", districtLeaid: { in: ["A", "B", "C"] } },
    });
  });

  it("returns 400 when leaids is empty array", async () => {
    const req = new Request("http://test/api/territory-plans/plan-1/districts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaids: [] }),
    });
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: "plan-1" }),
    } as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when leaids is missing", async () => {
    const req = new Request("http://test/api/territory-plans/plan-1/districts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: "plan-1" }),
    } as never);
    expect(res.status).toBe(400);
  });
});
