import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ChatPanel } from "../ChatPanel";

describe("ChatPanel", () => {
  it("calls onSend when user submits a message", () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} isLoading={false} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "show me Texas" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSend).toHaveBeenCalledWith("show me Texas");
  });

  it("renders a thinking indicator when isLoading", () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} isLoading={true} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} isLoading={false} />);
    const btn = screen.getByRole("button", { name: /send/i });
    expect(btn).toBeDisabled();
  });
});
