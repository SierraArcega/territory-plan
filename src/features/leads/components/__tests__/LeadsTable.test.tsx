import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LeadsTable from "../LeadsTable";
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

describe("LeadsTable header sort", () => {
  it("sets a clicked header as the sole sort with the column's default direction", () => {
    const onSortsChange = vi.fn();
    render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[]}
        onSortsChange={onSortsChange}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByText("Score"));
    expect(onSortsChange).toHaveBeenCalledWith([{ key: "score", dir: "desc" }]);
    fireEvent.click(screen.getByText("District"));
    expect(onSortsChange).toHaveBeenLastCalledWith([{ key: "org", dir: "asc" }]);
  });

  it("toggles direction when the clicked header is already the primary sort", () => {
    const onSortsChange = vi.fn();
    render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[{ key: "score", dir: "desc" }]}
        onSortsChange={onSortsChange}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByText("Score"));
    expect(onSortsChange).toHaveBeenCalledWith([{ key: "score", dir: "asc" }]);
  });

  it("replaces a multi-column toolbar sort with the sole header sort", () => {
    const onSortsChange = vi.fn();
    render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[
          { key: "status", dir: "asc" },
          { key: "score", dir: "desc" },
        ]}
        onSortsChange={onSortsChange}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByText("Created"));
    expect(onSortsChange).toHaveBeenCalledWith([{ key: "created", dir: "desc" }]);
  });

  it("marks the active header with aria-sort", () => {
    render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[{ key: "name", dir: "asc" }]}
        onSortsChange={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getByText("Lead").closest("th")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
});

describe("LeadsTable rows", () => {
  it("selects a lead on row click", () => {
    const onSelectLead = vi.fn();
    render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={onSelectLead}
        sorts={[]}
        onSortsChange={() => {}}
        now={NOW}
      />,
    );
    fireEvent.click(screen.getByText("Karen Whitfield"));
    expect(onSelectLead).toHaveBeenCalledTimes(1);
    expect(onSelectLead.mock.calls[0][0].id).toBe("l1");
  });

  it("shows an inline SLA badge under the status for New leads only", () => {
    render(
      <LeadsTable
        leads={[
          makeLead(),
          makeLead({ id: "l2", status: "working" }),
        ]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[]}
        onSortsChange={() => {}}
        now={NOW}
      />,
    );
    expect(screen.getAllByTitle("Acceptance SLA · 2 business days")).toHaveLength(1);
  });

  it("renders You for the current user's leads and an empty state when no rows", () => {
    const { rerender } = render(
      <LeadsTable
        leads={[makeLead()]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[]}
        onSortsChange={() => {}}
        currentUserId="u1"
        now={NOW}
      />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
    rerender(
      <LeadsTable
        leads={[]}
        selectedId={null}
        onSelectLead={() => {}}
        sorts={[]}
        onSortsChange={() => {}}
        currentUserId="u1"
        now={NOW}
      />,
    );
    expect(screen.getByText("No leads match these filters.")).toBeInTheDocument();
  });
});
