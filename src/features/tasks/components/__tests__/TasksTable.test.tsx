// src/features/tasks/components/__tests__/TasksTable.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TasksTable from "../TasksTable";
import type { TaskItem } from "@/features/shared/types/api-types";

// Mock useUpdateTask so TasksTable can render without a real API
const mockMutate = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    useUpdateTask: () => ({
      mutate: mockMutate,
      isPending: false,
    }),
  };
});

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
  return render(
    <QueryClientProvider client={qc}>
      <TasksTable tasks={tasks} onTaskClick={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

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
    fireEvent.click(th); // back to null sort → original order
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

  it("Linked column header has no aria-sort attribute", () => {
    // The Linked column is not sortable — it is a plain <th>, not a SortHeader.
    // SortHeader always sets aria-sort; a plain <th> has no aria-sort at all.
    renderTable([makeTask()]);
    const linkedHeader = screen.getByRole("columnheader", { name: /linked/i });
    expect(linkedHeader).not.toHaveAttribute("aria-sort");
  });
});
