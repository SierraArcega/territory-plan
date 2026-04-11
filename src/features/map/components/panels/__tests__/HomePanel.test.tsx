import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HomePanel from "../HomePanel";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

// ---------------------------------------------------------------------------
// Mock external hooks
// ---------------------------------------------------------------------------

let plansData: TerritoryPlan[] = [];

vi.mock("@/lib/api", () => ({
  useProfile: () => ({
    data: { fullName: "Test User", email: "test@test.com", jobTitle: "Rep", avatarUrl: null, location: null, locationLat: null, locationLng: null, phone: null, slackUrl: null, bio: null },
  }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useTerritoryPlans: () => ({ data: plansData }),
}));

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      viewPlan: vi.fn(),
      startNewPlan: vi.fn(),
    }),
}));

vi.mock("@/features/map/lib/geocode", () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Plan Card Integration Tests (PRD tests 29-32)
// ---------------------------------------------------------------------------

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
    pipelineTotal: 50000,
    districtLeaids: [],
    schoolNcesIds: [],
    ...overrides,
  };
}

describe("HomePanel — Plan cards integration", () => {
  beforeEach(() => {
    plansData = [];
  });

  // PRD Test 29: Plan cards render when plans exist for selected FY
  it("renders FlippablePlanCard components when plans exist for selected FY", () => {
    plansData = [
      makePlan({ id: "plan-1", name: "Alpha Plan" }),
      makePlan({ id: "plan-2", name: "Bravo Plan", owner: { id: "user-2", fullName: "Jane Doe", avatarUrl: null } }),
    ];

    render(<HomePanel />);

    // Plan names should appear in the rendered cards
    expect(screen.getByText("Alpha Plan")).toBeInTheDocument();
    expect(screen.getByText("Bravo Plan")).toBeInTheDocument();
  });

  // PRD Test 30: Owner filter reduces visible cards
  it("reduces visible cards when an owner chip is selected", () => {
    plansData = [
      makePlan({ id: "plan-1", name: "Alpha Plan", owner: { id: "user-1", fullName: "John Smith", avatarUrl: null } }),
      makePlan({ id: "plan-2", name: "Bravo Plan", owner: { id: "user-2", fullName: "Jane Doe", avatarUrl: null } }),
      makePlan({ id: "plan-3", name: "Charlie Plan", owner: { id: "user-1", fullName: "John Smith", avatarUrl: null } }),
    ];

    render(<HomePanel />);

    // All 3 plans visible initially
    expect(screen.getByText("Alpha Plan")).toBeInTheDocument();
    expect(screen.getByText("Bravo Plan")).toBeInTheDocument();
    expect(screen.getByText("Charlie Plan")).toBeInTheDocument();

    // Click Jane Doe's owner chip to filter
    fireEvent.click(screen.getByLabelText("Filter by Jane Doe"));

    // Only Bravo Plan (Jane Doe's) should remain visible
    expect(screen.getByText("Bravo Plan")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie Plan")).not.toBeInTheDocument();
  });

  // PRD Test 31: Sort changes card order
  it("reorders cards when sort option is changed", () => {
    plansData = [
      makePlan({ id: "plan-1", name: "Charlie Plan", updatedAt: "2026-12-10T00:00:00Z" }),
      makePlan({ id: "plan-2", name: "Alpha Plan", updatedAt: "2026-12-20T00:00:00Z" }),
      makePlan({ id: "plan-3", name: "Bravo Plan", updatedAt: "2026-12-05T00:00:00Z" }),
    ];

    const { container } = render(<HomePanel />);

    // Switch sort to "Name A-Z"
    const sortSelect = screen.getByLabelText("Sort plans");
    fireEvent.change(sortSelect, { target: { value: "name" } });

    // Plan name headings inside FlippablePlanCard have the text-plum class
    const planNameHeadings = container.querySelectorAll("h3.text-\\[\\#403770\\]");
    const nameTexts = Array.from(planNameHeadings).map((h) => h.textContent);

    // Should be alphabetical
    expect(nameTexts).toEqual(["Alpha Plan", "Bravo Plan", "Charlie Plan"]);
  });

  // PRD Test 32: Empty state shows when no plans for FY
  it('shows "No plans" message when no plans exist for selected FY', () => {
    plansData = [];

    render(<HomePanel />);

    expect(screen.getByText(/No plans for FY27/)).toBeInTheDocument();
  });
});
