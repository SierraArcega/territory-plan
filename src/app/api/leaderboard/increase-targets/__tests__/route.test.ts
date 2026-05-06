import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock supabase server - route calls getUser()
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Mock Prisma — only $queryRaw is used by this route
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

// Import handler after mocks
import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

const mockGetUser = vi.mocked(getUser);

interface RawRow {
  leaid: string;
  name: string | null;
  state_abbrev: string | null;
  enrollment: number | string | null;
  lmsid: string | null;
  category: "missing_renewal" | "fullmind_winback" | "ek12_winback";
  fy26_revenue: number | string | null;
  fy26_completed_revenue: number | string | null;
  fy26_scheduled_revenue: number | string | null;
  fy26_session_count: number | string | null;
  fy26_subscription_count: number | string | null;
  fy26_opp_bookings: number | string | null;
  fy26_opp_min_commit: number | string | null;
  prior_year_revenue: number | string | null;
  prior_year_vendor: string | null;
  prior_year_fy: string | null;
  in_fy27_plan: boolean;
  plan_ids: string[] | null;
  has_fy27_target: boolean;
  has_fy27_pipeline: boolean;
  fy27_open_pipeline: number | string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  close_date: Date | string | null;
  school_yr: string | null;
  net_booking_amount: number | string | null;
  product_types: string[] | null;
  sub_products: string[] | null;
  trend_fy24: number | string | null;
  trend_fy25: number | string | null;
  trend_fy26: number | string | null;
  trend_fy27: number | string | null;
}

function makeRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    leaid: "0100001",
    name: "Test District",
    state_abbrev: "CA",
    enrollment: 1000,
    lmsid: null,
    category: "missing_renewal",
    fy26_revenue: "50000",
    fy26_completed_revenue: "30000",
    fy26_scheduled_revenue: "20000",
    fy26_session_count: 100,
    fy26_subscription_count: 5,
    fy26_opp_bookings: "0",
    fy26_opp_min_commit: "0",
    prior_year_revenue: "0",
    prior_year_vendor: null,
    prior_year_fy: null,
    in_fy27_plan: false,
    plan_ids: null,
    has_fy27_target: false,
    has_fy27_pipeline: false,
    fy27_open_pipeline: null,
    sales_rep_name: null,
    sales_rep_email: null,
    close_date: null,
    school_yr: null,
    net_booking_amount: null,
    product_types: null,
    sub_products: null,
    trend_fy24: null,
    trend_fy25: null,
    trend_fy26: "320000",
    trend_fy27: null,
    ...overrides,
  };
}

describe("GET /api/leaderboard/increase-targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
  });

  it("returns 401 when getUser returns null", async () => {
    mockGetUser.mockResolvedValue(null as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns empty districts array and zero revenue when no FY26 customers exist", async () => {
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.districts).toEqual([]);
    expect(data.totalRevenueAtRisk).toBe(0);
  });

  it("returns districts with FY26 revenue that have no FY27 activity and are not in any plan", async () => {
    // The SQL itself excludes fy27 and already-planned districts via NOT IN
    // clauses. We assert: whatever rows come back from the query are mapped
    // straight into the response.
    const eligibleRow = makeRow({
      leaid: "0200001",
      name: "Eligible District",
      category: "missing_renewal",
      fy26_revenue: "75000",
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([eligibleRow]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.districts).toHaveLength(1);
    expect(data.districts[0].leaid).toBe("0200001");
    expect(data.districts[0].districtName).toBe("Eligible District");
    expect(data.districts[0].fy26Revenue).toBe(75000);
    expect(data.totalRevenueAtRisk).toBe(75000);
  });

  it("references fy27_done, fy27_pipe, fy27_plan, fy27_any_opp, and revenue_trend CTEs in its SQL", async () => {
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([]);

    await GET();

    // The raw SQL template is passed as a TemplateStringsArray. It's the first
    // argument; we join its `strings` to inspect the query shape.
    const firstCall = (prisma.$queryRaw as unknown as Mock).mock.calls[0] as unknown[];
    const template = firstCall[0] as TemplateStringsArray;
    const sql = template.join("");

    expect(sql).toContain("fy27_done");
    expect(sql).toContain("fy27_pipe");
    expect(sql).toContain("fy27_plan");
    expect(sql).toContain("fy27_any_opp");
    expect(sql).toContain("revenue_trend");
    expect(sql).toContain("NOT IN (SELECT leaid FROM fy27_done");
    expect(sql).toContain("NOT IN (SELECT leaid FROM fy27_any_opp");
    expect(sql).toContain("LEFT JOIN revenue_trend rt");
  });

  it("returns lastClosedWon as null when the district has no prior Closed Won opp", async () => {
    const rowNoLastOpp = makeRow({
      leaid: "0300001",
      sales_rep_name: null,
      sales_rep_email: null,
      close_date: null,
      school_yr: null,
      net_booking_amount: null,
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([rowNoLastOpp]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.districts[0].lastClosedWon).toBeNull();
  });

  it("populates lastClosedWon when the district has a prior Closed Won opp", async () => {
    const closeDate = new Date("2024-06-15T00:00:00Z");
    const rowWithLastOpp = makeRow({
      leaid: "0400001",
      sales_rep_name: "Jane Rep",
      sales_rep_email: "jane@example.com",
      close_date: closeDate,
      school_yr: "2023-24",
      net_booking_amount: 45000,
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([rowWithLastOpp]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.districts[0].lastClosedWon).toEqual({
      repName: "Jane Rep",
      repEmail: "jane@example.com",
      closeDate: closeDate.toISOString(),
      schoolYr: "2023-24",
      amount: 45000,
    });
  });

  it("returns 500 with the documented error message on Prisma error", async () => {
    // Silence the expected console.error in the handler.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (prisma.$queryRaw as unknown as Mock).mockRejectedValueOnce(new Error("boom"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to load at-risk districts");

    consoleSpy.mockRestore();
  });

  it("computes suggestedTarget = fy26 × 1.05 rounded to $5K for missing_renewal", async () => {
    const row = makeRow({
      category: "missing_renewal",
      fy26_revenue: "320000",
      fy26_opp_bookings: "0",
      prior_year_revenue: "0",
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
    const res = await GET();
    const body = await res.json();
    expect(body.districts[0].suggestedTarget).toBe(335000);
  });

  it("returns suggestedTarget null when fy26 and priorYear are both zero", async () => {
    const row = makeRow({
      category: "missing_renewal",
      fy26_revenue: "0",
      fy26_opp_bookings: "0",
      prior_year_revenue: "0",
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
    const res = await GET();
    const body = await res.json();
    expect(body.districts[0].suggestedTarget).toBeNull();
  });

  it("passes trend_fy24..fy27 through as revenueTrend", async () => {
    const row = makeRow({
      trend_fy24: "120000",
      trend_fy25: "240000",
      trend_fy26: "320000",
      trend_fy27: null,
    });
    (prisma.$queryRaw as unknown as Mock).mockResolvedValueOnce([row]);
    const res = await GET();
    const body = await res.json();
    expect(body.districts[0].revenueTrend).toEqual({
      fy24: 120000,
      fy25: 240000,
      fy26: 320000,
      fy27: null,
    });
  });
});
