import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    unmatchedOpportunity: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    district: {
      findUnique: vi.fn(),
    },
    opportunity: {
      updateMany: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
  },
}));

import { PATCH } from "../route";
import prisma from "@/lib/prisma";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/unmatched-opportunities/abc", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/admin/unmatched-opportunities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates resolvedDistrictLeaid back to opportunities.district_lea_id", async () => {
    vi.mocked(prisma.district.findUnique).mockResolvedValue({
      leaid: "3700445",
      name: "Hobgood Charter School",
      stateAbbrev: "NC",
      // findUnique is typed loosely in the route; cast keeps the test small.
    } as never);
    vi.mocked(prisma.unmatchedOpportunity.findUnique).mockResolvedValue({
      accountName: "Hobgood Charter School (District)",
    } as never);
    vi.mocked(prisma.unmatchedOpportunity.findMany).mockResolvedValue([
      { id: "17592317688335" },
      { id: "17592317988999" },
    ] as never);
    vi.mocked(prisma.unmatchedOpportunity.updateMany).mockResolvedValue({
      count: 2,
    } as never);
    vi.mocked(prisma.opportunity.updateMany).mockResolvedValue({
      count: 2,
    } as never);

    const res = await PATCH(makeRequest({ resolvedDistrictLeaid: "3700445" }), {
      params: Promise.resolve({ id: "17592317688335" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["17592317688335", "17592317988999"] },
        districtLeaId: null,
      },
      data: { districtLeaId: "3700445" },
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT refresh_fullmind_financials()",
    );
  });

  it("does not touch opportunities when dismissing (no district)", async () => {
    vi.mocked(prisma.unmatchedOpportunity.findUnique).mockResolvedValue({
      accountName: "Some University",
    } as never);
    vi.mocked(prisma.unmatchedOpportunity.updateMany).mockResolvedValue({
      count: 1,
    } as never);

    const res = await PATCH(makeRequest({ dismiss: true }), {
      params: Promise.resolve({ id: "999" }),
    });

    expect(res.status).toBe(200);
    expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
