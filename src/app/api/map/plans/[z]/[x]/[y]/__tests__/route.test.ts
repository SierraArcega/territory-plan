import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() =>
      Promise.resolve({ query: mockQuery, release: mockRelease })
    ),
  },
}));

import { GET } from "../route";
import pool from "@/lib/db";

function buildRequest(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const url = new URL(`http://localhost/api/map/plans/${z}/${x}/${y}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

async function callGET(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const request = buildRequest(z, x, y, searchParams);
  return GET(request, { params: Promise.resolve({ z, x, y }) });
}

describe("GET /api/map/plans/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parameter validation", () => {
    it("returns 400 for invalid z coordinate", async () => {
      const res = await callGET("abc", "1", "2.mvt");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for invalid x coordinate", async () => {
      const res = await callGET("5", "xyz", "2.mvt");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid y coordinate", async () => {
      const res = await callGET("5", "1", "abc.mvt");
      expect(res.status).toBe(400);
    });

    it("strips .mvt suffix from y parameter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });
      await callGET("7", "10", "20.mvt");
      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams[0]).toBe(7);
      expect(queryParams[1]).toBe(10);
      expect(queryParams[2]).toBe(20);
    });
  });

  describe("geometry simplification", () => {
    it("uses tolerance 0.01 for zoom < 7", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("3", "1", "1");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.01)");
    });

    it("uses tolerance 0.005 for zoom 7-10", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("8", "10", "10");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.005)");
    });

    it("uses tolerance 0.001 for zoom >= 11", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("12", "10", "10");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.001)");
    });
  });

  describe("SQL shape", () => {
    it("uses ST_AsMVT with the 'plans' layer name", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_AsMVT(tile_data, 'plans', 4096, 'geom')");
    });

    it("joins territory_plans → territory_plan_districts → district_map_features", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("FROM territory_plans tp");
      expect(sql).toContain("INNER JOIN territory_plan_districts tpd");
      expect(sql).toContain("INNER JOIN district_map_features d");
    });

    it("filters by tile envelope using GIST-friendly &&", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("d.render_geometry && (SELECT envelope_4326 FROM tile_bounds)");
    });

    it("passes z/x/y as the first three SQL parameters", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams.slice(0, 3)).toEqual([7, 10, 20]);
    });
  });

  describe("filter handling", () => {
    it("emits no extra WHERE clause when no filters are present", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20");
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams).toEqual([7, 10, 20]);
      expect(sql).not.toContain("AND tp.status");
      expect(sql).not.toContain("AND tp.fiscal_year");
      expect(sql).not.toContain("AND tp.owner_id");
      expect(sql).not.toMatch(/AND tp\.id\s*(=|IN)/);
    });

    it("filters by single status", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { status: "working" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.status = $4");
      expect(queryParams).toEqual([7, 10, 20, "working"]);
    });

    it("filters by multiple statuses with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { status: "working,planning" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.status IN \(\$4,\$5\)/);
      expect(queryParams).toEqual([7, 10, 20, "working", "planning"]);
    });

    it("returns 400 for non-numeric fiscalYear", async () => {
      const res = await callGET("7", "10", "20", { fiscalYear: "abc" });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid fiscalYear format");
    });

    it("filters by integer fiscalYear", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { fiscalYear: "2026" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.fiscal_year = $4");
      expect(queryParams).toEqual([7, 10, 20, 2026]);
    });

    it("filters by single planId param (legacy compat)", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { planId: "plan-uuid-1" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.id = $4");
      expect(queryParams).toEqual([7, 10, 20, "plan-uuid-1"]);
    });

    it("filters by planIds list with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { planIds: "p1,p2,p3" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.id IN \(\$4,\$5,\$6\)/);
      expect(queryParams).toEqual([7, 10, 20, "p1", "p2", "p3"]);
    });

    it("filters by ownerIds list with IN clause", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", { ownerIds: "u1,u2" });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/AND tp\.owner_id IN \(\$4,\$5\)/);
      expect(queryParams).toEqual([7, 10, 20, "u1", "u2"]);
    });

    it("combines multiple filters with AND", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });
      await callGET("7", "10", "20", {
        status: "working",
        fiscalYear: "2026",
        ownerIds: "u1",
      });
      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(sql).toContain("AND tp.status = $4");
      expect(sql).toContain("AND tp.fiscal_year = $5");
      expect(sql).toContain("AND tp.owner_id IN ($6)");
      expect(queryParams).toEqual([7, 10, 20, "working", 2026, "u1"]);
    });
  });
});
