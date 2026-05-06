import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

describe("GET /api/territory-plans/[id]/opportunities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes detailsLink in each row", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      {
        id: "opp-1",
        name: "Test Opp",
        districtName: "Test District",
        districtLeaId: "0123456",
        stage: "1 - Discovery",
        contractType: "New Business",
        netBookingAmount: 100,
        totalRevenue: 100,
        totalTake: 50,
        completedRevenue: 0,
        scheduledRevenue: 100,
        closeDate: new Date("2026-06-01"),
        detailsLink: "https://lms.example.com/opps/opp-1",
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    const res = await GET(req, { params: Promise.resolve({ id: "plan-1" }) });
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].detailsLink).toBe("https://lms.example.com/opps/opp-1");
  });

  it("passes detailsLink through as null when source is null", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      {
        id: "opp-2",
        name: "No-link Opp",
        districtName: "Test District",
        districtLeaId: "0123456",
        stage: "1 - Discovery",
        contractType: "New Business",
        netBookingAmount: 0,
        totalRevenue: 0,
        totalTake: 0,
        completedRevenue: 0,
        scheduledRevenue: 0,
        closeDate: null,
        detailsLink: null,
      },
    ] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    const res = await GET(req, { params: Promise.resolve({ id: "plan-1" }) });
    const body = await res.json();

    expect(body[0].detailsLink).toBeNull();
  });

  it("requests detailsLink in the Prisma select", async () => {
    vi.mocked(prisma.territoryPlan.findUnique).mockResolvedValue({
      fiscalYear: 2026,
      districts: [{ districtLeaid: "0123456" }],
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([] as never);

    const req = new NextRequest("http://localhost/api/territory-plans/plan-1/opportunities");
    await GET(req, { params: Promise.resolve({ id: "plan-1" }) });

    const findManyCall = vi.mocked(prisma.opportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.select).toMatchObject({ detailsLink: true });
  });
});
