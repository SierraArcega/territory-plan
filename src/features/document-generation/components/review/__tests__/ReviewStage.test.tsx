import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewStage from "../ReviewStage";

const props = (over = {}) => ({
  result: { docUrl: "https://docs.google.com/document/d/X/edit" },
  orderTotal: 16500,
  docType: "contract" as const,
  onSend: vi.fn(), onBack: vi.fn(),
  busy: false, sendState: null as null | { status: "processing" | "error"; recipientEmail?: string; sendError?: string },
  ...over,
});

describe("ReviewStage", () => {
  it("shows Send for signature for contracts", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("button", { name: /Send for signature/i })).toBeEnabled();
  });
  it("hides Send for boces_quote (no eSign)", () => {
    render(<ReviewStage {...props({ docType: "boces_quote" })} />);
    expect(screen.queryByRole("button", { name: /Send for signature/i })).not.toBeInTheDocument();
  });
  it("disables Send while busy (guards double-submit)", () => {
    render(<ReviewStage {...props({ busy: true })} />);
    expect(screen.getByRole("button", { name: /Sending/i })).toBeDisabled();
  });
  it("fires onSend when clicked", () => {
    const p = props();
    render(<ReviewStage {...p} />);
    screen.getByRole("button", { name: /Send for signature/i }).click();
    expect(p.onSend).toHaveBeenCalled();
  });
  it("shows the sent confirmation", () => {
    render(<ReviewStage {...props({ sendState: { status: "processing", recipientEmail: "s@acme.org" } })} />);
    expect(screen.getByText(/Sent/i)).toHaveTextContent("s@acme.org");
  });
  it("shows the send error", () => {
    render(<ReviewStage {...props({ sendState: { status: "error", sendError: "domain not allowed" } })} />);
    expect(screen.getByText(/domain not allowed/i)).toBeInTheDocument();
  });
  it("links to the rendered doc", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("link", { name: /rendered document/i })).toHaveAttribute("href", "https://docs.google.com/document/d/X/edit");
  });
});
