import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/activities/lib/queries", () => ({
  useOpportunitySearch: vi.fn(),
}));

import { useOpportunitySearch } from "@/features/activities/lib/queries";
import OutcomePanel from "../OutcomePanel";
import type { Activity } from "@/features/shared/types/api-types";

beforeEach(() => {
  vi.clearAllMocks();
  (useOpportunitySearch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: [],
    isLoading: false,
  });
});

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
    createdByUser: null,
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
    address: null,
    addressLat: null,
    addressLng: null,
    inPerson: null,
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
    opportunities: [],
    rating: null,
    ...overrides,
  };
}

describe("OutcomePanel", () => {
  it("clicking a star calls onPatch with the rating", () => {
    const onPatch = vi.fn();
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={onPatch} />);
    fireEvent.click(screen.getByRole("radio", { name: /rate 4 stars/i }));
    expect(onPatch).toHaveBeenCalledWith({ rating: 4 });
  });

  it("clicking an outcome pill calls onPatch with outcomeType", () => {
    const onPatch = vi.fn();
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={onPatch} />);
    // meetings category => "Moved Forward" (positive_progress)
    fireEvent.click(screen.getByRole("button", { name: /moved forward/i }));
    expect(onPatch).toHaveBeenCalledWith({ outcomeType: "positive_progress" });
  });

  it("clicking the active outcome pill clears it (toggle off)", () => {
    const onPatch = vi.fn();
    render(
      <OutcomePanel
        activity={makeActivity({ outcomeType: "positive_progress" })}
        readOnly={false}
        onPatch={onPatch}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /moved forward/i }));
    expect(onPatch).toHaveBeenCalledWith({ outcomeType: null });
  });

  it("disables outcome pills when readOnly", () => {
    render(<OutcomePanel activity={makeActivity()} readOnly onPatch={vi.fn()} />);
    expect(screen.getByRole("button", { name: /moved forward/i })).toBeDisabled();
  });

  it("renders the linked deals section", () => {
    render(<OutcomePanel activity={makeActivity()} readOnly={false} onPatch={vi.fn()} />);
    expect(screen.getByText(/linked deals/i)).toBeInTheDocument();
  });
});
