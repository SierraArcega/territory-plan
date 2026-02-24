import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HomePanel from "../HomePanel";

// ---------------------------------------------------------------------------
// Mock external hooks
// ---------------------------------------------------------------------------

const mockDashboardWithGoals = {
  fiscalYear: 2027,
  goals: {
    earningsTarget: 100000,
    takeRatePercent: null,
    renewalTarget: 50000,
    winbackTarget: 10000,
    expansionTarget: 20000,
    newBusinessTarget: 30000,
    takeTarget: 80000,
    newDistrictsTarget: 5,
  },
  actuals: {
    earnings: 45000,
    revenue: 60000,
    take: 32000,
    pipeline: 15000,
    newDistricts: 2,
  },
  planTotals: {
    renewalTarget: 0,
    winbackTarget: 0,
    expansionTarget: 0,
    newBusinessTarget: 0,
    totalTarget: 0,
    districtCount: 0,
    planCount: 0,
  },
  plans: [],
};

const mockDashboardNoGoals = {
  fiscalYear: 2027,
  goals: null,
  actuals: {
    earnings: 0,
    revenue: 0,
    take: 0,
    pipeline: 0,
    newDistricts: 0,
  },
  planTotals: {
    renewalTarget: 0,
    winbackTarget: 0,
    expansionTarget: 0,
    newBusinessTarget: 0,
    totalTarget: 0,
    districtCount: 0,
    planCount: 0,
  },
  plans: [],
};

let dashboardData = mockDashboardWithGoals as typeof mockDashboardWithGoals | typeof mockDashboardNoGoals;

vi.mock("@/lib/api", () => ({
  useProfile: () => ({
    data: { fullName: "Test User", email: "test@test.com", jobTitle: "Rep", avatarUrl: null, location: null, locationLat: null, locationLng: null, phone: null, slackUrl: null, bio: null },
  }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useTerritoryPlans: () => ({ data: [] }),
  useGoalDashboard: () => ({ data: dashboardData }),
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

vi.mock("@/features/goals/components/ProgressCard", () => ({
  getDefaultFiscalYear: () => 2027,
}));

vi.mock("@/features/goals/components/GoalEditorModal", () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomePanel — Goals donut grid", () => {
  beforeEach(() => {
    dashboardData = mockDashboardWithGoals;
  });

  // Test 11: 4 donuts render when goalMetrics is present
  it("renders 4 donut charts when goals are present", () => {
    const { container } = render(<HomePanel />);
    // Each DonutChart renders an SVG with two circles
    const svgs = container.querySelectorAll("svg");
    // Filter to SVGs that contain exactly 2 circle elements (donut charts)
    const donutSvgs = Array.from(svgs).filter(
      (svg) => svg.querySelectorAll("circle").length === 2,
    );
    expect(donutSvgs).toHaveLength(4);
  });

  // Test 12: Tapping a donut opens popover
  it("opens popover with current/target when a donut is tapped", () => {
    const { container } = render(<HomePanel />);
    // Find the first donut (role="button" div wrapping the SVG)
    const donutButtons = container.querySelectorAll('[role="button"]');
    expect(donutButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(donutButtons[0]);
    const popover = screen.getByTestId("donut-popover");
    expect(popover).toBeInTheDocument();
    // Popover shows current value and target
    expect(popover.textContent).toContain("$45K");
    expect(popover.textContent).toContain("of $100K");
  });

  // Test 13: Click outside closes popover
  it("closes popover when clicking outside", () => {
    const { container } = render(<HomePanel />);
    const donutButtons = container.querySelectorAll('[role="button"]');
    fireEvent.click(donutButtons[0]);
    expect(screen.getByTestId("donut-popover")).toBeInTheDocument();

    // Click outside the popover
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("donut-popover")).not.toBeInTheDocument();
  });

  // Test 14: Empty state renders when no goals
  it("shows empty state when no goals are set", () => {
    dashboardData = mockDashboardNoGoals;
    render(<HomePanel />);
    expect(screen.getByText(/No goals set for FY27/)).toBeInTheDocument();
  });
});
