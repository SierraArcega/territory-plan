import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the pool
const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() => Promise.resolve({ query: mockQuery, release: mockRelease })),
  },
}));

import { GET } from "../route";

describe("GET /api/districts/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated totals grouped by category", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          category: "multi_year",
          count: 50,
          total_enrollment: 200000,
          sessions_revenue: 5000000,
          net_invoicing: 3000000,
          closed_won_bookings: 2000000,
          open_pipeline: 1000000,
          weighted_pipeline: 500000,
        },
        {
          category: "target",
          count: 100,
          total_enrollment: 400000,
          sessions_revenue: 0,
          net_invoicing: 0,
          closed_won_bookings: 0,
          open_pipeline: 0,
          weighted_pipeline: 0,
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(150);
    expect(body.totalEnrollment).toBe(600000);
    expect(body.sessionsRevenue).toBe(5000000);
    expect(body.byCategory.multi_year.count).toBe(50);
    expect(body.byCategory.target.count).toBe(100);
  });

  it("passes state filter to SQL query", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind&states=CA,TX"
    );
    await GET(req);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("state_abbrev = ANY");
    expect(params).toContainEqual(["CA", "TX"]);
  });

  it("defaults to fy26 when no fy param", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("fy26_fullmind_category");
    expect(sql).toContain("fy26_sessions_revenue");
  });

  it("omits pipeline columns for fy25", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy25&vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("fy25_sessions_revenue");
    expect(sql).not.toContain("open_pipeline");
  });

  it("returns 500 on database error", async () => {
    mockQuery.mockRejectedValue(new Error("DB connection failed"));

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch district summary");
  });
});
