import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OutcomePanel from "../OutcomePanel";
import type { Activity } from "@/features/shared/types/api-types";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    type: "discovery_call",
    category: "meetings",
    title: "Test activity",
    notes: null,
    startDate: "2026-04-27T15:00:00.000Z",
    endDate: "2026-04-27T16:00:00.000Z",
    status: "completed",
    createdByUserId: "user-1",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    googleEventId: null,
    source: "manual",
    outcome: null,
    outcomeType: null,
    sentiment: null,
    nextStep: null,
    followUpDate: null,
    dealImpact: "none",
    outcomeDisposition: null,
    metadata: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    plans: [],
    districts: [],
    contacts: [],
    states: [],
    expenses: [],
    attendees: [],
    relatedActivities: [],
    ...overrides,
  };
}

describe("OutcomePanel", () => {
  it("clicking the Completed card calls onPatch with outcomeDisposition: 'completed'", () => {
    const onPatch = vi.fn();
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={onPatch} />);
    fireEvent.click(screen.getByRole("button", { name: /^completed/i }));
    expect(onPatch).toHaveBeenCalledWith({ outcomeDisposition: "completed" });
  });

  it("clicking sentiment Positive calls onPatch with sentiment: 'positive'", () => {
    const onPatch = vi.fn();
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={onPatch} />);
    fireEvent.click(screen.getByRole("button", { name: /^positive/i }));
    expect(onPatch).toHaveBeenCalledWith({ sentiment: "positive" });
  });

  it("renders the deal-impact select with the current value", () => {
    render(
      <OutcomePanel
        activity={makeActivity({ dealImpact: "won" })}
        readOnly={false}
        onPatch={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /deal impact/i })).toHaveTextContent("Won");
  });

  it("disables outcome cards when readOnly", () => {
    render(<OutcomePanel activity={makeActivity()} readOnly onPatch={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^completed/i })).toBeDisabled();
  });

  it("does not render the deprecated OutcomesTab content", () => {
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={vi.fn()} />);
    // The legacy OutcomesTab rendered "outcome captured" / type-specific copy.
    // The new panel never emits those literals.
    expect(screen.queryByText(/outcome captured/i)).not.toBeInTheDocument();
  });
});
