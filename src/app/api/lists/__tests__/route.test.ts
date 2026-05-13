import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    savedList: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET, POST } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

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
// GET /api/lists
// ============================================================
describe("GET /api/lists", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/lists"));
    expect(res.status).toBe(401);
  });

  it("returns lists for authenticated user", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findMany.mockResolvedValue([makeListRow()]);

    const res = await GET(makeRequest("/api/lists"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lists).toHaveLength(1);
    expect(data.lists[0].id).toBe("list-1");
    expect(data.lists[0].hidden).toBe(false);
    // Verify visibility filter includes both own and shared lists
    expect(mockPrisma.savedList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ ownerId: "user-1" }, { shared: true }],
        }),
      }),
    );
  });

  it("filters out hidden lists by default", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findMany.mockResolvedValue([
      makeListRow({ hidden: [{ hiddenAt: now }] }),
      makeListRow({ id: "list-2", name: "Visible" }),
    ]);

    const res = await GET(makeRequest("/api/lists"));
    const data = await res.json();

    expect(data.lists).toHaveLength(1);
    expect(data.lists[0].name).toBe("Visible");
  });

  it("includes hidden lists when ?showHidden=1", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findMany.mockResolvedValue([
      makeListRow({ hidden: [{ hiddenAt: now }] }),
      makeListRow({ id: "list-2", name: "Visible" }),
    ]);

    const res = await GET(makeRequest("/api/lists?showHidden=1"));
    const data = await res.json();

    expect(data.lists).toHaveLength(2);
    expect(data.lists[0].hidden).toBe(true);
  });
});

// ============================================================
// POST /api/lists
// ============================================================
describe("POST /api/lists", () => {
  const validBody = {
    name: "My new list",
    source: "districts",
    filterTree: {
      kind: "and",
      children: [{ kind: "rule", fieldId: "state", op: "is", value: "NY" }],
    },
  };

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/lists", { body: validBody }));
    expect(res.status).toBe(401);
  });

  it("creates a list with valid body", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.create.mockResolvedValue(
      makeListRow({ name: "My new list" }),
    );

    const res = await POST(makeRequest("/api/lists", { body: validBody }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("My new list");
    expect(mockPrisma.savedList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "user-1",
          name: "My new list",
          source: "districts",
          scopeMode: "none",
          shared: false,
        }),
      }),
    );
  });

  it("returns 400 when filterTree is malformed", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists", {
        body: {
          name: "Bad",
          source: "districts",
          filterTree: { kind: "not-a-kind" },
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists", {
        body: { ...validBody, name: "  " },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when source is unknown", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists", {
        body: { ...validBody, source: "schools" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when scopeMode=reference but scopeRefId missing", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists", {
        body: {
          ...validBody,
          scopeMode: "reference",
          scopeRefKind: "plan",
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});
