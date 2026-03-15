import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSortableTable } from "../useSortableTable";

interface Row {
  id: number;
  name: string;
  score: number;
  date: Date;
  dateStr: string;
  nullable: string | null;
}

const rows: Row[] = [
  { id: 1, name: "Charlie", score: 30, date: new Date("2026-01-15"), dateStr: "2026-01-15T00:00:00Z", nullable: "present" },
  { id: 2, name: "Alice",   score: 10, date: new Date("2026-03-01"), dateStr: "2026-03-01T00:00:00Z", nullable: null },
  { id: 3, name: "Bob",     score: 20, date: new Date("2026-02-10"), dateStr: "2026-02-10T00:00:00Z", nullable: "also present" },
];

describe("useSortableTable", () => {
  it("returns original array reference when no sort active", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    expect(result.current.sorted).toBe(rows);
    expect(result.current.sortState).toEqual({ field: null, dir: null });
  });

  it("starts sorted when defaultField is provided", () => {
    const { result } = renderHook(() =>
      useSortableTable({ data: rows, defaultField: "score", defaultDir: "asc" })
    );
    expect(result.current.sorted.map((r) => r.score)).toEqual([10, 20, 30]);
  });

  it("cycles: new field → asc, same asc → desc, same desc → null", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));

    act(() => result.current.onSort("name"));
    expect(result.current.sortState).toEqual({ field: "name", dir: "asc" });

    act(() => result.current.onSort("name"));
    expect(result.current.sortState).toEqual({ field: "name", dir: "desc" });

    act(() => result.current.onSort("name"));
    expect(result.current.sortState).toEqual({ field: null, dir: null });
  });

  it("switching to a different field resets direction to asc", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("name"));
    act(() => result.current.onSort("name")); // now desc
    act(() => result.current.onSort("score")); // new field → asc
    expect(result.current.sortState).toEqual({ field: "score", dir: "asc" });
  });

  it("null dir returns the data array reference as-is (no copy)", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("name"));
    act(() => result.current.onSort("name"));
    act(() => result.current.onSort("name")); // back to null
    expect(result.current.sorted).toBe(rows);
  });

  it("sorts strings ascending via localeCompare", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("name"));
    expect(result.current.sorted.map((r) => r.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts strings descending via localeCompare", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("name"));
    act(() => result.current.onSort("name"));
    expect(result.current.sorted.map((r) => r.name)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("sorts numbers ascending", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("score"));
    expect(result.current.sorted.map((r) => r.score)).toEqual([10, 20, 30]);
  });

  it("sorts numbers descending", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("score"));
    act(() => result.current.onSort("score"));
    expect(result.current.sorted.map((r) => r.score)).toEqual([30, 20, 10]);
  });

  it("type detection — Date objects use getTime(), not localeCompare", () => {
    const { result } = renderHook(() => useSortableTable({ data: rows }));
    act(() => result.current.onSort("date"));
    expect(result.current.sorted.map((r) => r.date.toISOString().slice(0, 10))).toEqual([
      "2026-01-15",
      "2026-02-10",
      "2026-03-01",
    ]);
  });

  it("type detection — ISO date strings fall into string branch (not Date)", () => {
    const data = [
      { id: 1, dateStr: "2026-03-01T00:00:00Z" },
      { id: 2, dateStr: "2026-01-15T00:00:00Z" },
    ];
    const { result } = renderHook(() => useSortableTable({ data }));
    act(() => result.current.onSort("dateStr"));
    expect(result.current.sorted.map((r) => r.dateStr)).toEqual([
      "2026-01-15T00:00:00Z",
      "2026-03-01T00:00:00Z",
    ]);
  });

  it("type detection — numeric fields use subtraction comparator", () => {
    const data = [{ v: 100 }, { v: 20 }, { v: 3 }];
    const { result } = renderHook(() => useSortableTable({ data }));
    act(() => result.current.onSort("v"));
    expect(result.current.sorted.map((r) => r.v)).toEqual([3, 20, 100]);
  });

  it("custom comparator overrides default for a field", () => {
    const statusOrder: Record<string, number> = { todo: 0, in_progress: 1, done: 2 };
    const data = [{ status: "done" }, { status: "todo" }, { status: "in_progress" }];
    const { result } = renderHook(() =>
      useSortableTable({
        data,
        comparators: {
          status: (a, b, dir) => {
            const r = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
            return dir === "desc" ? -r : r;
          },
        },
      })
    );
    act(() => result.current.onSort("status"));
    expect(result.current.sorted.map((r) => r.status)).toEqual(["todo", "in_progress", "done"]);
  });

  it("null values sort to end in asc direction", () => {
    const data = [{ id: 1, score: 30 }, { id: 2, score: null }, { id: 3, score: 10 }];
    const { result } = renderHook(() => useSortableTable({ data }));
    act(() => result.current.onSort("score"));
    expect(result.current.sorted.map((r) => r.score)).toEqual([10, 30, null]);
  });

  it("null values sort to end in desc direction", () => {
    const data = [{ id: 1, score: 30 }, { id: 2, score: null }, { id: 3, score: 10 }];
    const { result } = renderHook(() => useSortableTable({ data }));
    act(() => result.current.onSort("score"));
    act(() => result.current.onSort("score")); // desc
    expect(result.current.sorted.map((r) => r.score)).toEqual([30, 10, null]);
  });
});
