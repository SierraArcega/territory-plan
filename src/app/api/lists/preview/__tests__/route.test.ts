import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockReadonlyQuery = vi.fn();
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: (...args: unknown[]) => mockReadonlyQuery(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    savedList: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { POST } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string, body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lists/preview — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "districts",
        filterTree: { kind: "and", children: [] },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/lists/preview — validation", () => {
  it("returns 400 on invalid JSON body", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const req = new NextRequest(
      new URL("/api/lists/preview", "http://localhost:3000"),
      {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      } as never,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on missing source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        filterTree: { kind: "and", children: [] },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on unknown source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "schools",
        filterTree: { kind: "and", children: [] },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on unknown field id", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "districts",
        filterTree: {
          kind: "rule",
          fieldId: "no_such_field",
          op: "is",
          value: "x",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown field/);
  });

  it("returns 400 on disallowed op for a known field", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "districts",
        // enrollment is integer, doesn't support "contains"
        filterTree: {
          kind: "rule",
          fieldId: "enrollment",
          op: "contains",
          value: "1000",
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/lists/preview — happy path", () => {
  it("returns count + sample for a valid filter", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery
      .mockResolvedValueOnce({ rows: [{ count: 42 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "0100005",
            primary_label: "Albertville City",
            secondary_label: "AL",
            meta: 4200,
          },
        ],
      });

    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "districts",
        filterTree: { kind: "rule", fieldId: "state", op: "is", value: "AL" },
      }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.count).toBe(42);
    expect(data.sample).toHaveLength(1);
    expect(data.sample[0].primaryLabel).toBe("Albertville City");

    // Verify the count query was called with the right SQL + params
    const [countSql, countParams] = mockReadonlyQuery.mock.calls[0];
    expect(countSql).toContain('FROM "districts" p');
    expect(countParams).toEqual(["AL"]);
  });
});

describe("POST /api/lists/preview — scope=reference (list)", () => {
  it("looks up the referenced list and 404s when not visible", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "opps",
        filterTree: { kind: "and", children: [] },
        scopeMode: "reference",
        scopeRefKind: "list",
        scopeRefId: "list-x",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("loads referenced list and includes its filterTree in the scope", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: false,
      source: "districts",
      filterTree: {
        kind: "rule",
        fieldId: "state",
        op: "is",
        value: "NY",
      },
    });
    mockReadonlyQuery
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "opps",
        filterTree: { kind: "and", children: [] },
        scopeMode: "reference",
        scopeRefKind: "list",
        scopeRefId: "list-x",
      }),
    );
    expect(res.status).toBe(200);

    const [countSql, countParams] = mockReadonlyQuery.mock.calls[0];
    // Scope should EXISTS-join through districts using the referenced list's tree
    expect(countSql).toContain('FROM "districts" scoped');
    expect(countParams).toContain("NY");
  });

  it("rejects referenced list whose source is not 'districts'", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      ownerId: "user-1",
      shared: false,
      source: "contacts",
      filterTree: { kind: "and", children: [] },
    });
    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "opps",
        filterTree: { kind: "and", children: [] },
        scopeMode: "reference",
        scopeRefKind: "list",
        scopeRefId: "list-x",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/lists/preview — statement timeout", () => {
  it("returns { truncated: true } on statement timeout", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockRejectedValue(
      new Error("canceling statement due to statement timeout"),
    );

    const res = await POST(
      makeRequest("/api/lists/preview", {
        source: "districts",
        filterTree: { kind: "rule", fieldId: "state", op: "is", value: "NY" },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeNull();
    expect(data.sample).toEqual([]);
    expect(data.truncated).toBe(true);
  });
});
