import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import type { Lead } from "@/features/leads/lib/types";

const mutateMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useUpdateLeadMutation: () => ({ mutate: mutateMock }),
    useLeadTimelineQuery: () => ({
      data: { items: [] },
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock("@/features/shared/lib/queries", () => ({
  useUsers: () => ({
    data: [
      { id: "u1", fullName: "Alex Rivera", avatarUrl: null, email: "alex@x.com", jobTitle: null },
      { id: "u2", fullName: "Sam Ortiz", avatarUrl: null, email: "sam@x.com", jobTitle: null },
    ],
    isLoading: false,
  }),
}));

import LeadDetailPanel from "../LeadDetailPanel";

const NOW = new Date("2026-06-02T10:30:00");

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    status: "new",
    score: 120,
    leadType: "mql",
    sequence: "Superintendent — Special Ed",
    marketingOwner: "Dana Whitman",
    unqualifiedReason: null,
    meetingAt: null,
    assignedAt: new Date("2026-06-01T10:00:00").toISOString(),
    acceptedAt: null,
    createdAt: new Date("2026-05-22T09:00:00").toISOString(),
    updatedAt: new Date("2026-06-01T09:00:00").toISOString(),
    contact: {
      id: 11,
      name: "Karen Whitfield",
      title: "Director of Special Education",
      email: "kwhitfield@mesa.org",
      phone: "(970) 555-0142",
    },
    school: null,
    district: {
      leaid: "0802940",
      name: "Mesa Valley USD 51",
      city: "Grand Junction",
      stateAbbrev: "CO",
    },
    assignedBdr: { id: "u1", fullName: "Alex Rivera", avatarUrl: null },
    opportunity: null,
    ...overrides,
  };
}

function renderPanel(lead: Lead, props: Partial<Parameters<typeof LeadDetailPanel>[0]> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onOpenRecord: vi.fn(),
    onLogOutcome: vi.fn(),
    onDisqualify: vi.fn(),
    onLinkOpportunity: vi.fn(),
    onScheduleMeeting: vi.fn(),
  };
  render(
    <ToastProvider>
      <LeadDetailPanel
        lead={lead}
        currentUserId="u1"
        now={NOW}
        {...handlers}
        {...props}
      />
    </ToastProvider>,
  );
  return handlers;
}

beforeEach(() => {
  cleanup();
  mutateMock.mockReset();
});

describe("LeadDetailPanel action zone per status", () => {
  it("new → SLA banner + coral Accept; Accept fires the working PATCH", () => {
    renderPanel(makeLead());
    expect(screen.getByTestId("action-zone")).toHaveTextContent("Awaiting acceptance");
    const accept = screen.getByRole("button", { name: /Accept & start working/ });
    fireEvent.click(accept);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({ id: "lead-1", status: "working" });
    // Disqualify affordance is present for new leads.
    expect(screen.getByRole("button", { name: /Disqualify lead/ })).toBeInTheDocument();
  });

  it("working → Log activity & outcome + Schedule meeting / Link opportunity slots", () => {
    const handlers = renderPanel(makeLead({ status: "working" }));
    expect(screen.getByTestId("action-zone")).toHaveTextContent("Log engagement outcome");
    fireEvent.click(screen.getByRole("button", { name: /Log activity & outcome/ }));
    expect(handlers.onLogOutcome).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Schedule meeting/ }));
    expect(handlers.onScheduleMeeting).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Link opportunity/ }));
    expect(handlers.onLinkOpportunity).toHaveBeenCalledTimes(1);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("meeting_scheduled without an opp → Opportunity required gate", () => {
    const handlers = renderPanel(makeLead({ status: "meeting_scheduled" }));
    expect(screen.getByTestId("action-zone")).toHaveTextContent("Opportunity required");
    fireEvent.click(screen.getByRole("button", { name: /Link opportunity/ }));
    expect(handlers.onLinkOpportunity).toHaveBeenCalledTimes(1);
  });

  it("meeting_scheduled with an opp → meeting date + Sales-qualify PATCH", () => {
    renderPanel(
      makeLead({
        status: "meeting_scheduled",
        meetingAt: new Date("2026-06-04T14:00:00").toISOString(),
        opportunity: {
          id: "opp-1",
          name: "Mesa Valley USD 51 — Lead Pipeline",
          stage: "0 - Meeting Booked",
          amount: 75000,
          closeDate: null,
        },
      }),
    );
    const zone = screen.getByTestId("action-zone");
    expect(zone).toHaveTextContent("Meeting scheduled");
    expect(zone).toHaveTextContent("Jun 4");
    fireEvent.click(screen.getByRole("button", { name: /Mark Sales Qualified/ }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({
      id: "lead-1",
      status: "sales_qualified",
    });
  });

  it("sales_qualified → terminal banner, no disqualify affordance", () => {
    renderPanel(
      makeLead({
        status: "sales_qualified",
        opportunity: {
          id: "opp-1",
          name: "Mesa Valley USD 51 — Lead Pipeline",
          stage: "1 - Discovery",
          amount: 75000,
          closeDate: null,
        },
      }),
    );
    expect(screen.getByTestId("action-zone")).toHaveTextContent(
      "Sales Qualified Lead · Jun 1 · opportunity in the sales pipeline",
    );
    expect(
      screen.queryByRole("button", { name: /Disqualify lead/ }),
    ).not.toBeInTheDocument();
  });

  it("unqualified → terminal banner naming the reason", () => {
    renderPanel(makeLead({ status: "unqualified", unqualifiedReason: "No Response" }));
    const zone = screen.getByTestId("action-zone");
    expect(zone).toHaveTextContent("Unqualified");
    expect(zone).toHaveTextContent("No Response");
    expect(
      screen.queryByRole("button", { name: /Disqualify lead/ }),
    ).not.toBeInTheDocument();
  });
});

describe("LeadDetailPanel chrome & records", () => {
  it("Esc closes the panel — unless a record panel is stacked above", () => {
    const handlers = renderPanel(makeLead());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

    cleanup();
    const stacked = renderPanel(makeLead(), { escDisabled: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(stacked.onClose).not.toHaveBeenCalled();
  });

  it("opens the Contact / District record slots with push refs", () => {
    const handlers = renderPanel(makeLead());
    fireEvent.click(screen.getByRole("button", { name: /Contact record/ }));
    expect(handlers.onOpenRecord).toHaveBeenCalledWith({
      type: "contact",
      id: 11,
      label: "Karen Whitfield",
    });
    fireEvent.click(screen.getByRole("button", { name: "Mesa Valley USD 51" }));
    expect(handlers.onOpenRecord).toHaveBeenCalledWith({
      type: "district",
      id: "0802940",
      label: "Mesa Valley USD 51",
    });
    // No school on this contact → "District office" caption, no school row.
    expect(screen.getByText("District office")).toBeInTheDocument();
  });

  it("shows the School row only when the contact works at a school", () => {
    const handlers = renderPanel(
      makeLead({ school: { ncessch: "080294000001", name: "Mesa Ridge HS" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mesa Ridge HS" }));
    expect(handlers.onOpenRecord).toHaveBeenCalledWith({
      type: "school",
      id: "080294000001",
      label: "Mesa Ridge HS",
    });
    expect(screen.queryByText("District office")).not.toBeInTheDocument();
  });
});
