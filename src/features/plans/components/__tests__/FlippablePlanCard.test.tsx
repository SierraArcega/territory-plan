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
    ...overrides,
  };
}

describe("FlippablePlanCard", () => {
  const onNavigate = vi.fn();

  // Test 8: Front face renders plan name and district count
  it("renders plan name and district count on front face", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("West Region Q1")).toBeInTheDocument();
    expect(screen.getByText("15 districts")).toBeInTheDocument();
  });

  // Test 9: Front face renders owner name
  it("renders owner name on front face", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  });

  // Test 10: Front face renders "Unassigned" when no owner
  it('shows "Unassigned" when plan has no owner', () => {
    render(
      <FlippablePlanCard plan={makePlan({ owner: null })} variant="full" onNavigate={onNavigate} />
    );
    // Both faces will show "Unassigned" — at least one in DOM
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThanOrEqual(1);
  });

  // Test 11: Clicking flip icon toggles to back face
  it("toggles flipped state when flip icon is clicked", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );

    // Both faces have a flip button; pick the first (front face)
    const flipButtons = screen.getAllByLabelText("Show plan details");
    fireEvent.click(flipButtons[0]);

    // After flip, the inner container should have rotateY(180deg) in style
    const inner = container.querySelector("[style*='preserve-3d']");
    expect(inner).toBeInTheDocument();
    expect(inner?.getAttribute("style")).toContain("rotateY(180deg)");
  });

  // Test 12: Clicking flip icon on back returns to front
  it("returns to front face when flip icon is clicked twice", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );

    // First click: flip to back
    const flipButtons = screen.getAllByLabelText("Show plan details");
    fireEvent.click(flipButtons[0]);

    // After flip, labels change to "Show plan summary"
    const flipBackButtons = screen.getAllByLabelText("Show plan summary");
    fireEvent.click(flipBackButtons[0]);

    const inner = container.querySelector("[style*='preserve-3d']");
    expect(inner?.getAttribute("style")).toContain("rotateY(0deg)");
  });

  // Test 13: Clicking card body calls onNavigate
  it("calls onNavigate with plan ID when card body is clicked", () => {
    onNavigate.mockClear();
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);

    // Click on the card body (the role="button" div, not the flip icon button)
    const cardBodies = screen.getAllByRole("button").filter(
      (b) => !b.hasAttribute("aria-label")
    );
    if (cardBodies.length > 0) fireEvent.click(cardBodies[0]);

    expect(onNavigate).toHaveBeenCalledWith("plan-1");
  });

  // Test 14: Clicking card body does NOT flip
  it("does not toggle flipped state when card body is clicked", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );

    // Click on card body (not the flip icon)
    const cardBodies = screen.getAllByRole("button").filter(
      (b) => !b.hasAttribute("aria-label")
    );
    if (cardBodies.length > 0) fireEvent.click(cardBodies[0]);

    // Should still show front (rotateY(0deg))
    const inner = container.querySelector("[style*='preserve-3d']");
    expect(inner?.getAttribute("style")).toContain("rotateY(0deg)");
  });

  // Test 15: Back face shows status badge
  it("shows status badge on back face", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    // Status text is in DOM on the back face (always rendered, hidden via 3D transform)
    expect(screen.getByText("working")).toBeInTheDocument();
  });

  // Test 16: Back face shows description
  it("shows description on back face", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);
    // Description is rendered in DOM (on back face) even when not flipped
    expect(screen.getByText("Expanding in the Western region")).toBeInTheDocument();
  });

  // Test 17: Back face hides description when null
  it("does not render description element when description is null", () => {
    render(
      <FlippablePlanCard plan={makePlan({ description: null })} variant="full" onNavigate={onNavigate} />
    );
    expect(screen.queryByText("Expanding in the Western region")).not.toBeInTheDocument();
  });

  // Test 18: Compact variant uses smaller donut
  it("renders donut with size 40 in compact variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="compact" onNavigate={onNavigate} />
    );
    const svg = container.querySelector('svg[aria-label="Target breakdown donut chart"]');
    expect(svg).toHaveAttribute("width", "40");
  });

  // Test 19: Full variant uses larger donut
  it("renders donut with size 56 in full variant", () => {
    const { container } = render(
      <FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />
    );
    const svg = container.querySelector('svg[aria-label="Target breakdown donut chart"]');
    expect(svg).toHaveAttribute("width", "56");
  });

  // Test 20: Flip icon has correct aria-label
  it("toggles aria-label between 'Show plan details' and 'Show plan summary'", () => {
    render(<FlippablePlanCard plan={makePlan()} variant="full" onNavigate={onNavigate} />);

    // Initially both faces show "Show plan details" (since flipped=false)
    const detailButtons = screen.getAllByLabelText("Show plan details");
    expect(detailButtons.length).toBe(2);

    // After flip, both labels change to "Show plan summary"
    fireEvent.click(detailButtons[0]);
    const summaryButtons = screen.getAllByLabelText("Show plan summary");
    expect(summaryButtons.length).toBe(2);
  });
});
