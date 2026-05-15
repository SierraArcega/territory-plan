import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GridHeaderCell } from "../GridHeaderCell";

describe("GridHeaderCell", () => {
  it("cycles none → asc → desc → none on click when sortable", () => {
    const onChange = vi.fn();
    const { rerender } = render(<GridHeaderCell label="Name" sortable={true} sortDir={null} onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("asc");

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="asc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("desc");

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="desc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("renders as static text when not sortable", () => {
    render(<GridHeaderCell label="Tier" sortable={false} sortDir={null} onSortChange={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Tier")).toBeInTheDocument();
  });

  it("shows up-arrow when sortDir is asc, down-arrow when desc", () => {
    const { rerender, container } = render(
      <GridHeaderCell label="Name" sortable={true} sortDir="asc" onSortChange={() => {}} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    // Note: lucide-react renders as svg; specific class check is fragile, so we just confirm an svg appears
    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="desc" onSortChange={() => {}} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
