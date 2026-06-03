import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
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

vi.mock("@/features/activities/components/event-fields/DistrictSearchInput", () => ({
  default: ({
    excludeLeaids,
    onSelect,
  }: {
    excludeLeaids: string[];
    onSelect: (d: { leaid: string; name: string; stateAbbrev: string | null }) => void;
  }) => (
    <input
      placeholder="Search districts..."
      data-excluded={excludeLeaids.join(",")}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSelect({ leaid: "9999999", name: "Boise ISD", stateAbbrev: "ID" });
        }
      }}
    />
  ),
}));

import BackfillEventCard, {
  initialValuesFromEvent,
  type BackfillCardValues,
} from "../BackfillEventCard";

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

// Tiny controlled wrapper — mimics how BackfillWizard owns card state so the
// card can stay focused on rendering + edit dispatch.
interface HarnessProps {
  event: CalendarEvent;
  onConfirm?: (values: BackfillCardValues) => void;
  onSkip?: () => void;
  onDismiss?: () => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  initialValues?: BackfillCardValues;
  decisionStatus?: "confirmed" | "skipped" | "dismissed" | null;
}

function Harness({
  event,
  onConfirm = vi.fn(),
  onSkip = vi.fn(),
  onDismiss = vi.fn(),
  isSaving = false,
  errorMessage = null,
  initialValues,
  decisionStatus,
}: HarnessProps) {
  const [values, setValues] = useState<BackfillCardValues>(
    initialValues ?? initialValuesFromEvent(event)
  );
  return (
    <BackfillEventCard
      event={event}
      values={values}
      onValuesChange={setValues}
      onConfirm={onConfirm}
      onSkip={onSkip}
      onDismiss={onDismiss}
      isSaving={isSaving}
      errorMessage={errorMessage}
      decisionStatus={decisionStatus}
    />
  );
}

describe("BackfillEventCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills title, type and notes from event suggestions", () => {
    const event = makeEvent();
    render(<Harness event={event} />);

    const titleInput = screen.getByLabelText<HTMLInputElement>(/meeting title/i);
    expect(titleInput.value).toBe("Quarterly review with Ada County");

    const typeSelect = screen.getByLabelText<HTMLSelectElement>(/activity type/i);
    expect(typeSelect.value).toBe("program_check_in");

    const notesInput = screen.getByLabelText<HTMLTextAreaElement>(/notes/i);
    expect(notesInput.value).toBe("Review Q4 numbers and talk renewal.");
  });

  it("shows the high-confidence banner", () => {
    render(<Harness event={makeEvent()} />);
    expect(screen.getByText("Strong match")).toBeInTheDocument();
  });

  it("does not render a banner for confidence=none", () => {
    render(<Harness event={makeEvent({ matchConfidence: "none" })} />);
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
    expect(screen.queryByText("Possible match")).not.toBeInTheDocument();
  });

  it("updates local state without calling onConfirm while editing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness event={makeEvent()} onConfirm={onConfirm} />);

    const notesInput = screen.getByLabelText(/notes/i);
    await user.clear(notesInput);
    await user.type(notesInput, "Very productive");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm with edited values when Save & Next is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness event={makeEvent()} onConfirm={onConfirm} />);

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

  it("re-derives values from a new event when the parent swaps the event prop", () => {
    // The wizard re-initializes cardValues when currentIndex changes, so when
    // a new event arrives with new initialValues the displayed fields follow.
    const { rerender } = render(<Harness event={makeEvent()} />);
    expect(
      screen.getByLabelText<HTMLInputElement>(/meeting title/i).value
    ).toBe("Quarterly review with Ada County");

    const nextEvent = makeEvent({
      id: "evt-2",
      title: "Onboarding call with Boise ISD",
      description: "Kickoff",
      suggestedPlanId: null,
      suggestedDistrictId: null,
      suggestedDistrictName: null,
      suggestedDistrictState: null,
    });
    // Re-mount the harness with a new key so it re-runs useState(() => initial)
    rerender(<Harness key="evt-2" event={nextEvent} />);

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
      <Harness
        event={makeEvent()}
        onConfirm={onConfirm}
        onSkip={onSkip}
        onDismiss={onDismiss}
      />
    );

    await user.click(screen.getByRole("button", { name: /^skip$/i }));
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables buttons and shows spinner when isSaving is true", () => {
    render(<Harness event={makeEvent()} isSaving={true} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^skip$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^dismiss$/i })).toBeDisabled();
    expect(screen.getByTestId("save-spinner")).toBeInTheDocument();
  });

  it("renders the district search input when there is no suggested district", () => {
    render(
      <Harness
        event={makeEvent({
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
        })}
      />
    );
    expect(screen.getByPlaceholderText(/search districts/i)).toBeInTheDocument();
    expect(screen.queryByText(/no district match/i)).not.toBeInTheDocument();
  });

  it("renders a matched district as a removable chip alongside the search", () => {
    render(<Harness event={makeEvent()} />);
    expect(screen.getByText("Ada County SD (ID)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove ada county sd/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search districts/i)).toBeInTheDocument();
  });

  it("removing the district chip clears it from the confirm payload", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness event={makeEvent()} onConfirm={onConfirm} />);

    await user.click(
      screen.getByRole("button", { name: /remove ada county sd/i })
    );
    await user.click(screen.getByRole("button", { name: /save & next/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ districtLeaids: [] })
    );
  });

  it("renders an inline error banner when errorMessage is provided", () => {
    render(
      <Harness
        event={makeEvent()}
        errorMessage="We couldn't save this one. Try again?"
      />
    );
    const banner = screen.getByTestId("backfill-event-error");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/couldn't save this one/i);
  });

  it("shows no 'Add to contacts' for matched or internal attendees", () => {
    // Default event: jane@adacounty (matched) + rep@fullmindlearning (internal)
    render(<Harness event={makeEvent()} />);
    expect(
      screen.queryByRole("button", { name: /add to contacts/i })
    ).not.toBeInTheDocument();
  });

  it("shows no 'Add to contacts' for an unmatched internal-domain attendee", () => {
    render(
      <Harness
        event={makeEvent({
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "colleague@elevatek12.com",
              name: "Colleague",
              responseStatus: "accepted",
            },
          ],
        })}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add to contacts/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/pick a district to add/i)).not.toBeInTheDocument();
  });

  it("gates 'Add to contacts' behind a selected district", () => {
    render(
      <Harness
        event={makeEvent({
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
      />
    );
    expect(
      screen.queryByRole("button", { name: /add to contacts/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/pick a district to add/i)).toBeInTheDocument();
    // Precondition: no district is attached, so no remove-chip button exists
    expect(
      screen.queryByRole("button", { name: /^remove /i })
    ).not.toBeInTheDocument();
  });

  it("shows 'Add to contacts' for an external unmatched attendee when a district is set", () => {
    // suggestedDistrictId is set (1600001), casey is unmatched and external
    render(
      <Harness
        event={makeEvent({
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
      />
    );
    expect(
      screen.getByRole("button", { name: /add to contacts/i })
    ).toBeInTheDocument();
  });

  it("clicking 'Add to contacts' stages the attendee in onValuesChange without a network call", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent({
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: /add to contacts/i }));

    // Row now shows "Will add · undo" (no network mutation fired)
    expect(screen.getByText(/will add/i)).toBeInTheDocument();

    // Save & Next includes stagedContacts, no contactIds (creation is deferred)
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        stagedContacts: [{ email: "casey@marion.k12.in.us", name: "Casey Rivera" }],
      })
    );
  });

  it("clicking 'Will add · undo' unstages the attendee", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent({
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
        onConfirm={onConfirm}
      />
    );

    // Stage
    await user.click(screen.getByRole("button", { name: /add to contacts/i }));
    expect(screen.getByText(/will add/i)).toBeInTheDocument();

    // Unstage
    await user.click(screen.getByRole("button", { name: /will add/i }));
    expect(screen.getByRole("button", { name: /add to contacts/i })).toBeInTheDocument();

    // Save should have empty stagedContacts
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ stagedContacts: [] })
    );
  });

  it("removing the last district also clears stagedContacts", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent({
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
        onConfirm={onConfirm}
      />
    );

    // Stage Casey
    await user.click(screen.getByRole("button", { name: /add to contacts/i }));
    expect(screen.getByText(/will add/i)).toBeInTheDocument();

    // Remove the district chip — staged contacts should be cleared
    await user.click(screen.getByRole("button", { name: /remove ada county sd/i }));

    // Now the district is gone and the "pick a district" hint shows
    expect(screen.getByText(/pick a district to add/i)).toBeInTheDocument();

    // Save: stagedContacts must be empty because there's no district to file them under
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ stagedContacts: [], districtLeaids: [] })
    );
  });

  it("removing the PRIMARY district also clears stagedContacts when a second district remains", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    // Start with two districts attached and one staged contact
    const event = makeEvent({
      suggestedDistrictId: "1600001",
      suggestedDistrictName: "Ada County SD",
      suggestedDistrictState: "ID",
      suggestedContacts: [],
      suggestedContactIds: [],
      attendees: [
        {
          email: "casey@marion.k12.in.us",
          name: "Casey Rivera",
          responseStatus: "accepted",
        },
      ],
    });

    render(
      <Harness
        event={event}
        onConfirm={onConfirm}
        initialValues={{
          title: "Quarterly review with Ada County",
          activityType: "program_check_in",
          planIds: ["plan-1"],
          districtLeaids: ["1600001", "9999999"],
          contactIds: [],
          stagedContacts: [{ email: "casey@marion.k12.in.us", name: "Casey Rivera" }],
          notes: "",
        }}
      />
    );

    // Remove the FIRST (primary) district — the second district "9999999" remains
    await user.click(screen.getByRole("button", { name: /remove ada county sd/i }));

    // The second district chip is still present
    expect(screen.queryByText("Ada County SD (ID)")).not.toBeInTheDocument();

    // Save: stagedContacts must be cleared even though a district remains
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        stagedContacts: [],
        districtLeaids: ["9999999"],
      })
    );
  });

  it("with empty districtLeaids shows 'pick a district to add' and no add button", () => {
    render(
      <Harness
        event={makeEvent({
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
          suggestedContacts: [],
          suggestedContactIds: [],
          attendees: [
            {
              email: "casey@marion.k12.in.us",
              name: "Casey Rivera",
              responseStatus: "accepted",
            },
          ],
        })}
      />
    );
    expect(screen.getByText(/pick a district to add/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add to contacts/i })
    ).not.toBeInTheDocument();
  });

  it("adds a district chip when one is selected from the search", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent({
          suggestedDistrictId: null,
          suggestedDistrictName: null,
          suggestedDistrictState: null,
        })}
        onConfirm={onConfirm}
      />
    );

    // No chip yet
    expect(screen.queryByText("Boise ISD (ID)")).not.toBeInTheDocument();

    // Select a district via the (mocked) search input
    const search = screen.getByPlaceholderText(/search districts/i);
    await user.type(search, "{Enter}");

    // Chip appears with the formatted label
    expect(screen.getByText("Boise ISD (ID)")).toBeInTheDocument();

    // And it threads into the confirm payload
    await user.click(screen.getByRole("button", { name: /save & next/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ districtLeaids: ["9999999"] })
    );
  });

  // ---- decisionStatus badge tests ----

  it("shows 'Already saved' badge and disables Save when decisionStatus=confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent()}
        onConfirm={onConfirm}
        decisionStatus="confirmed"
      />
    );

    const badge = screen.getByTestId("backfill-decision-status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/already saved/i);

    const saveBtn = screen.getByRole("button", { name: /save & next/i });
    expect(saveBtn).toBeDisabled();

    // Clicking the disabled Save should not call onConfirm
    await user.click(saveBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows skipped badge but Save is enabled when decisionStatus=skipped", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness
        event={makeEvent()}
        onConfirm={onConfirm}
        decisionStatus="skipped"
      />
    );

    const badge = screen.getByTestId("backfill-decision-status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/skipped — you can still save/i);

    const saveBtn = screen.getByRole("button", { name: /save & next/i });
    expect(saveBtn).not.toBeDisabled();

    await user.click(saveBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders no badge when decisionStatus is not provided", () => {
    render(<Harness event={makeEvent()} />);
    expect(
      screen.queryByTestId("backfill-decision-status")
    ).not.toBeInTheDocument();
  });
});
