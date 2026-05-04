import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: {
      findUnique: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
    },
    unmatchedOpportunity: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

function makeRequest(qs: string) {
  return new NextRequest(`http://localhost/api/admin/unmatched-opportunities?${qs}`);
}

describe("GET /api/admin/unmatched-opportunities — rep filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.unmatchedOpportunity.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.unmatchedOpportunity.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([] as never);
  });

  it("filters by rep: looks up email, fetches opp ids, constrains where.id", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      email: "monica@fullmindlearning.com",
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([
      { id: "175922" },
      { id: "175923" },
    ] as never);

    await GET(makeRequest("rep=619f3009-0966-47ec-a09a-5f406d1da596"));

    expect(prisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "619f3009-0966-47ec-a09a-5f406d1da596" },
      select: { email: true },
    });
    expect(prisma.opportunity.findMany).toHaveBeenCalledWith({
      where: { salesRepEmail: "monica@fullmindlearning.com" },
      select: { id: true },
      take: 5000,
    });
    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.where).toMatchObject({ id: { in: ["175922", "175923"] } });
  });

  it("returns empty page when rep UUID has no matching profile", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("rep=00000000-0000-0000-0000-000000000000"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
    expect(prisma.opportunity.findMany).not.toHaveBeenCalled();
    expect(prisma.unmatchedOpportunity.findMany).not.toHaveBeenCalled();
  });

  it("returns empty page when profile email is null", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({ email: null } as never);

    const res = await GET(makeRequest("rep=619f3009-0966-47ec-a09a-5f406d1da596"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("composes rep filter with resolved=false", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      email: "monica@fullmindlearning.com",
    } as never);
    vi.mocked(prisma.opportunity.findMany).mockResolvedValue([{ id: "175922" }] as never);

    await GET(makeRequest("rep=619f3009&resolved=false"));

    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.where).toMatchObject({
      resolved: false,
      id: { in: ["175922"] },
    });
  });

  it("returns where.id = { in: [] } when rep has zero opportunities", async () => {
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      email: "newhire@fullmindlearning.com",
    } as never);
    // opportunity.findMany defaults to [] via beforeEach

    await GET(makeRequest("rep=619f3009-0966-47ec-a09a-5f406d1da596"));

    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.where).toMatchObject({ id: { in: [] } });
  });

  it("ignores rep param when not provided (regression guard)", async () => {
    await GET(makeRequest("resolved=false"));

    expect(prisma.userProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.opportunity.findMany).not.toHaveBeenCalled();
    const findManyCall = vi.mocked(prisma.unmatchedOpportunity.findMany).mock.calls[0]![0];
    expect(findManyCall!.where).not.toHaveProperty("id");
  });
});
