import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentSection from "../PaymentSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

const render_ = (over = {}) =>
  render(<PaymentSection state={{ ...emptyFormState("contract", "x"), ...over }} onChange={vi.fn()} />);

describe("PaymentSection", () => {
  it("shows the three payment-type labels", () => {
    render_();
    expect(screen.getByRole("option", { name: /A — Standard/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /B — Customized/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /C — BOCES Standardized/ })).toBeInTheDocument();
  });
  it("reveals type-B fields only when type is B", () => {
    render_({ paymentType: "A" });
    expect(screen.queryByPlaceholderText(/Additional terms/i)).not.toBeInTheDocument();
  });
  it("reveals type-C fields when type is C", () => {
    render_({ paymentType: "C" });
    expect(screen.getByPlaceholderText(/PO number/i)).toBeInTheDocument();
  });
});
