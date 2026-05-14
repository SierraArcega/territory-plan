import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PlanDetailMobileShell from "../PlanDetailMobileShell";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";

// Mock PlanDetailTabs so we don't need QueryClientProvider
vi.mock("../PlanDetailTabs", () => ({
  default: () => <div data-testid="plan-detail-tabs">Tabs</div>,
}));

const mockPlan: TerritoryPlanDetail = {
  id: "plan-1",
  name: "Westchester County",
  description: null,
  owner: null,
  color: "#403770",
  status: "working",
  fiscalYear: 2026,
  startDate: null,
  endDate: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  districtLeaids: [],
  schoolNcesIds: [],
  totalEnrollment: 134291,
  stateCount: 1,
  states: [],
  collaborators: [],
  taskCount: 0,
  completedTaskCount: 0,
  renewalRollup: 0,
  expansionRollup: 150000,
  winbackRollup: 0,
  newBusinessRollup: 1100000,
  pipelineTotal: 0,
  districts: [
    {
      leaid: "3620580",
      addedAt: "2026-01-01T00:00:00Z",
      name: "Yonkers City SD",
      stateAbbrev: "NY",
      enrollment: 25000,
      owner: null,
      renewalTarget: null,
      winbackTarget: null,
      expansionTarget: null,
      newBusinessTarget: null,
      notes: null,
      returnServices: [],
      newServices: [],
      tags: [],
      actuals: { totalRevenue: 42000, openPipeline: 0 },
    },
  ],
};

describe("PlanDetailMobileShell", () => {
  it("renders plan name and FY badge", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Westchester County")).toBeInTheDocument();
    expect(screen.getByText("FY26")).toBeInTheDocument();
  });

  it("renders Return to Map and close buttons", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Return to Map/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  it("calls onClose when Return to Map is clicked", () => {
    const onClose = vi.fn();
    render(<PlanDetailMobileShell plan={mockPlan} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Return to Map/i));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("hides stats section by default", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    expect(screen.queryByText("Total Target")).not.toBeInTheDocument();
  });

  it("shows stats section after tapping the Stats toggle", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /stats/i }));
    expect(screen.getByText("Total Target")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("hides stats section again when toggle is tapped a second time", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /stats/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText("Total Target")).not.toBeInTheDocument();
  });

  it("renders prev/next buttons and counter when navigation props are provided", () => {
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        currentIndex={1}
        totalCount={7}
      />
    );
    expect(screen.getByRole("button", { name: /Previous plan/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next plan/i })).toBeInTheDocument();
    expect(screen.getByText("2 of 7")).toBeInTheDocument();
  });

  it("calls onPrev and onNext when nav buttons are clicked", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <PlanDetailMobileShell
        plan={mockPlan}
        onClose={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        currentIndex={1}
        totalCount={7}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Previous plan/i }));
    expect(onPrev).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Next plan/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("renders the tabs panel", () => {
    render(<PlanDetailMobileShell plan={mockPlan} onClose={vi.fn()} />);
    expect(screen.getByTestId("plan-detail-tabs")).toBeInTheDocument();
  });
});
