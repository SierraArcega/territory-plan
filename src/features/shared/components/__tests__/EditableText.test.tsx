import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditableText from "../EditableText";

describe("EditableText", () => {
  it("renders the value when not editing", () => {
    render(<EditableText value="Hello" onChange={vi.fn()} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders placeholder when value is empty", () => {
    render(<EditableText value="" onChange={vi.fn()} placeholder="Type here…" />);
    expect(screen.getByText("Type here…")).toBeInTheDocument();
  });

  it("opens an input on click", () => {
    render(<EditableText value="Hello" onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Hello");
  });

  it("commits on Enter", async () => {
    const onChange = vi.fn();
    render(<EditableText value="Hello" onChange={onChange} />);
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "World" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("World");
    });
  });

  it("commits on blur if value changed", async () => {
    const onChange = vi.fn();
    render(<EditableText value="Hello" onChange={onChange} />);
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "World" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("World");
    });
  });

  it("does not commit on blur if value unchanged", () => {
    const onChange = vi.fn();
    render(<EditableText value="Hello" onChange={onChange} />);
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cancels on Escape", () => {
    const onChange = vi.fn();
    render(<EditableText value="Hello" onChange={onChange} />);
    fireEvent.click(screen.getByText("Hello"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "World" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("does not enter edit mode when readOnly", () => {
    render(<EditableText value="Hello" onChange={vi.fn()} readOnly />);
    fireEvent.click(screen.getByText("Hello"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("multiline keeps Enter as newline (commits on blur only)", async () => {
    const onChange = vi.fn();
    render(<EditableText value="line 1" onChange={onChange} multiline />);
    fireEvent.click(screen.getByText("line 1"));
    const ta = screen.getByRole("textbox");
    fireEvent.change(ta, { target: { value: "line 1\nline 2" } });
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(ta);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("line 1\nline 2");
    });
  });
});
