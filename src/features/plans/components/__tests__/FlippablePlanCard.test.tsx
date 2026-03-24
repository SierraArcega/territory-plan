import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlippablePlanCard from "../FlippablePlanCard";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

// Helper to build a minimal valid TerritoryPlan
function makePlan(overrides: Partial<TerritoryPlan> = {}): TerritoryPlan {
  return {
    id: "plan-1",
    name: "West Region Q1",
    description: "Expanding in the Western region",
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    color: "#FF5733",
    status: "working",
    fiscalYear: 2027,
    startDate: "2027-01-01T00:00:00Z",
    endDate: "2027-06-30T00:00:00Z",
    createdAt: "2026-12-01T00:00:00Z",
    updatedAt: "2026-12-15T00:00:00Z",
    districtCount: 15,
    totalEnrollment: 50000,
    stateCount: 2,
    states: [
      { fips: "06", abbrev: "CA", name: "California" },
      { fips: "48", abbrev: "TX", name: "Texas" },
    ],
    collaborators: [],
    taskCount: 8,
    completedTaskCount: 3,
    renewalRollup: 100000,
    expansionRollup: 50000,
    winbackRollup: 25000,
    newBusinessRollup: 75000,
    pipelineTotal: 120000,
    districtLeaids: [],
    schoolNcesIds: [],
    ...overrides,
  };
}

describe("FlippablePlanCard", () => {
  const onNavigate = vi.fn();

  it("renders plan name and district count", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("West Region Q1")).toBeInTheDocument();
    expect(screen.getByText(/15 districts/)).toBeInTheDocument();
  });

  it("calls onNavigate with plan ID when card is clicked", () => {
    onNavigate.mockClear();
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    const card = screen.getByRole("button");
    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith("plan-1");
  });

  it("calls onNavigate when Enter is pressed on the card", () => {
    onNavigate.mockClear();
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("plan-1");
  });

  it("shows state abbreviations after district count", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText((_, el) => el?.textContent?.includes("CA, TX") && el.tagName === "SPAN" || false)).toBeInTheDocument();
  });

  it("shows revenue progress bar with percentage when targets exist", () => {
    render(
      <FlippablePlanCard
        plan={makePlan({ revenueActual: 125000 })}
        variant="full"
        onNavigate={onNavigate}
      />
    );
    // totalTarget = 100k+50k+25k+75k = 250k, revenueActual = 125k → 50%
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/\$125K.*\/.*\$250K.*revenue/)).toBeInTheDocument();
  });

  it("shows 0% when revenueActual is not set", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    // revenueActual defaults to 0, totalTarget = 250k → 0%
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("hides progress bar when total target is zero", () => {
    render(
      <FlippablePlanCard
        plan={makePlan({
          renewalRollup: 0,
          expansionRollup: 0,
          winbackRollup: 0,
          newBusinessRollup: 0,
          pipelineTotal: 0,
        })}
        variant="full"
        onNavigate={onNavigate}
      />
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("uses compact padding in compact variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="compact" onNavigate={onNavigate} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("p-3");
  });

  it("uses full padding in full variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("p-4");
  });

  it("renders left color bar with plan color", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan({ color: "#FF5733" })} variant="full" onNavigate={onNavigate} />
    );
    const colorBar = container.querySelector('[style*="background-color: rgb(255, 87, 51)"]') ||
      container.querySelector('[style*="#FF5733"]');
    expect(colorBar).toBeInTheDocument();
  });

  it("uses singular 'district' when count is 1", () => {
    render(
      <FlippablePlanCard plan={makePlan({ districtCount: 1 })} variant="full" onNavigate={onNavigate} />
    );
    expect(screen.getByText(/1 district$/)).toBeInTheDocument();
  });
});
