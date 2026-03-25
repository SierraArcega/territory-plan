// Report Builder types — shared between frontend hooks and components.

// Re-export filter types from explore for convenience
export type { FilterDef, FilterOp } from "@/features/explore/lib/filters";

// ---------------------------------------------------------------------------
// Schema types — returned by GET /api/reports/schema
// ---------------------------------------------------------------------------

export interface ColumnSchema {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

export interface EntitySchema {
  name: string;
  label: string;
  columns: ColumnSchema[];
}

export interface ReportSchema {
  entities: EntitySchema[];
}

// ---------------------------------------------------------------------------
// Report config — the query config object managed by the ReportBuilder
// ---------------------------------------------------------------------------

export interface SortDef {
  column: string;
  direction: "asc" | "desc";
}

export interface ReportConfig {
  source: string;
  columns: string[];
  filters: import("@/features/explore/lib/filters").FilterDef[];
  sorts: SortDef[];
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Query response — returned by POST /api/reports/query
// ---------------------------------------------------------------------------

export interface ReportQueryResponse {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Saved report — stored in database, returned by CRUD APIs
// ---------------------------------------------------------------------------

export interface SavedReport {
  id: string;
  name: string;
  source: string;
  config: {
    columns: string[];
    filters: import("@/features/explore/lib/filters").FilterDef[];
    sorts: SortDef[];
    pageSize: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sharedWith: string[];
  creator?: {
    fullName: string | null;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface SavedReportListResponse {
  reports: SavedReport[];
}

export interface SavedReportResponse {
  report: SavedReport;
}
