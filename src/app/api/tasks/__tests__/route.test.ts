import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock getUser
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

// Mock Prisma - note: $transaction is needed for reorder
const mockTransaction = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    task: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma);

import { GET as listTasks, POST } from "../route";
import { GET as getTask, PATCH as patchTask, DELETE } from "../[id]/route";
import { PATCH as reorderTasks } from "../reorder/route";

// ---------- helpers ----------

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown }
) {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.body) {
    init.method = options.method ?? "POST";
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const now = new Date("2026-02-23T12:00:00Z");

function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Test Task",
    description: "A task",
    status: "todo",
    priority: "medium",
    dueDate: now,
    position: 0,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    districts: [
      {
        districtLeaid: "1234567",
        district: { leaid: "1234567", name: "Test District", stateAbbrev: "CA" },
      },
    ],
    plans: [
      {
        planId: "plan-1",
        plan: { id: "plan-1", name: "Plan A", color: "#ff0000" },
      },
    ],
    activities: [
      {
        activityId: "act-1",
        activity: { id: "act-1", title: "Follow up", type: "call" },
      },
    ],
    contacts: [
      {
        contactId: 1,
        contact: { id: 1, name: "Jane", title: "CTO" },
      },
    ],
    ...overrides,
  };
}

// ---------- setup ----------

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GET /api/tasks  (list)
// ============================================================
describe("GET /api/tasks", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await listTasks(makeRequest("/api/tasks"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns tasks for authenticated user", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.count.mockResolvedValue(1);
    mockPrisma.task.findMany.mockResolvedValue([taskRow] as never);

    const res = await listTasks(makeRequest("/api/tasks"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalCount).toBe(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe("task-1");
    expect(data.tasks[0].districts[0].leaid).toBe("1234567");
    expect(data.tasks[0].plans[0].planName).toBe("Plan A");
    // Verify user-scoping in where clause
    expect(mockPrisma.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdByUserId: "user-1" }),
      })
    );
  });

  it("filters by status", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.findMany.mockResolvedValue([] as never);

    await listTasks(makeRequest("/api/tasks?status=done"));

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "done" }),
      })
    );
  });

  it("filters by priority", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.findMany.mockResolvedValue([] as never);

    await listTasks(makeRequest("/api/tasks?priority=urgent"));

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priority: "urgent" }),
      })
    );
  });

  it("filters by planId", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.findMany.mockResolvedValue([] as never);

    await listTasks(makeRequest("/api/tasks?planId=plan-1"));

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plans: { some: { planId: "plan-1" } },
        }),
      })
    );
  });

  it("searches by title", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.findMany.mockResolvedValue([] as never);

    await listTasks(makeRequest("/api/tasks?search=follow"));

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: "follow", mode: "insensitive" },
        }),
      })
    );
  });

  it("filters by date range (dueBefore/dueAfter)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockResolvedValue(0);
    mockPrisma.task.findMany.mockResolvedValue([] as never);

    await listTasks(
      makeRequest(
        "/api/tasks?dueBefore=2026-03-01T00:00:00Z&dueAfter=2026-02-01T00:00:00Z"
      )
    );

    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: {
            lte: new Date("2026-03-01T00:00:00Z"),
            gte: new Date("2026-02-01T00:00:00Z"),
          },
        }),
      })
    );
  });

  it("returns 500 on error", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.count.mockRejectedValue(new Error("DB down"));

    const res = await listTasks(makeRequest("/api/tasks"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch tasks" });
  });
});

// ============================================================
// POST /api/tasks  (create)
// ============================================================
describe("POST /api/tasks", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/tasks", { body: { title: "Test" } })
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when title missing", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await POST(makeRequest("/api/tasks", { body: {} }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("returns 400 when title is whitespace only", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await POST(
      makeRequest("/api/tasks", { body: { title: "   " } })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "title is required" });
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await POST(
      makeRequest("/api/tasks", {
        body: { title: "Test", status: "invalid_status" },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("status must be one of");
  });

  it("returns 400 for invalid priority", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await POST(
      makeRequest("/api/tasks", {
        body: { title: "Test", priority: "super_urgent" },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("priority must be one of");
  });

  it("creates task with relations", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.create.mockResolvedValue(taskRow as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        body: {
          title: "New Task",
          description: "Description",
          status: "todo",
          priority: "high",
          dueDate: "2026-03-01T00:00:00Z",
          planIds: ["plan-1"],
          activityIds: ["act-1"],
          leaids: ["1234567"],
          contactIds: [1],
        },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("task-1");
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].planName).toBe("Plan A");
    expect(data.districts).toHaveLength(1);
    expect(data.activities).toHaveLength(1);
    expect(data.contacts).toHaveLength(1);

    // Verify nested create calls
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "New Task",
          createdByUserId: "user-1",
          plans: { create: [{ planId: "plan-1" }] },
          districts: { create: [{ districtLeaid: "1234567" }] },
          activities: { create: [{ activityId: "act-1" }] },
          contacts: { create: [{ contactId: 1 }] },
        }),
      })
    );
  });

  it("returns 500 on error", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(
      makeRequest("/api/tasks", { body: { title: "Test" } })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to create task" });
  });
});

// ============================================================
// GET /api/tasks/[id]  (detail)
// ============================================================
describe("GET /api/tasks/[id]", () => {
  const idParams = { params: Promise.resolve({ id: "task-1" }) };

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await getTask(makeRequest("/api/tasks/task-1"), idParams);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when task not found", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.findUnique.mockResolvedValue(null);

    const res = await getTask(makeRequest("/api/tasks/task-1"), idParams);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Task not found" });
  });

  it("returns 403 when user doesn't own task", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow({ createdByUserId: "other-user" });
    mockPrisma.task.findUnique.mockResolvedValue(taskRow as never);

    const res = await getTask(makeRequest("/api/tasks/task-1"), idParams);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Not authorized to view this task",
    });
  });

  it("returns task detail with linked entities", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.findUnique.mockResolvedValue(taskRow as never);

    const res = await getTask(makeRequest("/api/tasks/task-1"), idParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("task-1");
    expect(data.createdByUserId).toBe("user-1");
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].planId).toBe("plan-1");
    expect(data.districts).toHaveLength(1);
    expect(data.districts[0].leaid).toBe("1234567");
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0].activityId).toBe("act-1");
    expect(data.contacts).toHaveLength(1);
    expect(data.contacts[0].contactId).toBe(1);
  });
});

// ============================================================
// PATCH /api/tasks/[id]  (update)
// ============================================================
describe("PATCH /api/tasks/[id]", () => {
  const idParams = { params: Promise.resolve({ id: "task-1" }) };

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await patchTask(
      makeRequest("/api/tasks/task-1", {
        method: "PATCH",
        body: { status: "done" },
      }),
      idParams
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when task not found", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.findUnique.mockResolvedValue(null);

    const res = await patchTask(
      makeRequest("/api/tasks/task-1", {
        method: "PATCH",
        body: { status: "done" },
      }),
      idParams
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Task not found" });
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.findUnique.mockResolvedValue(taskRow as never);

    const res = await patchTask(
      makeRequest("/api/tasks/task-1", {
        method: "PATCH",
        body: { status: "not_a_status" },
      }),
      idParams
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("status must be one of");
  });

  it("returns 400 for invalid priority", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.findUnique.mockResolvedValue(taskRow as never);

    const res = await patchTask(
      makeRequest("/api/tasks/task-1", {
        method: "PATCH",
        body: { priority: "not_a_priority" },
      }),
      idParams
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("priority must be one of");
  });

  it("updates task fields", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const existingTask = makeTaskRow();
    mockPrisma.task.findUnique.mockResolvedValue(existingTask as never);

    const updatedTask = {
      id: "task-1",
      title: "Updated Title",
      status: "in_progress",
      priority: "high",
      position: 2,
      updatedAt: now,
    };
    mockPrisma.task.update.mockResolvedValue(updatedTask as never);

    const res = await patchTask(
      makeRequest("/api/tasks/task-1", {
        method: "PATCH",
        body: { title: "Updated Title", status: "in_progress", priority: "high", position: 2 },
      }),
      idParams
    );

    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("task-1");
    expect(data.title).toBe("Updated Title");
    expect(data.status).toBe("in_progress");
    expect(data.priority).toBe("high");
    expect(data.position).toBe(2);

    expect(mockPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          title: "Updated Title",
          status: "in_progress",
          priority: "high",
          position: 2,
        }),
      })
    );
  });
});

// ============================================================
// DELETE /api/tasks/[id]
// ============================================================
describe("DELETE /api/tasks/[id]", () => {
  const idParams = { params: Promise.resolve({ id: "task-1" }) };

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await DELETE(makeRequest("/api/tasks/task-1"), idParams);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when task not found", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockPrisma.task.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest("/api/tasks/task-1"), idParams);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Task not found" });
  });

  it("deletes task successfully", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const taskRow = makeTaskRow();
    mockPrisma.task.findUnique.mockResolvedValue(taskRow as never);
    mockPrisma.task.delete.mockResolvedValue(taskRow as never);

    const res = await DELETE(makeRequest("/api/tasks/task-1"), idParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockPrisma.task.delete).toHaveBeenCalledWith({
      where: { id: "task-1" },
    });
  });
});

// ============================================================
// PATCH /api/tasks/reorder
// ============================================================
describe("PATCH /api/tasks/reorder", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const res = await reorderTasks(
      makeRequest("/api/tasks/reorder", {
        method: "PATCH",
        body: { updates: [{ taskId: "t1", status: "todo", position: 0 }] },
      })
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when updates missing", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await reorderTasks(
      makeRequest("/api/tasks/reorder", {
        method: "PATCH",
        body: {},
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("updates must be a non-empty array");
  });

  it("returns 400 when updates is empty array", async () => {
    mockGetUser.mockResolvedValue(mockUser);

    const res = await reorderTasks(
      makeRequest("/api/tasks/reorder", {
        method: "PATCH",
        body: { updates: [] },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("updates must be a non-empty array");
  });

  it("returns 400 when tasks not owned by user", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // Return fewer tasks than requested => some not owned
    mockPrisma.task.findMany.mockResolvedValue([{ id: "t1" }] as never);

    const res = await reorderTasks(
      makeRequest("/api/tasks/reorder", {
        method: "PATCH",
        body: {
          updates: [
            { taskId: "t1", status: "todo", position: 0 },
            { taskId: "t2", status: "done", position: 1 },
          ],
        },
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("not found or not owned");
  });

  it("reorders tasks in transaction", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // All tasks owned
    mockPrisma.task.findMany.mockResolvedValue([
      { id: "t1" },
      { id: "t2" },
    ] as never);
    mockTransaction.mockResolvedValue([{}, {}]);

    const updates = [
      { taskId: "t1", status: "todo", position: 1 },
      { taskId: "t2", status: "in_progress", position: 0 },
    ];

    const res = await reorderTasks(
      makeRequest("/api/tasks/reorder", {
        method: "PATCH",
        body: { updates },
      })
    );

    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, updated: 2 });

    // Verify findMany ownership check
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1", "t2"] }, createdByUserId: "user-1" },
      select: { id: true },
    });

    // Verify $transaction was called with the update array
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
