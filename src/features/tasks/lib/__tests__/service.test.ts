import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: { findUnique: vi.fn() },
    task: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { createTask, updateTask } from "../service";
import { ServiceError } from "@/features/shared/lib/service-error";

const baseTaskRow = {
  id: "task-1",
  title: "Call school",
  description: null,
  status: "todo",
  priority: "medium",
  dueDate: null,
  position: 0,
  assignedTo: null,
  createdAt: new Date("2026-05-27T00:00:00Z"),
  updatedAt: new Date("2026-05-27T00:00:00Z"),
  plans: [],
  districts: [],
  activities: [],
  contacts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTask", () => {
  it("rejects a missing title", async () => {
    await expect(createTask({ title: "" }, "user-1")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects an invalid status", async () => {
    await expect(
      createTask({ title: "x", status: "nope" }, "user-1"),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("rejects an assignee that doesn't exist", async () => {
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    await expect(
      createTask({ title: "x", assignedToUserId: "ghost" }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("creates a task scoped to the current user", async () => {
    mockPrisma.task.create.mockResolvedValue(baseTaskRow);
    const result = await createTask({ title: "Call school" }, "user-1");
    expect(result.id).toBe("task-1");
    const arg = mockPrisma.task.create.mock.calls[0][0];
    expect(arg.data.createdByUserId).toBe("user-1");
    expect(arg.data.title).toBe("Call school");
  });
});

describe("updateTask", () => {
  it("404s when the task is missing", async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(
      updateTask("task-x", { status: "done" }, "user-1"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("403s when the user is not the owner", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "task-1",
      createdByUserId: "someone-else",
    });
    await expect(
      updateTask("task-1", { status: "done" }, "user-1"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("updates a task the user owns", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "task-1",
      createdByUserId: "user-1",
    });
    mockPrisma.task.update.mockResolvedValue({
      id: "task-1",
      title: "Updated",
      status: "done",
      priority: "high",
      position: 0,
      updatedAt: new Date("2026-05-27T00:00:00Z"),
    });
    const result = await updateTask("task-1", { status: "done" }, "user-1");
    expect(result.status).toBe("done");
    expect(mockPrisma.task.update).toHaveBeenCalledOnce();
  });

  it("rejects an invalid priority before touching the db", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "task-1",
      createdByUserId: "user-1",
    });
    await expect(
      updateTask("task-1", { priority: "whenever" }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });
});
