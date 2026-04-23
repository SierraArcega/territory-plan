import { describe, it, expect, vi } from "vitest";

// Mock auth so POST gets a user without hitting Supabase.
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

import prisma from "@/lib/prisma";
import { POST } from "../route";

describe("POST /api/territory-plans/[id]/contacts/bulk-enrich rollup pre-check", () => {
  it("returns 400 with reason=rollup-district when plan contains a rollup", async () => {
    const plan = await prisma.territoryPlan.create({
      data: {
        name: "rollup-enrich-test",
        fiscalYear: 2026,
        districts: { create: [{ districtLeaid: "3620580" }] },
      },
    });

    try {
      const req = new Request(
        `http://localhost/api/territory-plans/${plan.id}/contacts/bulk-enrich`,
        { method: "POST", body: JSON.stringify({ targetRole: "Superintendent" }) }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await POST(req as any, {
        params: Promise.resolve({ id: plan.id }),
      } as any);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.reason).toBe("rollup-district");
      expect(body.rollupLeaids).toEqual(["3620580"]);
      expect(body.childLeaids.length).toBeGreaterThanOrEqual(32);
    } finally {
      await prisma.territoryPlanDistrict.deleteMany({ where: { planId: plan.id } });
      await prisma.territoryPlan.delete({ where: { id: plan.id } });
    }
  });
});
