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
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  Prisma: { JsonNull: null },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET, PATCH, DELETE } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };
const otherUser = { id: "user-2", email: "other@example.com" };

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown },
) {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.body) {
    init.method = options.method ?? "POST";
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

const now = new Date("2026-05-13T12:00:00Z");

function makeListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "list-1",
    ownerId: "user-1",
    name: "NY Customers",
    source: "districts",
    filterTree: { kind: "and", children: [] },
    scopeMode: "none",
    scopeFilterTree: null,
    scopeRefKind: null,
    scopeRefId: null,
    shared: false,
    createdAt: now,
    updatedAt: now,
    owner: { id: "user-1", fullName: "Test User", avatarUrl: null },
    hidden: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GET /api/lists/[id]
// ============================================================
describe("GET /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when list does not exist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the list when user is owner", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(makeListRow());
    const res = await GET(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe("list-1");
  });

  it("returns 404 (not 403) when user is not owner and list is not shared", async () => {
    mockGetUser.mockResolvedValue(otherUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(makeListRow());
    const res = await GET(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns the list when user is not owner but list is shared", async () => {
    mockGetUser.mockResolvedValue(otherUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(
      makeListRow({ shared: true }),
    );
    const res = await GET(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(200);
  });
});

// ============================================================
// PATCH /api/lists/[id]
// ============================================================
describe("PATCH /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest("/api/lists/list-1", { body: { name: "x" } }),
      { params: Promise.resolve({ id: "list-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not owner", async () => {
    mockGetUser.mockResolvedValue(otherUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    const res = await PATCH(
      makeRequest("/api/lists/list-1", { body: { name: "x" } }),
      { params: Promise.resolve({ id: "list-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("updates name when caller is owner", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    mockPrisma.savedList.update.mockResolvedValue(
      makeListRow({ name: "Renamed" }),
    );
    const res = await PATCH(
      makeRequest("/api/lists/list-1", { body: { name: "Renamed" } }),
      { params: Promise.resolve({ id: "list-1" }) },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.name).toBe("Renamed");
    expect(mockPrisma.savedList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Renamed" }),
      }),
    );
  });

  it("returns 400 on malformed filterTree", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    const res = await PATCH(
      makeRequest("/api/lists/list-1", {
        body: { filterTree: { kind: "junk" } },
      }),
      { params: Promise.resolve({ id: "list-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("persists valid viewLayouts", async () => {
    const validLayout = {
      columns: [{ id: "name", order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
    };
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    mockPrisma.savedList.update.mockResolvedValue(makeListRow());

    const res = await PATCH(
      makeRequest("/api/lists/list-1", {
        body: { viewLayouts: { table: validLayout } },
      }),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.savedList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viewLayouts: { table: validLayout },
        }),
      }),
    );
  });

  it("returns 400 when viewLayouts contains unknown column id", async () => {
    const badLayout = {
      columns: [{ id: "bad_col", order: 0, visible: true }],
      sort: [],
      filters: { kind: "and" as const, children: [] },
    };
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });

    const res = await PATCH(
      makeRequest("/api/lists/list-1", {
        body: { viewLayouts: { table: badLayout } },
      }),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.savedList.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// DELETE /api/lists/[id]
// ============================================================
describe("DELETE /api/lists/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not owner", async () => {
    mockGetUser.mockResolvedValue(otherUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    const res = await DELETE(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("deletes the list when caller is owner", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({ ownerId: "user-1" });
    mockPrisma.savedList.delete.mockResolvedValue(makeListRow());
    const res = await DELETE(makeRequest("/api/lists/list-1"), {
      params: Promise.resolve({ id: "list-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.savedList.delete).toHaveBeenCalledWith({
      where: { id: "list-1" },
    });
  });
});
