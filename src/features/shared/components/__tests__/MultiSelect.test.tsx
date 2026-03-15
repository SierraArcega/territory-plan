import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect } from "../MultiSelect";
import type { MultiSelectOption } from "../MultiSelect";

const OPTIONS: MultiSelectOption[] = [
  { value: "ca", label: "California" },
  { value: "tx", label: "Texas" },
  { value: "ny", label: "New York" },
  { value: "fl", label: "Florida" },
  { value: "wa", label: "Washington" },
];

function setup(props: Partial<React.ComponentProps<typeof MultiSelect>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MultiSelect
      id="test"
      label="States"
      options={OPTIONS}
      selected={[]}
      onChange={onChange}
      placeholder="All States"
      countLabel="states"
      {...props}
    />
  );
  return { ...utils, onChange };
}

describe("MultiSelect — trigger label", () => {
  it("shows placeholder when nothing selected", () => {
    setup({ selected: [] });
    expect(screen.getByRole("button", { name: /All States/i })).toBeInTheDocument();
  });

  it("shows option label for 1 selected", () => {
    setup({ selected: ["ca"] });
    expect(screen.getByRole("button", { name: /California/i })).toBeInTheDocument();
  });

  it("shows comma-joined labels for 2 selected", () => {
    setup({ selected: ["ca", "tx"] });
    expect(screen.getByRole("button", { name: /California, Texas/i })).toBeInTheDocument();
  });

  it("shows comma-joined labels for 3 selected", () => {
    setup({ selected: ["ca", "tx", "ny"] });
    expect(screen.getByRole("button", { name: /California, Texas, New York/i })).toBeInTheDocument();
  });

  it("shows count label for 4+ selected", () => {
    setup({ selected: ["ca", "tx", "ny", "fl"] });
    expect(screen.getByRole("button", { name: /4 states/i })).toBeInTheDocument();
  });
});

describe("MultiSelect — open/close", () => {
  it("opens dropdown on trigger click", () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All States/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes dropdown on second trigger click", () => {
    setup();
    const trigger = screen.getByRole("button", { name: /All States/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    setup({ disabled: true });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("MultiSelect — option selection", () => {
  it("calls onChange with added value when option clicked", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button", { name: /All States/i }));
    fireEvent.click(screen.getByRole("option", { name: /California/i }));
    expect(onChange).toHaveBeenCalledWith(["ca"]);
  });

  it("calls onChange with value removed when selected option clicked", () => {
    const { onChange } = setup({ selected: ["ca"] });
    fireEvent.click(screen.getByRole("button", { name: /California/i }));
    fireEvent.click(screen.getByRole("option", { name: /California/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("MultiSelect — search", () => {
  it("filters options by query", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "cal" } });
    expect(screen.getByRole("option", { name: /California/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Texas/i })).not.toBeInTheDocument();
  });

  it("shows no-results state when search has no matches", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/No results/i)).toBeInTheDocument();
  });
});

describe("MultiSelect — Select All", () => {
  it("renders Select All row with count when open", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("checkbox", { name: /Select all 5/i })).toBeInTheDocument();
  });

  it("Select All hidden when search returns 0 results", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzz" } });
    expect(screen.queryByRole("checkbox", { name: /Select all/i })).not.toBeInTheDocument();
  });

  it("clicking Select All (unchecked) checks all filtered options", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Select all 5/i }));
    expect(onChange).toHaveBeenCalledWith(["ca", "tx", "ny", "fl", "wa"]);
  });

  it("clicking Select All (checked) unchecks all filtered options", () => {
    const { onChange } = setup({ selected: ["ca", "tx", "ny", "fl", "wa"] });
    fireEvent.click(screen.getByRole("button", { name: /5 states/i }));
    const selectAll = screen.getByRole("checkbox", { name: /Select all 5/i });
    expect(selectAll).toHaveAttribute("aria-checked", "true");
    fireEvent.click(selectAll);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("Select All is indeterminate when some filtered options selected", () => {
    setup({ selected: ["ca"] });
    fireEvent.click(screen.getByRole("button"));
    const selectAll = screen.getByRole("checkbox", { name: /Select all 5/i });
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");
  });

  it("Select All label adapts to search query", () => {
    setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    // "ali" matches only "California"
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ali" } });
    expect(screen.getByRole("checkbox", { name: /Select 1 results/i })).toBeInTheDocument();
  });
});

describe("MultiSelect — keyboard navigation", () => {
  it("ArrowDown from initial state activates Select All (index 0)", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("checkbox", { name: /Select all/i })).toHaveClass("bg-[#EDE9F7]");
  });

  it("Escape closes when query is empty", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape clears query (not close) when query has text", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "cal" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Enter on Select All (index 0) applies Select All logic", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // → index 0 (Select All)
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["ca", "tx", "ny", "fl", "wa"]);
  });

  it("Enter at activeIndex -1 (no selection) is a no-op", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    // Do NOT press ArrowDown — activeIndex stays at -1
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowDown clamps at last option (index N)", () => {
    setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    // N = 5 options; press down 6 times to go past the end: -1→0→1→2→3→4→5(clamp)
    for (let i = 0; i < 7; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    // Last option "Washington" (index 5) should have cursor class
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveClass("bg-[#EDE9F7]");
  });

  it("outside click closes the dropdown", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("MultiSelect — chips", () => {
  it("renders chips for selected values", () => {
    setup({ selected: ["ca", "tx"] });
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("Texas")).toBeInTheDocument();
  });

  it("chip remove button calls onChange without that value", () => {
    const { onChange } = setup({ selected: ["ca", "tx"] });
    fireEvent.click(screen.getByRole("button", { name: "Remove California" }));
    expect(onChange).toHaveBeenCalledWith(["tx"]);
  });

  it("chips hidden when disabled", () => {
    setup({ selected: ["ca"], disabled: true });
    expect(screen.queryByText("California")).not.toBeInTheDocument();
  });
});
