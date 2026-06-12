import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import FilterBuilder from "../FilterBuilder";
import type { ActiveFilter, FilterColumn } from "../filter-builder-utils";

interface Row {
  name: string;
  score: number;
  status: string;
}

const COLUMNS: FilterColumn<Row>[] = [
  { key: "name", label: "Name", type: "text", group: "Lead" },
  { key: "score", label: "Score", type: "number", group: "Lead" },
  {
    key: "status",
    label: "Status",
    type: "enum",
    group: "Lead",
    options: [
      { value: "new", label: "New" },
      { value: "working", label: "Working" },
    ],
  },
];

function Harness({
  initial = [],
  onChange,
}: {
  initial?: ActiveFilter[];
  onChange?: (f: ActiveFilter[]) => void;
}) {
  const [filters, setFilters] = useState<ActiveFilter[]>(initial);
  return (
    <FilterBuilder<Row>
      columns={COLUMNS}
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onChange?.(next);
      }}
    />
  );
}

describe("FilterBuilder", () => {
  it("walks Column → Operator → Value and adds a filter pill", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    // Step 1: column list (grouped)
    expect(screen.getByPlaceholderText("Search columns…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    // Step 2: text operators
    expect(screen.getByRole("button", { name: "contains" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "does not contain" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "contains" }));
    // Step 3: value
    fireEvent.change(screen.getByLabelText("Filter value"), {
      target: { value: "Ortiz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const filters = onChange.mock.calls[0][0] as ActiveFilter[];
    expect(filters).toHaveLength(1);
    expect(filters[0]).toMatchObject({
      column: "name",
      op: "contains",
      value: "Ortiz",
    });
    // Pill renders column, operator, value; popover is closed
    expect(
      screen.getByRole("button", { name: "Edit filter: Name contains Ortiz" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Search columns…"),
    ).not.toBeInTheDocument();
    // Trigger label switches once a filter exists
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();
  });

  it("shows number operators as symbols and supports between", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    expect(screen.getByRole("button", { name: "=" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "≠" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "between" }));

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "10" } });
    expect(applyButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "20" } });
    fireEvent.click(applyButton);

    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      column: "score",
      op: "between",
      value: ["10", "20"],
    });
  });

  it("commits no-value operators immediately from the operator step", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    fireEvent.click(screen.getByRole("button", { name: "is empty" }));

    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      column: "name",
      op: "is_empty",
    });
    expect(
      screen.queryByPlaceholderText("Search columns…"),
    ).not.toBeInTheDocument();
  });

  it("applies enum values on click and shows their label in the pill", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(screen.getByRole("button", { name: "is" }));
    fireEvent.click(screen.getByRole("button", { name: "Working" }));

    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      column: "status",
      op: "eq",
      value: "working",
    });
    expect(
      screen.getByRole("button", { name: "Edit filter: Status is Working" }),
    ).toBeInTheDocument();
  });

  it("edits an existing pill at the value step", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[{ id: "f1", column: "name", op: "contains", value: "Ortiz" }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit filter: Name contains Ortiz" }),
    );
    const input = screen.getByLabelText("Filter value");
    expect(input).toHaveValue("Ortiz");
    fireEvent.change(input, { target: { value: "Smith" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const updated = onChange.mock.calls[0][0] as ActiveFilter[];
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: "f1", value: "Smith" });
  });

  it("removes a pill via its × button", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[{ id: "f1", column: "name", op: "contains", value: "Ortiz" }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Name" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters the column list by search", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.change(screen.getByPlaceholderText("Search columns…"), {
      target: { value: "sco" },
    });
    expect(screen.getByRole("button", { name: "Score" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(screen.getByPlaceholderText("Search columns…")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText("Search columns…"), {
      key: "Escape",
    });
    expect(
      screen.queryByPlaceholderText("Search columns…"),
    ).not.toBeInTheDocument();
  });
});
