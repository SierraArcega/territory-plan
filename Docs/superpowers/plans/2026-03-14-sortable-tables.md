# Sortable Data Tables Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `useSortableTable` hook and `SortHeader` component, then wire them into ActivitiesTable, PlansTable, DistrictsTable, ContactsTable, and a refactored TasksTable so all five comply with the UI Framework Data Table sorting spec.

**Architecture:** A generic `useSortableTable` hook manages sort state (field + direction) and returns a sorted array using runtime type detection for default comparators plus an escape hatch for custom ones. A shared `SortHeader` component renders sortable `<th>` elements with the correct Fullmind visual states and ARIA attributes. Each table keeps its own layout — it just swaps `<th>` elements for `SortHeader` and passes its data through the hook.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, @testing-library/react

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/shared/hooks/useSortableTable.ts` | Create | Sort state, cycle logic, sorted array, type detection |
| `src/features/shared/hooks/__tests__/useSortableTable.test.ts` | Create | Unit tests for the hook |
| `src/features/shared/components/SortHeader.tsx` | Create | Sortable `<th>` with Fullmind visuals + ARIA |
| `src/features/shared/components/__tests__/SortHeader.test.tsx` | Create | Unit tests for the component |
| `src/features/tasks/components/TasksTable.tsx` | Modify | Remove bespoke sort code, wire shared hook + component |
| `src/features/tasks/components/__tests__/TasksTable.test.tsx` | Modify/Create | Add sort integration test |
| `src/features/plans/components/ActivitiesTable.tsx` | Modify | Add sort via shared hook + component |
| `src/features/plans/components/__tests__/ActivitiesTable.test.tsx` | Modify | Add sort integration test |
| `src/features/plans/components/PlansTable.tsx` | Modify | Add sort via shared hook + component |
| `src/features/plans/components/__tests__/PlansTable.test.tsx` | Modify/Create | Add sort integration test |
| `src/features/plans/components/DistrictsTable.tsx` | Modify | Add sort via shared hook + component |
| `src/features/plans/components/__tests__/DistrictsTable.test.tsx` | Modify/Create | Add sort integration test |
| `src/features/plans/components/ContactsTable.tsx` | Modify | Add sort via shared hook + component |
| `src/features/plans/components/__tests__/ContactsTable.test.tsx` | Modify/Create | Add sort integration test |

---

## Chunk 1: Foundation — Hook + SortHeader + Tests

### Task 1: Create branch

- [ ] **Step 1: Create and switch to new branch**

```bash
git checkout main
git pull
git checkout -b aston-sortable-tables
```

---

### Task 2: Write useSortableTable hook tests (TDD — test first)

**Files:**
- Create: `src/features/shared/hooks/__tests__/useSortableTable.test.ts`

- [ ] **Step 1: Create the test directory and file**

```bash
mkdir -p src/features/shared/hooks/__tests__
```

Create `src/features/shared/hooks/__tests__/useSortableTable.test.ts`:

```typescript
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
    // ISO 8601 sorts correctly lexicographically, but this confirms the string branch fires.
    // If the Date branch fired by mistake it would also work, so we also assert sortState.field.
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
    // The hook sorted by string comparison — if you need proper Date sort on ISO strings
    // you MUST pass a custom comparator (per spec).
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
```

- [ ] **Step 2: Run test — expect it to fail with "module not found"**

```bash
npx vitest run src/features/shared/hooks/__tests__/useSortableTable.test.ts
```

Expected: FAIL — `Cannot find module '../useSortableTable'` (15 tests collected, all failing)

---

### Task 3: Implement useSortableTable hook

**Files:**
- Create: `src/features/shared/hooks/useSortableTable.ts`

- [ ] **Step 1: Write the hook**

Create `src/features/shared/hooks/useSortableTable.ts`:

```typescript
import { useState, useMemo } from "react";

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
  comparators = {},
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

  const onSort = (field: string) => {
    setSortState((prev) => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return { field: null, dir: null };
    });
  };

  return { sorted, sortState, onSort };
}
```

- [ ] **Step 2: Run tests — expect all to pass**

```bash
npx vitest run src/features/shared/hooks/__tests__/useSortableTable.test.ts
```

Expected: all 15 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/hooks/useSortableTable.ts src/features/shared/hooks/__tests__/useSortableTable.test.ts
git commit -m "feat: add useSortableTable shared hook with full test coverage"
```

---

### Task 4: Write SortHeader component tests (TDD — test first)

**Files:**
- Create: `src/features/shared/components/__tests__/SortHeader.test.tsx`

- [ ] **Step 1: Create test file**

```bash
mkdir -p src/features/shared/components/__tests__
```

Create `src/features/shared/components/__tests__/SortHeader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SortHeader } from "../SortHeader";
import type { SortState } from "@/features/shared/hooks/useSortableTable";

const onSort = vi.fn();

function makeState(field: string | null, dir: "asc" | "desc" | null): SortState {
  return { field, dir };
}

// Table wrapper is required for valid HTML — th must be inside a table
function wrap(ui: React.ReactNode) {
  return render(<table><thead><tr>{ui}</tr></thead></table>);
}

describe("SortHeader", () => {
  beforeEach(() => onSort.mockClear());

  it("renders the label text", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("aria-sort is 'none' when column is not active", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "none");
  });

  it("aria-sort is 'ascending' when active asc", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "ascending");
  });

  it("aria-sort is 'descending' when active desc", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState("name", "desc")} onSort={onSort} />);
    expect(screen.getByRole("columnheader")).toHaveAttribute("aria-sort", "descending");
  });

  it("applies active text color class when sorted", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />
    );
    expect(container.querySelector("th")?.className).toContain("text-[#403770]");
  });

  it("applies inactive text color class when not sorted", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    expect(container.querySelector("th")?.className).toContain("text-[#8A80A8]");
  });

  it("calls onSort with field name on click", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.click(screen.getByRole("columnheader"));
    expect(onSort).toHaveBeenCalledOnce();
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("calls onSort on Enter keydown", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader"), { key: "Enter" });
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("calls onSort on Space keydown", () => {
    wrap(<SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader"), { key: " " });
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("arrow has opacity-0 class when inactive (hidden by default)", () => {
    // In jsdom, Tailwind classes are just strings in className — we assert the class
    // string is present, not that it visually renders. opacity-0 hides the arrow at rest.
    // group-hover:opacity-50 is also in the class string and handles the CSS hover state.
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    const arrow = container.querySelector("[aria-hidden='true']");
    expect(arrow?.className).toContain("opacity-0");
    expect(arrow?.className).toContain("group-hover:opacity-50");
  });

  it("arrow has opacity-100 class when active (always visible)", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState("name", "asc")} onSort={onSort} />
    );
    const arrow = container.querySelector("[aria-hidden='true']");
    expect(arrow?.className).toContain("opacity-100");
    // opacity-0 and group-hover should NOT be present when active
    expect(arrow?.className).not.toContain("opacity-0");
  });

  it("th is tab-focusable", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} />
    );
    expect(container.querySelector("th")).toHaveAttribute("tabindex", "0");
  });

  it("passes className to th", () => {
    const { container } = wrap(
      <SortHeader field="name" label="Name" sortState={makeState(null, null)} onSort={onSort} className="w-[30%]" />
    );
    expect(container.querySelector("th")?.className).toContain("w-[30%]");
  });
});
```

- [ ] **Step 2: Run test — expect it to fail with "module not found"**

```bash
npx vitest run src/features/shared/components/__tests__/SortHeader.test.tsx
```

Expected: FAIL — `Cannot find module '../SortHeader'`

---

### Task 5: Implement SortHeader component

**Files:**
- Create: `src/features/shared/components/SortHeader.tsx`

- [ ] **Step 1: Write the component**

Create `src/features/shared/components/SortHeader.tsx`:

```tsx
import type { SortState } from "@/features/shared/hooks/useSortableTable";

interface SortHeaderProps {
  field: string;
  label: string;
  sortState: SortState;
  onSort: (field: string) => void;
  className?: string;
}

// Renders a sortable <th> per the Fullmind Data Table spec.
// Visual states:
//   - Inactive: text-[#8A80A8], arrow hidden (opacity-0), faint arrow on hover
//   - Active asc/desc: text-[#403770], arrow visible at full opacity
// The 50% opacity on hover applies to the arrow element only, not the label text.
export function SortHeader({ field, label, sortState, onSort, className = "" }: SortHeaderProps) {
  const isActive = sortState.field === field;
  const dir = isActive ? sortState.dir : null;

  return (
    <th
      className={`group px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none ${
        isActive ? "text-[#403770]" : "text-[#8A80A8]"
      } ${className}`}
      aria-sort={!isActive ? "none" : dir === "asc" ? "ascending" : "descending"}
      tabIndex={0}
      onClick={() => onSort(field)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(field);
        }
      }}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {/* Arrow is always rendered; opacity controls visibility so hover works via CSS */}
        <span
          className={`w-3 h-3 inline-flex items-center justify-center text-[8px] leading-none transition-opacity ${
            isActive
              ? "opacity-100 text-[#403770]"
              : "opacity-0 group-hover:opacity-50 text-[#A69DC0]"
          }`}
          aria-hidden="true"
        >
          {dir === "desc" ? "▼" : "▲"}
        </span>
      </div>
    </th>
  );
}
```

- [ ] **Step 2: Run tests — expect all to pass**

```bash
npx vitest run src/features/shared/components/__tests__/SortHeader.test.tsx
```

Expected: all 13 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/shared/components/SortHeader.tsx src/features/shared/components/__tests__/SortHeader.test.tsx
git commit -m "feat: add SortHeader shared component with full test coverage"
```

---

## Chunk 2: Refactor TasksTable

### Task 6: Add TasksTable sort integration test

**Files:**
- Modify/Create: `src/features/tasks/components/__tests__/TasksTable.test.tsx`

The test file is at `src/features/tasks/components/__tests__/TasksTable.test.tsx`. Check if it exists:
```bash
ls src/features/tasks/components/__tests__/
```

If it exists, add the sort tests below to the existing describe block (don't replace existing tests). If it doesn't exist, create the file with this content:

- [ ] **Step 1: Write failing integration test**

Add to `src/features/tasks/components/__tests__/TasksTable.test.tsx`:

```tsx
// Add these imports if not already present:
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TasksTable from "../TasksTable";
import type { TaskItem } from "@/features/shared/types/api-types";

// Minimal TaskItem factory — only fields TasksTable reads
function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "t1",
    title: "Default task",
    description: null,
    status: "todo",
    priority: "medium",
    dueDate: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    plans: [],
    districts: [],
    activities: [],
    contacts: [],
    ...overrides,
  };
}

function renderTable(tasks: TaskItem[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Pass minimal required props — check actual TasksTable props signature for others
  return render(
    <QueryClientProvider client={qc}>
      <TasksTable tasks={tasks} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("TasksTable sorting", () => {
  it("renders all task titles", () => {
    const tasks = [makeTask({ id: "1", title: "Alpha" }), makeTask({ id: "2", title: "Beta" })];
    renderTable(tasks);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("clicking Title header sorts tasks ascending", () => {
    const tasks = [
      makeTask({ id: "1", title: "Charlie" }),
      makeTask({ id: "2", title: "Alice" }),
      makeTask({ id: "3", title: "Bob" }),
    ];
    renderTable(tasks);
    fireEvent.click(screen.getByRole("columnheader", { name: /title/i }));
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("Alice");
    expect(rows[1]).toHaveTextContent("Bob");
    expect(rows[2]).toHaveTextContent("Charlie");
  });

  it("clicking Title header again sorts descending", () => {
    const tasks = [
      makeTask({ id: "1", title: "Charlie" }),
      makeTask({ id: "2", title: "Alice" }),
      makeTask({ id: "3", title: "Bob" }),
    ];
    renderTable(tasks);
    fireEvent.click(screen.getByRole("columnheader", { name: /title/i }));
    fireEvent.click(screen.getByRole("columnheader", { name: /title/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Charlie");
  });

  it("clicking Title a third time restores original order", () => {
    const tasks = [
      makeTask({ id: "1", title: "Charlie" }),
      makeTask({ id: "2", title: "Alice" }),
    ];
    renderTable(tasks);
    const th = screen.getByRole("columnheader", { name: /title/i });
    fireEvent.click(th);
    fireEvent.click(th);
    fireEvent.click(th); // back to null
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Charlie"); // original order
  });

  it("default sort is createdAt descending on initial render", () => {
    // Tasks should appear newest-first without any user interaction —
    // this preserves the existing TasksTable behavior after refactor.
    const tasks = [
      makeTask({ id: "1", title: "Older task", createdAt: "2026-01-01T00:00:00Z" }),
      makeTask({ id: "2", title: "Newer task", createdAt: "2026-03-01T00:00:00Z" }),
    ];
    renderTable(tasks);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Newer task"); // desc = newest first
  });

  it("Linked column header has no onClick sort", () => {
    renderTable([makeTask()]);
    const linkedHeader = screen.getByRole("columnheader", { name: /linked/i });
    // SortHeader is not used, so no aria-sort attribute
    expect(linkedHeader).not.toHaveAttribute("aria-sort");
  });
});
```

- [ ] **Step 2: Run test — expect failures (TasksTable not yet wired)**

```bash
npx vitest run src/features/tasks/components/__tests__/TasksTable.test.tsx
```

Note the specific failures — sorting tests should fail or the render test may need prop adjustment.

---

### Task 7: Refactor TasksTable to use shared hook

**Files:**
- Modify: `src/features/tasks/components/TasksTable.tsx`

- [ ] **Step 1: Read the current file to understand its full structure**

Read `src/features/tasks/components/TasksTable.tsx` before making any edits.

- [ ] **Step 2: Remove all bespoke sort code**

The current file has these items to delete entirely:
Delete these items:
- `type SortField = ...` — remove
- `type SortDir = ...` — remove (re-exported from shared hook)
- `PRIORITY_ORDER` and `STATUS_ORDER` const maps — remove (will re-add as comparators)
- `useState(sortField)` and `useState(sortDir)` — remove
- `useMemo(sorted)` block — remove
- `handleSort` function — remove
- The entire local `SortHeader` component declaration (the inner function, ~13 lines)

After deleting, the file should have no sort-related logic. Verify TypeScript still compiles (will have missing variable errors — that's expected at this step, fixed in Step 3):

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Wire in shared hook and component**

**At the top of the file, update imports:**
```tsx
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";
import type { TaskItem } from "@/features/shared/types/api-types";
```

**Define comparators at module level (outside the component):**
```tsx
// Workflow order maps — used by custom comparators so status/priority sort logically,
// not alphabetically (e.g. "todo" before "in_progress" before "done")
const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, blocked: 2, done: 3 };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const taskComparators: Record<string, SortComparator<TaskItem>> = {
  status: (a, b, dir) => {
    const r = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
  priority: (a, b, dir) => {
    const r = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    return dir === "desc" ? -r : r;
  },
  dueDate: (a, b, dir) => {
    // Null due dates always sort last (matches previous Infinity sentinel behavior)
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const r = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return dir === "desc" ? -r : r;
  },
  createdAt: (a, b, dir) => {
    const r = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -r : r;
  },
};
```

**Inside the component, replace sort state with hook call:**
```tsx
// Remove the old useState + useMemo + handleSort lines and replace with:
const { sorted: sortedTasks, sortState, onSort } = useSortableTable({
  data: tasks,
  defaultField: "createdAt",
  defaultDir: "desc",
  comparators: taskComparators,
});
```

**In the thead, replace each local `<SortHeader>` call with the shared one:**

The old local SortHeader used a closure over `handleSort` and `sortField`/`sortDir`. The new one takes explicit props.

Before (example):
```tsx
<SortHeader field="title" label="Title" className="w-[35%]" />
```

After:
```tsx
<SortHeader field="title" label="Title" sortState={sortState} onSort={onSort} className="w-[35%]" />
```

Apply this pattern to all five sortable columns: `title`, `status`, `priority`, `dueDate`, `createdAt`.

The "Linked" column stays as a plain `<th>` (no sorting).

**In the tbody, change `tasks.map(...)` to `sortedTasks.map(...)`.**

- [ ] **Step 4: Run the integration tests**

```bash
npx vitest run src/features/tasks/components/__tests__/TasksTable.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: no new failures

- [ ] **Step 6: Commit**

```bash
git add src/features/tasks/components/TasksTable.tsx src/features/tasks/components/__tests__/TasksTable.test.tsx
git commit -m "refactor: migrate TasksTable to shared useSortableTable hook and SortHeader"
```

---

## Chunk 3: ActivitiesTable + PlansTable

### Task 8: Add sort to ActivitiesTable

**Files:**
- Modify: `src/features/plans/components/ActivitiesTable.tsx`
- Modify: `src/features/plans/components/__tests__/ActivitiesTable.test.tsx`

ActivitiesTable receives `activities: ActivityListItem[]` as a prop and renders them directly.

`ActivityListItem` relevant fields: `title: string`, `type: ActivityType` (string), `status: ActivityStatus` (`"planned" | "completed" | "cancelled"`), `startDate: string | null`

- [ ] **Step 1: Write the failing integration test**

Add to `src/features/plans/components/__tests__/ActivitiesTable.test.tsx`:

```tsx
describe("ActivitiesTable sorting", () => {
  it("clicking Title header sorts activities by title ascending", () => {
    const activities = [
      makeActivity({ id: "1", title: "Zeta" }),
      makeActivity({ id: "2", title: "Alpha" }),
    ];
    renderTable(activities);
    fireEvent.click(screen.getByRole("columnheader", { name: /title/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Zeta");
  });

  it("clicking Title again sorts descending", () => {
    const activities = [
      makeActivity({ id: "1", title: "Zeta" }),
      makeActivity({ id: "2", title: "Alpha" }),
    ];
    renderTable(activities);
    const th = screen.getByRole("columnheader", { name: /title/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta");
  });

  it("clicking Title a third time restores original order", () => {
    const activities = [
      makeActivity({ id: "1", title: "Zeta" }),
      makeActivity({ id: "2", title: "Alpha" }),
    ];
    renderTable(activities);
    const th = screen.getByRole("columnheader", { name: /title/i });
    fireEvent.click(th);
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta"); // original order
  });

  it("Scope column header has no sort behavior", () => {
    renderTable([makeActivity()]);
    const scopeHeader = screen.getByRole("columnheader", { name: /scope/i });
    expect(scopeHeader).not.toHaveAttribute("aria-sort");
  });
});
```

If `makeActivity` or `renderTable` helpers don't exist in this test file, add minimal versions:

```tsx
function makeActivity(overrides: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    id: "a1",
    type: "conference",
    category: "events",
    title: "Test activity",
    startDate: null,
    endDate: null,
    status: "planned",
    source: "manual",
    outcomeType: null,
    assignedToUserId: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 0,
    districtCount: 0,
    stateAbbrevs: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: Run — expect failures**

```bash
npx vitest run src/features/plans/components/__tests__/ActivitiesTable.test.tsx
```

Expected: new sort tests FAIL

- [ ] **Step 3: Read ActivitiesTable before editing**

Read `src/features/plans/components/ActivitiesTable.tsx` fully before making changes.

- [ ] **Step 4: Wire sort into ActivitiesTable**

Add imports at the top:
```tsx
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";
import type { ActivityListItem } from "@/features/shared/types/api-types";
```

Add module-level comparators:
```tsx
// ActivityStatus = "planned" | "completed" | "cancelled" (no "in_progress").
// The spec note "Planned → In Progress → Completed" reflects a UI label mismatch —
// the actual enum has no in_progress value. Workflow order: planned → completed → cancelled.
const ACTIVITY_STATUS_ORDER: Record<string, number> = {
  planned: 0,
  completed: 1,
  cancelled: 2,
};

const activityComparators: Record<string, SortComparator<ActivityListItem>> = {
  status: (a, b, dir) => {
    const r = (ACTIVITY_STATUS_ORDER[a.status] ?? 9) - (ACTIVITY_STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
  startDate: (a, b, dir) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    const r = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return dir === "desc" ? -r : r;
  },
};
```

Inside the component (after the `activities` prop is received):
```tsx
const { sorted: sortedActivities, sortState, onSort } = useSortableTable({
  data: activities,
  comparators: activityComparators,
});
```

In the `<thead>`, replace the Title, Type, Status, and Date `<th>` elements with `<SortHeader>`. Keep Scope and Actions as plain `<th>`:

```tsx
<thead>
  <tr className="border-b border-gray-200 bg-gray-50/80">
    <th
      className="w-[28px] px-2 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
      aria-label="Icon"
    />
    <SortHeader field="title"     label="Title"  sortState={sortState} onSort={onSort} className="w-[30%] px-2" />
    <SortHeader field="type"      label="Type"   sortState={sortState} onSort={onSort} className="w-[15%] px-2" />
    <SortHeader field="status"    label="Status" sortState={sortState} onSort={onSort} className="w-[12%] px-2" />
    <SortHeader field="startDate" label="Date"   sortState={sortState} onSort={onSort} className="w-[18%] px-2" />
    <th className="w-[15%] px-2 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
      Scope
    </th>
    <th className="w-20 px-3 py-3" />
  </tr>
</thead>
```

In the tbody, replace `activities.map(...)` with `sortedActivities.map(...)`.

- [ ] **Step 5: Run tests — expect all to pass**

```bash
npx vitest run src/features/plans/components/__tests__/ActivitiesTable.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/plans/components/ActivitiesTable.tsx src/features/plans/components/__tests__/ActivitiesTable.test.tsx
git commit -m "feat: add column sorting to ActivitiesTable"
```

---

### Task 9: Add sort to PlansTable

**Files:**
- Modify: `src/features/plans/components/PlansTable.tsx`
- Modify/Create: `src/features/plans/components/__tests__/PlansTable.test.tsx`

`TerritoryPlan` relevant sortable fields: `name: string`, `owner: PlanOwner | null` (access `owner?.fullName`), `fiscalYear: number`, `status: "planning" | "working" | "stale" | "archived"`, `startDate: string | null`, `districtCount: number`

- [ ] **Step 1: Read PlansTable before writing tests**

Read `src/features/plans/components/PlansTable.tsx` fully. Note the exact component props signature (what props does it accept? `plans`, `onUpdate`, `onDelete`? — confirm before writing the test helper below).

- [ ] **Step 2: Write the failing integration test**

Check if `src/features/plans/components/__tests__/PlansTable.test.tsx` exists. If not, create it. Update `renderTable` below to match the actual props confirmed in Step 1:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlansTable from "../PlansTable";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

function makePlan(overrides: Partial<TerritoryPlan> = {}): TerritoryPlan {
  return {
    id: "p1",
    name: "Default Plan",
    description: null,
    owner: null,
    color: "#403770",
    status: "planning",
    fiscalYear: 2026,
    startDate: null,
    endDate: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    districtCount: 0,
    totalEnrollment: 0,
    stateCount: 0,
    states: [],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
    renewalRollup: 0,
    expansionRollup: 0,
    winbackRollup: 0,
    newBusinessRollup: 0,
    pipelineTotal: 0,
    ...overrides,
  };
}

function renderTable(plans: TerritoryPlan[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Props confirmed from PlansTable source in Step 1 — adjust if different
  return render(
    <QueryClientProvider client={qc}>
      <PlansTable plans={plans} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("PlansTable sorting", () => {
  it("clicking Name header sorts plans by name ascending", () => {
    const plans = [
      makePlan({ id: "1", name: "Zeta Plan" }),
      makePlan({ id: "2", name: "Alpha Plan" }),
    ];
    renderTable(plans);
    fireEvent.click(screen.getByRole("columnheader", { name: /name/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha Plan");
  });

  it("clicking Name again sorts descending", () => {
    const plans = [
      makePlan({ id: "1", name: "Zeta Plan" }),
      makePlan({ id: "2", name: "Alpha Plan" }),
    ];
    renderTable(plans);
    const th = screen.getByRole("columnheader", { name: /name/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta Plan");
  });

  it("third click restores original order", () => {
    const plans = [
      makePlan({ id: "1", name: "Zeta Plan" }),
      makePlan({ id: "2", name: "Alpha Plan" }),
    ];
    renderTable(plans);
    const th = screen.getByRole("columnheader", { name: /name/i });
    fireEvent.click(th);
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta Plan");
  });

  it("Description and Color columns have no sort", () => {
    renderTable([makePlan()]);
    const descriptionHeader = screen.queryByRole("columnheader", { name: /description/i });
    if (descriptionHeader) expect(descriptionHeader).not.toHaveAttribute("aria-sort");
  });
});
```

- [ ] **Step 3: Run — expect sort tests to fail**

```bash
npx vitest run src/features/plans/components/__tests__/PlansTable.test.tsx
```

- [ ] **Step 4: Wire sort into PlansTable**

Add imports:
```tsx
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";
import type { TerritoryPlan } from "@/features/shared/types/api-types";
```

Add module-level comparators:
```tsx
const PLAN_STATUS_ORDER: Record<string, number> = {
  planning: 0,
  working: 1,
  stale: 2,
  archived: 3,
};

const planComparators: Record<string, SortComparator<TerritoryPlan>> = {
  owner: (a, b, dir) => {
    const aName = a.owner?.fullName ?? null;
    const bName = b.owner?.fullName ?? null;
    if (!aName && !bName) return 0;
    if (!aName) return 1;
    if (!bName) return -1;
    const r = aName.localeCompare(bName);
    return dir === "desc" ? -r : r;
  },
  status: (a, b, dir) => {
    const r = (PLAN_STATUS_ORDER[a.status] ?? 9) - (PLAN_STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
  startDate: (a, b, dir) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    const r = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return dir === "desc" ? -r : r;
  },
};
```

Inside component:
```tsx
const { sorted: sortedPlans, sortState, onSort } = useSortableTable({
  data: plans,
  comparators: planComparators,
});
```

In `<thead>`, replace the Name, Owner, FY, Status, Dates, and Dist. `<th>` elements with `<SortHeader>`. Keep Color, Description, and Actions as plain `<th>`. Use the existing column widths from the file you read in Step 1. The pattern looks like this (widths are illustrative — use actual values from the file):

```tsx
<thead>
  <tr className="border-b border-gray-200 bg-gray-50/80">
    {/* Color — not sortable */}
    <th className="w-[28px] px-2 py-3" />
    <SortHeader field="name"          label="Name"   sortState={sortState} onSort={onSort} className="w-[18%] px-2" />
    {/* Description — not sortable */}
    <th className="w-[22%] px-2 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
    <SortHeader field="owner"         label="Owner"  sortState={sortState} onSort={onSort} className="w-[12%] px-2" />
    <SortHeader field="fiscalYear"    label="FY"     sortState={sortState} onSort={onSort} className="w-[40px] px-2" />
    <SortHeader field="status"        label="Status" sortState={sortState} onSort={onSort} className="w-[10%] px-2" />
    <SortHeader field="startDate"     label="Dates"  sortState={sortState} onSort={onSort} className="w-[16%] px-2" />
    <SortHeader field="districtCount" label="Dist."  sortState={sortState} onSort={onSort} className="w-[44px] px-2" />
    {/* Actions — not sortable */}
    <th className="w-[56px] px-3 py-3" />
  </tr>
</thead>
```

In tbody, change `plans.map(...)` to `sortedPlans.map(...)`.

- [ ] **Step 5: Run tests — expect all to pass**

```bash
npx vitest run src/features/plans/components/__tests__/PlansTable.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/plans/components/PlansTable.tsx src/features/plans/components/__tests__/PlansTable.test.tsx
git commit -m "feat: add column sorting to PlansTable"
```

---

## Chunk 4: DistrictsTable + ContactsTable

### Task 10: Add sort to DistrictsTable

**Files:**
- Modify: `src/features/plans/components/DistrictsTable.tsx`
- Modify/Create: `src/features/plans/components/__tests__/DistrictsTable.test.tsx`

`TerritoryPlanDistrict` relevant fields: `name: string`, `stateAbbrev: string | null`, `renewalTarget: number | null`, `winbackTarget: number | null`, `expansionTarget: number | null`, `newBusinessTarget: number | null`, `actuals?: PlanDistrictActuals`

**Important:** Revenue, Take, Pipeline, Prior FY are nested under `district.actuals` — they're not top-level fields. Use virtual string keys (`"revenue"`, `"take"`, `"pipeline"`, `"priorFy"`) in the comparators map.

**TypeScript note:** `useSortableTable` and `SortHeader` both use `field: string` (not `keyof T`), so passing virtual keys like `"revenue"` compiles without errors — no casts needed. This was an explicit design decision in the hook to support exactly this case.

- [ ] **Step 1: Read DistrictsTable before writing tests**

Read `src/features/plans/components/DistrictsTable.tsx` fully. Note the exact props signature before writing the test helper below.

- [ ] **Step 2: Write failing integration test**

Check/create `src/features/plans/components/__tests__/DistrictsTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DistrictsTable from "../DistrictsTable";
import type { TerritoryPlanDistrict } from "@/features/shared/types/api-types";

function makeDistrict(overrides: Partial<TerritoryPlanDistrict> = {}): TerritoryPlanDistrict {
  return {
    leaid: "d1",
    addedAt: "2026-01-01T00:00:00Z",
    name: "Default District",
    stateAbbrev: "CA",
    enrollment: null,
    owner: null,
    renewalTarget: null,
    winbackTarget: null,
    expansionTarget: null,
    newBusinessTarget: null,
    notes: null,
    returnServices: [],
    newServices: [],
    tags: [],
    ...overrides,
  };
}

function renderTable(districts: TerritoryPlanDistrict[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Adjust props to match DistrictsTable's actual signature
  return render(
    <QueryClientProvider client={qc}>
      <DistrictsTable districts={districts} planId="p1" onUpdate={vi.fn()} onRemove={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("DistrictsTable sorting", () => {
  it("clicking District header sorts by name ascending", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Zeta USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
    ];
    renderTable(districts);
    fireEvent.click(screen.getByRole("columnheader", { name: /district/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha USD");
  });

  it("clicking District again sorts descending", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Zeta USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
    ];
    renderTable(districts);
    const th = screen.getByRole("columnheader", { name: /district/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta USD");
  });

  it("third click restores original order", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Zeta USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
    ];
    renderTable(districts);
    const th = screen.getByRole("columnheader", { name: /district/i });
    fireEvent.click(th);
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta USD");
  });

  it("Services column header has no sort", () => {
    renderTable([makeDistrict()]);
    const servicesHeader = screen.queryByRole("columnheader", { name: /services/i });
    if (servicesHeader) expect(servicesHeader).not.toHaveAttribute("aria-sort");
  });

  it("Revenue column sorts by actuals.totalRevenue, nulls last", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "A", actuals: { totalRevenue: 100, completedRevenue: 0, scheduledRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0, takeRate: null, openPipeline: 0, weightedPipeline: 0, invoiced: 0, credited: 0, oppCount: 0, priorFyRevenue: 0, priorFyTake: 0, yoyRevenueChange: null } }),
      makeDistrict({ leaid: "2", name: "B" }), // no actuals → null
      makeDistrict({ leaid: "3", name: "C", actuals: { totalRevenue: 50, completedRevenue: 0, scheduledRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0, takeRate: null, openPipeline: 0, weightedPipeline: 0, invoiced: 0, credited: 0, oppCount: 0, priorFyRevenue: 0, priorFyTake: 0, yoyRevenueChange: null } }),
    ];
    renderTable(districts);
    fireEvent.click(screen.getByRole("columnheader", { name: /revenue/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("C"); // 50 < 100
    expect(rows[2]).toHaveTextContent("B"); // null last
  });
});
```

- [ ] **Step 3: Run — expect failures**

```bash
npx vitest run src/features/plans/components/__tests__/DistrictsTable.test.tsx
```

- [ ] **Step 4: Wire sort into DistrictsTable**

Add imports:
```tsx
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";
import type { TerritoryPlanDistrict } from "@/features/shared/types/api-types";
```

Module-level comparators (note: use virtual string keys for actuals columns):
```tsx
const districtComparators: Record<string, SortComparator<TerritoryPlanDistrict>> = {
  // Actuals are nested under district.actuals — can't use keyof T, so use virtual keys.
  revenue: (a, b, dir) => {
    const aVal = a.actuals?.totalRevenue ?? null;
    const bVal = b.actuals?.totalRevenue ?? null;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
  take: (a, b, dir) => {
    const aVal = a.actuals?.totalTake ?? null;
    const bVal = b.actuals?.totalTake ?? null;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
  pipeline: (a, b, dir) => {
    const aVal = a.actuals?.weightedPipeline ?? null;
    const bVal = b.actuals?.weightedPipeline ?? null;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
  priorFy: (a, b, dir) => {
    const aVal = a.actuals?.priorFyRevenue ?? null;
    const bVal = b.actuals?.priorFyRevenue ?? null;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
};
```

Inside component:
```tsx
const { sorted: sortedDistricts, sortState, onSort } = useSortableTable({
  data: districts,
  comparators: districtComparators,
});
```

In thead, replace each sortable column header with `<SortHeader>`. Field key mapping:

| Column label | Field key | Notes |
|---|---|---|
| District | `"name"` | top-level `district.name` — default string comparator |
| State | `"stateAbbrev"` | top-level — default string comparator, nullable |
| Renewal | `"renewalTarget"` | top-level number, nullable |
| Winback | `"winbackTarget"` | top-level number, nullable |
| Expansion | `"expansionTarget"` | top-level number, nullable |
| New Biz | `"newBusinessTarget"` | top-level number, nullable |
| Revenue | `"revenue"` | virtual key — custom comparator |
| Take | `"take"` | virtual key — custom comparator |
| Pipeline | `"pipeline"` | virtual key — custom comparator |
| Prior FY | `"priorFy"` | virtual key — custom comparator |

Services and Actions stay as plain `<th>`.

In tbody, change `districts.map(...)` to `sortedDistricts.map(...)`.

- [ ] **Step 5: Run table tests — expect all to pass**

```bash
npx vitest run src/features/plans/components/__tests__/DistrictsTable.test.tsx
```

- [ ] **Step 6: Run full suite to catch any virtual-key related regressions**

```bash
npx vitest run
```

Expected: no new failures

- [ ] **Step 7: Commit**

```bash
git add src/features/plans/components/DistrictsTable.tsx src/features/plans/components/__tests__/DistrictsTable.test.tsx
git commit -m "feat: add column sorting to DistrictsTable"
```

---

### Task 11: Add sort to ContactsTable

**Files:**
- Modify: `src/features/plans/components/ContactsTable.tsx`
- Modify/Create: `src/features/plans/components/__tests__/ContactsTable.test.tsx`

`Contact` relevant fields: `name: string`, `email: string | null`, `persona: string | null`, `seniorityLevel: string | null`

**District column decision:** The `Contact` type has no `district` field — it only has `leaid: string`. The "District" column in ContactsTable is derived from `leaid` and is **not sortable**. Leave it as a plain `<th>`. The sortable columns are: Person (`name`), Email (`email`), Department (`persona`), Seniority (`seniorityLevel`).

No custom comparators are needed — all sortable Contact fields are direct string/nullable fields. The hook's `applyNullPolicy` handles nullable values automatically.

- [ ] **Step 1: Read ContactsTable before writing tests**

Read `src/features/plans/components/ContactsTable.tsx` fully. Confirm the exact props signature before writing the test helper below.

- [ ] **Step 2: Write failing integration test**

Check/create `src/features/plans/components/__tests__/ContactsTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContactsTable from "../ContactsTable";
import type { Contact } from "@/features/shared/types/api-types";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    leaid: "d1",
    salutation: null,
    name: "Default Contact",
    title: null,
    email: null,
    phone: null,
    isPrimary: false,
    linkedinUrl: null,
    persona: null,
    seniorityLevel: null,
    createdAt: "2026-01-01T00:00:00Z",
    lastEnrichedAt: null,
    ...overrides,
  };
}

function renderTable(contacts: Contact[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Adjust props to match ContactsTable's actual signature
  return render(
    <QueryClientProvider client={qc}>
      <ContactsTable contacts={contacts} onUpdate={vi.fn()} onDelete={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("ContactsTable sorting", () => {
  it("clicking Person header sorts contacts by name ascending", () => {
    const contacts = [
      makeContact({ id: 1, name: "Zara Smith" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
    ];
    renderTable(contacts);
    fireEvent.click(screen.getByRole("columnheader", { name: /person/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Aaron Jones");
  });

  it("clicking Person again sorts descending", () => {
    const contacts = [
      makeContact({ id: 1, name: "Zara Smith" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
    ];
    renderTable(contacts);
    const th = screen.getByRole("columnheader", { name: /person/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zara Smith");
  });

  it("third click restores original order", () => {
    const contacts = [
      makeContact({ id: 1, name: "Zara Smith" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
    ];
    renderTable(contacts);
    const th = screen.getByRole("columnheader", { name: /person/i });
    fireEvent.click(th);
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zara Smith");
  });

  it("Last Activity column header has no sort", () => {
    renderTable([makeContact()]);
    const lastActivityHeader = screen.queryByRole("columnheader", { name: /last activity/i });
    if (lastActivityHeader) expect(lastActivityHeader).not.toHaveAttribute("aria-sort");
  });
});
```

- [ ] **Step 3: Run — expect failures**

```bash
npx vitest run src/features/plans/components/__tests__/ContactsTable.test.tsx
```

- [ ] **Step 4: Wire sort into ContactsTable**

Add imports:
```tsx
import { useSortableTable } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";
```

No custom comparators needed. Inside component:
```tsx
const { sorted: sortedContacts, sortState, onSort } = useSortableTable({
  data: contacts,
});
```

In thead, replace Person, Email, Department, and Seniority with `<SortHeader>`. Field keys: `"name"`, `"email"`, `"persona"`, `"seniorityLevel"`.

Leave District, Checkbox, Last Activity, and Actions as plain `<th>` — District is derived from `leaid` and has no direct sortable field on `Contact`.

In tbody, change `contacts.map(...)` to `sortedContacts.map(...)`.

- [ ] **Step 5: Run tests — expect all to pass**

```bash
npx vitest run src/features/plans/components/__tests__/ContactsTable.test.tsx
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions

- [ ] **Step 7: Commit**

```bash
git add src/features/plans/components/ContactsTable.tsx src/features/plans/components/__tests__/ContactsTable.test.tsx
git commit -m "feat: add column sorting to ContactsTable"
```

---

### Task 12: Final verification and PR prep

- [ ] **Step 1: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 3: Invoke superpowers:verification-before-completion**

Run the verification skill before claiming the work is done.

- [ ] **Step 4: Invoke superpowers:finishing-a-development-branch**

Guides the PR creation and merge process.
