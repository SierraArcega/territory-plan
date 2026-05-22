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
    territoryPlanDistrict: {
      findMany: vi.fn(),
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

/**
 * Route the readonly mock per-SQL: rollups (GROUP BY) vs the district base
 * (SELECT leaid, name, state_abbrev). Each takes the rows it should return.
 */
function wireQueries(opts: {
  vac?: Array<{ leaid: string; cnt: number; newest: Date | null }>;
  news?: Array<{ leaid: string; cnt: number; newest: Date | null }>;
  rfp?: Array<{ leaid: string; cnt: number; newest: Date | null }>;
  districts: Array<{ leaid: string; name: string; state_abbrev: string | null }>;
}) {
  mockReadonlyQuery.mockImplementation((sql: string) => {
    if (sql.includes("FROM districts")) {
      return Promise.resolve({ rows: opts.districts });
    }
    if (sql.includes("FROM vacancies")) {
      return Promise.resolve({ rows: opts.vac ?? [] });
    }
    if (sql.includes("news_article_districts")) {
      return Promise.resolve({ rows: opts.news ?? [] });
    }
    if (sql.includes("FROM rfps")) {
      return Promise.resolve({ rows: opts.rfp ?? [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/signals — auth", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/signals?leaids=0100001"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/signals — scope validation", () => {
  it("400 when neither planId nor leaids provided", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/signals"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/scope/i);
  });

  it("returns empty for an empty leaids CSV", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/signals?leaids="));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ districts: [], total: 0 });
    expect(mockReadonlyQuery).not.toHaveBeenCalled();
  });

  it("resolves leaids from planId via territory_plan_districts", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.territoryPlanDistrict.findMany.mockResolvedValue([
      { districtLeaid: "0100001" },
      { districtLeaid: "0100002" },
    ]);
    wireQueries({
      vac: [{ leaid: "0100001", cnt: 2, newest: new Date("2026-05-20T00:00:00Z") }],
      districts: [
        { leaid: "0100001", name: "Alpha SD", state_abbrev: "AL" },
        { leaid: "0100002", name: "Beta SD", state_abbrev: "AL" },
      ],
    });
    const res = await GET(makeRequest("/api/signals?planId=plan-1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.territoryPlanDistrict.findMany).toHaveBeenCalledWith({
      where: { planId: "plan-1" },
      select: { districtLeaid: true },
    });
    const body = await res.json();
    expect(body.total).toBe(2);
  });
});

describe("GET /api/signals — shape + merge", () => {
  beforeEach(() => mockGetUser.mockResolvedValue(mockUser));

  it("merges per-type counts and computes newest across sources", async () => {
    wireQueries({
      vac: [
        { leaid: "0100001", cnt: 3, newest: new Date("2026-05-18T00:00:00Z") },
      ],
      news: [
        { leaid: "0100001", cnt: 2, newest: new Date("2026-05-20T00:00:00Z") },
      ],
      rfp: [
        { leaid: "0100001", cnt: 1, newest: new Date("2026-05-19T00:00:00Z") },
      ],
      districts: [{ leaid: "0100001", name: "Alpha SD", state_abbrev: "AL" }],
    });
    const res = await GET(makeRequest("/api/signals?leaids=0100001&since=all"));
    const body = await res.json();
    expect(body.districts[0]).toEqual({
      leaid: "0100001",
      name: "Alpha SD",
      stateAbbrev: "AL",
      counts: { vac: 3, news: 2, rfp: 1 },
      // newest = max(may 18, may 20, may 19) = may 20
      newestSignalAt: "2026-05-20T00:00:00.000Z",
    });
  });

  it("includes 0-signal in-scope districts with zeroed counts + null newest", async () => {
    wireQueries({
      vac: [
        { leaid: "0100001", cnt: 1, newest: new Date("2026-05-20T00:00:00Z") },
      ],
      districts: [
        { leaid: "0100001", name: "Alpha SD", state_abbrev: "AL" },
        { leaid: "0100002", name: "Zeta SD", state_abbrev: "AL" },
      ],
    });
    const res = await GET(
      makeRequest("/api/signals?leaids=0100001,0100002&since=all"),
    );
    const body = await res.json();
    expect(body.total).toBe(2);
    const zeta = body.districts.find(
      (d: { leaid: string }) => d.leaid === "0100002",
    );
    expect(zeta).toEqual({
      leaid: "0100002",
      name: "Zeta SD",
      stateAbbrev: "AL",
      counts: { vac: 0, news: 0, rfp: 0 },
      newestSignalAt: null,
    });
  });

  it("sorts newest-first, NULLS LAST, then name ASC", async () => {
    wireQueries({
      vac: [
        { leaid: "A", cnt: 1, newest: new Date("2026-05-10T00:00:00Z") },
        { leaid: "B", cnt: 1, newest: new Date("2026-05-20T00:00:00Z") },
      ],
      districts: [
        { leaid: "A", name: "Aaa", state_abbrev: null },
        { leaid: "B", name: "Bbb", state_abbrev: null },
        { leaid: "Z", name: "Zzz", state_abbrev: null }, // 0-signal
        { leaid: "M", name: "Mmm", state_abbrev: null }, // 0-signal
      ],
    });
    const res = await GET(makeRequest("/api/signals?leaids=A,B,Z,M&since=all"));
    const body = await res.json();
    expect(body.districts.map((d: { leaid: string }) => d.leaid)).toEqual([
      "B", // newest may 20
      "A", // newest may 10
      "M", // null → name asc
      "Z", // null → name asc
    ]);
  });

  it("omits off types from the query and the counts", async () => {
    wireQueries({
      news: [
        { leaid: "0100001", cnt: 5, newest: new Date("2026-05-20T00:00:00Z") },
      ],
      districts: [{ leaid: "0100001", name: "Alpha SD", state_abbrev: "AL" }],
    });
    const res = await GET(
      makeRequest("/api/signals?leaids=0100001&types=news&since=all"),
    );
    const body = await res.json();
    expect(body.districts[0].counts).toEqual({ vac: 0, news: 5, rfp: 0 });
    // vacancies + rfps sub-selects must NOT have been issued.
    const sqls = mockReadonlyQuery.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes("FROM vacancies"))).toBe(false);
    expect(sqls.some((s) => s.includes("FROM rfps"))).toBe(false);
    expect(sqls.some((s) => s.includes("news_article_districts"))).toBe(true);
  });
});
