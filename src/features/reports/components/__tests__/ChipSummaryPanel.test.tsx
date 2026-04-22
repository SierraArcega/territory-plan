import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ChipSummaryPanel } from "../ChipSummaryPanel";
import type { QuerySummary } from "../../lib/agent/types";

const summary: QuerySummary = {
  source: "Districts with closed-won contracts",
  filters: [
    { id: "f1", label: "State", value: "Texas" },
    { id: "f2", label: "Won in", value: "FY26" },
  ],
  columns: [
    { id: "c1", label: "District name" },
    { id: "c2", label: "Bookings" },
  ],
  sort: { column: "Bookings", direction: "desc" },
  limit: 500,
};

describe("ChipSummaryPanel", () => {
  it("renders source, filters, columns, sort, limit", () => {
    render(<ChipSummaryPanel summary={summary} onEdit={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(/Districts with closed-won contracts/)).toBeInTheDocument();
    expect(screen.getByText(/State/)).toBeInTheDocument();
    expect(screen.getByText(/Texas/)).toBeInTheDocument();
    expect(screen.getByText(/District name/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it("never renders the word SQL", () => {
    const { container } = render(
      <ChipSummaryPanel summary={summary} onEdit={vi.fn()} onSave={vi.fn()} />,
    );
    expect(container.textContent?.toLowerCase()).not.toContain("sql");
  });

  it("calls onEdit with remove_filter when a filter chip's × is clicked", () => {
    const onEdit = vi.fn();
    render(<ChipSummaryPanel summary={summary} onEdit={onEdit} onSave={vi.fn()} />);
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]!);
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "remove_filter" }),
    );
  });
});
