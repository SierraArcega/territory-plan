import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { PacingTable } from "../PlanDistrictsTab";
import type { DistrictPacing } from "@/features/shared/types/api-types";

const basePacing: DistrictPacing = {
  currentRevenue: 100000,
  currentPipeline: 50000,
  currentDeals: 3,
  currentSessions: 160,
  priorSameDateRevenue: 40000,
  priorSameDatePipeline: 30000,
  priorSameDateDeals: 2,
  priorSameDateSessions: 80,
  priorFullRevenue: 180000,
  priorFullPipeline: 55000,
  priorFullDeals: 5,
  priorFullSessions: 820,
};

const pacingWithBreakdown: DistrictPacing = {
  ...basePacing,
  serviceTypeBreakdown: [
    {
      serviceType: "Tutoring",
      currentRevenue: 63000,
      currentSessions: 100,
      priorSameDateRevenue: 22000,
      priorSameDateSessions: 50,
      priorFullRevenue: 118000,
      priorFullSessions: 600,
    },
    {
      serviceType: "Virtual Staffing",
      currentRevenue: 37000,
      currentSessions: 60,
      priorSameDateRevenue: 18000,
      priorSameDateSessions: 30,
      priorFullRevenue: 62000,
      priorFullSessions: 220,
    },
  ],
};

describe("PacingTable", () => {
  it("renders empty state when pacing is undefined", () => {
    render(<PacingTable fiscalYear={27} />);
    expect(screen.getByText("No prior year data")).toBeInTheDocument();
  });

  it("renders Revenue row with just revenue in collapsed state", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    // Revenue row shows just the revenue amount
    expect(screen.getByText("$100.0K")).toBeInTheDocument();
    // All four rows present: Revenue, Pipeline, Deals, Sessions
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
  });

  it("does not show service type sub-rows when collapsed", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Virtual Staffing")).not.toBeInTheDocument();
  });

  it("expands Revenue row to show service type breakdown on click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    await user.click(screen.getByText("Revenue"));
    // Service type labels appear
    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    expect(screen.getByText("Virtual Staffing")).toBeInTheDocument();
    // Sub-rows show revenue values
    expect(screen.getByText("$63.0K")).toBeInTheDocument();
    expect(screen.getByText("$37.0K")).toBeInTheDocument();
    // Sub-rows show session counts as secondary text
    expect(screen.getByText("100 sessions")).toBeInTheDocument();
    expect(screen.getByText("60 sessions")).toBeInTheDocument();
  });

  it("collapses sub-rows on second click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    await user.click(screen.getByText("Revenue"));
    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    await user.click(screen.getByText("Revenue"));
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("Revenue row is not expandable when no serviceTypeBreakdown", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("renders Pipeline, Deals, and Sessions rows", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
  });
});
