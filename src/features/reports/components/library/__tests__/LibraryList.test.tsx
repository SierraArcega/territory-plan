import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { LibraryList } from "../LibraryList";
import type { ReportListItem } from "../../../lib/queries";

function row(id: number, title: string): ReportListItem {
  return {
    id,
    title,
    description: null,
    question: `q${id}`,
    lastRunAt: null,
    runCount: 0,
    rowCount: null,
    isTeamPinned: false,
    updatedAt: new Date().toISOString(),
    owner: null,
  };
}

describe("LibraryList", () => {
  it("filters by title (case-insensitive substring)", () => {
    const rows = [row(1, "Texas open opps"), row(2, "California pipeline"), row(3, "Texas wins")];
    render(
      <LibraryList
        rows={rows}
        kind="mine"
        searchQuery="texas"
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
        onNewReport={() => {}}
      />,
    );
    expect(screen.getByText("Texas open opps")).toBeInTheDocument();
    expect(screen.getByText("Texas wins")).toBeInTheDocument();
    expect(screen.queryByText("California pipeline")).not.toBeInTheDocument();
  });

  it("renders empty state when filter has no matches", () => {
    render(
      <LibraryList
        rows={[row(1, "Texas")]}
        kind="mine"
        searchQuery="xxx"
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
        onNewReport={() => {}}
      />,
    );
    expect(screen.getByText(/no saved reports yet/i)).toBeInTheDocument();
  });

  it("paginates at 50 rows and reveals more on Show more click", () => {
    const rows = Array.from({ length: 73 }).map((_, i) => row(i + 1, `Report ${i + 1}`));
    render(
      <LibraryList
        rows={rows}
        kind="mine"
        searchQuery=""
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
        onNewReport={() => {}}
      />,
    );
    expect(screen.getByText("Report 50")).toBeInTheDocument();
    expect(screen.queryByText("Report 51")).not.toBeInTheDocument();
    const showMore = screen.getByRole("button", { name: /show 23 more/i });
    fireEvent.click(showMore);
    expect(screen.getByText("Report 73")).toBeInTheDocument();
  });

  it("shows the filter-hint banner when total > 200", () => {
    const rows = Array.from({ length: 250 }).map((_, i) => row(i + 1, `Report ${i + 1}`));
    render(
      <LibraryList
        rows={rows}
        kind="team"
        searchQuery=""
        isAdmin={false}
        onOpen={() => {}}
        onToggleStar={() => {}}
        onNewReport={() => {}}
      />,
    );
    expect(screen.getByText(/250 reports match/i)).toBeInTheDocument();
  });
});
