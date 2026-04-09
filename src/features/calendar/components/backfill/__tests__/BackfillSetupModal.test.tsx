import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CalendarEvent } from "@/features/shared/types/api-types";

// Hoisted mocks shared across vi.mock factories
const {
  mockStartMutate,
  mockCompleteMutate,
  mockConfirmMutate,
  mockDismissMutate,
  mockUseCalendarInbox,
} = vi.hoisted(() => ({
  mockStartMutate: vi.fn(),
  mockCompleteMutate: vi.fn(),
  mockConfirmMutate: vi.fn(),
  mockDismissMutate: vi.fn(),
  mockUseCalendarInbox: vi.fn(),
}));

vi.mock("@/features/calendar/lib/queries", () => ({
  useStartBackfill: () => ({
    mutate: mockStartMutate,
    isPending: false,
  }),
  useCompleteBackfill: () => ({
    mutate: mockCompleteMutate,
    isPending: false,
  }),
  useCalendarInbox: (status?: string) => mockUseCalendarInbox(status),
  useConfirmCalendarEvent: () => ({
    mutate: mockConfirmMutate,
    isPending: false,
  }),
  useDismissCalendarEvent: () => ({
    mutate: mockDismissMutate,
    isPending: false,
  }),
}));

vi.mock("@/features/plans/lib/queries", () => ({
  useTerritoryPlans: () => ({
    data: [{ id: "plan-1", name: "NY Renewals", status: "working" }],
  }),
}));

import BackfillSetupModal from "../BackfillSetupModal";

function makeEvent(id: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    googleEventId: `g-${id}`,
    title: `Meeting ${id}`,
    description: null,
    startTime: "2026-03-15T15:00:00.000Z",
    endTime: "2026-03-15T16:00:00.000Z",
    location: null,
    attendees: [],
    status: "pending",
    suggestedActivityType: "program_check_in",
    suggestedDistrictId: null,
    suggestedDistrictName: null,
    suggestedDistrictState: null,
    suggestedContactIds: null,
    suggestedContacts: [],
    suggestedPlanId: null,
    suggestedPlanName: null,
    suggestedPlanColor: null,
    matchConfidence: "none",
    activityId: null,
    lastSyncedAt: "2026-04-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("BackfillSetupModal", () => {
  beforeEach(() => {
    mockStartMutate.mockReset();
    mockCompleteMutate.mockReset();
    mockConfirmMutate.mockReset();
    mockDismissMutate.mockReset();
    mockUseCalendarInbox.mockReturnValue({
      data: { events: [], total: 0, pendingCount: 0 },
      isLoading: false,
    });
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <BackfillSetupModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the picker step by default", () => {
    render(<BackfillSetupModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/get your calendar caught up/i)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("transitions picker → loading → wizard on a successful Start with events", async () => {
    mockUseCalendarInbox.mockReturnValue({
      data: {
        events: [makeEvent("a"), makeEvent("b")],
        total: 2,
        pendingCount: 2,
      },
      isLoading: false,
    });
    mockStartMutate.mockImplementation((_days, opts) => {
      opts?.onSuccess?.({
        eventsProcessed: 2,
        newEvents: 2,
        updatedEvents: 0,
        cancelledEvents: 0,
        errors: [],
        pendingCount: 2,
      });
    });

    const user = userEvent.setup();
    render(<BackfillSetupModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /start sync/i }));

    await waitFor(() => expect(screen.getByTestId("backfill-wizard")).toBeInTheDocument());
    expect(screen.getByText("Event 1 of 2")).toBeInTheDocument();
  });

  it("shows empty state when pendingCount is 0", async () => {
    mockStartMutate.mockImplementation((_days, opts) => {
      opts?.onSuccess?.({
        eventsProcessed: 0,
        newEvents: 0,
        updatedEvents: 0,
        cancelledEvents: 0,
        errors: [],
        pendingCount: 0,
      });
    });

    const user = userEvent.setup();
    render(<BackfillSetupModal isOpen={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start sync/i }));

    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
  });

  it("shows error state when start mutation fails", async () => {
    mockStartMutate.mockImplementation((_days, opts) => {
      opts?.onError?.(new Error("Network down"));
    });

    const user = userEvent.setup();
    render(<BackfillSetupModal isOpen={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /start sync/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn.t reach google/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("initialStep='wizard' skips the picker", () => {
    mockUseCalendarInbox.mockReturnValue({
      data: {
        events: [makeEvent("a")],
        total: 1,
        pendingCount: 1,
      },
      isLoading: false,
    });
    render(
      <BackfillSetupModal isOpen={true} onClose={vi.fn()} initialStep="wizard" />
    );
    expect(screen.queryByText(/get your calendar caught up/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("backfill-wizard")).toBeInTheDocument();
  });

  it("close button fires onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BackfillSetupModal isOpen={true} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key fires onClose", () => {
    const onClose = vi.fn();
    render(<BackfillSetupModal isOpen={true} onClose={onClose} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click closes the modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BackfillSetupModal isOpen={true} onClose={onClose} />);
    await user.click(screen.getByTestId("backfill-setup-modal"));
    expect(onClose).toHaveBeenCalled();
  });
});
