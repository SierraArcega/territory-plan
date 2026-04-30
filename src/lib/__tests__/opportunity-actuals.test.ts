// src/lib/__tests__/opportunity-actuals.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import {
  getDistrictActuals,
  getRepActuals,
  getDistrictOpportunities,
  getNewDistrictsCount,
  fiscalYearToSchoolYear,
} from "@/lib/opportunity-actuals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fiscalYearToSchoolYear", () => {
  it("converts FY26 to 2025-26", () => {
    expect(fiscalYearToSchoolYear(26)).toBe("2025-26");
    expect(fiscalYearToSchoolYear(2026)).toBe("2025-26");
  });

  it("converts FY25 to 2024-25", () => {
    expect(fiscalYearToSchoolYear(25)).toBe("2024-25");
    expect(fiscalYearToSchoolYear(2025)).toBe("2024-25");
  });

  it("converts FY27 to 2026-27", () => {
    expect(fiscalYearToSchoolYear(27)).toBe("2026-27");
  });
});

describe("getDistrictActuals", () => {
  it("returns aggregated actuals for a district and school year", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        total_revenue: 50000,
        completed_revenue: 30000,
        scheduled_revenue: 20000,
        total_take: 12000,
        completed_take: 8000,
        scheduled_take: 4000,
        weighted_pipeline: 25000,
        open_pipeline: 40000,
        bookings: 35000,
        invoiced: 28000,
        credited: 1200,
        opp_count: 3,
      },
    ]);

    const result = await getDistrictActuals("1234567", "2025-26");
    expect(result).toEqual({
      totalRevenue: 50000,
      completedRevenue: 30000,
      scheduledRevenue: 20000,
      totalTake: 12000,
      completedTake: 8000,
      scheduledTake: 4000,
      weightedPipeline: 25000,
      openPipeline: 40000,
      bookings: 35000,
      invoiced: 28000,
      credited: 1200,
      oppCount: 3,
      takeRate: 0.24, // 12000/50000
    });
  });

  it("returns zeros when no data found", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await getDistrictActuals("9999999", "2025-26");
    expect(result.totalRevenue).toBe(0);
    expect(result.oppCount).toBe(0);
    expect(result.takeRate).toBeNull();
  });
});

describe("getRepActuals", () => {
  it("sums session revenue (from rep_session_actuals) + sub revenue (from district_opportunity_actuals)", async () => {
    // First call: rep_session_actuals — session_revenue
    // Second call: district_opportunity_actuals — sub_revenue + everything else
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ session_revenue: 100000 }])
      .mockResolvedValueOnce([
        {
          sub_revenue: 25000,
          total_take: 30000,
          completed_take: 25000,
          scheduled_take: 5000,
          weighted_pipeline: 50000,
          open_pipeline: 80000,
          bookings: 200000,
          min_purchase_bookings: 150000,
          invoiced: 90000,
        },
      ]);

    const actuals = await getRepActuals("rep@example.com", "2025-26");

    expect(actuals.totalRevenue).toBe(125000); // 100k sessions + 25k subs
    expect(actuals.totalTake).toBe(30000);
    expect(actuals.openPipeline).toBe(80000);
    expect(actuals.minPurchaseBookings).toBe(150000);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("returns zeros when both queries come back empty", async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const actuals = await getRepActuals("rep@example.com", "2025-26");

    expect(actuals.totalRevenue).toBe(0);
    expect(actuals.totalTake).toBe(0);
    expect(actuals.openPipeline).toBe(0);
  });

  it("makes exactly 2 DB calls and session-only revenue comes from first call", async () => {
    // Verify the two-query wiring: session revenue query (call 1) is independent
    // from the opp actuals query (call 2). We confirm this by checking that:
    // - exactly 2 calls are made (Promise.all fires both)
    // - session_revenue = 50k, sub_revenue = 0 → totalRevenue = 50k (not 0)
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ session_revenue: 50000 }])
      .mockResolvedValueOnce([{
        sub_revenue: 0, total_take: 0, completed_take: 0, scheduled_take: 0,
        weighted_pipeline: 0, open_pipeline: 0, bookings: 0,
        min_purchase_bookings: 0, invoiced: 0,
      }]);

    const actuals = await getRepActuals("rep@example.com", "2025-26");

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    // Only session revenue contributes (sub_revenue = 0)
    expect(actuals.totalRevenue).toBe(50000);
    // No opp actuals → all other fields are 0
    expect(actuals.totalTake).toBe(0);
    expect(actuals.bookings).toBe(0);
  });
});

describe("getNewDistrictsCount", () => {
  it("returns count of districts with current FY opps but no prior FY opps", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 5 }]);

    const result = await getNewDistrictsCount("rep@example.com", "2025-26", "2024-25");
    expect(result).toBe(5);
  });

  it("returns 0 when no new districts", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    const result = await getNewDistrictsCount("rep@example.com", "2025-26", "2024-25");
    expect(result).toBe(0);
  });
});

describe("getDistrictOpportunities", () => {
  it("returns individual opportunity records for a district", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "opp-1",
        name: "FY26 Renewal",
        stage: "5 - Closed Won",
        net_booking_amount: 50000,
        total_revenue: 48000,
        total_take: 12000,
        completed_revenue: 30000,
        scheduled_revenue: 18000,
      },
    ]);

    const result = await getDistrictOpportunities("1234567", "2025-26");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "opp-1",
      name: "FY26 Renewal",
      stage: "5 - Closed Won",
      netBookingAmount: 50000,
      totalRevenue: 48000,
      totalTake: 12000,
      completedRevenue: 30000,
      scheduledRevenue: 18000,
    });
  });
});
