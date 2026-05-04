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

function buildRequest(searchParams?: Record<string, string>) {
  const url = new URL("http://localhost/api/map/plans/list");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

const sampleRows = [
  {
    planId: "plan-1",
    planName: "Working A",
    planColor: "#7B6BA4",
    planStatus: "working",
    districtName: "Acme USD",
    leaid: "0001234",
    renewalTarget: "12.5",
    expansionTarget: null,
  },
];

describe("GET /api/map/plans/list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a flat array of rows (no FeatureCollection wrapper, no geometry)", async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      planId: "plan-1",
      planName: "Working A",
      leaid: "0001234",
    });
    expect(body[0]).not.toHaveProperty("geometry");
    expect(body[0]).not.toHaveProperty("type");
  });

  it("parses numeric targets to floats and preserves nulls", async () => {
    mockQuery.mockResolvedValue({ rows: sampleRows });
    const res = await GET(buildRequest());
    const body = await res.json();
    expect(body[0].renewalTarget).toBe(12.5);
    expect(body[0].expansionTarget).toBeNull();
  });

  it("does NOT call ST_AsGeoJSON in the SQL", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest());
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain("ST_AsGeoJSON");
    expect(sql).not.toContain("geometry");
  });

  it("filters by status with $1", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest({ status: "working" }));
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("tp.status = $1");
    expect(params).toEqual(["working"]);
  });

  it("filters by ownerIds list", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(buildRequest({ ownerIds: "u1,u2" }));
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/tp\.owner_id IN \(\$1,\$2\)/);
    expect(params).toEqual(["u1", "u2"]);
  });

  it("returns 400 on invalid fiscalYear", async () => {
    const res = await GET(buildRequest({ fiscalYear: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error and releases the client", async () => {
    mockQuery.mockRejectedValue(new Error("db down"));
    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("sets a short browser cache header", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(buildRequest());
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=120");
  });
});
