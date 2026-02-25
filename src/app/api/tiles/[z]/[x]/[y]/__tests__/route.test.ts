import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the pool
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
  const url = new URL(`http://localhost/api/tiles/${z}/${x}/${y}`);
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

describe("GET /api/tiles/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Parameter validation
  // ---------------------------------------------------------------------------
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
      const body = await res.json();
      expect(body.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for invalid y coordinate", async () => {
      const res = await callGET("5", "1", "abc.mvt");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid tile coordinates");
    });

    it("strips .mvt suffix from y parameter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });

      await callGET("7", "10", "20.mvt");

      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams[0]).toBe(7); // zoom
      expect(queryParams[1]).toBe(10); // tileX
      expect(queryParams[2]).toBe(20); // tileY (stripped of .mvt)
    });

    it("handles y parameter without .mvt suffix", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });

      await callGET("7", "10", "20");

      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams[2]).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // FY parameter
  // ---------------------------------------------------------------------------
  describe("fy parameter", () => {
    it("defaults to fy26 when no fy param is provided", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy26_fullmind_category");
      expect(sql).toContain("fy26_proximity_category");
      expect(sql).toContain("fy26_elevate_category");
      expect(sql).toContain("fy26_tbt_category");
      expect(sql).toContain("fy26_educere_category");
    });

    it("uses fy24 when specified", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy24" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy24_fullmind_category");
      expect(sql).toContain("fy24_proximity_category");
      expect(sql).toContain("fy24_elevate_category");
      expect(sql).toContain("fy24_tbt_category");
      expect(sql).toContain("fy24_educere_category");
    });

    it("uses fy25 when specified", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy25" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy25_fullmind_category");
    });

    it("uses fy27 when specified", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy27" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy27_fullmind_category");
    });

    it("falls back to fy26 for invalid fy values", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy99" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy26_fullmind_category");
      expect(sql).not.toContain("fy99");
    });
  });

  // ---------------------------------------------------------------------------
  // Geometry simplification
  // ---------------------------------------------------------------------------
  describe("geometry simplification", () => {
    it("uses tolerance 0.01 for zoom < 5", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("3", "1", "1");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.01)");
    });

    it("uses tolerance 0.005 for zoom 5-6", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("5", "10", "10");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.005)");
    });

    it("uses tolerance 0.005 for zoom 6", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("6", "10", "10");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.005)");
    });

    it("uses tolerance 0.001 for zoom >= 7", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "10");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.001)");
    });

    it("uses tolerance 0.001 for high zoom levels", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("12", "1000", "1500");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("ST_Simplify(d.render_geometry, 0.001)");
    });
  });

  // ---------------------------------------------------------------------------
  // National view detection
  // ---------------------------------------------------------------------------
  describe("national view detection", () => {
    it("activates national view for zoom < 6 with no state filter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("4", "5", "5");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fullmind_category IS NOT NULL");
      expect(sql).toContain("proximity_category IS NOT NULL");
      expect(sql).toContain("elevate_category IS NOT NULL");
      expect(sql).toContain("tbt_category IS NOT NULL");
      expect(sql).toContain("educere_category IS NOT NULL");
    });

    it("does not activate national view for zoom >= 6", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("6", "10", "10");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain("fullmind_category IS NOT NULL");
      expect(sql).not.toContain("proximity_category IS NOT NULL");
    });

    it("does not activate national view for zoom < 6 with state filter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("4", "5", "5", { state: "CA" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain("fullmind_category IS NOT NULL");
      expect(sql).not.toContain("proximity_category IS NOT NULL");
    });
  });

  // ---------------------------------------------------------------------------
  // State filter
  // ---------------------------------------------------------------------------
  describe("state filter", () => {
    it("passes 3 query params when no state filter is provided", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20");

      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams).toEqual([7, 10, 20]);
      expect(sql).not.toContain("state_abbrev = $4");
    });

    it("passes 4 query params and includes $4 when state filter is provided", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { state: "TX" });

      const [sql, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams).toEqual([7, 10, 20, "TX"]);
      expect(sql).toContain("state_abbrev = $4");
    });
  });

  // ---------------------------------------------------------------------------
  // Response handling
  // ---------------------------------------------------------------------------
  describe("response handling", () => {
    it("returns 204 with correct headers when MVT is null", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(204);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.mapbox-vector-tile"
      );
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("returns 204 when MVT buffer is empty", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.alloc(0) }] });

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(204);
    });

    it("returns 204 when rows are empty", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(204);
    });

    it("returns 200 with MVT data and correct headers", async () => {
      const tileData = Buffer.from("mock-tile-data");
      mockQuery.mockResolvedValue({ rows: [{ mvt: tileData }] });

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.mapbox-vector-tile"
      );
      expect(res.headers.get("Content-Length")).toBe(
        tileData.length.toString()
      );
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("returns 86400 cache time for national view tiles", async () => {
      const tileData = Buffer.from("mock-tile-data");
      mockQuery.mockResolvedValue({ rows: [{ mvt: tileData }] });

      // zoom < 6 and no state filter = national view
      const res = await callGET("4", "5", "5");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    });

    it("returns 3600 cache time for non-national view tiles", async () => {
      const tileData = Buffer.from("mock-tile-data");
      mockQuery.mockResolvedValue({ rows: [{ mvt: tileData }] });

      // zoom >= 6 = not national view
      const res = await callGET("8", "100", "150");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("returns 3600 cache time when zoom < 6 but state filter is set", async () => {
      const tileData = Buffer.from("mock-tile-data");
      mockQuery.mockResolvedValue({ rows: [{ mvt: tileData }] });

      // zoom < 6 but state filter present = not national view
      const res = await callGET("4", "5", "5", { state: "CA" });

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe("error handling", () => {
    it("returns 500 on database query error", async () => {
      mockQuery.mockRejectedValue(new Error("DB connection failed"));

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to generate tile");
    });

    it("returns 500 on pool.connect error", async () => {
      vi.mocked(pool.connect).mockRejectedValueOnce(
        new Error("Connection pool exhausted")
      );

      const res = await callGET("7", "10", "20");

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to generate tile");
    });
  });

  // ---------------------------------------------------------------------------
  // Educere vendor column integration
  // ---------------------------------------------------------------------------
  describe("educere vendor columns", () => {
    it("includes educere_category column in normal mode", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/d\.fy26_educere_category\s+AS\s+educere_category/);
    });

    it("includes educere_category_a and educere_category_b in comparison mode", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy25", fy2: "fy26" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/d\.fy25_educere_category\s+AS\s+educere_category_a/);
      expect(sql).toMatch(/d\.fy26_educere_category\s+AS\s+educere_category_b/);
    });

    it("includes educere in national view filter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("4", "5", "5");

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy26_educere_category IS NOT NULL");
    });
  });

  // ---------------------------------------------------------------------------
  // Comparison mode (fy2 parameter)
  // ---------------------------------------------------------------------------
  describe("comparison mode", () => {
    it("generates _a and _b suffixed columns for all vendors when fy2 is provided", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy25", fy2: "fy26" });

      const [sql] = mockQuery.mock.calls[0];
      for (const vendor of ["fullmind", "proximity", "elevate", "tbt", "educere"]) {
        expect(sql).toContain(`${vendor}_category_a`);
        expect(sql).toContain(`${vendor}_category_b`);
      }
    });

    it("uses correct FY columns for each comparison side", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy24", fy2: "fy27" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy24_fullmind_category AS fullmind_category_a");
      expect(sql).toContain("fy27_fullmind_category AS fullmind_category_b");
      expect(sql).toContain("fy24_educere_category AS educere_category_a");
      expect(sql).toContain("fy27_educere_category AS educere_category_b");
    });

    it("ignores invalid fy2 parameter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20", { fy: "fy26", fy2: "fy99" });

      const [sql] = mockQuery.mock.calls[0];
      // Should fall back to normal mode (no _a/_b suffixes)
      expect(sql).toContain("educere_category");
      expect(sql).not.toContain("educere_category_a");
      expect(sql).not.toContain("educere_category_b");
    });

    it("includes both FY columns in national view filter during comparison", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("4", "5", "5", { fy: "fy25", fy2: "fy26" });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("fy25_educere_category IS NOT NULL");
      expect(sql).toContain("fy26_educere_category IS NOT NULL");
    });
  });

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------
  describe("connection management", () => {
    it("releases client after successful query with data", async () => {
      mockQuery.mockResolvedValue({
        rows: [{ mvt: Buffer.from("tile-data") }],
      });

      await callGET("7", "10", "20");

      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("releases client after empty result (204)", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: null }] });

      await callGET("7", "10", "20");

      expect(mockRelease).toHaveBeenCalledOnce();
    });

    it("releases client even when query throws", async () => {
      mockQuery.mockRejectedValue(new Error("Query failed"));

      await callGET("7", "10", "20");

      expect(mockRelease).toHaveBeenCalledOnce();
    });
  });
});
