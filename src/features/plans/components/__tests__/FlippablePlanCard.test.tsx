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
    ...overrides,
  };
}

describe("FlippablePlanCard", () => {
  const onNavigate = vi.fn();

  // Test 8: Front face renders plan name and district count
  it("renders plan name and district count", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("West Region Q1")).toBeInTheDocument();
    expect(screen.getByText(/15 districts/)).toBeInTheDocument();
  });

  // Test 9: Renders owner name
  it("renders owner name", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  // Test 10: Shows "Unassigned" when no owner
  it('shows "Unassigned" when plan has no owner', () => {
    render(
      <FlippablePlanCard plan={makePlan({ owner: null })} variant="full" onNavigate={onNavigate} />
    );
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  // Test 11: Shows "Owner" label
  it('displays "Owner" label', () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  // Test 12: Shows "Targets" label beneath donut
  it('displays "Targets" label beneath the donut', () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("Targets")).toBeInTheDocument();
  });

  // Test 13: Clicking card calls onNavigate
  it("calls onNavigate with plan ID when card is clicked", () => {
    onNavigate.mockClear();
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);

    const card = screen.getByRole("button");
    fireEvent.click(card);

    expect(onNavigate).toHaveBeenCalledWith("plan-1");
  });

  // Test 14: Keyboard navigation works
  it("calls onNavigate when Enter is pressed on the card", () => {
    onNavigate.mockClear();
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onNavigate).toHaveBeenCalledWith("plan-1");
  });

  // Test 15: Shows states inline with districts
  it("shows state abbreviations after district count", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    // States are in a nested span: " · CA, TX"
    expect(screen.getByText((_, el) => el?.textContent?.includes("CA, TX") && el.tagName === "SPAN" || false)).toBeInTheDocument();
  });

  // Test 16: Shows pipeline and target labels
  it("shows Pipeline and Target labels with formatted values", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    // Pipeline = 120K, Target = 250K (100k+50k+25k+75k)
    expect(screen.getByText("$120K")).toBeInTheDocument();
    expect(screen.getByText("$250K")).toBeInTheDocument();
  });

  // Test 17: Shows percentage to target
  it("shows percentage to target", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    // 120000 / 250000 = 48%
    expect(screen.getByText("48%")).toBeInTheDocument();
  });

  // Test 18: Compact variant uses smaller donut
  it("renders donut with size 44 in compact variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="compact" onNavigate={onNavigate} />
    );
    const svg = container.querySelector('svg[aria-label="Target breakdown donut chart"]');
    expect(svg).toHaveAttribute("width", "44");
  });

  // Test 19: Full variant uses larger donut
  it("renders donut with size 56 in full variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );
    const svg = container.querySelector('svg[aria-label="Target breakdown donut chart"]');
    expect(svg).toHaveAttribute("width", "56");
  });

  // Test 20: Shows owner initials fallback when no avatar
  it("shows initials fallback when owner has no avatar", () => {
    render(
      <FlippablePlanCard
        plan={makePlan({ owner: { id: "user-1", fullName: "John Smith", avatarUrl: null } })}
        variant="full"
        onNavigate={onNavigate}
      />
    );
    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  // Test: Hides pipeline/target section when all rollups are zero
  it("hides pipeline bar when total target is zero", () => {
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
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });

  // Test: Color bar uses plan.color
  it("renders left color bar with plan color", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan({ color: "#FF5733" })} variant="full" onNavigate={onNavigate} />
    );
    const colorBar = container.querySelector('[style*="background-color: rgb(255, 87, 51)"]') ||
      container.querySelector('[style*="#FF5733"]');
    expect(colorBar).toBeInTheDocument();
  });
});
