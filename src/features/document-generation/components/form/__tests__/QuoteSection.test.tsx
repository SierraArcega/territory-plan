import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuoteSection from "../QuoteSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../AdjustmentsSection", () => ({ default: () => <div>adjustments</div> }));

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
  it("editing the Count field calls onChange with updated count", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getAllByLabelText("Count")[0], { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith({ lineItems: expect.arrayContaining([expect.objectContaining({ id: "1", count: 5 })]) });
  });
  it("changing the Unit select calls onChange with updated unit", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getAllByLabelText("Unit")[0], { target: { value: "Day" } });
    expect(onChange).toHaveBeenCalledWith({ lineItems: expect.arrayContaining([expect.objectContaining({ id: "1", unit: "Day" })]) });
  });
  it("shows Billable days and correct Order total when a Day-unit line has count × qty", () => {
    const { onChange: _onChange } = setup(
      {
        lineItems: [
          { id: "1", sku: "S", service: "Educator", description: "", count: 5, qty: 180, unit: "Day", listRate: 500.23, discountPct: 0 },
        ],
      },
      null,
    );
    expect(screen.getByText(/Billable days: 900/)).toBeInTheDocument();
    expect(screen.getByText(/Order total: \$450,207/)).toBeInTheDocument();
  });
  it("shows savings callout and discounted order total when a percent discount adjustment is applied", () => {
    setup(
      {
        adjustments: [{ id: "d", label: "Early Signing", type: "discount", mode: "percent", value: 10 }],
      },
      null,
    );
    // subtotal 16,500 − 10% = 14,850
    expect(screen.getByText(/Order total: \$14,850/)).toBeInTheDocument();
    expect(screen.getByText(/You'll save/i)).toBeInTheDocument();
  });

  it("renders min/max amount inputs for contract doc type", () => {
    setup({}, null);
    expect(screen.getByLabelText("Minimum purchase")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum budget")).toBeInTheDocument();
  });

  it("does not render min/max inputs for boces_quote", () => {
    const onChange = vi.fn();
    render(<QuoteSection state={{ ...makeState(), docType: "boces_quote" }} bookingReference={null} onChange={onChange} />);
    expect(screen.queryByLabelText("Minimum purchase")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Maximum budget")).not.toBeInTheDocument();
  });

  it("fires onChange with a parsed number when minAmt is entered", () => {
    const { onChange } = setup({}, null);
    fireEvent.change(screen.getByLabelText("Minimum purchase"), { target: { value: "5000" } });
    expect(onChange).toHaveBeenCalledWith({ minAmt: 5000 });
  });

  it("fires onChange with null when minAmt is cleared", () => {
    const { onChange } = setup({ minAmt: 5000 }, null);
    fireEvent.change(screen.getByLabelText("Minimum purchase"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ minAmt: null });
  });

  it("fires onChange with a parsed number when maxAmt is entered", () => {
    const { onChange } = setup({}, null);
    fireEvent.change(screen.getByLabelText("Maximum budget"), { target: { value: "20000" } });
    expect(onChange).toHaveBeenCalledWith({ maxAmt: 20000 });
  });

  it("fires onChange with null when maxAmt is cleared", () => {
    const { onChange } = setup({ maxAmt: 20000 }, null);
    fireEvent.change(screen.getByLabelText("Maximum budget"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ maxAmt: null });
  });
});
