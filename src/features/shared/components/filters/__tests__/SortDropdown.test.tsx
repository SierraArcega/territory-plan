import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import SortDropdown from "../SortDropdown";
import type { ColumnSort, FilterColumn } from "../filter-builder-utils";

const COLUMNS: FilterColumn[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "score", label: "Score", type: "number" },
  { key: "created", label: "Created", type: "date" },
];

function Harness({
  initial = [],
  onChange,
}: {
  initial?: ColumnSort[];
  onChange?: (s: ColumnSort[]) => void;
}) {
  const [sorts, setSorts] = useState<ColumnSort[]>(initial);
  return (
    <SortDropdown
      columns={COLUMNS}
      sorts={sorts}
      onChange={(next) => {
        setSorts(next);
        onChange?.(next);
      }}
    />
  );
}

describe("SortDropdown", () => {
  it("shows an empty state and no badge with no sorts", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Sort" });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByText("No sort applied.")).toBeInTheDocument();
  });

  it("shows a count badge when sorts are active", () => {
    render(
      <Harness
        initial={[
          { key: "name", dir: "asc" },
          { key: "score", dir: "desc" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Sort 2/ })).toBeInTheDocument();
  });

  it("adds a column as a new ascending sort", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort" }));
    fireEvent.click(screen.getByRole("button", { name: "Add sort" }));
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(onChange).toHaveBeenCalledWith([{ key: "score", dir: "asc" }]);
  });

  it("only offers columns that are not already sorted", () => {
    render(<Harness initial={[{ key: "name", dir: "asc" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add sort" }));
    expect(screen.getByRole("button", { name: "Score" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Name$/ }),
    ).not.toBeInTheDocument();
  });

  it("toggles a sort's direction", () => {
    const onChange = vi.fn();
    render(<Harness initial={[{ key: "name", dir: "asc" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Sort/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Name: sorted ascending, toggle direction",
      }),
    );
    expect(onChange).toHaveBeenCalledWith([{ key: "name", dir: "desc" }]);
    // Controlled state round-trips into the toggle label
    expect(
      screen.getByRole("button", {
        name: "Name: sorted descending, toggle direction",
      }),
    ).toBeInTheDocument();
  });

  it("removes a sort", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[
          { key: "name", dir: "asc" },
          { key: "score", dir: "desc" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Sort/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove sort: Name" }));
    expect(onChange).toHaveBeenCalledWith([{ key: "score", dir: "desc" }]);
  });

  it("renders priority numbers in order", () => {
    render(
      <Harness
        initial={[
          { key: "score", dir: "desc" },
          { key: "created", dir: "asc" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Sort/ }));
    const rows = screen.getAllByRole("button", { name: /^Reorder / });
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Reorder Score",
      "Reorder Created",
    ]);
    expect(screen.getByText("1")).toBeInTheDocument();
    // "2" appears twice: the trigger badge and the second priority number
    expect(screen.getAllByText("2")).toHaveLength(2);
  });
});
