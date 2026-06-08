import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkuPicker from "../SkuPicker";

vi.mock("@/features/document-generation/lib/pricebook", () => ({
  DEFAULT_FISCAL_YEAR: "FY27",
  getProducts: (opts: { fiscalYear?: string } = {}) =>
    opts.fiscalYear === "FY26"
      ? [{ sku: "OLD-1", name: "Legacy Service", category: "c", fiscalYear: "FY26", listRate: 50, description: "d", unit: "Hour", pricePerHour: 50, chargedPer: null, fullYear190: null, fullYear180: null }]
      : [{ sku: "HS-1", name: "HS SpEd FT", category: "c", fiscalYear: "FY27", listRate: 85, description: "d", unit: "Hour", pricePerHour: 85, chargedPer: null, fullYear190: null, fullYear180: null }],
  getBocesProducts: () => [{ sku: "BOC27-HB11", name: "Homebound", category: "c", fiscalYear: "FY27", listRate: 100, description: "d", unit: "Hour", pricePerHour: 100, chargedPer: null, fullYear190: null, fullYear180: null }],
}));

describe("SkuPicker (combobox)", () => {
  it("hides the product list until opened", () => {
    render(<SkuPicker docType="contract" fiscalYear="FY27" onPick={vi.fn()} />);
    expect(screen.queryByText(/HS SpEd FT/)).not.toBeInTheDocument();
  });
  it("opens via the browse button and emits a LineItemRow on select", () => {
    const onPick = vi.fn();
    render(<SkuPicker docType="contract" fiscalYear="FY27" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /browse products/i }));
    fireEvent.click(screen.getByText(/HS SpEd FT/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ sku: "HS-1", service: "HS SpEd FT", listRate: 85, qty: 1, unit: "Hour", discountPct: 0 }));
  });
  it("closes the list after selecting", () => {
    render(<SkuPicker docType="contract" fiscalYear="FY27" onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse products/i }));
    fireEvent.click(screen.getByText(/HS SpEd FT/));
    expect(screen.queryByText(/HS SpEd FT/)).not.toBeInTheDocument();
  });
  it("filters as you type", () => {
    render(<SkuPicker docType="contract" fiscalYear="FY27" onPick={vi.fn()} />);
    const input = screen.getByLabelText(/search or select/i);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryByText(/HS SpEd FT/)).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "spe" } });
    expect(screen.getByText(/HS SpEd FT/)).toBeInTheDocument();
  });
  it("uses the FY26 book when fiscalYear is FY26", () => {
    render(<SkuPicker docType="contract" fiscalYear="FY26" onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /browse products/i }));
    expect(screen.getByText(/Legacy Service/)).toBeInTheDocument();
  });
});
