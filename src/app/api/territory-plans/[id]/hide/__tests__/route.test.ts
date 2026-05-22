import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
    },
    territoryPlanHidden: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { POST } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/territory-plans/plan-1/hide", "http://localhost:3000"),
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/territory-plans/[id]/hide", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ hidden: true }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when plan does not exist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ hidden: true }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid body", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    const res = await POST(makeRequest({ hidden: "yes" }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("upserts a hidden row when hidden:true", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanHidden.upsert.mockResolvedValue({} as never);

    const res = await POST(makeRequest({ hidden: true }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.territoryPlanHidden.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { planId_userId: { planId: "plan-1", userId: "user-1" } },
      }),
    );
  });

  it("deletes the hidden row when hidden:false", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1" });
    mockPrisma.territoryPlanHidden.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await POST(makeRequest({ hidden: false }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.territoryPlanHidden.deleteMany).toHaveBeenCalledWith({
      where: { planId: "plan-1", userId: "user-1" },
    });
  });
});
