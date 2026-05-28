import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { copilotTurn: { findMany: vi.fn() } },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { loadCopilotHistory } from "../conversation";

beforeEach(() => vi.clearAllMocks());

describe("loadCopilotHistory", () => {
  it("returns [] without a conversationId", async () => {
    expect(await loadCopilotHistory(undefined, "user-1")).toEqual([]);
    expect(mockPrisma.copilotTurn.findMany).not.toHaveBeenCalled();
  });

  it("maps a turn to a user message + assistant message", async () => {
    mockPrisma.copilotTurn.findMany.mockResolvedValue([
      { question: "how many open tasks?", assistantText: "You have 4.", sql: null, proposedActions: null },
    ]);
    const msgs = await loadCopilotHistory("conv-1", "user-1");
    expect(msgs).toEqual([
      { role: "user", text: "how many open tasks?" },
      { role: "assistant", text: "You have 4." },
    ]);
  });

  it("notes that a past turn returned a table (rows aren't persisted)", async () => {
    mockPrisma.copilotTurn.findMany.mockResolvedValue([
      { question: "texas districts", assistantText: "", sql: "SELECT ...", proposedActions: null },
    ]);
    const msgs = await loadCopilotHistory("conv-1", "user-1");
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].note).toMatch(/table/i);
  });

  it("notes how many actions a past turn proposed", async () => {
    mockPrisma.copilotTurn.findMany.mockResolvedValue([
      {
        question: "add a task",
        assistantText: "Drafted it.",
        sql: null,
        proposedActions: [{ operation: "create", objectType: "task", preview: { summary: "x" } }],
      },
    ]);
    const msgs = await loadCopilotHistory("conv-1", "user-1");
    expect(msgs[1].note).toMatch(/1 action/i);
  });
});
