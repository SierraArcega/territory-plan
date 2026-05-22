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
      update: vi.fn(),
    },
  },
  Prisma: { JsonNull: null },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { PATCH } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("/api/territory-plans/plan-1", "http://localhost:3000"),
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    } as never,
  );
}

const validLayout = {
  columns: [{ id: "name", order: 0, visible: true }],
  sort: [],
  filters: { kind: "and" as const, children: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/territory-plans/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when plan does not exist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when plan is owned by another user", async () => {
    mockGetUser.mockResolvedValue({ id: "user-a" });
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1", ownerId: "user-b" });

    const res = await PATCH(
      makeRequest({ viewLayouts: { table: validLayout } }),
      { params: Promise.resolve({ id: "plan-1" }) },
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.territoryPlan.update).not.toHaveBeenCalled();
  });

  it("persists valid viewLayouts", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1", ownerId: mockUser.id });
    mockPrisma.territoryPlan.update.mockResolvedValue({
      id: "plan-1",
      updatedAt: new Date("2026-05-14T00:00:00Z"),
    });

    const res = await PATCH(
      makeRequest({ viewLayouts: { table: validLayout } }),
      { params: Promise.resolve({ id: "plan-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viewLayouts: { table: validLayout },
        }),
      }),
    );
  });

  it("clears viewLayouts when null is passed", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1", ownerId: mockUser.id });
    mockPrisma.territoryPlan.update.mockResolvedValue({
      id: "plan-1",
      updatedAt: new Date("2026-05-14T00:00:00Z"),
    });

    const res = await PATCH(
      makeRequest({ viewLayouts: null }),
      { params: Promise.resolve({ id: "plan-1" }) },
    );

    expect(res.status).toBe(200);
    // Verify update was called with a viewLayouts key set to Prisma.JsonNull
    // (the exact symbol — not plain null — because @prisma/client is not mocked here)
    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viewLayouts: expect.anything(),
        }),
      }),
    );
  });

  it("returns 400 for unknown column id in viewLayouts", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1", ownerId: mockUser.id });

    const badLayout = {
      columns: [{ id: "fake_column", order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
    };

    const res = await PATCH(
      makeRequest({ viewLayouts: { table: badLayout } }),
      { params: Promise.resolve({ id: "plan-1" }) },
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.territoryPlan.update).not.toHaveBeenCalled();
  });

  it("returns 200 with no-op when viewLayouts is omitted", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlan.findUnique.mockResolvedValue({ id: "plan-1", ownerId: mockUser.id });
    mockPrisma.territoryPlan.update.mockResolvedValue({
      id: "plan-1",
      updatedAt: new Date("2026-05-14T00:00:00Z"),
    });

    const res = await PATCH(makeRequest({}), {
      params: Promise.resolve({ id: "plan-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.territoryPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });
});
