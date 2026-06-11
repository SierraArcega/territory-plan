import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewStage from "../ReviewStage";
import type { SendBanner } from "../ReviewStage";

const props = (over = {}) => ({
  result: { docUrl: "https://docs.google.com/document/d/X/edit" },
  orderTotal: 16500,
  docType: "contract" as const,
  onSend: vi.fn(), onBack: vi.fn(),
  busy: false, sendState: null as SendBanner | null,
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
    render(<ReviewStage {...props({ sendState: { phase: "sent", recipientEmail: "s@acme.org" } })} />);
    expect(screen.getByText(/Sent/i)).toHaveTextContent("s@acme.org");
  });
  it("shows the send error", () => {
    render(<ReviewStage {...props({ sendState: { phase: "error", sendError: "domain not allowed" } })} />);
    expect(screen.getByText(/domain not allowed/i)).toBeInTheDocument();
  });
  it("links to the rendered doc via Edit in Google Docs", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("link", { name: /edit in google docs/i })).toHaveAttribute("href", "https://docs.google.com/document/d/X/edit");
  });

  // Task 8: PDF-first review actions
  it("offers a View PDF primary action derived from the doc URL", () => {
    render(<ReviewStage {...props()} />);
    const pdf = screen.getByRole("link", { name: /view pdf/i });
    expect(pdf).toHaveAttribute("href", "https://docs.google.com/document/d/X/export?format=pdf");
  });
  it("keeps the Google Doc link as the manual-edit escape hatch", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("link", { name: /edit in google docs/i })).toHaveAttribute("href", "https://docs.google.com/document/d/X/edit");
  });
  it("explains that manual edits do not flow into Send", () => {
    render(<ReviewStage {...props({ docType: "contract" })} />);
    expect(screen.getByText(/send for signature via Google instead/i)).toBeInTheDocument();
  });

  // New phase-based banner tests
  it("shows Sending… while processing and disables the send button", () => {
    render(<ReviewStage {...props({ sendState: { phase: "processing" } })} />);
    expect(screen.getByText("Sending…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send for signature/i })).toBeDisabled();
  });
  it("shows the awaiting-confirmation banner on timeout", () => {
    render(<ReviewStage {...props({ sendState: { phase: "unconfirmed" } })} />);
    expect(screen.getByText(/Send accepted — awaiting confirmation/i)).toBeInTheDocument();
    // button should be disabled (not error phase)
    expect(screen.getByRole("button", { name: /Send for signature/i })).toBeDisabled();
  });
  it("shows the stamped error message", () => {
    render(<ReviewStage {...props({ sendState: { phase: "error", sendError: "signature_request_invalid" } })} />);
    expect(screen.getByText(/signature_request_invalid/i)).toBeInTheDocument();
  });
  it("keeps the send button enabled for error phase (retry allowed)", () => {
    render(<ReviewStage {...props({ sendState: { phase: "error", sendError: "oops" } })} />);
    expect(screen.getByRole("button", { name: /Send for signature/i })).toBeEnabled();
  });
});
