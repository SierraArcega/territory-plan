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
          category: "multi_year_growing",
          count: 30,
          total_enrollment: 120000,
          open_pipeline: 500000,
          closed_won_bookings: 1200000,
          invoicing: 1800000,
          scheduled_revenue: 0,
          delivered_revenue: 0,
          deferred_revenue: 0,
          total_revenue: 3000000,
          delivered_take: 0,
          scheduled_take: 0,
          all_take: 0,
        },
        {
          category: "multi_year_shrinking",
          count: 20,
          total_enrollment: 80000,
          open_pipeline: 500000,
          closed_won_bookings: 800000,
          invoicing: 1200000,
          scheduled_revenue: 0,
          delivered_revenue: 0,
          deferred_revenue: 0,
          total_revenue: 2000000,
          delivered_take: 0,
          scheduled_take: 0,
          all_take: 0,
        },
        {
          category: "target",
          count: 100,
          total_enrollment: 400000,
          open_pipeline: 0,
          closed_won_bookings: 0,
          invoicing: 0,
          scheduled_revenue: 0,
          delivered_revenue: 0,
          deferred_revenue: 0,
          total_revenue: 0,
          delivered_take: 0,
          scheduled_take: 0,
          all_take: 0,
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
    expect(body.totalRevenue).toBe(5000000);
    expect(body.byCategory.multi_year_growing.count).toBe(30);
    expect(body.byCategory.multi_year_shrinking.count).toBe(20);
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
  });

  it("queries vendor_financials table", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("vendor_financials");
    expect(sql).toContain("vf.total_revenue");
    expect(sql).toContain("vf.open_pipeline");
  });

  it("uses CTE for enrollment dedup (not SUM DISTINCT)", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const req = new NextRequest(
      "http://localhost:3000/api/districts/summary?fy=fy26&vendors=fullmind"
    );
    await GET(req);

    const [sql] = mockQuery.mock.calls[0];
    // Should use CTE approach, not SUM(DISTINCT d.enrollment)
    expect(sql).toContain("WITH dist AS");
    expect(sql).toContain("dist.enrollment");
    expect(sql).not.toContain("SUM(DISTINCT d.enrollment)");
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
