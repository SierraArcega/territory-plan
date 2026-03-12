# Data Grid Component Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable DataGrid component from the existing ExploreTable monolith, following the spec in `Documentation/UI Framework/Components/Tables/data-grid.md`.

**Architecture:** The 1274-line ExploreTable.tsx is split into a shared DataGrid component (presentational, prop-driven) plus entity-specific cell renderers that get injected. The companion components (column picker, filters, sort dropdown, saved views, bulk action bar) already exist as separate files and stay where they are. ExploreOverlay continues to own state and orchestrate.

**Tech Stack:** React 19, TanStack React Table 8.21, Zustand 5, Tailwind CSS 4, Vitest, React Testing Library

**Spec:** `Documentation/UI Framework/Components/Tables/data-grid.md`

---

## File Structure

```
src/features/shared/components/DataGrid/
  index.ts                        — barrel export
  types.ts                        — ColumnDef, SortRule, FilterRule, DataGridProps, CellRendererMap
  renderCell.tsx                  — shared cell formatter (extracted from ExploreTable)
  DataGrid.tsx                    — main component: table card + footer + pagination
  SelectAllBanner.tsx             — select-all escalation banner
  __tests__/
    renderCell.test.tsx           — unit tests for cell formatting
    DataGrid.test.tsx             — integration tests for DataGrid rendering

src/features/map/components/explore/
  cellRenderers.tsx               — entity-specific custom cell renderers (extracted from ExploreTable)
  ExploreOverlay.tsx              — updated to use DataGrid instead of ExploreTable
  ExploreTable.tsx                — deleted after migration
  columns/
    districtColumns.ts            — updated: import ColumnDef from shared, add sortable
    activityColumns.ts            — updated: import ColumnDef from shared, add sortable
    taskColumns.ts                — updated: import ColumnDef from shared, add sortable
    contactColumns.ts             — updated: import ColumnDef from shared, add sortable
    planColumns.ts                — updated: import ColumnDef from shared, add sortable
```

---

## Chunk 1: Shared Types & Cell Renderer

### Task 1: Create shared types

**Files:**
- Create: `src/features/shared/components/DataGrid/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/features/shared/components/DataGrid/types.ts
import type { ReactNode } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags" | "relation";
  enumValues?: string[];
  relationSource?: string; // intentionally wide per spec (existing districtColumns uses "tags" | "plans")
  editable?: boolean;
  sortable?: boolean; // defaults to true; set false to disable sorting
}

export type SortRule = {
  column: string;
  direction: "asc" | "desc";
};

export type FilterRule = {
  column: string;
  operator: string;
  value: string | string[] | number | boolean;
};

export type CellRendererFn = (props: {
  value: unknown;
  row: Record<string, unknown>;
  columnDef: ColumnDef;
}) => ReactNode;

export interface DataGridProps {
  // Data
  data: Record<string, unknown>[];
  columnDefs: ColumnDef[];
  entityType: string;
  isLoading: boolean;
  isError?: boolean;           // shows error state in tbody when true
  onRetry?: () => void;        // retry button in error state
  // Columns
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  // Sorting — onSort receives (column, shiftKey) so parent can implement multi-sort
  sorts: SortRule[];
  onSort: (column: string, shiftKey?: boolean) => void;
  // Filtering — needed for empty state distinction ("no results" vs "no data")
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  // Pagination
  pagination: { page: number; pageSize: number; total: number } | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Selection (optional — omit to disable)
  selectedIds?: Set<string>;
  selectAllMatchingFilters?: boolean;
  onToggleSelect?: (id: string) => void;
  onSelectPage?: (ids: string[]) => void;
  onSelectAllMatching?: () => void;
  onClearSelection?: () => void;
  // Row interaction
  onRowClick?: (row: Record<string, unknown>) => void;
  // Custom rendering (optional — for entity-specific cells like owner, tags)
  cellRenderers?: Record<string, CellRendererFn>;
  // Column label resolver (optional — defaults to columnDef.label lookup)
  columnLabel?: (key: string) => string;
  // Row ID accessor (defaults to "id", districts use "leaid")
  rowIdAccessor?: string;
  // Expanding rows (optional)
  expandedRowIds?: Set<string>;
  onToggleExpand?: (id: string) => void;
  renderExpandedRow?: (row: Record<string, unknown>) => ReactNode;
  // Footer
  footerSummary?: ReactNode;
}

/*
 * Spec deviation note: The spec's DataGridProps includes filter/search props
 * (filters, onAddFilter, searchTerm, onSearch). In this implementation, filtering
 * and search remain in their existing companion components (ExploreFilters, search
 * in toolbar). DataGrid is purely a table renderer. hasActiveFilters + onClearFilters
 * are the minimal surface needed for empty state distinction. Full filter props can
 * be added later without breaking changes.
 *
 * onSort widened to (column, shiftKey?) to enable Shift+click multi-sort per spec
 * Column Header Behavior section. Backward-compatible (shiftKey is optional).
 *
 * pagination made optional (| undefined) for initial load before API response.
 * onPageSizeChange made optional for grids that use a fixed page size.
 *
 * Extensions beyond spec: cellRenderers, columnLabel, rowIdAccessor, expandedRowIds,
 * renderExpandedRow, footerSummary — justified by real entity-specific rendering needs
 * (districts use "leaid" not "id", plans have expanding rows, etc).
 */
```

- [ ] **Step 2: Create barrel export**

```ts
// src/features/shared/components/DataGrid/index.ts
export { DataGrid } from "./DataGrid";
export type {
  ColumnDef,
  SortRule,
  FilterRule,
  DataGridProps,
  CellRendererFn,
} from "./types";
```

Note: This will show a TS error until DataGrid.tsx is created in Task 5. That's expected.

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/types.ts src/features/shared/components/DataGrid/index.ts
git commit -m "feat(data-grid): add shared types — ColumnDef, DataGridProps, SortRule, FilterRule"
```

---

### Task 2: Extract renderCell utility

**Files:**
- Create: `src/features/shared/components/DataGrid/renderCell.tsx`
- Reference: `src/features/map/components/explore/ExploreTable.tsx` lines 94–180

Extract the generic cell formatting logic from ExploreTable. This includes `formatCellValue`, `renderColoredPills`, and the currency/percent/date/boolean/array detection.

**Intentional color change:** Em-dash/empty styling changes from `text-gray-300` (existing ExploreTable) to `text-[#A69DC0]` (spec Muted token). This is a deliberate migration to the Fullmind token system.

- [ ] **Step 1: Write the renderCell file**

```tsx
// src/features/shared/components/DataGrid/renderCell.tsx
"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "./types";

const PERCENT_KEYS = /percent|rate|proficiency/i;

function renderColoredPills(items: { name: string; color: string }[]) {
  if (items.length === 0) return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight"
          style={{
            backgroundColor: item.color + "18",
            color: item.color,
            border: `1px solid ${item.color}30`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          {item.name}
        </span>
      ))}
    </span>
  );
}

/**
 * Determines if a column represents currency based on its label or key.
 * No global state needed — derive from the column definition directly.
 */
function isCurrencyColumn(key: string, columnDef?: ColumnDef): boolean {
  if (key.startsWith("comp_")) return true;
  return columnDef?.label.includes("($)") ?? false;
}

export function formatCellValue(value: unknown, key: string, columnDef?: ColumnDef): string {
  if (value == null) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "name" in item
          ? (item as { name: string }).name
          : String(item)
      )
      .join(", ");
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try { return new Date(value).toLocaleDateString(); }
    catch { return value; }
  }
  if (typeof value === "number") {
    if (PERCENT_KEYS.test(key)) return `${(value * 100).toFixed(1)}%`;
    if (isCurrencyColumn(key, columnDef)) {
      const rounded = Math.round(value);
      if (Math.abs(rounded) >= 1_000_000) return `$${(rounded / 1_000_000).toFixed(1)}M`;
      if (Math.abs(rounded) >= 1_000) return `$${(rounded / 1_000).toFixed(1)}K`;
      return `$${rounded.toLocaleString()}`;
    }
    return value.toLocaleString();
  }
  return String(value);
}

export function renderCell(value: unknown, key: string, columnDef?: ColumnDef): ReactNode {
  if (value == null) return <span className="text-[#A69DC0]">{"\u2014"}</span>;

  // Array of objects with name + color → colored pills
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "name" in value[0] &&
    "color" in value[0]
  ) {
    return renderColoredPills(value as { name: string; color: string }[]);
  }

  const formatted = formatCellValue(value, key, columnDef);
  if (formatted === "\u2014") return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  return <>{formatted}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/components/DataGrid/renderCell.tsx
git commit -m "feat(data-grid): extract shared renderCell utility from ExploreTable"
```

---

### Task 3: Test renderCell

**Files:**
- Create: `src/features/shared/components/DataGrid/__tests__/renderCell.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/features/shared/components/DataGrid/__tests__/renderCell.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/__tests__/renderCell.test.tsx
git commit -m "test(data-grid): add renderCell unit tests"
```

---

### Task 4: Update column definitions to use shared ColumnDef

**Files:**
- Modify: `src/features/map/components/explore/columns/districtColumns.ts` (lines 4–13)
- Modify: `src/features/map/components/explore/columns/activityColumns.ts` (lines 4–12)
- Modify: `src/features/map/components/explore/columns/taskColumns.ts` (lines 4–12)
- Modify: `src/features/map/components/explore/columns/contactColumns.ts` (lines 4–12)
- Modify: `src/features/map/components/explore/columns/planColumns.ts` (imports ColumnDef from districtColumns)

For each column file:
1. Replace the local `interface ColumnDef` with `import type { ColumnDef } from "@/features/shared/components/DataGrid/types";`
2. Add `sortable: false` to specific columns (see list below)
3. All other columns get no `sortable` property (defaults to true)

**Note:** The local ColumnDef in activityColumns, taskColumns, and contactColumns uses a narrower `filterType` union (missing `"relation"`). The shared type is intentionally broader — no columns in those files use `"relation"`, so the switch is safe. Similarly, districtColumns uses `relationSource?: "tags" | "plans"` which is narrower than the shared `string` — also safe.

- [ ] **Step 1: Update districtColumns.ts — replace local interface with shared import**

Replace lines 4–13 (the local `interface ColumnDef` block) with:
```ts
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
```

Add `sortable: false` to these exact keys: `tags`, `planNames`, `websiteUrl`, `jobBoardUrl`. Read the file first to confirm key names.

- [ ] **Step 2: Update activityColumns.ts — same pattern**

Replace local interface, import from shared. Add `sortable: false` to: `districtNames`, `planNames`, `contactNames`.

- [ ] **Step 3: Update taskColumns.ts — same pattern**

Replace local interface, import from shared. Add `sortable: false` to: `districtNames`, `planNames`, `contactNames`, `activityNames`.

- [ ] **Step 4: Update contactColumns.ts — same pattern**

Replace local interface, import from shared. Add `sortable: false` to: `linkedinUrl`.

- [ ] **Step 5: Update planColumns.ts — update import**

This file imports ColumnDef from districtColumns. Change to import from shared types instead.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new type errors in the column files. (There may be pre-existing errors elsewhere; only verify column files compile.)

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/explore/columns/
git commit -m "refactor(data-grid): migrate column definitions to shared ColumnDef, add sortable"
```

---

## Chunk 2: DataGrid Component

### Task 5: Create DataGrid core

**Files:**
- Create: `src/features/shared/components/DataGrid/DataGrid.tsx`

This is the main component. It handles:
- TanStack React Table setup (useReactTable, getCoreRowModel, flexRender)
- Column conversion from our ColumnDef to TanStack's format
- Header rendering with sort indicators and column reordering
- Body rendering with cell formatting and custom renderers
- Checkbox column for selection
- Footer with count and optional summary
- Pagination
- ARIA attributes

Important implementation notes:
- Column labels: DataGrid uses `props.columnLabel(key)` if provided, otherwise looks up `columnDefs.find(c => c.key === key)?.label`. The parent (ExploreOverlay) passes a `columnLabel` function that handles entity-specific labels and dynamic competitor columns (from ExploreTable lines 51–92).
- Copy the column reordering drag-and-drop logic from ExploreTable
- Copy the pagination logic from ExploreTable lines 1244–1274
- Use spec token colors: borders `#D4CFE2`, header bg `#F7F5FA`, row hover `#EFEDF5`, row dividers `#E2DEEC`
- Header text class: `text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider` (from spec line 82)
- **Intentional style migration:** Cell text changes from `text-[13px] text-gray-600` (existing ExploreTable) to `text-sm text-[#6E6390]` (spec tokens). This is deliberate.

- [ ] **Step 1: Create DataGrid.tsx**

Read ExploreTable.tsx fully before writing. The new DataGrid should:

1. Accept `DataGridProps` (from types.ts)
2. Render the `_foundations.md` card wrapper: `<div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm">`
3. Build TanStack columns from `visibleColumns` + `columnDefs`
4. For each column, check `cellRenderers[key]` first, then fall back to `renderCell(value, key, columnDef)` — pass the full `ColumnDef` so currency detection works without global state
5. Add checkbox column if `selectedIds` prop is provided. Header checkbox: `aria-label="Select all rows on this page"`
6. Render header with:
   - `role="grid"` on the table with `aria-rowcount={pagination?.total ?? data.length}` and `aria-colcount={columnDefs.length}`
   - `aria-sort="ascending"` / `"descending"` / `"none"` on sortable column headers
   - Sort indicator arrows (w-3 h-3, `#403770` active, `#A69DC0` inactive)
   - Click to sort: pass `(column, event.shiftKey)` to `onSort`. Respect `sortable: false`. Three-state cycle (asc → desc → remove) is handled by the parent via `onSort`.
   - Drag-to-reorder column headers
7. Render body with:
   - Row hover: `hover:bg-[#EFEDF5]`
   - Selected row: `bg-[#C4E7E6]/15`
   - Cell text: `text-sm text-[#6E6390]` (standard data), `text-sm font-medium text-[#403770]` (first/name column)
   - Expanding rows if `expandedRowIds` + `renderExpandedRow` are provided
8. Render footer: `px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]` with `aria-live="polite"` on the count element
9. Render pagination below the card

Target: ~300-400 lines. This is the core component and can be larger, but should NOT include entity-specific logic.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "DataGrid" | head -10`
Expected: No type errors in DataGrid.tsx

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/DataGrid.tsx
git commit -m "feat(data-grid): create DataGrid core component with TanStack, sorting, pagination"
```

---

### Task 6: Create SelectAllBanner

**Files:**
- Create: `src/features/shared/components/DataGrid/SelectAllBanner.tsx`

- [ ] **Step 1: Write SelectAllBanner**

```tsx
// src/features/shared/components/DataGrid/SelectAllBanner.tsx
"use client";

interface SelectAllBannerProps {
  pageRowCount: number;
  totalMatching: number;
  selectAllMatchingFilters: boolean;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
}

export function SelectAllBanner({
  pageRowCount,
  totalMatching,
  selectAllMatchingFilters,
  onSelectAllMatching,
  onClearSelection,
}: SelectAllBannerProps) {
  if (selectAllMatchingFilters) {
    return (
      <div className="bg-[#C4E7E6]/20 text-xs text-[#403770] text-center py-2 border-b border-[#E2DEEC]">
        All {totalMatching.toLocaleString()} results selected.{" "}
        <button
          onClick={onClearSelection}
          className="font-semibold underline cursor-pointer"
        >
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#C4E7E6]/20 text-xs text-[#403770] text-center py-2 border-b border-[#E2DEEC]">
      All {pageRowCount} rows on this page are selected.{" "}
      <button
        onClick={onSelectAllMatching}
        className="font-semibold underline cursor-pointer"
      >
        Select all {totalMatching.toLocaleString()} matching results
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Import SelectAllBanner in DataGrid.tsx**

Add it between `<thead>` and `<tbody>` when all rows on the page are selected:

```tsx
{showSelectAllBanner && (
  <SelectAllBanner
    pageRowCount={data.length}
    totalMatching={pagination?.total ?? 0}
    selectAllMatchingFilters={selectAllMatchingFilters ?? false}
    onSelectAllMatching={onSelectAllMatching!}
    onClearSelection={onClearSelection!}
  />
)}
```

Where `showSelectAllBanner` is true when `selectedIds` is provided, `onSelectAllMatching` exists, and all current page rows are selected.

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/SelectAllBanner.tsx src/features/shared/components/DataGrid/DataGrid.tsx
git commit -m "feat(data-grid): add select-all escalation banner"
```

---

### Task 7: Add loading, error, and empty states to DataGrid

**Files:**
- Modify: `src/features/shared/components/DataGrid/DataGrid.tsx`

- [ ] **Step 1: Add states as conditional rendering in DataGrid body**

Follow the spec exactly:

**Loading (initial):** When `isLoading && data.length === 0`:
- Show 5 skeleton rows with `bg-[#E2DEEC]/60 animate-pulse rounded h-4`
- Varying widths per column (60%, 30%, 40% cycling)
- Header stays intact

**Loading (refresh):** When `isLoading && data.length > 0`:
- Existing rows: `opacity-50 transition-opacity`
- Progress bar below header: `h-0.5 bg-[#403770]` with CSS sliding animation (add `@keyframes` to component)

**Empty (no results, with filters):** When `!isLoading && !isError && data.length === 0 && hasActiveFilters`:
- Container: `role="status"` for screen readers
- Centered: filter icon, "No matching results", "Try adjusting your filters or search term"
- "Clear all filters" button: calls `onClearFilters` prop, styled per spec

**Empty (no data):** When `!isLoading && !isError && data.length === 0 && !hasActiveFilters`:
- Container: `role="status"` for screen readers
- Centered: entity icon, "No {entityType} yet", contextual text

**Error state:** When `isError`:
- Container: `role="status"` for screen readers
- Centered: error icon, "Something went wrong", "Failed to load {entityType}"
- "Try again" button: calls `onRetry` prop if provided

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/components/DataGrid/DataGrid.tsx
git commit -m "feat(data-grid): add loading, error, and empty states with spec styling"
```

---

### Task 8: Test DataGrid component

**Files:**
- Create: `src/features/shared/components/DataGrid/__tests__/DataGrid.test.tsx`

- [ ] **Step 1: Write tests**

Test the key behaviors:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataGrid } from "../DataGrid";
import type { ColumnDef } from "../types";

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

describe("DataGrid", () => {
  it("renders column headers (uppercased via CSS)", () => {
    render(<DataGrid {...defaultProps} />);
    // Headers render label text and are uppercased via CSS `uppercase` class, not in JSX
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

  it("calls onSort when header is clicked", () => {
    render(<DataGrid {...defaultProps} />);
    fireEvent.click(screen.getByText("Name"));
    expect(defaultProps.onSort).toHaveBeenCalledWith("name", false);
  });

  it("does not sort columns with sortable: false", () => {
    const cols = [
      ...testColumns.slice(0, 2),
      { ...testColumns[2], sortable: false },
    ];
    const onSort = vi.fn();
    render(<DataGrid {...defaultProps} columnDefs={cols} onSort={onSort} />);
    fireEvent.click(screen.getByText("Count"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("renders checkboxes when selectedIds is provided", () => {
    render(
      <DataGrid
        {...defaultProps}
        selectedIds={new Set<string>()}
        onToggleSelect={vi.fn()}
        onSelectPage={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(4); // 1 header + 3 rows
  });

  it("shows skeleton rows when loading with no data", () => {
    render(<DataGrid {...defaultProps} data={[]} isLoading={true} />);
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    // Skeleton rows should be present (check for animate-pulse class)
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no data and not loading", () => {
    render(<DataGrid {...defaultProps} data={[]} />);
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has role=grid on table element", () => {
    render(<DataGrid {...defaultProps} />);
    expect(document.querySelector("[role='grid']")).toBeInTheDocument();
  });

  it("shows aria-sort on sorted column", () => {
    render(<DataGrid {...defaultProps} sorts={[{ column: "name", direction: "asc" }]} />);
    const nameHeader = screen.getByText("Name").closest("th");
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("toggles row selection when checkbox clicked", () => {
    const onToggle = vi.fn();
    render(
      <DataGrid
        {...defaultProps}
        selectedIds={new Set<string>()}
        onToggleSelect={onToggle}
        onSelectPage={vi.fn()}
        onClearSelection={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // first data row
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("shows reduced opacity during refresh loading", () => {
    const { container } = render(
      <DataGrid {...defaultProps} isLoading={true} />
    );
    // opacity-50 may be on tbody itself or a child wrapper — check both
    const tbody = container.querySelector("tbody");
    const hasDimming = tbody?.classList.contains("opacity-50") || tbody?.querySelector(".opacity-50");
    expect(hasDimming).toBeTruthy();
  });

  it("shows error state with retry button and role=status", () => {
    const onRetry = vi.fn();
    render(<DataGrid {...defaultProps} data={[]} isError={true} onRetry={onRetry} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/try again/i));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows filtered empty state with clear filters button and role=status", () => {
    const onClear = vi.fn();
    render(<DataGrid {...defaultProps} data={[]} hasActiveFilters={true} onClearFilters={onClear} />);
    expect(screen.getByText(/no matching results/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/clear all filters/i));
    expect(onClear).toHaveBeenCalled();
  });

  it("renders footer with count", () => {
    render(<DataGrid {...defaultProps} />);
    expect(screen.getByText(/showing 1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/features/shared/components/DataGrid/__tests__/DataGrid.test.tsx`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/DataGrid/__tests__/DataGrid.test.tsx
git commit -m "test(data-grid): add DataGrid integration tests"
```

---

### Task 9: Update barrel export

**Files:**
- Modify: `src/features/shared/components/DataGrid/index.ts`

- [ ] **Step 1: Update exports**

```ts
export { DataGrid } from "./DataGrid";
export { SelectAllBanner } from "./SelectAllBanner";
export { renderCell, formatCellValue } from "./renderCell";
export type {
  ColumnDef,
  SortRule,
  FilterRule,
  DataGridProps,
  CellRendererFn,
} from "./types";
```

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/components/DataGrid/index.ts
git commit -m "chore(data-grid): update barrel exports"
```

---

## Chunk 3: Migration

### Task 10: Extract entity-specific cell renderers from ExploreTable

**Files:**
- Create: `src/features/map/components/explore/cellRenderers.tsx`
- Reference: `src/features/map/components/explore/ExploreTable.tsx` lines 182–700 (approx)

Extract these components from ExploreTable into a new file:
- `EditableOwnerCell` — uses `useUsers` hook
- `EditableTextCell` — generic text editing
- `EditableCurrencyCell` — currency input with optimistic updates
- `EditableTagsCell` — tag picker with create-new
- `EditablePlansCell` — plan assignment with optimistic updates
- `ClickToCopyCell` — click-to-copy with tooltip feedback
- `PLAN_STATUS_STYLES` — status color map used by plan cell renderers
- `EditableServiceCell` (if present)
- `EditablePlanAssignmentCell` (if present)
- `useOutsideClick` hook
- `PlanExpansionRow` — the plan expansion sub-table (~lines 781–1236), extracted as a standalone component that receives a district row and renders the expandable plan details table

Also export a function that builds the `CellRendererMap` for each entity type, using these components.

For plans entity, also export `usePlanCellRenderers()` which maps plan-specific columns to their renderers (status pills using `PLAN_STATUS_STYLES`, etc).

- [ ] **Step 1: Read ExploreTable.tsx fully to identify all custom cell components and their dependencies**

Read lines 180–700 to catalog every custom cell component and what hooks/APIs they use.

- [ ] **Step 2: Create cellRenderers.tsx**

Move each custom cell component from ExploreTable. Keep their exact implementations — only change imports.

Export a function per entity that returns a `Record<string, CellRendererFn>`:

```tsx
export function useDistrictCellRenderers(): Record<string, CellRendererFn> {
  const users = useUsers();
  const updateEdits = useUpdateDistrictEdits();
  // ... etc

  return {
    owner: ({ value, row }) => (
      <EditableOwnerCell
        value={value}
        rowId={String(row.leaid)}
        onSave={(rowId, col, val) => updateEdits.mutate({ leaid: rowId, [col]: val })}
        users={users.data}
      />
    ),
    tags: ({ value, row }) => (
      <EditableTagsCell
        tags={(value as { id: number; name: string; color: string }[]) || []}
        rowId={String(row.leaid)}
      />
    ),
    // ... other editable columns
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "cellRenderer" | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/explore/cellRenderers.tsx
git commit -m "refactor(data-grid): extract entity-specific cell renderers from ExploreTable"
```

---

### Task 11: Wire ExploreOverlay to DataGrid

**Files:**
- Modify: `src/features/map/components/explore/ExploreOverlay.tsx`

- [ ] **Step 1: Read current ExploreOverlay.tsx**

Understand the current prop passing to ExploreTable (lines 346–361).

- [ ] **Step 2: Replace ExploreTable import with DataGrid**

```tsx
import { DataGrid } from "@/features/shared/components/DataGrid";
import { useDistrictCellRenderers, usePlanCellRenderers, PlanExpansionRow } from "./cellRenderers";
```

- [ ] **Step 3: Add cell renderer hook calls**

Inside ExploreOverlay, add:
```tsx
const districtCellRenderers = useDistrictCellRenderers();
const planCellRenderers = usePlanCellRenderers();
const cellRenderers = exploreEntity === "districts"
  ? districtCellRenderers
  : exploreEntity === "plans"
  ? planCellRenderers
  : undefined;
```

- [ ] **Step 4: Replace ExploreTable JSX with DataGrid**

```tsx
<DataGrid
  data={result?.data || []}
  columnDefs={ENTITY_COLUMN_DEFS[exploreEntity]}
  entityType={exploreEntity}
  isLoading={isLoading}
  isError={isError}
  onRetry={() => refetch()}
  visibleColumns={exploreColumns[exploreEntity]}
  onColumnsChange={(cols) => setExploreColumns(exploreEntity, cols)}
  sorts={exploreSort[exploreEntity]}
  onSort={handleSort}
  hasActiveFilters={exploreFilters[exploreEntity]?.length > 0}
  onClearFilters={() => clearExploreFilters(exploreEntity)}
  pagination={result?.pagination}
  onPageChange={(page) => setExplorePage(page)}
  onPageSizeChange={(size) => setExplorePageSize(size)}
  selectedIds={exploreEntity === "districts" ? selectedDistrictLeaids : undefined}
  selectAllMatchingFilters={selectAllMatchingFilters}
  onToggleSelect={exploreEntity === "districts" ? toggleDistrictSelection : undefined}
  onSelectPage={exploreEntity === "districts" ? (ids) => setDistrictSelection(ids) : undefined}
  onSelectAllMatching={exploreEntity === "districts" ? () => setSelectAllMatchingFilters(true) : undefined}
  onClearSelection={exploreEntity === "districts" ? clearDistrictSelection : undefined}
  onRowClick={handleRowClick}
  cellRenderers={cellRenderers}
  columnLabel={getColumnLabel}
  rowIdAccessor={exploreEntity === "districts" ? "leaid" : "id"}
  expandedRowIds={exploreEntity === "districts" ? expandedDistrictIds : undefined}
  onToggleExpand={exploreEntity === "districts" ? toggleDistrictExpand : undefined}
  renderExpandedRow={exploreEntity === "districts" ? (row) => <PlanExpansionRow district={row} /> : undefined}
/>
```

**Note:** The `getColumnLabel` function already exists in ExploreOverlay (or ExploreTable) — it resolves entity-specific labels and dynamic competitor column names. Extract it from ExploreTable if needed, or it may already be in ExploreOverlay.

**Note:** BulkActionBar is rendered OUTSIDE the DataGrid (already rendered separately in ExploreOverlay). It reads selection state from the store and doesn't need any changes. Verify it still works during manual testing in Step 6.
```

- [ ] **Step 5: Run dev server and verify the grid renders correctly**

Run: `npm run dev`
Open: `http://localhost:3005` → navigate to Explore → verify:
- Districts table renders with data
- Column headers show with sort indicators
- Clicking a header sorts
- Checkboxes work for selection
- Pagination works
- Inline editing works (owner, tags, text fields)
- Switch entity tabs (activities, tasks, contacts, plans)

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/features/map/components/explore/ExploreOverlay.tsx
git commit -m "feat(data-grid): wire ExploreOverlay to use shared DataGrid component"
```

---

### Task 12: Clean up — remove ExploreTable

**Files:**
- Delete: `src/features/map/components/explore/ExploreTable.tsx`
- Modify: Any remaining imports of ExploreTable

- [ ] **Step 1: Search for any remaining ExploreTable imports**

Run: `grep -r "ExploreTable" src/ --include="*.tsx" --include="*.ts" -l`
Expected: Only ExploreOverlay.tsx (which we already updated). If others exist, update them.

- [ ] **Step 2: Delete ExploreTable.tsx**

Only delete after confirming no other files import it and the app works.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git rm src/features/map/components/explore/ExploreTable.tsx
git commit -m "refactor(data-grid): remove ExploreTable after migration to shared DataGrid"
```

---

## Chunk 4: Documentation Update

### Task 13: Update data-grid.md file reference

**Files:**
- Modify: `Documentation/UI Framework/Components/Tables/data-grid.md` (lines 621–633)

- [ ] **Step 1: Update file reference table**

Replace the current file reference table with:

```markdown
| Component | File |
|---|---|
| DataGrid (shared) | `src/features/shared/components/DataGrid/DataGrid.tsx` |
| DataGrid types | `src/features/shared/components/DataGrid/types.ts` |
| renderCell utility | `src/features/shared/components/DataGrid/renderCell.tsx` |
| SelectAllBanner | `src/features/shared/components/DataGrid/SelectAllBanner.tsx` |
| ExploreOverlay (state owner) | `src/features/map/components/explore/ExploreOverlay.tsx` |
| Entity cell renderers | `src/features/map/components/explore/cellRenderers.tsx` |
| District column definitions | `src/features/map/components/explore/columns/districtColumns.ts` |
| Activity column definitions | `src/features/map/components/explore/columns/activityColumns.ts` |
| Task column definitions | `src/features/map/components/explore/columns/taskColumns.ts` |
| Contact column definitions | `src/features/map/components/explore/columns/contactColumns.ts` |
| Plan column definitions | `src/features/map/components/explore/columns/planColumns.ts` |
| InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
| Design reference | Paper → Components → Tables artboard (Data Grid sections) |
```

- [ ] **Step 2: Commit**

```bash
git add Documentation/UI Framework/Components/Tables/data-grid.md
git commit -m "docs: update data-grid file reference after implementation"
```

---

## Summary

| Chunk | Tasks | Deliverable |
|---|---|---|
| 1: Types & Utils | 1–4 | Shared ColumnDef, renderCell, column files updated |
| 2: DataGrid Component | 5–9 | DataGrid.tsx with selection, sorting, ARIA, states, tests |
| 3: Migration | 10–12 | ExploreOverlay uses DataGrid, ExploreTable deleted |
| 4: Documentation | 13 | Updated file references |

Total: 13 tasks, ~50 steps. Each step is 2–5 minutes of focused work.
