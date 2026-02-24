import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import HomeView from "../HomeView";

// ---------------------------------------------------------------------------
// Mock all external dependencies
// ---------------------------------------------------------------------------

const mockDashboard = {
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

vi.mock("@/lib/api", () => ({
  useProfile: () => ({ data: { fullName: "Test User", email: "t@t.com" } }),
  useGoalDashboard: () => ({ data: mockDashboard }),
  useTerritoryPlans: () => ({ data: [] }),
  useTasks: () => ({ data: { tasks: [] } }),
  useActivities: () => ({ data: { activities: [] } }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useCreateTerritoryPlan: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/features/shared/lib/app-store", () => ({
  useMapStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setActiveTab: vi.fn() }),
}));

vi.mock("@/features/goals/components/ProgressCard", () => ({
  getDefaultFiscalYear: () => 2027,
}));

vi.mock("@/features/goals/components/GoalEditorModal", () => ({
  default: () => null,
}));

vi.mock("@/features/tasks/components/TaskDetailModal", () => ({
  default: () => null,
}));

vi.mock("@/features/plans/components/PlanFormModal", () => ({
  default: () => null,
}));

vi.mock("@/features/calendar/components/CalendarInboxWidget", () => ({
  default: () => <div data-testid="calendar-widget" />,
}));

vi.mock("@/features/progress/components/LeadingIndicatorsPanel", () => ({
  default: () => <div data-testid="leading-panel" />,
}));

vi.mock("@/features/progress/components/LaggingIndicatorsPanel", () => ({
  default: () => <div data-testid="lagging-panel" />,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomeView — regression after DonutChart extraction", () => {
  // Test 15: HomeView still renders 4 donuts after extraction
  it("renders 4 donut chart SVGs after extraction to shared component", () => {
    const { container } = render(<HomeView />);
    // Each DonutChart renders an SVG with exactly 2 circles
    const svgs = container.querySelectorAll("svg");
    const donutSvgs = Array.from(svgs).filter(
      (svg) => svg.querySelectorAll("circle").length === 2,
    );
    expect(donutSvgs).toHaveLength(4);
  });
});
