import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LowHangingFruitView from "../LowHangingFruitView";

vi.mock("../../lib/queries", async () => {
  const actual = await vi.importActual<object>("../../lib/queries");
  return {
    ...actual,
    useLowHangingFruitList: () => ({
      data: {
        totalRevenueAtRisk: 1_000_000,
        districts: [
          {
            leaid: "1", districtName: "Pasadena USD", state: "CA",
            enrollment: null, lmsId: null, category: "missing_renewal",
            fy26Revenue: 320000, fy26CompletedRevenue: 0, fy26ScheduledRevenue: 0,
            fy26SessionCount: null, fy26SubscriptionCount: null,
            fy26OppBookings: 0, fy26MinBookings: 0,
            priorYearRevenue: 0, priorYearVendor: null, priorYearFy: null,
            inFy27Plan: false, planIds: [], hasFy27Target: false,
            hasFy27Pipeline: false, fy27OpenPipeline: 0, inPlan: false,
            lastClosedWon: null, productTypes: [], subProducts: [],
            revenueTrend: { fy24: null, fy25: null, fy26: 320000, fy27: null },
            suggestedTarget: 335000,
          },
        ],
      },
      isLoading: false, isError: false,
    }),
    useMyPlans: () => ({ data: [], isLoading: false }),
  };
});

describe("LowHangingFruitView", () => {
  it("renders header with district count and total revenue", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <LowHangingFruitView />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Low Hanging Fruit/i)).toBeInTheDocument();
    expect(screen.getByText(/1 district/)).toBeInTheDocument();
  });
});
