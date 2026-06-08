import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentSection from "../PaymentSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

const render_ = (over = {}, onChange = vi.fn()) => {
  render(<PaymentSection state={{ ...emptyFormState("contract", "x"), ...over }} onChange={onChange} />);
  return { onChange };
};

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
  it("defaults invoice to 'at time of signing' (checked, no date input)", () => {
    render_();
    const atSigning = screen.getByLabelText(/Invoice at time of signing/i) as HTMLInputElement;
    expect(atSigning.checked).toBe(true);
    expect(screen.queryByLabelText("Invoice date")).not.toBeInTheDocument();
  });
  it("reveals the date picker when 'at time of signing' is unchecked", () => {
    render_();
    fireEvent.click(screen.getByLabelText(/Invoice at time of signing/i));
    expect(screen.getByLabelText("Invoice date")).toBeInTheDocument();
  });
  it("reflects a prefilled invoice date: unchecked + date input shown without toggling", () => {
    render_({ invoiceDate: "2026-07-15" });
    const atSigning = screen.getByLabelText(/Invoice at time of signing/i) as HTMLInputElement;
    expect(atSigning.checked).toBe(false);
    expect((screen.getByLabelText("Invoice date") as HTMLInputElement).value).toBe("2026-07-15");
  });
  it("clears the invoice date when re-checking 'at time of signing'", () => {
    const { onChange } = render_({ invoiceDate: "2026-07-15" });
    // starts with the date picker shown (invoiceDate non-empty)
    expect(screen.getByLabelText("Invoice date")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Invoice at time of signing/i));
    expect(onChange).toHaveBeenCalledWith({ invoiceDate: "" });
  });
});
