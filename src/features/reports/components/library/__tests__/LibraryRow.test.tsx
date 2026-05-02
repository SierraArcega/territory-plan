import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { LibraryRow } from "../LibraryRow";
import type { ReportListItem } from "../../../lib/queries";

const baseReport: ReportListItem = {
  id: 42,
  title: "Texas open opps stuck > 90 days",
  description: null,
  question: "Show me Texas opps stuck > 90 days",
  lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  runCount: 3,
  rowCount: 9,
  isTeamPinned: false,
  updatedAt: new Date().toISOString(),
  owner: null,
};

describe("LibraryRow", () => {
  it("renders title, question, and rowCount", () => {
    render(
      <LibraryRow
        report={baseReport}
        showOwner={false}
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
      />,
    );
    expect(screen.getByText("Texas open opps stuck > 90 days")).toBeInTheDocument();
    expect(screen.getByText(/Show me Texas opps stuck/)).toBeInTheDocument();
    expect(screen.getByText(/9 rows/)).toBeInTheDocument();
  });

  it("calls onOpen with the report id when the row is clicked", () => {
    const onOpen = vi.fn();
    render(
      <LibraryRow
        report={baseReport}
        showOwner={false}
        isAdmin={false}
        onOpen={onOpen}
        onToggleStar={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Texas open opps stuck > 90 days"));
    expect(onOpen).toHaveBeenCalledWith(42);
  });

  it("shows owner avatar + name only when showOwner is true", () => {
    const withOwner: ReportListItem = {
      ...baseReport,
      owner: { id: "u1", fullName: "Maddie Park", avatarUrl: null },
    };
    const { rerender } = render(
      <LibraryRow
        report={withOwner}
        showOwner={false}
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
      />,
    );
    expect(screen.queryByText("Maddie Park")).not.toBeInTheDocument();

    rerender(
      <LibraryRow
        report={withOwner}
        showOwner
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
      />,
    );
    expect(screen.getByText("Maddie Park")).toBeInTheDocument();
    expect(screen.getByText("MP")).toBeInTheDocument();
  });

  it("admins see a star button that toggles via onToggleStar (without opening the row)", () => {
    const onOpen = vi.fn();
    const onToggleStar = vi.fn();
    render(
      <LibraryRow
        report={baseReport}
        showOwner={false}
        isAdmin
        onOpen={onOpen}
        onToggleStar={onToggleStar}
      />,
    );
    fireEvent.click(screen.getByLabelText(/star report/i));
    expect(onToggleStar).toHaveBeenCalledWith(42, true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("non-admins still see a filled star indicator when isTeamPinned, but no toggle button", () => {
    const pinned: ReportListItem = { ...baseReport, isTeamPinned: true };
    render(
      <LibraryRow
        report={pinned}
        showOwner={false}
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/star report/i)).not.toBeInTheDocument();
  });
});
