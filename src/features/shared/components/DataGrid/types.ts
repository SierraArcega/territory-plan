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
