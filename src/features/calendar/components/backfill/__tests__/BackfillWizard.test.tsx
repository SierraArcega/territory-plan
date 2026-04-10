import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CalendarEvent } from "@/features/shared/types/api-types";

// Hoisted mocks so we can reach them inside vi.mock factories.
const { mockConfirm, mockDismiss } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockDismiss: vi.fn(),
}));

vi.mock("@/features/calendar/lib/queries", () => ({
  useConfirmCalendarEvent: () => ({
    mutate: mockConfirm,
    isPending: false,
  }),
  useDismissCalendarEvent: () => ({
    mutate: mockDismiss,
    isPending: false,
  }),
}));

// Stub useTerritoryPlans transitively used by BackfillEventCard
vi.mock("@/features/plans/lib/queries", () => ({
  useTerritoryPlans: () => ({
    data: [{ id: "plan-1", name: "NY Renewals", status: "working" }],
  }),
}));

import BackfillWizard from "../BackfillWizard";

function makeEvent(id: string, overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    googleEventId: `g-${id}`,
    title: `Meeting ${id}`,
    description: "description",
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
    suggestedPlanId: "plan-1",
    suggestedPlanName: "NY Renewals",
    suggestedPlanColor: "#403770",
    matchConfidence: "medium",
    activityId: null,
    lastSyncedAt: "2026-04-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("BackfillWizard", () => {
  beforeEach(() => {
    mockConfirm.mockReset();
    mockDismiss.mockReset();
    // Default: both mutations succeed immediately
    mockConfirm.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.();
    });
    mockDismiss.mockImplementation((_id, opts) => {
      opts?.onSuccess?.();
    });
  });

  it("renders the first event", () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Meeting a")).toBeInTheDocument();
    expect(screen.getByText("Event 1 of 2")).toBeInTheDocument();
  });

  it("Prev button is disabled at index 0", () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const prev = screen.getByRole("button", { name: /prev/i });
    expect(prev).toBeDisabled();
  });

  it("Skip advances and updates the skipped counter", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b"), makeEvent("c")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(screen.getByText("Event 2 of 3")).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
  });

  it("Dismiss calls the dismiss mutation and advances", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));
    expect(mockDismiss).toHaveBeenCalledWith("a", expect.any(Object));
    expect(screen.getByText("Event 2 of 2")).toBeInTheDocument();
  });

  it("Save & Next calls the confirm mutation with card values", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({
      eventId: "a",
      activityType: "program_check_in",
    });
  });

  it("onComplete fires after the last event with the final counts", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b"), makeEvent("c"), makeEvent("d")]}
        onComplete={onComplete}
        onClose={vi.fn()}
      />
    );

    // Event a: confirm
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    // Event b: confirm
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    // Event c: skip
    await user.click(screen.getByRole("button", { name: /^skip$/i }));
    // Event d: dismiss (this is the last event, should trigger onComplete)
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    // onComplete is queued with queueMicrotask and should receive fresh counts
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith({
      confirmed: 2,
      skipped: 1,
      dismissed: 1,
    });
  });

  it("onComplete reports correct counts when the last event is a confirm", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <BackfillWizard events={[makeEvent("a")]} onComplete={onComplete} onClose={vi.fn()} />
    );
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith({
      confirmed: 1,
      skipped: 0,
      dismissed: 0,
    });
  });

  it("does not advance and shows an inline error banner when confirm fails", async () => {
    const user = userEvent.setup();
    // Mock confirm to call onError instead of onSuccess
    mockConfirm.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error("Server exploded"));
    });
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /save & next/i }));

    // Wizard stays on event 1
    expect(screen.getByText("Event 1 of 2")).toBeInTheDocument();
    // Inline error banner appears with the server error
    const banner = await screen.findByTestId("backfill-event-error");
    expect(banner).toHaveTextContent(/server exploded/i);
  });

  it("does not advance and shows an inline error banner when dismiss fails", async () => {
    const user = userEvent.setup();
    mockDismiss.mockImplementation((_id, opts) => {
      opts?.onError?.(new Error("Nope"));
    });
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    expect(screen.getByText("Event 1 of 2")).toBeInTheDocument();
    const banner = await screen.findByTestId("backfill-event-error");
    expect(banner).toHaveTextContent(/nope/i);
  });

  it("keyboard Y confirms with the user's edited values, not the event suggestions", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWizard
        events={[makeEvent("a", { suggestedActivityType: "program_check_in" })]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // User changes the activity type dropdown to "proposal_review"
    const typeSelect = screen.getByLabelText<HTMLSelectElement>(/activity type/i);
    await user.selectOptions(typeSelect, "proposal_review");
    expect(typeSelect.value).toBe("proposal_review");

    // User also edits the title
    const titleInput = screen.getByLabelText<HTMLInputElement>(/meeting title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "New edited title");

    // User presses Y — dispatch on document since focus moves around inputs.
    // The keyboard handler ignores events whose target is a form input, so we
    // move focus away first before firing.
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "y", bubbles: true }));
    });

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][0]).toMatchObject({
      eventId: "a",
      activityType: "proposal_review",
      title: "New edited title",
    });
  });

  it("keyboard: Y confirms", async () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    // Fire the Y key on the document body (not inside an input)
    act(() => {
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "y", bubbles: true }));
    });
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  });

  it("keyboard: S skips", async () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true }));
    });
    await waitFor(() =>
      expect(screen.getByText("Event 2 of 2")).toBeInTheDocument()
    );
  });

  it("keyboard: X dismisses", async () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    });
    await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith("a", expect.any(Object)));
  });

  it("keyboard: ArrowLeft prev, ArrowRight next", async () => {
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b"), makeEvent("c")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );
    // Advance twice via Skip
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await waitFor(() => expect(screen.getByText("Event 2 of 3")).toBeInTheDocument());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    await waitFor(() => expect(screen.getByText("Event 1 of 3")).toBeInTheDocument());
  });

  it("keyboard: Escape closes", () => {
    const onClose = vi.fn();
    render(
      <BackfillWizard events={[makeEvent("a")]} onComplete={vi.fn()} onClose={onClose} />
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keyboard shortcuts are ignored when focus is inside the notes textarea", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWizard
        events={[makeEvent("a"), makeEvent("b")]}
        onComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const notes = screen.getByLabelText(/notes/i) as HTMLTextAreaElement;
    await user.click(notes);
    expect(notes).toHaveFocus();

    // With the textarea focused, typing "s" should NOT trigger Skip
    await user.keyboard("s");

    expect(screen.getByText("Event 1 of 2")).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    // The "s" should end up in the textarea value
    expect(notes.value).toMatch(/s$/);
  });
});
