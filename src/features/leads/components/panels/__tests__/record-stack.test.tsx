// Record-panel navigation stack — integration through LeadsView: opening
// records from the lead panel pushes levels, Esc pops ONE level at a time
// (and only closes the lead panel once the stack is empty), and the lead
// breadcrumb jumps back to the pipeline.

import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import type { Lead, LeadsResponse } from "@/features/leads/lib/types";

const useLeadsQueryMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLeadsQuery: () => useLeadsQueryMock(),
    useUpdateLeadMutation: () => ({ mutate: vi.fn() }),
    useLeadTimelineQuery: () => ({
      data: { items: [] },
      isLoading: false,
      isError: false,
    }),
    useContactRecordQuery: () => ({
      data: {
        contact: {
          id: 11,
          name: "Karen Whitfield",
          title: "Director of Special Education",
          email: "k@mesa.org",
          phone: null,
        },
        school: null,
        district: {
          leaid: "0802940",
          name: "Mesa Valley USD 51",
          city: "Grand Junction",
          stateAbbrev: "CO",
        },
        lead: {
          id: "abc",
          status: "new",
          score: 120,
          leadType: "mql",
          unqualifiedReason: null,
        },
        stats: { activities: 2, points: 120 },
        items: [],
      },
      isLoading: false,
      isError: false,
    }),
    useDistrictRecordQuery: () => ({
      data: {
        district: {
          leaid: "0802940",
          name: "Mesa Valley USD 51",
          city: "Grand Junction",
          stateAbbrev: "CO",
        },
        stats: { schools: 0, contacts: 1, leads: 1, points: 120 },
        schools: [],
        contacts: [],
        leads: [],
        items: [],
      },
      isLoading: false,
      isError: false,
    }),
    useSchoolRecordQuery: () => ({ data: undefined, isLoading: true, isError: false }),
  };
});

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "u1", fullName: "Alex Rivera" } }),
  useUsers: () => ({
    data: [
      { id: "u1", fullName: "Alex Rivera", avatarUrl: null, email: "a@x.com", jobTitle: null },
    ],
    isLoading: false,
  }),
}));

import LeadsView from "../../LeadsView";

function makeLead(): Lead {
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
      id: 11,
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
  };
}

beforeEach(() => {
  cleanup();
  window.location.hash = "#lead=abc";
  const data: LeadsResponse = { leads: [makeLead()], total: 1 };
  useLeadsQueryMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

const leadPanel = () => screen.queryByRole("dialog", { name: "Lead: Karen Whitfield" });
const contactPanel = () =>
  screen.queryByRole("dialog", { name: "Contact record: Karen Whitfield" });
const districtPanel = () =>
  screen.queryByRole("dialog", { name: "District record: Mesa Valley USD 51" });

function renderView() {
  return render(
    <ToastProvider>
      <LeadsView />
    </ToastProvider>,
  );
}

describe("record stack push/pop", () => {
  it("pushes Contact then District; Esc pops one level at a time", () => {
    renderView();
    expect(leadPanel()).toBeInTheDocument();

    // Push: lead → contact record.
    fireEvent.click(screen.getByRole("button", { name: /Contact record/ }));
    expect(contactPanel()).toBeInTheDocument();

    // Push: contact → district record (the "Works at" district row).
    fireEvent.click(
      within(contactPanel()!).getByRole("button", { name: /Mesa Valley USD 51/ }),
    );
    expect(districtPanel()).toBeInTheDocument();
    expect(contactPanel()).not.toBeInTheDocument(); // only the top is mounted

    // Esc pops ONE level: district → contact. The lead panel stays hidden
    // while a record is open (drill-in replaces it, no visual stacking).
    fireEvent.keyDown(window, { key: "Escape" });
    expect(districtPanel()).not.toBeInTheDocument();
    expect(contactPanel()).toBeInTheDocument();
    expect(leadPanel()).not.toBeInTheDocument();

    // Esc again: contact → lead panel only.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(contactPanel()).not.toBeInTheDocument();
    expect(leadPanel()).toBeInTheDocument();

    // Stack empty → Esc closes the lead panel.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(leadPanel()).not.toBeInTheDocument();
  });

  it("renders the visited breadcrumb path and jumps via the lead crumb", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Contact record/ }));
    fireEvent.click(
      within(contactPanel()!).getByRole("button", { name: /Mesa Valley USD 51/ }),
    );

    // Trail on the district panel: Lead › Contact › District (current).
    const nav = within(districtPanel()!).getByRole("navigation", {
      name: "Record trail",
    });
    const crumbButtons = within(nav).getAllByRole("button");
    expect(crumbButtons).toHaveLength(2); // lead + contact levels
    const current = within(nav).getByText("Mesa Valley USD 51");
    expect(current).toHaveAttribute("aria-current", "location");

    // The lead crumb clears the record stack — back to the pipeline panel.
    fireEvent.click(crumbButtons[0]);
    expect(districtPanel()).not.toBeInTheDocument();
    expect(contactPanel()).not.toBeInTheDocument();
    expect(leadPanel()).toBeInTheDocument();
  });

  it("the contact panel's lead row jumps back to the lead and clears the stack", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Contact record/ }));
    fireEvent.click(within(contactPanel()!).getByRole("button", { name: /^Lead/ }));
    expect(contactPanel()).not.toBeInTheDocument();
    expect(leadPanel()).toBeInTheDocument();
  });
});
