import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CalendarEvent } from "@/features/shared/types/api-types";

// Mock useTerritoryPlans to return a couple of plans so the MultiSelect has options.
vi.mock("@/features/plans/lib/queries", () => ({
  useTerritoryPlans: () => ({
    data: [
      { id: "plan-1", name: "NY Renewals", status: "working" },
      { id: "plan-2", name: "CA Expansion", status: "planning" },
      { id: "plan-3", name: "Old archived", status: "archived" },
    ],
  }),
}));

import BackfillEventCard from "../BackfillEventCard";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    googleEventId: "g-evt-1",
    title: "Quarterly review with Ada County",
    description: "Review Q4 numbers and talk renewal.",
    startTime: "2026-03-15T15:00:00.000Z",
    endTime: "2026-03-15T16:00:00.000Z",
    location: null,
    attendees: [
      { email: "jane@adacounty.k12.id.us", name: "Jane Smith", responseStatus: "accepted" },
      { email: "rep@fullmindlearning.com", name: "Rep", responseStatus: "accepted" },
    ],
    status: "pending",
    suggestedActivityType: "program_check_in",
    suggestedDistrictId: "1600001",
    suggestedDistrictName: "Ada County SD",
    suggestedDistrictState: "ID",
    suggestedContactIds: [42],
    suggestedContacts: [
      { id: 42, name: "Jane Smith", title: "Superintendent", email: "jane@adacounty.k12.id.us" },
    ],
    suggestedPlanId: "plan-1",
    suggestedPlanName: "NY Renewals",
    suggestedPlanColor: "#403770",
    matchConfidence: "high",
    activityId: null,
    lastSyncedAt: "2026-04-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("BackfillEventCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills title, type and notes from event suggestions", () => {
    const event = makeEvent();
    render(
      <BackfillEventCard
        event={event}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );

    const titleInput = screen.getByLabelText<HTMLInputElement>(/meeting title/i);
    expect(titleInput.value).toBe("Quarterly review with Ada County");

    const typeSelect = screen.getByLabelText<HTMLSelectElement>(/activity type/i);
    expect(typeSelect.value).toBe("program_check_in");

    const notesInput = screen.getByLabelText<HTMLTextAreaElement>(/notes/i);
    expect(notesInput.value).toBe("Review Q4 numbers and talk renewal.");
  });

  it("shows the high-confidence banner", () => {
    render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );
    expect(screen.getByText("Strong match")).toBeInTheDocument();
  });

  it("does not render a banner for confidence=none", () => {
    render(
      <BackfillEventCard
        event={makeEvent({ matchConfidence: "none" })}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
    expect(screen.queryByText("Possible match")).not.toBeInTheDocument();
  });

  it("updates local state without calling onConfirm while editing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );

    const notesInput = screen.getByLabelText(/notes/i);
    await user.clear(notesInput);
    await user.type(notesInput, "Very productive");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with edited values when Save & Next is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );

    const notesInput = screen.getByLabelText(/notes/i);
    await user.clear(notesInput);
    await user.type(notesInput, "Edited note");

    await user.click(screen.getByRole("button", { name: /save & next/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "program_check_in",
        title: "Quarterly review with Ada County",
        planIds: ["plan-1"],
        districtLeaids: ["1600001"],
        notes: "Edited note",
      })
    );
  });

  it("resets local state when a new event.id is passed in", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );
    expect(
      screen.getByLabelText<HTMLInputElement>(/meeting title/i).value
    ).toBe("Quarterly review with Ada County");

    rerender(
      <BackfillEventCard
        event={makeEvent({
          id: "evt-2",
          title: "Onboarding call with Boise ISD",
          description: "Kickoff",
          suggestedPlanId: null,
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
        })}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );

    expect(
      screen.getByLabelText<HTMLInputElement>(/meeting title/i).value
    ).toBe("Onboarding call with Boise ISD");
    expect(screen.getByLabelText<HTMLTextAreaElement>(/notes/i).value).toBe(
      "Kickoff"
    );
  });

  it("Skip and Dismiss do not call onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onSkip = vi.fn();
    const onDismiss = vi.fn();
    render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={onConfirm}
        onSkip={onSkip}
        onDismiss={onDismiss}
        isSaving={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /^skip$/i }));
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables buttons and shows spinner when isSaving is true", () => {
    render(
      <BackfillEventCard
        event={makeEvent()}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={true}
      />
    );
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^skip$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^dismiss$/i })).toBeDisabled();
    expect(screen.getByTestId("save-spinner")).toBeInTheDocument();
  });

  it("renders 'No district match' fallback when there is no suggested district", () => {
    render(
      <BackfillEventCard
        event={makeEvent({
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
        })}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onDismiss={vi.fn()}
        isSaving={false}
      />
    );
    expect(screen.getByText(/no district match/i)).toBeInTheDocument();
  });
});
