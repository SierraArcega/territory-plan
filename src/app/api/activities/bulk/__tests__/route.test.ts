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
    activity: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { PATCH } from "../route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(body: unknown) {
  return new NextRequest(new URL("/api/activities/bulk", "http://localhost:3000"), {
    method: "PATCH",
    body: JSON.stringify(body),
  } as never);
}

describe("PATCH /api/activities/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockResolvedValue(false);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ ids: ["a"], updates: { status: "completed" } }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty ids", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const res = await PATCH(makeRequest({ ids: [], updates: { status: "completed" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for >500 ids", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const ids = Array.from({ length: 501 }, (_, i) => `a-${i}`);
    const res = await PATCH(makeRequest({ ids, updates: { status: "completed" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("too_many_ids");
    expect(body.max).toBe(500);
  });

  it("returns 400 when updates has no fields", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const res = await PATCH(makeRequest({ ids: ["a"], updates: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("no_updates");
  });

  it("returns 400 when ownerId references a non-existent user", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ ids: ["a"], updates: { ownerId: "ghost" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_owner");
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const res = await PATCH(makeRequest({ ids: ["a"], updates: { status: "not_a_status" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_status");
  });

  it("owner can update their own rows (status only)", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "user-1", source: "manual" },
      { id: "a-2", createdByUserId: "user-1", source: "manual" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 2 });

    const res = await PATCH(
      makeRequest({ ids: ["a-1", "a-2"], updates: { status: "completed" } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual(["a-1", "a-2"]);
    expect(body.failed).toEqual([]);
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a-1", "a-2"] } },
      data: { status: "completed" },
    });
  });

  it("owner can reassign their own rows (owner only)", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" });
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "user-1", source: "manual" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(makeRequest({ ids: ["a-1"], updates: { ownerId: "user-2" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual(["a-1"]);
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a-1"] } },
      data: { createdByUserId: "user-2" },
    });
  });

  it("applies status and owner together in one call", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.userProfile.findUnique.mockResolvedValue({ id: "user-2" });
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "user-1", source: "manual" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(
      makeRequest({ ids: ["a-1"], updates: { ownerId: "user-2", status: "completed" } })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a-1"] } },
      data: { createdByUserId: "user-2", status: "completed" },
    });
  });

  it("non-owner non-admin row returns failed:forbidden", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(false);
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "user-1", source: "manual" },
      { id: "a-2", createdByUserId: "someone-else", source: "manual" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(
      makeRequest({ ids: ["a-1", "a-2"], updates: { status: "completed" } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual(["a-1"]);
    expect(body.failed).toEqual([{ id: "a-2", reason: "forbidden" }]);
  });

  it("admin can update any row", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockIsAdmin.mockResolvedValue(true);
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "someone-else", source: "manual" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 });

    const res = await PATCH(makeRequest({ ids: ["a-1"], updates: { status: "completed" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual(["a-1"]);
    expect(body.failed).toEqual([]);
  });

  it("system-source row returns failed:system_skip", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findMany.mockResolvedValue([
      { id: "a-1", createdByUserId: "user-1", source: "system" },
    ]);
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(makeRequest({ ids: ["a-1"], updates: { status: "completed" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual([]);
    expect(body.failed).toEqual([{ id: "a-1", reason: "system_skip" }]);
    expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled();
  });

  it("non-existent id returns failed:not_found", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findMany.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ ids: ["ghost"], updates: { status: "completed" } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toEqual([]);
    expect(body.failed).toEqual([{ id: "ghost", reason: "not_found" }]);
    expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled();
  });
});
