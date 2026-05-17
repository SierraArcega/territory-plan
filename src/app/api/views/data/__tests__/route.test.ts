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

import { GET } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "GET",
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Auth
// ============================================================
describe("GET /api/views/data — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/views/data?source=districts"));
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Validation
// ============================================================
describe("GET /api/views/data — validation", () => {
  it("returns 400 on unknown source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/views/data?source=schools"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it("returns 400 on missing source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/views/data"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it("returns 400 on sort against a non-existent field", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest("/api/views/data?source=districts&sort=ghost:asc"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sort/i);
  });

  it("returns 400 on sort against a derived/unknown field (tier)", async () => {
    // 'tier' is a derived/computed column not in SOURCE_FIELDS for districts
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest("/api/views/data?source=districts&sort=tier:asc"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sort/i);
  });

  it("returns 400 on malformed sort format (missing dir)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest("/api/views/data?source=districts&sort=name"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sort/i);
  });

  it("returns 400 on invalid sort direction", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest("/api/views/data?source=districts&sort=name:sideways"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sort/i);
  });

  it("returns 400 on invalid filters JSON", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest(
        "/api/views/data?source=districts&filters=" +
          encodeURIComponent("not-valid-json"),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/filter/i);
  });

  it("returns 400 on filters with invalid structure", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const filters = JSON.stringify({ kind: "unknown-kind", children: [] });
    const res = await GET(
      makeRequest(
        `/api/views/data?source=districts&filters=${encodeURIComponent(filters)}`,
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/filter/i);
  });
});

// ============================================================
// Empty leaids short-circuit
// ============================================================
describe("GET /api/views/data — leaids scope", () => {
  it("returns empty result immediately when leaids is empty string", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(
      makeRequest("/api/views/data?source=districts&leaids="),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
    // Pool should NOT have been queried
    expect(mockReadonlyQuery).not.toHaveBeenCalled();
  });

  it("returns rows from readonly pool when leaids scope is provided", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({
      rows: [
        {
          leaid: "0100005",
          name: "Albertville City",
          state_abbrev: "AL",
          enrollment: 5000,
          __total: "1",
        },
      ],
    });

    const res = await GET(
      makeRequest(
        "/api/views/data?source=districts&leaids=0100005,0100010",
      ),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].leaid).toBe("0100005");
    // __total must not leak into the response rows
    expect(body.rows[0].__total).toBeUndefined();
    expect(body.total).toBe(1);
    // Verify the leaids were passed as params
    const [, params] = mockReadonlyQuery.mock.calls[0];
    expect(params).toContainEqual(["0100005", "0100010"]);
  });
});

// ============================================================
// Happy path — basic query without filters
// ============================================================
describe("GET /api/views/data — happy path", () => {
  it("returns rows and total on success", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({
      rows: [
        { leaid: "1234567", name: "Test District", state_abbrev: "NY", __total: "2" },
        { leaid: "7654321", name: "Other District", state_abbrev: "NY", __total: "2" },
      ],
    });

    const res = await GET(
      makeRequest("/api/views/data?source=districts"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(2);
    // total comes from __total window column, not rows.length
    expect(body.total).toBe(2);
    // __total must not leak into the response rows
    expect(body.rows[0].__total).toBeUndefined();
  });

  it("uses __total window column as true total (not rows.length)", async () => {
    // Simulate a page of 2 results where the full dataset has 127 rows.
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({
      rows: [
        { leaid: "lea1", __total: "127" },
        { leaid: "lea2", __total: "127" },
      ],
    });

    const res = await GET(makeRequest("/api/views/data?source=districts"));
    const body = await res.json();
    expect(res.status).toBe(200);
    // total must reflect the window-function value, not rows.length
    expect(body.total).toBe(127);
    // rows must not contain __total
    expect(body.rows).toEqual([{ leaid: "lea1" }, { leaid: "lea2" }]);
  });

  it("respects limit and offset params", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/views/data?source=contacts&limit=25&offset=50"),
    );
    expect(res.status).toBe(200);
    // Confirm the query was called (SQL should include LIMIT/OFFSET)
    expect(mockReadonlyQuery).toHaveBeenCalledTimes(1);
    const [sql] = mockReadonlyQuery.mock.calls[0];
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
  });

  it("caps limit at 200", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&limit=9999"),
    );
    expect(res.status).toBe(200);
    const [sql, params] = mockReadonlyQuery.mock.calls[0];
    // The effective limit bound to params should not exceed 200
    expect(sql).toContain("LIMIT");
    const limitParam = (params as unknown[]).find(
      (p) => typeof p === "number" && p <= 200,
    );
    expect(limitParam).toBeDefined();
  });
});

// ============================================================
// Statement timeout
// ============================================================
describe("GET /api/views/data — statement timeout", () => {
  it("returns 200 with truncated:true when query times out (code 57014)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const timeoutErr = Object.assign(
      new Error("canceling statement due to statement timeout"),
      { code: "57014" },
    );
    mockReadonlyQuery.mockRejectedValue(timeoutErr);

    const res = await GET(
      makeRequest("/api/views/data?source=districts"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.truncated).toBe(true);
  });

  it("returns 500 on other query errors", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockRejectedValue(new Error("connection reset"));

    const res = await GET(
      makeRequest("/api/views/data?source=districts"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ============================================================
// listId loading
// ============================================================
describe("GET /api/views/data — listId", () => {
  it("returns 404 when listId references a non-existent list", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue(null);

    const res = await GET(
      makeRequest("/api/views/data?source=districts&listId=list-999"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when listId references a list the user does not own and is not shared", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      id: "list-other",
      ownerId: "user-other",
      shared: false,
      source: "districts",
      filterTree: { kind: "and", children: [] },
    });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&listId=list-other"),
    );
    expect(res.status).toBe(403);
  });

  it("allows access to a shared list owned by another user", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      id: "list-shared",
      ownerId: "user-other",
      shared: true,
      source: "districts",
      filterTree: { kind: "and", children: [] },
    });
    mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&listId=list-shared"),
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when listId source does not match request source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      id: "list-contacts",
      ownerId: "user-1",
      shared: false,
      source: "contacts",
      filterTree: { kind: "and", children: [] },
    });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&listId=list-contacts"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source/i);
  });

  it("merges listId filterTree with request filters and queries the pool", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.savedList.findUnique.mockResolvedValue({
      id: "list-1",
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
    mockReadonlyQuery.mockResolvedValueOnce({
      rows: [{ leaid: "1234567", name: "Some District", state_abbrev: "NY", __total: "1" }],
    });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&listId=list-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    // __total must not leak into the response rows
    expect(body.rows[0].__total).toBeUndefined();
    // NY should appear in query params from the list's filterTree
    const [, params] = mockReadonlyQuery.mock.calls[0];
    expect(params).toContain("NY");
  });
});

// ============================================================
// sort integration
// ============================================================
describe("GET /api/views/data — sort", () => {
  it("includes ORDER BY clause when sort param is valid", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockReadonlyQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/views/data?source=districts&sort=name:asc"),
    );
    expect(res.status).toBe(200);
    const [sql] = mockReadonlyQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY/i);
    expect(sql).toContain('"name"');
  });
});
