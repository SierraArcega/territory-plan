import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SegmentedControl from "../SegmentedControl";

const OPTIONS = [
  { value: "board", label: "Board" },
  { value: "table", label: "Table" },
] as const;

type View = (typeof OPTIONS)[number]["value"];

describe("SegmentedControl", () => {
  it("renders all options inside a labeled group", () => {
    render(
      <SegmentedControl<View>
        options={[...OPTIONS]}
        value="board"
        onChange={() => {}}
        ariaLabel="View"
      />,
    );
    expect(screen.getByRole("group", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
  });

  it("marks the active segment with aria-pressed and the white-card styling", () => {
    render(
      <SegmentedControl<View>
        options={[...OPTIONS]}
        value="table"
        onChange={() => {}}
        ariaLabel="View"
      />,
    );
    const active = screen.getByRole("button", { name: "Table" });
    const inactive = screen.getByRole("button", { name: "Board" });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.className).toContain("bg-white");
    expect(active.className).toContain("text-[#403770]");
    expect(inactive).toHaveAttribute("aria-pressed", "false");
    expect(inactive.className).toContain("bg-transparent");
  });

  it("calls onChange with the clicked option value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl<View>
        options={[...OPTIONS]}
        value="board"
        onChange={onChange}
        ariaLabel="View"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("table");
  });
});
