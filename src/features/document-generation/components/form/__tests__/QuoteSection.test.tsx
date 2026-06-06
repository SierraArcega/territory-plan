import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import QuoteSection from "../QuoteSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../SkuPicker", () => ({ default: () => <div>sku-picker</div> }));

// Two line items so the order total (16,500) is distinct from any single line total.
function setup(over = {}, booking: number | null = 188000) {
  const state = {
    ...emptyFormState("contract", "x"),
    lineItems: [
      { id: "1", sku: "HS", service: "HS SpEd", description: "", qty: 120, unit: "hrs", listRate: 85, discountPct: 0 },
      { id: "2", sku: "TUT", service: "Tutoring", description: "", qty: 90, unit: "hrs", listRate: 70, discountPct: 0 },
    ],
    ...over,
  };
  render(<QuoteSection state={state} bookingReference={booking} onChange={vi.fn()} />);
}

describe("QuoteSection", () => {
  it("shows the live order total (sum of line totals)", () => {
    setup();
    // 120*85 + 90*70 = 10,200 + 6,300 = 16,500 — only appears in the summary
    expect(screen.getByText(/Order total: \$16,500/)).toBeInTheDocument();
  });
  it("renders a per-line total for each row", () => {
    setup();
    expect(screen.getByText("$10,200")).toBeInTheDocument(); // line 1
    expect(screen.getByText("$6,300")).toBeInTheDocument(); // line 2
  });
  it("shows the opp booking reference and a mismatch warning", () => {
    setup();
    expect(screen.getByText(/\$188,000/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't match/i)).toBeInTheDocument();
  });
});
