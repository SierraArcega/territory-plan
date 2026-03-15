import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SortHeader } from "../SortHeader";
import type { SortState } from "@/features/shared/hooks/useSortableTable";

const onSort = vi.fn();

function makeState(field: string | null, dir: "asc" | "desc" | null): SortState {
  return { field, dir };
}

// Table wrapper is required for valid HTML — th must be inside a table
function wrap(ui: React.ReactNode) {
  return render(<table><thead><tr>{ui}</tr></thead></table>);
}

describe("SortHeader", () => {
  beforeEach(() => onSort.mockClear());

  it("renders the label text", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("aria-sort is 'none' when column is not active", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "none");
  });

  it("aria-sort is 'ascending' when active asc", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "ascending");
  });

  it("aria-sort is 'descending' when active desc", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState("name", "desc")} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "descending");
  });

  it("applies active text color class when sorted", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />
    );
    expect(container.querySelector("th")?.className).toContain("text-[#403770]");
  });

  it("applies inactive text color class when not sorted", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    expect(container.querySelector("th")?.className).toContain("text-[#8A80A8]");
  });

  it("calls onSort with field name on click", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.click(screen.getByRole("columnheader"));
    expect(onSort).toHaveBeenCalledOnce();
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("calls onSort on Enter keydown", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader"), { key: "Enter" });
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("calls onSort on Space keydown", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader"), { key: " " });
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("arrow has opacity-0 class when inactive (hidden by default)", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    const arrow = container.querySelector("[aria-hidden='true']");
    expect(arrow?.className).toContain("opacity-0");
    expect(arrow?.className).toContain("group-hover:opacity-50");
  });

  it("arrow has opacity-100 class when active (always visible)", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />
    );
    const arrow = container.querySelector("[aria-hidden='true']");
    expect(arrow?.className).toContain("opacity-100");
    expect(arrow?.className).not.toContain("opacity-0");
  });

  it("th is tab-focusable", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    expect(container.querySelector("th")).toHaveAttribute("tabindex", "0");
  });

  it("passes className to th", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} className="w-[30%]" />
    );
    expect(container.querySelector("th")?.className).toContain("w-[30%]");
  });
});
