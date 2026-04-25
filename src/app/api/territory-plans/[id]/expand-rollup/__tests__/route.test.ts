import { describe, it, expect, vi, afterEach } from "vitest";
import prisma from "@/lib/prisma";
import { PATCH } from "../route";

// Mock auth to a stable user so activity log has an actor
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001", email: "test@example.com" }),
}));

describe("PATCH /api/territory-plans/[id]/expand-rollup", () => {
  let planId: string;

  afterEach(async () => {
    if (planId) {
      await prisma.activityPlan.deleteMany({ where: { planId } });
      await prisma.activity.deleteMany({ where: { plans: { some: { planId } } } });
      await prisma.territoryPlanDistrict.deleteMany({ where: { planId } });
      await prisma.territoryPlan.delete({ where: { id: planId } }).catch(() => {});
    }
  });

  it("expands a specific rollup leaid and returns the expanded count", async () => {
    const plan = await prisma.territoryPlan.create({
      data: {
        name: "expand-rollup-route-test",
        fiscalYear: 2026,
        districts: { create: [{ districtLeaid: "3620580" }] },
      },
    });
    planId = plan.id;

    const req = new Request(
      `http://localhost/api/territory-plans/${plan.id}/expand-rollup`,
      { method: "PATCH", body: JSON.stringify({ rollupLeaid: "3620580" }) }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: plan.id }),
    } as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.expandedCount).toBeGreaterThanOrEqual(32);
    expect(body.rollupsExpanded).toEqual(["3620580"]);

    const rows = await prisma.territoryPlanDistrict.findMany({
      where: { planId: plan.id },
      select: { districtLeaid: true },
    });
    expect(rows.map((r) => r.districtLeaid)).not.toContain("3620580");
  }, 30000);

  it("returns 404 for missing plan", async () => {
    planId = ""; // skip afterEach delete
    const req = new Request(
      "http://localhost/api/territory-plans/nope/expand-rollup",
      { method: "PATCH", body: JSON.stringify({ rollupLeaid: "3620580" }) }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ id: "nope" }),
    } as any);
    expect(res.status).toBe(404);
  });
});
