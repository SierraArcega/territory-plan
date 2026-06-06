// src/features/document-generation/components/form/__tests__/SkuPicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkuPicker from "../SkuPicker";

vi.mock("@/features/document-generation/lib/pricebook", () => ({
  DEFAULT_FISCAL_YEAR: "FY27",
  getProducts: () => [{ sku: "HS-1", name: "HS SpEd FT", category: "c", fiscalYear: "FY27", listRate: 85, description: "d", unit: "Hour", pricePerHour: 85, chargedPer: null, fullYear190: null, fullYear180: null }],
  getBocesProducts: () => [{ sku: "BOC27-HB11", name: "Homebound", category: "c", fiscalYear: "FY27", listRate: 100, description: "d", unit: "Hour", pricePerHour: 100, chargedPer: null, fullYear190: null, fullYear180: null }],
}));

describe("SkuPicker", () => {
  it("lists contract products and emits a LineItemRow on pick", () => {
    const onPick = vi.fn();
    render(<SkuPicker docType="contract" onPick={onPick} />);
    fireEvent.click(screen.getByText(/HS SpEd FT/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ sku: "HS-1", service: "HS SpEd FT", listRate: 85, unit: "Hour" }));
  });
  it("lists BOCES products in boces mode", () => {
    render(<SkuPicker docType="boces_quote" onPick={vi.fn()} />);
    expect(screen.getByText(/Homebound/)).toBeInTheDocument();
  });
});
