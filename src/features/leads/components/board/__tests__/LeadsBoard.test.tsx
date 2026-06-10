import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LeadsBoard from "../LeadsBoard";
import type { Lead } from "@/features/leads/lib/types";

const NOW = new Date("2026-06-02T10:30:00");

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    status: "new",
    score: 120,
    leadType: "mql",
    sequence: null,
    marketingOwner: null,
    unqualifiedReason: null,
    assignedAt: new Date("2026-06-02T03:30:00").toISOString(),
    acceptedAt: null,
    createdAt: new Date("2026-05-22T09:00:00").toISOString(),
    updatedAt: new Date("2026-06-01T09:00:00").toISOString(),
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

describe("LeadsBoard (columns)", () => {
  it("fires onMove with the dropped lead id and the target column status", () => {
    const onMove = vi.fn();
    render(
      <LeadsBoard
        leads={[makeLead()]}
        layout="columns"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={onMove}
        now={NOW}
      />,
    );
    const workingColumn = screen.getByTestId("board-column-working");
    fireEvent.drop(workingColumn, {
      dataTransfer: { getData: () => "l1" },
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("l1", "working");
  });

  it("shows the overdue alert pill on the New column when a lead is past SLA", () => {
    // Assigned Thu May 28 → due Mon Jun 1 → overdue at NOW (Tue Jun 2).
    const overdueLead = makeLead({
      id: "l2",
      assignedAt: new Date("2026-05-28T11:00:00").toISOString(),
    });
    render(
      <LeadsBoard
        leads={[makeLead(), overdueLead]}
        layout="columns"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText("1 overdue")).toBeInTheDocument();
  });

  it("hides the overdue pill when nothing is overdue", () => {
    render(
      <LeadsBoard
        leads={[makeLead()]}
        layout="columns"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={() => {}}
        now={NOW}
      />,
    );
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  it("opens a lead on card click", () => {
    const onSelectLead = vi.fn();
    render(
      <LeadsBoard
        leads={[makeLead()]}
        layout="columns"
        selectedId={null}
        onSelectLead={onSelectLead}
        onMove={() => {}}
        now={NOW}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open lead: Karen Whitfield" }),
    );
    expect(onSelectLead).toHaveBeenCalledTimes(1);
    expect(onSelectLead.mock.calls[0][0].id).toBe("l1");
  });
});

describe("LeadsBoard (swimlanes)", () => {
  it("excludes the New column and labels the current user's row You", () => {
    const leads = [
      makeLead({ id: "l3", status: "working" }),
      makeLead({
        id: "l4",
        status: "working",
        assignedBdr: { id: "u2", fullName: "Priya Shah", avatarUrl: null },
      }),
    ];
    render(
      <LeadsBoard
        leads={leads}
        layout="swimlanes"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={() => {}}
        currentUserId="u1"
        now={NOW}
      />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Priya")).toBeInTheDocument();
    // Stage header "New" must not render in swimlanes
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.getAllByText("Working").length).toBeGreaterThan(0);
  });
});

describe("LeadsBoard (grouped)", () => {
  it("renders every stage group with counts and footer signals", () => {
    const leads = [
      makeLead(),
      makeLead({
        id: "l5",
        status: "unqualified",
        unqualifiedReason: "No Response",
      }),
    ];
    render(
      <LeadsBoard
        leads={leads}
        layout="grouped"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Unqualified")).toBeInTheDocument();
    // Empty stage groups show "None"
    expect(screen.getAllByText("None").length).toBe(3);
  });
});
