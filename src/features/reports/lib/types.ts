/**
 * Structured query parameters for the Claude query tool. These params are the
 * canonical representation of a report — saved to saved_reports.params JSONB,
 * produced by Claude's NL→params tool_use, consumed by the Builder UI chips,
 * and compiled to SQL server-side.
 *
 * SQL is never exposed to the client. If debugging requires it, it's in
 * query_log.sql (server-side only).
 */

export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "notIn"
  | "like"
  | "ilike"
  | "isNull"
  | "isNotNull";

export type FilterValue = string | number | boolean | Array<string | number>;

export interface Filter {
  /** Column name. For joined queries, may be qualified as `table.column`. */
  column: string;
  op: FilterOp;
  /** Required for all ops except `isNull` / `isNotNull`. */
  value?: FilterValue;
}

export type AggregationFn = "sum" | "avg" | "min" | "max" | "count";

export interface Aggregation {
  /** Column to aggregate. Use `"*"` for COUNT(*). */
  column: string;
  fn: AggregationFn;
  /** Alias for the result column; defaults to `${fn}_${column}`. */
  alias?: string;
}

export interface OrderBy {
  /** Column or alias to sort by. */
  column: string;
  direction: "asc" | "desc";
}

export interface Join {
  /** Target table — must be in TABLE_REGISTRY and reachable via a declared relationship. */
  toTable: string;
}

export interface QueryParams {
  /** Root table for the query — must be registered and not excluded. */
  table: string;
  /** Columns to return. If omitted and no aggregations, SELECT * (capped). */
  columns?: string[];
  /** Filter conditions (ANDed together for MVP). */
  filters?: Filter[];
  /** Columns to GROUP BY (required whenever aggregations + non-aggregated columns coexist). */
  groupBy?: string[];
  /** Aggregation expressions — when present, non-aggregated columns must all be in groupBy. */
  aggregations?: Aggregation[];
  /** Sort order, applied after aggregation. */
  orderBy?: OrderBy[];
  /** Max rows to return. Capped at MAX_LIMIT (500); defaults to DEFAULT_LIMIT (100). */
  limit?: number;
  /** Additional tables to join via their declared relationships. */
  joins?: Join[];
}

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;

/** Result shape returned by POST /api/ai/query/run. */
export interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
}
