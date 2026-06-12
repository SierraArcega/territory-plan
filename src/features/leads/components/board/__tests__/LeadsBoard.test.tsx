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
    meetingAt: null,
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
  it("includes the New column first and labels the current user's row You", () => {
    const leads = [
      makeLead({ id: "l3", status: "working" }),
      makeLead({
        id: "l4",
        status: "working",
        assignedBdr: { id: "u2", fullName: "Priya Shah", avatarUrl: null },
      }),
      makeLead({ id: "l5", status: "new" }),
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
    // All pipeline stages render, New first — new leads must be visible here too
    const stageHeaders = ["New", "Working", "Meeting Scheduled"];
    for (const label of stageHeaders) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const headerRow = screen.getAllByText(/New|Working/).map((el) => el.textContent);
    expect(headerRow.indexOf("New")).toBeLessThan(headerRow.indexOf("Working"));
    // The new-status lead renders in the grid
    expect(
      screen.getAllByRole("button", { name: "Open lead: Karen Whitfield" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("LeadsBoard swimlane cell pager", () => {
  it("swimlane cells show one card at a time with a count and prev/next pager", () => {
    const leads = Array.from({ length: 55 }, (_, i) =>
      makeLead({
        id: `lw${i}`,
        status: "working",
        contact: {
          id: i,
          name: `Lead Person ${i}`,
          title: null,
          email: null,
          phone: null,
        },
      }),
    );
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
    // One card visible, pager shows position + total
    expect(screen.getAllByRole("button", { name: /Open lead/ })).toHaveLength(1);
    expect(screen.getByText("Lead Person 0")).toBeInTheDocument();
    expect(screen.getByText("1 of 55")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous lead" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next lead" }));
    expect(screen.getByText("Lead Person 1")).toBeInTheDocument();
    expect(screen.getByText("2 of 55")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous lead" })).toBeEnabled();
  });

  it("swimlane cells with a single lead render no pager chrome", () => {
    render(
      <LeadsBoard
        leads={[makeLead({ id: "solo", status: "working" })]}
        layout="swimlanes"
        selectedId={null}
        onSelectLead={() => {}}
        onMove={() => {}}
        currentUserId="u1"
        now={NOW}
      />,
    );
    expect(screen.getAllByRole("button", { name: /Open lead/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Next lead" })).not.toBeInTheDocument();
    expect(screen.queryByText(/of 1/)).not.toBeInTheDocument();
  });
});
