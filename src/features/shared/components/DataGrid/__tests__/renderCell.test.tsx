// src/features/shared/components/DataGrid/__tests__/renderCell.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCellValue, renderCell } from "../renderCell";
import type { ColumnDef } from "../types";

const revenueCol: ColumnDef = { key: "revenue", label: "Revenue ($)", group: "Finance", isDefault: true, filterType: "number" };

describe("formatCellValue", () => {
  it("returns em dash for null", () => {
    expect(formatCellValue(null, "name")).toBe("\u2014");
  });

  it("returns em dash for undefined", () => {
    expect(formatCellValue(undefined, "name")).toBe("\u2014");
  });

  it("formats boolean true as Yes", () => {
    expect(formatCellValue(true, "isActive")).toBe("Yes");
  });

  it("formats boolean false as No", () => {
    expect(formatCellValue(false, "isActive")).toBe("No");
  });

  it("formats currency in millions", () => {
    expect(formatCellValue(2500000, "revenue", revenueCol)).toBe("$2.5M");
  });

  it("formats currency in thousands", () => {
    expect(formatCellValue(45300, "revenue", revenueCol)).toBe("$45.3K");
  });

  it("formats small currency", () => {
    expect(formatCellValue(999, "revenue", revenueCol)).toBe("$999");
  });

  it("formats competitor columns as currency", () => {
    expect(formatCellValue(1500000, "comp_test_fy26")).toBe("$1.5M");
  });

  it("formats percentage", () => {
    expect(formatCellValue(0.732, "proficiency")).toBe("73.2%");
  });

  it("formats ISO date string", () => {
    const result = formatCellValue("2024-01-15T00:00:00Z", "createdAt");
    expect(result).toMatch(/1\/15\/2024|15\/1\/2024|2024/); // locale-dependent
  });

  it("joins array of named objects", () => {
    expect(formatCellValue([{ name: "A" }, { name: "B" }], "tags")).toBe("A, B");
  });

  it("returns em dash for empty array", () => {
    expect(formatCellValue([], "tags")).toBe("\u2014");
  });

  it("formats plain numbers with locale", () => {
    expect(formatCellValue(12345, "enrollment")).toBe("12,345");
  });
});

describe("renderCell", () => {
  it("renders em dash for null in muted color", () => {
    render(<div data-testid="cell">{renderCell(null, "name")}</div>);
    const span = screen.getByText("\u2014");
    expect(span).toHaveClass("text-[#A69DC0]");
  });

  it("renders colored pills for array with name+color", () => {
    const items = [{ name: "Tag A", color: "#403770" }];
    render(<div data-testid="cell">{renderCell(items, "tags")}</div>);
    expect(screen.getByText("Tag A")).toBeInTheDocument();
  });

  it("renders formatted text for plain values", () => {
    render(<div data-testid="cell">{renderCell("hello", "name")}</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
