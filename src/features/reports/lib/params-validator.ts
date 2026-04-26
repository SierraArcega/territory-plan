import {
  SEMANTIC_CONTEXT,
  TABLE_REGISTRY,
  type ColumnMetadata,
  type TableMetadata,
} from "@/lib/district-column-metadata";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Aggregation,
  type Filter,
  type FilterOp,
  type Join,
  type OrderBy,
  type QueryParams,
} from "./types";

export interface ValidationOk {
  valid: true;
  /** Params normalized (limit clamped, joins deduped). */
  normalized: QueryParams;
}

export interface ValidationFail {
  valid: false;
  errors: string[];
}

export type ValidationResult = ValidationOk | ValidationFail;

const OPS_REQUIRING_VALUE: readonly FilterOp[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
];
const OPS_REQUIRING_ARRAY: readonly FilterOp[] = ["in", "notIn"];
const OPS_REQUIRING_NO_VALUE: readonly FilterOp[] = ["isNull", "isNotNull"];

const VALID_OPS: ReadonlySet<FilterOp> = new Set<FilterOp>([
  ...OPS_REQUIRING_VALUE,
  ...OPS_REQUIRING_ARRAY,
  ...OPS_REQUIRING_NO_VALUE,
]);

const VALID_AGG_FNS = new Set(["sum", "avg", "min", "max", "count"]);

export function validateParams(params: QueryParams): ValidationResult {
  const errors: string[] = [];
  const excluded = new Set(SEMANTIC_CONTEXT.excludedTables);

  // Root table exists and isn't excluded.
  const rootMeta = TABLE_REGISTRY[params.table];
  if (!rootMeta) {
    errors.push(
      `table '${params.table}' is not in the query tool's registry`,
    );
    return { valid: false, errors };
  }
  if (excluded.has(params.table)) {
    errors.push(`table '${params.table}' is excluded from the query tool`);
    return { valid: false, errors };
  }

  // Validate and dedupe joins. Each join's `toTable` may be either a real
  // table name or a registered alias (for self-joins / disambiguated joins).
  // Relationships are matched by `rel.alias ?? rel.toTable`.
  const joinedTables = new Map<string, TableMetadata>();
  const normalizedJoins: Join[] = [];
  for (const join of params.joins ?? []) {
    const joinKey = join.toTable;
    if (joinedTables.has(joinKey)) continue;
    // Skip self-references to the root unless declared via an alias.
    if (joinKey === params.table) continue;
    const rel = rootMeta.relationships.find(
      (r) => (r.alias ?? r.toTable) === joinKey,
    );
    if (!rel) {
      errors.push(
        `no declared relationship from '${params.table}' to '${joinKey}'`,
      );
      continue;
    }
    const target = TABLE_REGISTRY[rel.toTable];
    if (!target) {
      errors.push(`join target '${rel.toTable}' is not registered`);
      continue;
    }
    if (excluded.has(rel.toTable)) {
      errors.push(`join target '${rel.toTable}' is excluded`);
      continue;
    }
    joinedTables.set(joinKey, target);
    normalizedJoins.push(join);
  }

  // Build a column lookup covering root + joined tables.
  const columnIndex = buildColumnIndex(rootMeta, joinedTables);

  // Columns.
  for (const col of params.columns ?? []) {
    if (!resolveColumn(col, params.table, columnIndex)) {
      errors.push(`column '${col}' not found on ${describeScope(params.table, joinedTables)}`);
    }
  }

  // Aggregations.
  for (const agg of params.aggregations ?? []) {
    const errMsg = validateAggregation(agg, params.table, columnIndex);
    if (errMsg) errors.push(errMsg);
  }

  // Group by columns must be real columns in scope.
  for (const col of params.groupBy ?? []) {
    if (!resolveColumn(col, params.table, columnIndex)) {
      errors.push(`groupBy column '${col}' not found`);
    }
  }

  // Aggregation + non-aggregated coherence: if any aggregations are present,
  // every selected column that isn't itself an aggregation alias must be in groupBy.
  if (params.aggregations && params.aggregations.length > 0 && params.columns) {
    const groupBySet = new Set(params.groupBy ?? []);
    for (const col of params.columns) {
      if (!groupBySet.has(col)) {
        errors.push(
          `column '${col}' is not in groupBy — required when aggregations are used`,
        );
      }
    }
  }

  // Filters.
  for (const f of params.filters ?? []) {
    const errMsgs = validateFilter(f, params.table, columnIndex);
    errors.push(...errMsgs);
  }

  // Order by columns: must resolve to a real column OR match an aggregation alias.
  const aggAliases = new Set(
    (params.aggregations ?? []).map((a) => a.alias ?? `${a.fn}_${a.column}`),
  );
  for (const o of params.orderBy ?? []) {
    if (o.direction !== "asc" && o.direction !== "desc") {
      errors.push(`orderBy direction must be 'asc' or 'desc', got '${o.direction}'`);
    }
    if (
      !aggAliases.has(o.column) &&
      !resolveColumn(o.column, params.table, columnIndex)
    ) {
      errors.push(`orderBy column '${o.column}' not found`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const rawLimit = params.limit ?? DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)));

  return {
    valid: true,
    normalized: {
      ...params,
      limit,
      joins: normalizedJoins.length > 0 ? normalizedJoins : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

type ColumnIndex = Map<string, Map<string, ColumnMetadata>>; // tableName → columnName → meta

function buildColumnIndex(
  rootMeta: TableMetadata,
  joined: Map<string, TableMetadata>,
): ColumnIndex {
  const idx: ColumnIndex = new Map();
  idx.set(rootMeta.table, mapColumns(rootMeta));
  for (const [name, meta] of joined) {
    idx.set(name, mapColumns(meta));
  }
  return idx;
}

function mapColumns(meta: TableMetadata): Map<string, ColumnMetadata> {
  const m = new Map<string, ColumnMetadata>();
  for (const c of meta.columns) m.set(c.column, c);
  return m;
}

/**
 * Resolve a column reference to { table, column, meta } if valid.
 * - "table.column" → explicit qualification
 * - "column" → looks up on root table first, else unique match across joined tables
 */
function resolveColumn(
  reference: string,
  rootTable: string,
  idx: ColumnIndex,
):
  | { table: string; column: string; meta: ColumnMetadata }
  | null {
  if (reference === "*") {
    // COUNT(*) — only valid in aggregation context, caller checks
    return { table: rootTable, column: "*", meta: null as unknown as ColumnMetadata };
  }
  const dotIdx = reference.indexOf(".");
  if (dotIdx > -1) {
    const table = reference.slice(0, dotIdx);
    const column = reference.slice(dotIdx + 1);
    const cols = idx.get(table);
    if (!cols) return null;
    const meta = cols.get(column);
    return meta ? { table, column, meta } : null;
  }
  // Unqualified — prefer root table.
  const rootCols = idx.get(rootTable);
  const rootMatch = rootCols?.get(reference);
  if (rootMatch) return { table: rootTable, column: reference, meta: rootMatch };
  // Check joined tables; if exactly one match, use it.
  const matches: Array<{ table: string; meta: ColumnMetadata }> = [];
  for (const [table, cols] of idx) {
    if (table === rootTable) continue;
    const m = cols.get(reference);
    if (m) matches.push({ table, meta: m });
  }
  if (matches.length === 1) {
    return { table: matches[0].table, column: reference, meta: matches[0].meta };
  }
  // 0 matches or ambiguous → not resolvable.
  return null;
}

function validateFilter(
  f: Filter,
  rootTable: string,
  idx: ColumnIndex,
): string[] {
  const errs: string[] = [];
  if (!VALID_OPS.has(f.op)) {
    errs.push(`filter op '${f.op}' is not supported`);
    return errs;
  }
  if (!resolveColumn(f.column, rootTable, idx)) {
    errs.push(`filter column '${f.column}' not found`);
    return errs;
  }
  const hasValue = f.value !== undefined;
  if (OPS_REQUIRING_VALUE.includes(f.op) && !hasValue) {
    errs.push(`filter op '${f.op}' on '${f.column}' requires a value`);
  }
  if (OPS_REQUIRING_NO_VALUE.includes(f.op) && hasValue) {
    errs.push(`filter op '${f.op}' on '${f.column}' should not have a value`);
  }
  if (OPS_REQUIRING_ARRAY.includes(f.op)) {
    if (!Array.isArray(f.value) || f.value.length === 0) {
      errs.push(`filter op '${f.op}' on '${f.column}' requires a non-empty array value`);
    }
  }
  return errs;
}

function validateAggregation(
  agg: Aggregation,
  rootTable: string,
  idx: ColumnIndex,
): string | null {
  if (!VALID_AGG_FNS.has(agg.fn)) {
    return `aggregation fn '${agg.fn}' is not supported`;
  }
  if (agg.column === "*") {
    if (agg.fn !== "count") {
      return `aggregation '${agg.fn}(*)' is only valid for count`;
    }
    return null;
  }
  if (!resolveColumn(agg.column, rootTable, idx)) {
    return `aggregation column '${agg.column}' not found`;
  }
  return null;
}

function describeScope(
  rootTable: string,
  joined: Map<string, TableMetadata>,
): string {
  if (joined.size === 0) return `table '${rootTable}'`;
  const joinedNames = Array.from(joined.keys()).join(", ");
  return `tables ['${rootTable}', ${joinedNames}]`;
}
