// src/features/shared/components/DataGrid/__tests__/DataGrid.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataGrid } from "../DataGrid";
import type { ColumnDef } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testColumns: ColumnDef[] = [
  { key: "name", label: "Name", group: "Core", isDefault: true, filterType: "text" },
  { key: "status", label: "Status", group: "Core", isDefault: true, filterType: "enum", enumValues: ["active", "inactive"] },
  { key: "count", label: "Count", group: "Stats", isDefault: true, filterType: "number" },
];

const testData = [
  { id: "1", name: "Alpha", status: "active", count: 100 },
  { id: "2", name: "Beta", status: "inactive", count: 200 },
  { id: "3", name: "Gamma", status: "active", count: 300 },
];

const defaultProps = {
  data: testData,
  columnDefs: testColumns,
  entityType: "items",
  isLoading: false,
  visibleColumns: ["name", "status", "count"],
  onColumnsChange: vi.fn(),
  sorts: [],
  onSort: vi.fn(),
  pagination: { page: 1, pageSize: 50, total: 3 },
  onPageChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DataGrid", () => {
  it("renders column headers", () => {
    render(<DataGrid {...defaultProps} />);
    // Headers are uppercased via CSS class, not JSX text transform
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
  });

  it("renders data rows", () => {
    render(<DataGrid {...defaultProps} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("calls onSort when header clicked", () => {
    const onSort = vi.fn();
    render(<DataGrid {...defaultProps} onSort={onSort} />);
    // Click the "Name" header — shiftKey is false for a normal click
    fireEvent.click(screen.getByText("Name"));
    expect(onSort).toHaveBeenCalledWith("name", false);
  });

  it("respects sortable:false — non-sortable column does not trigger onSort", () => {
    const onSort = vi.fn();
    const columnsWithNonSortable: ColumnDef[] = [
      ...testColumns,
      { key: "fixed", label: "Fixed", group: "Core", isDefault: true, filterType: "text", sortable: false },
    ];
    render(
      <DataGrid
        {...defaultProps}
        onSort={onSort}
        columnDefs={columnsWithNonSortable}
        visibleColumns={["name", "status", "count", "fixed"]}
        data={testData.map((r) => ({ ...r, fixed: "x" }))}
      />,
    );
    fireEvent.click(screen.getByText("Fixed"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("renders checkboxes when selectedIds provided", () => {
    render(
      <DataGrid
        {...defaultProps}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onSelectPage={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    // 1 header checkbox + 3 row checkboxes = 4 total
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
  });

  it("shows skeleton when loading with no data", () => {
    render(<DataGrid {...defaultProps} data={[]} isLoading={true} />);
    // Skeleton rows have animate-pulse class
    const pulseElements = document.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("shows empty state with role='status'", () => {
    render(<DataGrid {...defaultProps} data={[]} isLoading={false} />);
    // Default empty state (no active filters) renders "No {entityType} yet"
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has role='grid' on table element", () => {
    render(<DataGrid {...defaultProps} />);
    expect(document.querySelector("[role='grid']")).toBeInTheDocument();
  });

  it("shows aria-sort='ascending' on sorted column header", () => {
    render(
      <DataGrid
        {...defaultProps}
        sorts={[{ column: "name", direction: "asc" }]}
      />,
    );
    // The "Name" header <th> should have aria-sort="ascending"
    const nameHeader = screen.getByText("Name").closest("th");
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("toggles row selection by calling onToggleSelect with the row id", () => {
    const onToggleSelect = vi.fn();
    render(
      <DataGrid
        {...defaultProps}
        selectedIds={new Set<string>()}
        onToggleSelect={onToggleSelect}
        onSelectPage={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    // The first row checkbox corresponds to id "1"
    const checkboxes = screen.getAllByRole("checkbox");
    // Index 0 is the header checkbox; index 1 is the first row
    fireEvent.click(checkboxes[1]);
    expect(onToggleSelect).toHaveBeenCalledWith("1");
  });

  it("shows opacity-50 on tbody when refreshing (isLoading with existing data)", () => {
    render(<DataGrid {...defaultProps} isLoading={true} />);
    // tbody gets opacity-50 class when isLoading && data.length > 0
    const tbody = document.querySelector("tbody");
    expect(tbody).toHaveClass("opacity-50");
  });

  it("shows error state with role='status', message, and retry button", () => {
    const onRetry = vi.fn();
    render(
      <DataGrid
        {...defaultProps}
        data={[]}
        isLoading={false}
        isError={true}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    const retryButton = screen.getByText("Try again");
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows filtered empty state with role='status' and clear filters button", () => {
    const onClearFilters = vi.fn();
    render(
      <DataGrid
        {...defaultProps}
        data={[]}
        isLoading={false}
        hasActiveFilters={true}
        onClearFilters={onClearFilters}
      />,
    );
    expect(screen.getByText("No matching results")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    const clearButton = screen.getByText("Clear all filters");
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("shows 'Showing' text in footer", () => {
    render(<DataGrid {...defaultProps} />);
    // Footer renders "Showing 1–3 of 3 items"
    const footerText = screen.getByText(/Showing/);
    expect(footerText).toBeInTheDocument();
  });
});
