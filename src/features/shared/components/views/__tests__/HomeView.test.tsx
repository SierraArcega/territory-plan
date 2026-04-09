import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// Backfill modal + toast — stubbed out so we can assert on props. The stub
// renders a "close" button so tests can simulate the user dismissing the
// modal (e.g. "Maybe later") and verify it stays closed on re-render.
vi.mock("@/features/calendar/components/backfill/BackfillSetupModal", () => ({
  default: (props: {
    isOpen: boolean;
    initialStep: string;
    onClose: () => void;
    onGoToActivities?: () => void;
  }) => (
    <div
      data-testid="backfill-modal"
      data-open={props.isOpen ? "true" : "false"}
      data-initial-step={props.initialStep}
      data-has-go-to-activities={props.onGoToActivities ? "true" : "false"}
    >
      <button
        type="button"
        data-testid="backfill-modal-close"
        onClick={props.onClose}
      >
        Close
      </button>
    </div>
  ),
}));

vi.mock("@/features/calendar/components/CalendarSyncToast", () => ({
  default: (props: { visible: boolean; newEventCount: number }) => (
    <div
      data-testid="sync-toast"
      data-visible={props.visible ? "true" : "false"}
      data-count={String(props.newEventCount)}
    />
  ),
}));

// next/navigation — routerReplace + searchParams are swappable per-test
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();
const searchParamsRef: { current: URLSearchParams } = {
  current: new URLSearchParams(),
};
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  useSearchParams: () => searchParamsRef.current,
}));

// Calendar hooks — swappable per-test
const mockBackfillStatus = {
  isLoading: false,
  connected: false,
  needsSetup: false,
  needsResume: false,
  backfillCompletedAt: null as string | null,
};
const newEventsCallbacks: Array<(n: number) => void> = [];

vi.mock("@/features/calendar/lib/queries", () => ({
  useBackfillStatus: () => ({ ...mockBackfillStatus }),
  useAutoSyncCalendarOnMount: () => ({
    setOnNewEvents: (cb: (n: number) => void) => {
      newEventsCallbacks.push(cb);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomeView — regression after DonutChart extraction", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockRouterPush.mockReset();
    searchParamsRef.current = new URLSearchParams();
    mockBackfillStatus.needsSetup = false;
    mockBackfillStatus.needsResume = false;
    newEventsCallbacks.length = 0;
  });

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

describe("HomeView — calendar sync integration", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockRouterPush.mockReset();
    searchParamsRef.current = new URLSearchParams();
    mockBackfillStatus.needsSetup = false;
    mockBackfillStatus.needsResume = false;
    newEventsCallbacks.length = 0;
  });

  it("keeps the backfill modal closed on a neutral mount", () => {
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("false");
  });

  it("opens the backfill modal when ?calendarJustConnected=true is present", () => {
    searchParamsRef.current = new URLSearchParams("calendarJustConnected=true");
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("true");
    expect(modal.dataset.initialStep).toBe("picker");
    // Query param should be stripped
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it("opens the backfill modal at the wizard step when needsResume is true", () => {
    mockBackfillStatus.needsResume = true;
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("true");
    expect(modal.dataset.initialStep).toBe("wizard");
  });

  it("opens the backfill modal when needsSetup is true", () => {
    mockBackfillStatus.needsSetup = true;
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("true");
  });

  it("fires the calendar sync toast when autoSync.setOnNewEvents callback is invoked", () => {
    render(<HomeView />);
    expect(screen.getByTestId("sync-toast").dataset.visible).toBe("false");

    // Simulate the auto-sync hook firing its callback with 3 new events
    act(() => {
      newEventsCallbacks.forEach((cb) => cb(3));
    });

    const toast = screen.getByTestId("sync-toast");
    expect(toast.dataset.visible).toBe("true");
    expect(toast.dataset.count).toBe("3");
  });

  it("opens the backfill modal when ?resumeBackfill=true is present", () => {
    searchParamsRef.current = new URLSearchParams("resumeBackfill=true");
    mockBackfillStatus.needsResume = true;
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("true");
    expect(modal.dataset.initialStep).toBe("wizard");
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it("does not re-open the backfill modal after the user dismisses it via 'Maybe later'", async () => {
    const user = userEvent.setup();
    mockBackfillStatus.needsSetup = true;
    const { rerender } = render(<HomeView />);

    // Auto-opens on mount
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.open).toBe("true");

    // User dismisses the modal via the close (Maybe later) button
    await user.click(screen.getByTestId("backfill-modal-close"));
    expect(screen.getByTestId("backfill-modal").dataset.open).toBe("false");

    // Force a re-render — nothing about the backfill status has changed and
    // no explicit query param intent is set, so the modal must stay closed.
    rerender(<HomeView />);
    expect(screen.getByTestId("backfill-modal").dataset.open).toBe("false");
  });

  it("passes onGoToActivities to the backfill modal", () => {
    mockBackfillStatus.needsSetup = true;
    render(<HomeView />);
    const modal = screen.getByTestId("backfill-modal");
    expect(modal.dataset.hasGoToActivities).toBe("true");
  });
});
