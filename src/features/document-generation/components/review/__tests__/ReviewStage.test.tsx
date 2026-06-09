import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewStage from "../ReviewStage";

const props = (over = {}) => ({
  result: { docUrl: "https://docs.google.com/document/d/X/edit" },
  orderTotal: 16500,
  onSend: vi.fn(), onManual: vi.fn(), onBack: vi.fn(), ...over,
});

describe("ReviewStage", () => {
  it("makes Send for signature the primary action", () => {
    render(<ReviewStage {...props()} />);
    const send = screen.getByRole("button", { name: /Send for signature/i });
    expect(send).toBeInTheDocument();
  });
  it("fires onManual for the Open Google Doc branch", () => {
    const p = props();
    render(<ReviewStage {...p} />);
    screen.getByRole("button", { name: /Open Google Doc/i }).click();
    expect(p.onManual).toHaveBeenCalled();
  });
  it("links to the rendered doc", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("link", { name: /rendered document/i })).toHaveAttribute("href", "https://docs.google.com/document/d/X/edit");
  });

  it("disables Open Google Doc button and shows generating label when busy=true", () => {
    render(<ReviewStage {...props({ busy: true })} />);
    const btn = screen.getByRole("button", { name: /Generating/i });
    expect(btn).toBeDisabled();
  });

  it("shows normal label and is enabled for Open Google Doc when busy=false", () => {
    render(<ReviewStage {...props({ busy: false })} />);
    const btn = screen.getByRole("button", { name: /Open Google Doc \(manual\)/i });
    expect(btn).toBeEnabled();
  });
});
