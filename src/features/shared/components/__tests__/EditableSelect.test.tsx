import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EditableSelect from "../EditableSelect";

const OPTIONS = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
  { id: "c", label: "Cherry", dot: "#F37167" },
];

describe("EditableSelect", () => {
  it("shows the current option label", () => {
    render(<EditableSelect value="b" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Banana");
  });

  it("opens listbox on click and shows options", () => {
    render(<EditableSelect value="a" options={OPTIONS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /apple/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /banana/i })).toBeInTheDocument();
  });

  it("calls onChange when an option is selected", () => {
    const onChange = vi.fn();
    render(<EditableSelect value="a" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /apple/i }));
    fireEvent.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("closes the listbox after selection", () => {
    render(<EditableSelect value="a" options={OPTIONS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /apple/i }));
    fireEvent.click(screen.getByRole("option", { name: /banana/i }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<EditableSelect value="a" options={OPTIONS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /apple/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("disables interactions when readOnly", () => {
    render(<EditableSelect value="a" options={OPTIONS} onChange={vi.fn()} readOnly />);
    const button = screen.getByRole("button", { name: /apple/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("marks the selected option with aria-selected", () => {
    render(<EditableSelect value="c" options={OPTIONS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cherry/i }));
    const opt = screen.getByRole("option", { name: /cherry/i });
    expect(opt).toHaveAttribute("aria-selected", "true");
  });
});
