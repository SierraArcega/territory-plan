import { useState, useMemo, useCallback } from "react";

export type SortDir = "asc" | "desc" | null;

// Using string (not keyof T) for field so DistrictsTable can use virtual keys
// for nested actuals fields (e.g. "revenue") that aren't top-level properties.
export interface SortState {
  field: string | null;
  dir: SortDir;
}

export type SortComparator<T> = (a: T, b: T, dir: SortDir) => number;

export interface UseSortableTableOptions<T> {
  data: T[];
  defaultField?: string;
  defaultDir?: "asc" | "desc";
  // Pass comparators as a module-level constant (not inline object) to keep
  // the useMemo dependency stable across renders.
  comparators?: Record<string, SortComparator<T>>;
}

export interface UseSortableTableReturn<T> {
  sorted: T[];
  sortState: SortState;
  onSort: (field: string) => void;
}

// Returns a number if either value is null/undefined (nulls always sort last),
// or null if both values are present and the caller should continue comparing.
function applyNullPolicy(aVal: unknown, bVal: unknown): number | null {
  const aNull = aVal == null;
  const bNull = bVal == null;
  if (aNull && bNull) return 0;
  if (aNull) return 1;  // a is null → sort after b
  if (bNull) return -1; // b is null → sort after a
  return null;          // neither is null, keep comparing
}

// Stable empty-object fallback so callers that omit `comparators` don't
// force useMemo to recompute on every render due to a fresh object reference.
const EMPTY_COMPARATORS: Record<string, SortComparator<unknown>> = {};

// Runtime type detection: check instanceof Date first, then typeof.
// NOTE: ISO date strings (typeof === "string") fall into localeCompare.
// ISO 8601 sorts correctly lexicographically, but if you have non-ISO date
// strings you MUST provide a custom comparator for that field.
function defaultCompare(aVal: unknown, bVal: unknown, dir: SortDir): number {
  let result: number;
  if (aVal instanceof Date && bVal instanceof Date) {
    result = aVal.getTime() - bVal.getTime();
  } else if (typeof aVal === "number" && typeof bVal === "number") {
    result = aVal - bVal;
  } else {
    result = String(aVal).localeCompare(String(bVal));
  }
  return dir === "desc" ? -result : result;
}

export function useSortableTable<T>({
  data,
  defaultField,
  defaultDir = "asc",
  comparators = EMPTY_COMPARATORS as Record<string, SortComparator<T>>,
}: UseSortableTableOptions<T>): UseSortableTableReturn<T> {
  const [sortState, setSortState] = useState<SortState>({
    field: defaultField ?? null,
    dir: defaultField ? defaultDir : null,
  });

  const sorted = useMemo(() => {
    const { field, dir } = sortState;
    if (!field || !dir) return data; // returns original reference, no copy

    const custom = comparators[field];

    return [...data].sort((a, b) => {
      if (custom) return custom(a, b, dir);

      const aVal = (a as Record<string, unknown>)[field];
      const bVal = (b as Record<string, unknown>)[field];
      const nullResult = applyNullPolicy(aVal, bVal);
      if (nullResult !== null) return nullResult;
      return defaultCompare(aVal, bVal, dir);
    });
  }, [data, sortState, comparators]);

  // Wrapped in useCallback so callers receive a stable function reference.
  const onSort = useCallback((field: string) => {
    setSortState((prev) => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return { field: null, dir: null };
    });
  }, [setSortState]);

  return { sorted, sortState, onSort };
}
