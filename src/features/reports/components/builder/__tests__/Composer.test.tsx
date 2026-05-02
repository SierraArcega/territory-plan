import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Composer } from "../Composer";

describe("Composer", () => {
  it("submits trimmed text on Enter and clears the input", () => {
    const onSubmit = vi.fn();
    render(<Composer inFlight={false} latestVersionN={null} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/ask a question/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  show me texas opps  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("show me texas opps");
    expect(input.value).toBe("");
  });

  it("submits on send-button click", () => {
    const onSubmit = vi.fn();
    render(<Composer inFlight={false} latestVersionN={1} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/follow-up/i);
    fireEvent.change(input, { target: { value: "narrow to TX" } });
    const send = screen.getByRole("button");
    fireEvent.click(send);
    expect(onSubmit).toHaveBeenCalledWith("narrow to TX");
  });

  it("locks input + send when inFlight, with a Working… placeholder", () => {
    const onSubmit = vi.fn();
    render(<Composer inFlight latestVersionN={2} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/working/i) as HTMLInputElement;
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { value: "ignored" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores empty submissions", () => {
    const onSubmit = vi.fn();
    render(<Composer inFlight={false} latestVersionN={null} onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: "    " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the 'Continues from v{n}' helper when versions exist", () => {
    render(<Composer inFlight={false} latestVersionN={3} onSubmit={() => {}} />);
    expect(screen.getByText(/continues from/i)).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
  });
});
