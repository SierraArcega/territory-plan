import type {
  Aggregation,
  Filter,
  OrderBy,
  QueryParams,
} from "./types";

/**
 * Structured record of one change between two QueryParams snapshots.
 * Consumed by ChatMessage to render tagged action rows under an assistant reply.
 */
export interface ReceiptAction {
  kind: "add" | "rem" | "mod";
  field:
    | "table"
    | "join"
    | "column"
    | "filter"
    | "aggregation"
    | "groupBy"
    | "sort"
    | "limit";
  /** Primary text shown in the row, e.g. "owner_name" or "status = open". */
  label: string;
  /** Optional "was → now" detail for `mod` actions. */
  detail?: string;
}

/**
 * Semantic diff between two QueryParams snapshots. Array order within a field
 * is ignored — entries are keyed by identity (column name, alias, etc.) so
 * reorders don't produce spurious actions.
 */
export function diffParams(
  prev: QueryParams | null,
  next: QueryParams,
): ReceiptAction[] {
  const actions: ReceiptAction[] = [];

  // table
  if (!prev) {
    actions.push({ kind: "add", field: "table", label: next.table });
  } else if (prev.table !== next.table) {
    actions.push({
      kind: "mod",
      field: "table",
      label: next.table,
      detail: `${prev.table} → ${next.table}`,
    });
  }

  diffStringSet(
    actions,
    "join",
    (prev?.joins ?? []).map((j) => j.toTable),
    (next.joins ?? []).map((j) => j.toTable),
  );
  diffStringSet(actions, "column", prev?.columns ?? [], next.columns ?? []);
  diffFilters(actions, prev?.filters ?? [], next.filters ?? []);
  diffAggregations(
    actions,
    prev?.aggregations ?? [],
    next.aggregations ?? [],
  );
  diffStringSet(actions, "groupBy", prev?.groupBy ?? [], next.groupBy ?? []);
  diffOrderBy(actions, prev?.orderBy ?? [], next.orderBy ?? []);
  diffLimit(actions, prev?.limit, next.limit);

  return actions;
}

function diffStringSet(
  actions: ReceiptAction[],
  field: ReceiptAction["field"],
  prev: readonly string[],
  next: readonly string[],
): void {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  for (const v of next) if (!prevSet.has(v)) actions.push({ kind: "add", field, label: v });
  for (const v of prev) if (!nextSet.has(v)) actions.push({ kind: "rem", field, label: v });
}

function filterKey(f: Filter): string {
  return `${f.column}:${f.op}`;
}

function filterLabel(f: Filter): string {
  const opStr: Record<Filter["op"], string> = {
    eq: "=",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    like: "like",
    ilike: "ilike",
    in: "in",
    notIn: "not in",
    isNull: "is null",
    isNotNull: "is not null",
  };
  const op = opStr[f.op];
  if (f.op === "isNull" || f.op === "isNotNull") return `${f.column} ${op}`;
  const v = Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
  return `${f.column} ${op} ${v}`;
}

function filterValueStr(f: Filter): string {
  if (f.op === "isNull" || f.op === "isNotNull") return "";
  return Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
}

function diffFilters(
  actions: ReceiptAction[],
  prev: readonly Filter[],
  next: readonly Filter[],
): void {
  const prevMap = new Map(prev.map((f) => [filterKey(f), f]));
  const nextMap = new Map(next.map((f) => [filterKey(f), f]));

  for (const [key, f] of nextMap) {
    const prevF = prevMap.get(key);
    if (!prevF) {
      actions.push({ kind: "add", field: "filter", label: filterLabel(f) });
    } else if (filterValueStr(prevF) !== filterValueStr(f)) {
      actions.push({
        kind: "mod",
        field: "filter",
        label: filterLabel(f),
        detail: `${filterValueStr(prevF)} → ${filterValueStr(f)}`,
      });
    }
  }
  for (const [key, f] of prevMap) {
    if (!nextMap.has(key)) {
      actions.push({ kind: "rem", field: "filter", label: filterLabel(f) });
    }
  }
}

function aggKey(a: Aggregation): string {
  return a.alias ?? `${a.fn}_${a.column}`;
}

function aggBody(a: Aggregation): string {
  return `${a.fn}(${a.column})`;
}

function diffAggregations(
  actions: ReceiptAction[],
  prev: readonly Aggregation[],
  next: readonly Aggregation[],
): void {
  const prevMap = new Map(prev.map((a) => [aggKey(a), a]));
  const nextMap = new Map(next.map((a) => [aggKey(a), a]));

  for (const [key, a] of nextMap) {
    const prevA = prevMap.get(key);
    if (!prevA) {
      actions.push({ kind: "add", field: "aggregation", label: key });
    } else if (prevA.fn !== a.fn || prevA.column !== a.column) {
      actions.push({
        kind: "mod",
        field: "aggregation",
        label: key,
        detail: `${aggBody(prevA)} → ${aggBody(a)}`,
      });
    }
  }
  for (const [key] of prevMap) {
    if (!nextMap.has(key)) {
      actions.push({ kind: "rem", field: "aggregation", label: key });
    }
  }
}

function orderLabel(o: OrderBy): string {
  return `${o.column} ${o.direction === "desc" ? "↓" : "↑"}`;
}

function diffOrderBy(
  actions: ReceiptAction[],
  prev: readonly OrderBy[],
  next: readonly OrderBy[],
): void {
  const prevMap = new Map(prev.map((o) => [o.column, o]));
  const nextMap = new Map(next.map((o) => [o.column, o]));

  for (const [col, o] of nextMap) {
    const prevO = prevMap.get(col);
    if (!prevO) {
      actions.push({ kind: "add", field: "sort", label: orderLabel(o) });
    } else if (prevO.direction !== o.direction) {
      actions.push({
        kind: "mod",
        field: "sort",
        label: orderLabel(o),
        detail: `${prevO.direction} → ${o.direction}`,
      });
    }
  }
  for (const [col, o] of prevMap) {
    if (!nextMap.has(col)) {
      actions.push({ kind: "rem", field: "sort", label: orderLabel(o) });
    }
  }
}

function diffLimit(
  actions: ReceiptAction[],
  prev: number | undefined,
  next: number | undefined,
): void {
  // Ignore undefined → default transitions (validator inserts default=100).
  if (prev === undefined || next === undefined) return;
  if (prev === next) return;
  actions.push({
    kind: "mod",
    field: "limit",
    label: String(next),
    detail: `${prev} → ${next}`,
  });
}
