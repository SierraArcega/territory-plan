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
  priorFullPipeline: 60000,
  priorFullDeals: 5,
  priorFullSessions: 820,
};

const pacingWithBreakdown: DistrictPacing = {
  ...basePacing,
  serviceTypeBreakdown: [
    {
      serviceType: "Tutoring",
      currentRevenue: 60000,
      currentSessions: 100,
      priorSameDateRevenue: 25000,
      priorSameDateSessions: 50,
      priorFullRevenue: 120000,
      priorFullSessions: 600,
    },
    {
      serviceType: "Virtual Staffing",
      currentRevenue: 40000,
      currentSessions: 60,
      priorSameDateRevenue: 15000,
      priorSameDateSessions: 30,
      priorFullRevenue: 60000,
      priorFullSessions: 220,
    },
  ],
};

describe("PacingTable", () => {
  it("renders empty state when pacing is undefined", () => {
    render(<PacingTable fiscalYear={27} />);
    expect(screen.getByText("No prior year data")).toBeInTheDocument();
  });

  it("renders combined Revenue & Sessions row in collapsed state", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.getByText(/\$100\.0K\s*\/\s*160/)).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
  });

  it("shows Revenue & Sessions label for combined row", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.getByText("Revenue & Sessions")).toBeInTheDocument();
  });

  it("does not show service type sub-rows when collapsed", () => {
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Virtual Staffing")).not.toBeInTheDocument();
  });

  it("expands to show service type sub-rows with values on click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    await user.click(screen.getByText("Revenue & Sessions"));
    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    expect(screen.getByText("Virtual Staffing")).toBeInTheDocument();
    expect(screen.getByText(/\$60\.0K\s*\/\s*100/)).toBeInTheDocument();
    expect(screen.getByText(/\$40\.0K\s*\/\s*60/)).toBeInTheDocument();
  });

  it("collapses sub-rows on second click", async () => {
    const user = userEvent.setup();
    render(<PacingTable pacing={pacingWithBreakdown} fiscalYear={27} />);
    await user.click(screen.getByText("Revenue & Sessions"));
    expect(screen.getByText("Tutoring")).toBeInTheDocument();
    await user.click(screen.getByText("Revenue & Sessions"));
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("does not render chevron when no serviceTypeBreakdown", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    expect(screen.getByText("Revenue & Sessions")).toBeInTheDocument();
    expect(screen.queryByText("Tutoring")).not.toBeInTheDocument();
  });

  it("renders Pipeline and Deals as currency and count respectively", () => {
    render(<PacingTable pacing={basePacing} fiscalYear={27} />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Deals")).toBeInTheDocument();
  });
});
