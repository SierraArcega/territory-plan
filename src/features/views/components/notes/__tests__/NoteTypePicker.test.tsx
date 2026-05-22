import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteTypePicker } from "../NoteTypePicker";

describe("NoteTypePicker", () => {
  it("shows the current type label and opens the menu on click", () => {
    render(<NoteTypePicker value="general_update" onChange={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /general update/i });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /risk flag/i })).toBeInTheDocument();
  });

  it("calls onChange and closes when a type is picked", () => {
    const onChange = vi.fn();
    render(<NoteTypePicker value="general_update" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /general update/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /good news/i }));
    expect(onChange).toHaveBeenCalledWith("good_news");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
