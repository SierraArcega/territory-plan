import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: { query: vi.fn() },
}));
vi.mock("@/lib/saved-views/sql-compiler", () => ({
  compileFilterTree: vi.fn().mockReturnValue({ ok: true, whereSql: "", params: [] }),
}));

import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";

const prismaMock = prisma as unknown as {
  territoryPlan: { findUnique: ReturnType<typeof vi.fn> };
};
const poolMock = readonlyPool as unknown as { query: ReturnType<typeof vi.fn> };

describe("GET /api/territory-plans/[id]/districts/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when plan not found", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue(null);
    const req = new Request("http://test/api/territory-plans/missing/districts/export");
    const res = await GET(req as never, {
      params: Promise.resolve({ id: "missing" }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("returns empty rows when plan has no districts", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue({ id: "p1", districts: [] });
    const req = new Request("http://test/api/territory-plans/p1/districts/export");
    const res = await GET(req as never, {
      params: Promise.resolve({ id: "p1" }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns all matching rows from readonlyPool without a LIMIT clause", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue({
      id: "p1",
      districts: [{ districtLeaid: "A" }, { districtLeaid: "B" }],
    });
    poolMock.query.mockResolvedValue({
      rows: [
        { leaid: "A", name: "Alpha SD", state_abbrev: "CA", enrollment: 1000, renewal_target: null, winback_target: null, expansion_target: null, new_business_target: null },
        { leaid: "B", name: "Beta SD", state_abbrev: "CA", enrollment: 500, renewal_target: 50000, winback_target: null, expansion_target: null, new_business_target: null },
      ],
    });

    const req = new Request("http://test/api/territory-plans/p1/districts/export");
    const res = await GET(req as never, {
      params: Promise.resolve({ id: "p1" }),
    } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(2);

    // Verify no LIMIT clause in emitted SQL
    const sql: string = poolMock.query.mock.calls[0][0];
    expect(sql).not.toMatch(/LIMIT/i);
  });
});
