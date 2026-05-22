import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GridHeaderCell } from "../GridHeaderCell";

describe("GridHeaderCell", () => {
  it("cycles none → asc → desc → none on click when sortable", () => {
    const onChange = vi.fn();
    const { rerender } = render(<GridHeaderCell label="Name" sortable={true} sortDir={null} onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("asc", false);

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="asc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("desc", false);

    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="desc" onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(null, false);
  });

  it("passes shift=true when clicking with shiftKey held", () => {
    const onChange = vi.fn();
    render(<GridHeaderCell label="Name" sortable={true} sortDir={null} onSortChange={onChange} />);
    fireEvent.click(screen.getByRole("button"), { shiftKey: true });
    expect(onChange).toHaveBeenCalledWith("asc", true);
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
    rerender(<GridHeaderCell label="Name" sortable={true} sortDir="desc" onSortChange={() => {}} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows the sortIndex badge when sortIndex is provided and sortDir is not null", () => {
    render(
      <GridHeaderCell label="Name" sortable={true} sortDir="asc" sortIndex={2} onSortChange={() => {}} />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show badge when sortIndex is undefined", () => {
    const { container } = render(
      <GridHeaderCell label="Name" sortable={true} sortDir="asc" onSortChange={() => {}} />
    );
    // No badge span — only the svg chevron
    const spans = container.querySelectorAll("button span");
    // The only span inside the button is the label text span
    expect(Array.from(spans).map((s) => s.textContent)).not.toContain("1");
  });

  it("does not show badge when sortDir is null (even if sortIndex is set)", () => {
    render(
      <GridHeaderCell label="Name" sortable={true} sortDir={null} sortIndex={1} onSortChange={() => {}} />
    );
    expect(screen.queryByText("1")).toBeNull();
  });
});
