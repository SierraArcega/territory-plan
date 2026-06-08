import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdjustmentsSection from "../AdjustmentsSection";
import type { OrderAdjustment } from "@/features/document-generation/lib/payload-types";

const adj: OrderAdjustment = { id: "1", label: "Early Signing", type: "discount", mode: "percent", value: 10 };

describe("AdjustmentsSection", () => {
  it("adds an adjustment", () => {
    const onChange = vi.fn();
    render(<AdjustmentsSection adjustments={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add adjustment/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "discount", mode: "percent", value: 0 })]);
  });
  it("edits the label and removes a row", () => {
    const onChange = vi.fn();
    render(<AdjustmentsSection adjustments={[adj]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Adjustment label"), { target: { value: "Loyalty" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: "1", label: "Loyalty" })]);
    fireEvent.click(screen.getByLabelText("Remove adjustment"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
  it("exposes Discount, Fee, and Tax types", () => {
    render(<AdjustmentsSection adjustments={[adj]} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: /Discount/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Fee/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Tax/i })).toBeInTheDocument();
  });
});
