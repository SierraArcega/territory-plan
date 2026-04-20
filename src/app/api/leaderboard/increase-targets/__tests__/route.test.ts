import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase server - route calls getUser()
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Mock Prisma — only $queryRaw is used by this route
const mockQueryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// Import handler after mocks
import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";

const mockGetUser = vi.mocked(getUser);

interface RawRow {
  leaid: string;
  name: string | null;
  state_abbrev: string | null;
  enrollment: number | string | null;
  total_revenue: number | string | null;
  completed_revenue: number | string | null;
  scheduled_revenue: number | string | null;
  session_count: number | string | null;
  subscription_count: number | string | null;
  sales_rep_name: string | null;
  sales_rep_email: string | null;
  close_date: Date | string | null;
  school_yr: string | null;
  net_booking_amount: number | string | null;
  product_types: string[] | null;
  sub_products: string[] | null;
}

function makeRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    leaid: "0100001",
    name: "Test District",
    state_abbrev: "CA",
    enrollment: 1000,
    total_revenue: 50000,
    completed_revenue: 30000,
    scheduled_revenue: 20000,
    session_count: 100,
    subscription_count: 5,
    sales_rep_name: null,
    sales_rep_email: null,
    close_date: null,
    school_yr: null,
    net_booking_amount: null,
    product_types: null,
    sub_products: null,
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
    mockQueryRaw.mockResolvedValue([]);

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
      total_revenue: 75000,
    });
    mockQueryRaw.mockResolvedValue([eligibleRow]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.districts).toHaveLength(1);
    expect(data.districts[0].leaid).toBe("0200001");
    expect(data.districts[0].districtName).toBe("Eligible District");
    expect(data.districts[0].fy26Revenue).toBe(75000);
    expect(data.totalRevenueAtRisk).toBe(75000);
  });

  it("excludes districts in its SQL with fy27_any and already_planned CTEs", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await GET();

    // The raw SQL template is passed as a TemplateStringsArray. It's the first
    // argument; we join its `strings` to inspect the query shape.
    const firstCall = mockQueryRaw.mock.calls[0] as unknown[];
    const template = firstCall[0] as TemplateStringsArray;
    const sql = template.join("");

    expect(sql).toContain("fy27_any");
    expect(sql).toContain("already_planned");
    expect(sql).toContain("NOT IN (SELECT leaid FROM fy27_any");
    expect(sql).toContain("NOT IN (SELECT leaid FROM already_planned");
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
    mockQueryRaw.mockResolvedValue([rowNoLastOpp]);

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
    mockQueryRaw.mockResolvedValue([rowWithLastOpp]);

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
    mockQueryRaw.mockRejectedValue(new Error("boom"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to load at-risk districts");

    consoleSpy.mockRestore();
  });
});
