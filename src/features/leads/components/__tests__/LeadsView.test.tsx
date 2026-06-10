import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import type { Lead, LeadsResponse } from "@/features/leads/lib/types";

const useLeadsQueryMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLeadsQuery: (scope: string) => useLeadsQueryMock(scope),
    useUpdateLeadMutation: () => ({ mutate: mutateMock }),
    useLeadTimelineQuery: () => ({ data: { items: [] }, isLoading: false, isError: false }),
    useContactRecordQuery: () => ({ data: undefined, isLoading: true, isError: false }),
    useSchoolRecordQuery: () => ({ data: undefined, isLoading: true, isError: false }),
    useDistrictRecordQuery: () => ({ data: undefined, isLoading: true, isError: false }),
  };
});

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "u1", fullName: "Alex Rivera" } }),
  useUsers: () => ({
    data: [{ id: "u1", fullName: "Alex Rivera", avatarUrl: null, email: "a@x.com", jobTitle: null }],
    isLoading: false,
  }),
}));

import LeadsView from "../LeadsView";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "abc",
    status: "new",
    score: 120,
    leadType: "mql",
    sequence: null,
    marketingOwner: null,
    unqualifiedReason: null,
    meetingAt: null,
    assignedAt: new Date().toISOString(),
    acceptedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contact: {
      id: 1,
      name: "Karen Whitfield",
      title: "Director of Special Education",
      email: null,
      phone: null,
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

function setLeads(leads: Lead[]) {
  const data: LeadsResponse = { leads, total: leads.length };
  useLeadsQueryMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

function renderView() {
  return render(
    <ToastProvider>
      <LeadsView />
    </ToastProvider>,
  );
}

beforeEach(() => {
  cleanup();
  window.location.hash = "";
  history.replaceState(null, "", window.location.pathname);
  setLeads([makeLead()]);
});

describe("LeadsView scope", () => {
  it("defaults the scope to My leads (current user)", () => {
    renderView();
    expect(useLeadsQueryMock).toHaveBeenCalledWith("mine");
    expect(screen.getByRole("button", { name: "My leads" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches the query scope when Team is selected", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(useLeadsQueryMock).toHaveBeenLastCalledWith("team");
  });
});

describe("LeadsView deep link", () => {
  it("restores the selected lead from #lead=<id> on load", () => {
    window.location.hash = "#lead=abc";
    renderView();
    const card = screen.getByRole("button", { name: "Open lead: Karen Whitfield" });
    expect(card.className).toContain("border-[#F37167]");
  });

  it("writes the hash when a lead is selected", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", { name: "Open lead: Karen Whitfield" }),
    );
    expect(window.location.hash).toBe("#lead=abc");
  });
});

describe("LeadsView drag-to-restage", () => {
  it("sends an optimistic status PATCH when a card is dropped on another column", () => {
    renderView();
    fireEvent.drop(screen.getByTestId("board-column-working"), {
      dataTransfer: { getData: () => "abc" },
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock.mock.calls[0][0]).toEqual({ id: "abc", status: "working" });
  });

  it("ignores drops onto the lead's current column", () => {
    renderView();
    fireEvent.drop(screen.getByTestId("board-column-new"), {
      dataTransfer: { getData: () => "abc" },
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

describe("LeadsView filtered-to-zero state", () => {
  it("shows the No-leads-match state and recovers via Clear filters", () => {
    renderView();
    fireEvent.change(screen.getByLabelText("Search leads"), {
      target: { value: "zzz-no-such-lead" },
    });
    expect(screen.getByText("No leads match")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open lead: Karen Whitfield" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.queryByText("No leads match")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open lead: Karen Whitfield" }),
    ).toBeInTheDocument();
  });
});

describe("LeadsView stat strip", () => {
  it("derives counts from the active scope's leads", () => {
    setLeads([
      makeLead(),
      makeLead({ id: "l2", status: "working" }),
      makeLead({ id: "l3", status: "sales_qualified" }),
    ]);
    renderView();
    // Stat tiles render (labels also appear as board column headers, so
    // assert on the tile-only labels and the values rendered next to them).
    const newTile = screen.getByText("New · awaiting acceptance");
    expect(newTile).toBeInTheDocument();
    expect(newTile.previousElementSibling).toHaveTextContent("1");
    const meetingsTile = screen.getByText("Meetings set");
    expect(meetingsTile.previousElementSibling).toHaveTextContent("0");
    // "Sales Qualified" also appears in the SQL card footer — scope to tiles.
    const sqlTile = screen
      .getAllByText("Sales Qualified")
      .find((el) => el.previousElementSibling != null)!;
    expect(sqlTile.previousElementSibling).toHaveTextContent("1");
  });
});
