import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuoteSection from "../QuoteSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../SkuPicker", () => ({ default: ({ fiscalYear }: { fiscalYear: string }) => <div>sku:{fiscalYear}</div> }));

function makeState(over = {}) {
  return {
    ...emptyFormState("contract", "x"),
    lineItems: [
      { id: "1", sku: "HS", service: "HS SpEd", description: "", qty: 120, unit: "hrs", listRate: 85, discountPct: 0 },
      { id: "2", sku: "TUT", service: "Tutoring", description: "", qty: 90, unit: "hrs", listRate: 70, discountPct: 0 },
    ],
    ...over,
  };
}
function setup(over = {}, booking: number | null = 188000) {
  const onChange = vi.fn();
  render(<QuoteSection state={makeState(over)} bookingReference={booking} onChange={onChange} />);
  return { onChange };
}

describe("QuoteSection", () => {
  it("shows the live order total (sum of line totals)", () => {
    setup();
    expect(screen.getByText(/Order total: \$16,500/)).toBeInTheDocument();
  });
  it("renders a per-line total for each row", () => {
    setup();
    expect(screen.getByText("$10,200")).toBeInTheDocument();
    expect(screen.getByText("$6,300")).toBeInTheDocument();
  });
  it("shows the opp booking reference and a mismatch warning", () => {
    setup();
    expect(screen.getByText(/\$188,000/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't match/i)).toBeInTheDocument();
  });
  it("edits a line quantity inline", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getAllByLabelText("Quantity")[0], { target: { value: "200" } });
    expect(onChange).toHaveBeenCalledWith({ lineItems: expect.arrayContaining([expect.objectContaining({ id: "1", qty: 200 })]) });
  });
  it("edits a line discount inline (contract)", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getAllByLabelText("Discount %")[0], { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith({ lineItems: expect.arrayContaining([expect.objectContaining({ id: "1", discountPct: 10 })]) });
  });
  it("removes a line item", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getAllByLabelText("Remove line item")[0]);
    expect(onChange).toHaveBeenCalledWith({ lineItems: [expect.objectContaining({ id: "2" })] });
  });
  it("passes the resolved pricebook year to the picker (auto → FY27 with no usable dates)", () => {
    setup();
    expect(screen.getByText("sku:FY27")).toBeInTheDocument();
  });
  it("resolves FY26 from a 2025-26 contract start date in auto mode", () => {
    setup({ startDate: "2025-08-01" });
    expect(screen.getByText("sku:FY26")).toBeInTheDocument();
  });
});
