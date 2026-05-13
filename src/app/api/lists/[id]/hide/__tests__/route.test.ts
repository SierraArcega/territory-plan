import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    savedList: {
      findUnique: vi.fn(),
    },
    savedListHidden: {
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
const otherUser = { id: "user-2", email: "other@example.com" };

function makeRequest(url: string, body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lists/[id]/hide", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/lists/list-1/hide", { hidden: true }), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when list does not exist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/lists/list-1/hide", { hidden: true }), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when list is not shared and caller is not owner", async () => {
    mockGetUser.mockResolvedValue(otherUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: false,
    });
    const res = await POST(makeRequest("/api/lists/list-1/hide", { hidden: true }), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("upserts a hidden row when hidden:true", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: false,
    });
    mockPrisma.savedListHidden.upsert.mockResolvedValue({} as never);

    const res = await POST(
      makeRequest("/api/lists/list-1/hide", { hidden: true }),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.savedListHidden.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listId_userId: { listId: "list-1", userId: "user-1" } },
      }),
    );
  });

  it("deletes the hidden row when hidden:false", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: true,
    });
    mockPrisma.savedListHidden.deleteMany.mockResolvedValue({ count: 1 } as never);

    const res = await POST(
      makeRequest("/api/lists/list-1/hide", { hidden: false }),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.savedListHidden.deleteMany).toHaveBeenCalledWith({
      where: { listId: "list-1", userId: "user-1" },
    });
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: false,
    });
    const res = await POST(
      makeRequest("/api/lists/list-1/hide", { hidden: "yes" }),
      { params: Promise.resolve({ id: "list-1" }) },
    );
    expect(res.status).toBe(400);
  });
});
