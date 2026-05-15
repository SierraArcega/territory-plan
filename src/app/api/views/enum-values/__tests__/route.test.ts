import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock getUser
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Mock Prisma
const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// Mock readonlyPool
const mockQuery = vi.fn();
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { GET } from "../route";

// ---------- helpers ----------

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ---------- setup ----------

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Auth
// ============================================================
describe("GET /api/views/enum-values — auth", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await GET(makeRequest("/api/views/enum-values?source=states"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

// ============================================================
// Validation
// ============================================================
describe("GET /api/views/enum-values — validation", () => {
  it("returns 400 on unknown source id", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await GET(makeRequest("/api/views/enum-values?source=invalid"));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("invalid");
  });

  it("returns 400 when source param is missing", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await GET(makeRequest("/api/views/enum-values"));

    expect(res.status).toBe(400);
  });
});

// ============================================================
// ?source=states
// ============================================================
describe("GET /api/views/enum-values?source=states", () => {
  it("returns static list with at least 50 entries, no DB call", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await GET(makeRequest("/api/views/enum-values?source=states"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.values)).toBe(true);
    expect(data.values.length).toBeGreaterThanOrEqual(50);
    // Each entry must have value and label
    data.values.forEach((entry: { value: string; label: string }) => {
      expect(entry).toHaveProperty("value");
      expect(entry).toHaveProperty("label");
      expect(typeof entry.value).toBe("string");
      expect(typeof entry.label).toBe("string");
    });
    // Static — no DB calls
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

// ============================================================
// ?source=users
// ============================================================
describe("GET /api/views/enum-values?source=users", () => {
  it("queries prisma.userProfile.findMany and maps to {value, label}", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockFindMany.mockResolvedValue([
      { id: "user-1", fullName: "Alice Smith", email: "alice@example.com" },
      { id: "user-2", fullName: null, email: "bob@example.com" },
    ]);

    const res = await GET(makeRequest("/api/views/enum-values?source=users"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toHaveLength(2);
    expect(data.values[0]).toEqual({ value: "user-1", label: "Alice Smith" });
    // When fullName is null, falls back to email
    expect(data.values[1]).toEqual({ value: "user-2", label: "bob@example.com" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ id: true, fullName: true, email: true }),
        orderBy: { fullName: "asc" },
      })
    );
  });
});

// ============================================================
// ?source=stages
// ============================================================
describe("GET /api/views/enum-values?source=stages", () => {
  it("runs DISTINCT query on opportunities.stage", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({
      rows: [{ stage: "Closed Won" }, { stage: "Prospecting" }],
    });

    const res = await GET(makeRequest("/api/views/enum-values?source=stages"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toEqual([
      { value: "Closed Won", label: "Closed Won" },
      { value: "Prospecting", label: "Prospecting" },
    ]);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/opportunities/i);
    expect(sql).toMatch(/stage/i);
    expect(sql).toMatch(/distinct/i);
  });
});

// ============================================================
// ?source=personas
// ============================================================
describe("GET /api/views/enum-values?source=personas", () => {
  it("runs DISTINCT query on contacts.persona", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({
      rows: [{ v: "Champion" }, { v: "Decision Maker" }],
    });

    const res = await GET(makeRequest("/api/views/enum-values?source=personas"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toEqual([
      { value: "Champion", label: "Champion" },
      { value: "Decision Maker", label: "Decision Maker" },
    ]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/contacts/i);
    expect(sql).toMatch(/persona/i);
  });
});

// ============================================================
// ?source=seniorities
// ============================================================
describe("GET /api/views/enum-values?source=seniorities", () => {
  it("runs DISTINCT query on contacts.seniority_level", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({
      rows: [{ v: "C-Suite" }, { v: "Director" }],
    });

    const res = await GET(makeRequest("/api/views/enum-values?source=seniorities"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toEqual([
      { value: "C-Suite", label: "C-Suite" },
      { value: "Director", label: "Director" },
    ]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/contacts/i);
    expect(sql).toMatch(/seniority_level/i);
  });
});

// ============================================================
// ?source=feed_sources
// ============================================================
describe("GET /api/views/enum-values?source=feed_sources", () => {
  it("runs DISTINCT query on news_articles.feed_source", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({
      rows: [{ v: "EdWeek" }, { v: "StatePolicy" }],
    });

    const res = await GET(makeRequest("/api/views/enum-values?source=feed_sources"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.values).toEqual([
      { value: "EdWeek", label: "EdWeek" },
      { value: "StatePolicy", label: "StatePolicy" },
    ]);

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/news_articles/i);
    expect(sql).toMatch(/feed_source/i);
  });
});
