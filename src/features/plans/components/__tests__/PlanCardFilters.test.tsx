import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PlanCardFilters, { filterAndSortPlans, type PlanSortKey } from "../PlanCardFilters";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

// Helper to build a minimal valid TerritoryPlan
function makePlan(overrides: Partial<TerritoryPlan> = {}): TerritoryPlan {
  return {
    id: "plan-1",
    name: "Alpha Plan",
    description: null,
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    color: "#FF5733",
    status: "working",
    fiscalYear: 2027,
    startDate: null,
    endDate: null,
    createdAt: "2026-12-01T00:00:00Z",
    updatedAt: "2026-12-15T00:00:00Z",
    districtCount: 10,
    totalEnrollment: 30000,
    stateCount: 1,
    states: [],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
    renewalRollup: 50000,
    expansionRollup: 20000,
    winbackRollup: 10000,
    newBusinessRollup: 30000,
    ...overrides,
  };
}

const plans: TerritoryPlan[] = [
  makePlan({
    id: "plan-1",
    name: "Alpha Plan",
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    districtCount: 10,
    updatedAt: "2026-12-20T00:00:00Z",
    renewalRollup: 50000,
    expansionRollup: 20000,
    winbackRollup: 10000,
    newBusinessRollup: 30000,
  }),
  makePlan({
    id: "plan-2",
    name: "Bravo Plan",
    owner: { id: "user-2", fullName: "Jane Doe", avatarUrl: null },
    districtCount: 5,
    updatedAt: "2026-12-25T00:00:00Z",
    renewalRollup: 10000,
    expansionRollup: 5000,
    winbackRollup: 0,
    newBusinessRollup: 5000,
  }),
  makePlan({
    id: "plan-3",
    name: "Charlie Plan",
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    districtCount: 20,
    updatedAt: "2026-12-10T00:00:00Z",
    renewalRollup: 200000,
    expansionRollup: 100000,
    winbackRollup: 50000,
    newBusinessRollup: 150000,
  }),
];

describe("PlanCardFilters", () => {
  const onOwnerChange = vi.fn();
  const onSortChange = vi.fn();

  // Test 21: Renders "All" chip always
  it('renders "All" chip regardless of owner data', () => {
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    expect(screen.getByLabelText("Show all plans")).toBeInTheDocument();
  });

  // Test 22: Renders one chip per unique owner
  it("renders one chip per unique owner plus All chip", () => {
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    // "All" + "John Smith" + "Jane Doe" = 3 buttons in the chip area
    const allChip = screen.getByLabelText("Show all plans");
    const johnChip = screen.getByLabelText("Filter by John Smith");
    const janeChip = screen.getByLabelText("Filter by Jane Doe");
    expect(allChip).toBeInTheDocument();
    expect(johnChip).toBeInTheDocument();
    expect(janeChip).toBeInTheDocument();
  });

  // Test 23: Deduplicates owners across plans
  it("deduplicates owners — John Smith appears only once despite 2 plans", () => {
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    // Only 1 chip for John Smith
    const johnChips = screen.getAllByLabelText("Filter by John Smith");
    expect(johnChips).toHaveLength(1);
  });

  // Test 24: Clicking owner chip calls onOwnerChange
  it("calls onOwnerChange with owner ID when an owner chip is clicked", () => {
    onOwnerChange.mockClear();
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    fireEvent.click(screen.getByLabelText("Filter by Jane Doe"));
    expect(onOwnerChange).toHaveBeenCalledWith("user-2");
  });

  // Test 25: Clicking "All" chip calls onOwnerChange(null)
  it("calls onOwnerChange(null) when All chip is clicked", () => {
    onOwnerChange.mockClear();
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId="user-1"
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    fireEvent.click(screen.getByLabelText("Show all plans"));
    expect(onOwnerChange).toHaveBeenCalledWith(null);
  });

  // Test 26: Selected owner chip has highlight styling
  it("applies ring-2 ring-plum to the selected owner chip", () => {
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId="user-1"
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    const chip = screen.getByLabelText("Filter by John Smith");
    expect(chip.className).toContain("ring-2");
    expect(chip.className).toContain("ring-plum");
  });

  // Test 27: Sort dropdown renders all options
  it("renders all 4 sort options in dropdown", () => {
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    const select = screen.getByLabelText("Sort plans");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent("Recently updated");
    expect(options[1]).toHaveTextContent("Name A-Z");
    expect(options[2]).toHaveTextContent("Most districts");
    expect(options[3]).toHaveTextContent("Largest target");
  });

  // Test 28: Changing sort calls onSortChange
  it('calls onSortChange with "name" when Name A-Z is selected', () => {
    onSortChange.mockClear();
    render(
      <PlanCardFilters
        plans={plans}
        selectedOwnerId={null}
        onOwnerChange={onOwnerChange}
        sortBy="updated"
        onSortChange={onSortChange}
        variant="full"
      />
    );
    const select = screen.getByLabelText("Sort plans");
    fireEvent.change(select, { target: { value: "name" } });
    expect(onSortChange).toHaveBeenCalledWith("name");
  });
});

// --- filterAndSortPlans utility tests ---

describe("filterAndSortPlans", () => {
  it("filters by owner ID", () => {
    const result = filterAndSortPlans(plans, "user-2", "updated");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("plan-2");
  });

  it("returns all plans when selectedOwnerId is null", () => {
    const result = filterAndSortPlans(plans, null, "updated");
    expect(result).toHaveLength(3);
  });

  it("sorts by name alphabetically", () => {
    const result = filterAndSortPlans(plans, null, "name");
    expect(result.map((p) => p.name)).toEqual(["Alpha Plan", "Bravo Plan", "Charlie Plan"]);
  });

  it("sorts by district count descending", () => {
    const result = filterAndSortPlans(plans, null, "districts");
    expect(result.map((p) => p.districtCount)).toEqual([20, 10, 5]);
  });

  it("sorts by total target descending", () => {
    const result = filterAndSortPlans(plans, null, "totalTarget");
    // Charlie: 500K, Alpha: 110K, Bravo: 20K
    expect(result.map((p) => p.id)).toEqual(["plan-3", "plan-1", "plan-2"]);
  });

  it("sorts by updated date descending", () => {
    const result = filterAndSortPlans(plans, null, "updated");
    expect(result.map((p) => p.id)).toEqual(["plan-2", "plan-1", "plan-3"]);
  });
});
