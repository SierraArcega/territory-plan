import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DistrictPerformanceSection from "../DistrictPerformanceSection";
import type { PlanDistrictActuals, PlanDistrictOpportunity } from "@/features/shared/types/api-types";

const mockActuals: PlanDistrictActuals = {
  totalRevenue: 50000,
  completedRevenue: 30000,
  scheduledRevenue: 20000,
  totalTake: 12000,
  completedTake: 8000,
  scheduledTake: 4000,
  takeRate: 0.24,
  openPipeline: 40000,
  weightedPipeline: 25000,
  invoiced: 28000,
  credited: 1200,
  oppCount: 3,
  priorFyRevenue: 38500,
  priorFyTake: 9000,
  yoyRevenueChange: 29.87,
};

const mockOpportunities: PlanDistrictOpportunity[] = [
  {
    id: "opp-1",
    name: "FY26 Renewal — Reading Program",
    stage: "5 - Closed Won",
    netBookingAmount: 28000,
    totalRevenue: 26000,
    totalTake: 6200,
    completedRevenue: 20000,
    scheduledRevenue: 6000,
  },
];

describe("DistrictPerformanceSection", () => {
  it("renders metric values", () => {
    render(
      <DistrictPerformanceSection
        actuals={mockActuals}
        opportunities={mockOpportunities}
        revenueTarget={50000}
      />
    );

    // Revenue vs Target card shows "$50,000 / $50,000"
    expect(screen.getByText("$50,000 / $50,000")).toBeInTheDocument();
    // Take card shows completedTake
    expect(screen.getByText("$8,000")).toBeInTheDocument();
    // Take Rate
    expect(screen.getByText("24.0%")).toBeInTheDocument();
    // Pipeline
    expect(screen.getByText("$25,000")).toBeInTheDocument();
  });

  it("renders opportunity list", () => {
    render(
      <DistrictPerformanceSection
        actuals={mockActuals}
        opportunities={mockOpportunities}
        revenueTarget={50000}
      />
    );

    expect(screen.getByText("FY26 Renewal — Reading Program")).toBeInTheDocument();
    expect(screen.getByText("5 - Closed Won")).toBeInTheDocument();
  });

  it("shows empty state when no actuals", () => {
    render(
      <DistrictPerformanceSection
        actuals={null}
        opportunities={[]}
        revenueTarget={50000}
      />
    );

    expect(screen.getByText("No opportunity data available for this fiscal year.")).toBeInTheDocument();
  });
});
