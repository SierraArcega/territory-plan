// Pure types + helpers behind FilterBuilder / SortDropdown.
//
// A typed column config drives both: which operators a column offers (by
// type), how a filter is evaluated client-side (buildFilterPredicate), and
// how multi-column sorts compare rows (buildComparator). Kept free of React
// so the evaluation logic is unit-testable and reusable (e.g. serializing
// the same filter shapes to an API).

import { fmtDate, parseLocalDate } from "@/features/shared/lib/date-utils";

export type FilterColumnType = "text" | "number" | "date" | "enum" | "boolean";

export type FilterBuilderOp =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "lt"
  | "between"
  | "after"
  | "before"
  | "is_true"
  | "is_false"
  | "is_empty"
  | "is_not_empty";

export interface FilterColumnOption {
  value: string;
  label: string;
}

export interface FilterColumn<Row = Record<string, unknown>> {
  key: string;
  label: string;
  type: FilterColumnType;
  /** Section heading in the column picker (optional). */
  group?: string;
  /** Required for `enum` columns: the selectable values. */
  options?: FilterColumnOption[];
  /** Read the filterable value off a row. Defaults to `row[key]`. */
  accessor?: (row: Row) => unknown;
  /** Optional separate accessor for sorting (e.g. a status order index). */
  sortAccessor?: (row: Row) => unknown;
}

export interface ActiveFilter {
  id: string;
  column: string;
  op: FilterBuilderOp;
  /** A string for single-value ops; `[lo, hi]` for `between`. */
  value?: string | [string, string];
}

export interface ColumnSort {
  key: string;
  dir: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Operator sets (per the leads design handoff §Filtering)
// ---------------------------------------------------------------------------

export const OPERATORS_BY_TYPE: Record<FilterColumnType, FilterBuilderOp[]> = {
  text: ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"],
  number: ["eq", "neq", "gt", "lt", "between"],
  date: ["after", "before", "between", "is_empty"],
  enum: ["eq", "neq"],
  boolean: ["is_true", "is_false"],
};

const OP_LABELS: Record<FilterBuilderOp, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  not_contains: "does not contain",
  gt: ">",
  lt: "<",
  between: "between",
  after: "after",
  before: "before",
  is_true: "is true",
  is_false: "is false",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

/** Number columns render eq/neq as symbols ("=", "≠") per the handoff. */
export function operatorLabel(
  type: FilterColumnType,
  op: FilterBuilderOp,
): string {
  if (type === "number" && op === "eq") return "=";
  if (type === "number" && op === "neq") return "≠";
  return OP_LABELS[op];
}

const NO_VALUE_OPS: ReadonlySet<FilterBuilderOp> = new Set([
  "is_true",
  "is_false",
  "is_empty",
  "is_not_empty",
]);

export function operatorNeedsValue(op: FilterBuilderOp): boolean {
  return !NO_VALUE_OPS.has(op);
}

// ---------------------------------------------------------------------------
// Row value access + date coercion
// ---------------------------------------------------------------------------

function getRowValue<Row>(col: FilterColumn<Row>, row: Row): unknown {
  return col.accessor
    ? col.accessor(row)
    : (row as Record<string, unknown>)[col.key];
}

function isEmptyValue(v: unknown): boolean {
  return v == null || v === "";
}

/**
 * Coerce a date-ish value to local-day-start ms. Strings are treated as
 * calendar dates via parseLocalDate (so UTC-midnight API dates don't shift
 * a day); Date objects keep their time. Returns null when unparseable.
 */
function dateMs(v: unknown): number | null {
  if (isEmptyValue(v)) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = parseLocalDate(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Local-day-start ms of the day AFTER the given calendar date (DST-safe). */
function nextDayMs(v: unknown): number | null {
  if (isEmptyValue(v)) return null;
  const d = v instanceof Date ? new Date(v) : parseLocalDate(String(v));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// buildFilterPredicate
// ---------------------------------------------------------------------------

function matchNumber(v: unknown, f: ActiveFilter): boolean {
  const n = isEmptyValue(v) ? null : Number(v);
  switch (f.op) {
    case "eq":
      return n != null && n === Number(f.value);
    case "neq":
      return n == null || n !== Number(f.value);
    case "gt":
      return n != null && n > Number(f.value);
    case "lt":
      return n != null && n < Number(f.value);
    case "between": {
      const [lo, hi] = f.value as [string, string];
      return n != null && n >= Number(lo) && n <= Number(hi);
    }
    default:
      return true;
  }
}

function matchDate(v: unknown, f: ActiveFilter): boolean {
  const t = dateMs(v);
  switch (f.op) {
    // Day-level semantics: "after Feb 12" excludes Feb 12 itself,
    // "before Feb 12" excludes Feb 12, "between" includes both endpoint days.
    case "after": {
      const bound = nextDayMs(f.value);
      return t != null && bound != null && t >= bound;
    }
    case "before": {
      const bound = dateMs(f.value);
      return t != null && bound != null && t < bound;
    }
    case "between": {
      const [lo, hi] = f.value as [string, string];
      const loMs = dateMs(lo);
      const hiMs = nextDayMs(hi);
      return t != null && loMs != null && hiMs != null && t >= loMs && t < hiMs;
    }
    default:
      return true;
  }
}

function matchOne<Row>(
  row: Row,
  f: ActiveFilter,
  col: FilterColumn<Row>,
): boolean {
  const v = getRowValue(col, row);
  switch (f.op) {
    case "is_empty":
      return isEmptyValue(v);
    case "is_not_empty":
      return !isEmptyValue(v);
    case "is_true":
      return v === true;
    case "is_false":
      return v === false;
    default:
      break;
  }
  if (col.type === "number") return matchNumber(v, f);
  if (col.type === "date") return matchDate(v, f);
  // text + enum: eq/neq exact (string), contains case-insensitive
  switch (f.op) {
    case "eq":
      return String(v ?? "") === String(f.value);
    case "neq":
      return String(v ?? "") !== String(f.value);
    case "contains":
      return String(v ?? "")
        .toLowerCase()
        .includes(String(f.value ?? "").toLowerCase());
    case "not_contains":
      return !String(v ?? "")
        .toLowerCase()
        .includes(String(f.value ?? "").toLowerCase());
    default:
      return true;
  }
}

/**
 * Compile active filters into a single row predicate. Filters AND together;
 * filters referencing unknown columns are ignored.
 */
export function buildFilterPredicate<Row>(
  filters: ActiveFilter[],
  columns: FilterColumn<Row>[],
): (row: Row) => boolean {
  const compiled: Array<(row: Row) => boolean> = [];
  for (const f of filters) {
    const col = columns.find((c) => c.key === f.column);
    if (col) compiled.push((row) => matchOne(row, f, col));
  }
  return (row) => compiled.every((p) => p(row));
}

// ---------------------------------------------------------------------------
// buildComparator
// ---------------------------------------------------------------------------

function compareByType<Row>(
  col: FilterColumn<Row>,
  av: unknown,
  bv: unknown,
): number {
  if (col.sortAccessor) {
    // Custom sort values: numeric when both sides are numbers, else string
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv));
  }
  switch (col.type) {
    case "number":
      return Number(av) - Number(bv);
    case "date":
      return (dateMs(av) ?? 0) - (dateMs(bv) ?? 0);
    case "boolean":
      return Number(av === true) - Number(bv === true);
    default:
      return String(av).localeCompare(String(bv));
  }
}

/**
 * Compile a multi-column sort into a comparator. Earlier entries take
 * priority; empty values sort last regardless of direction; sorts
 * referencing unknown columns are ignored.
 */
export function buildComparator<Row>(
  sorts: ColumnSort[],
  columns: FilterColumn<Row>[],
): (a: Row, b: Row) => number {
  const compiled = sorts.flatMap((s) => {
    const col = columns.find((c) => c.key === s.key);
    return col ? [{ s, col }] : [];
  });
  return (a, b) => {
    for (const { s, col } of compiled) {
      const read = col.sortAccessor ?? ((row: Row) => getRowValue(col, row));
      const av = read(a);
      const bv = read(b);
      const aEmpty = isEmptyValue(av);
      const bEmpty = isEmptyValue(bv);
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) continue;
        return aEmpty ? 1 : -1; // empties last, independent of direction
      }
      const cmp = compareByType(col, av, bv);
      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  };
}

// ---------------------------------------------------------------------------
// Pill display
// ---------------------------------------------------------------------------

/** Human-readable value portion of a filter pill (null for no-value ops). */
export function filterValueLabel<Row>(
  f: ActiveFilter,
  col: FilterColumn<Row>,
): string | null {
  if (!operatorNeedsValue(f.op) || f.value == null) return null;
  if (f.op === "between") {
    const [lo, hi] = f.value as [string, string];
    if (col.type === "date") return `${fmtDate(lo)}–${fmtDate(hi)}`;
    return `${lo}–${hi}`;
  }
  const value = String(f.value);
  if (col.type === "date") return fmtDate(value);
  if (col.type === "enum") {
    return col.options?.find((o) => o.value === value)?.label ?? value;
  }
  return value;
}
