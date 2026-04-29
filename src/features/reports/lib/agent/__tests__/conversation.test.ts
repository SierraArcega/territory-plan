import { describe, it, expect, vi } from "vitest";

const { findManyMock, createMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    queryLog: { findMany: findManyMock, create: createMock },
  },
}));

import { loadPriorTurns, saveTurn } from "../conversation";

describe("conversation persistence", () => {
  it("returns [] when conversationId is undefined", async () => {
    const turns = await loadPriorTurns(undefined, "user-1");
    expect(turns).toEqual([]);
  });

  it("loads turns in chronological order", async () => {
    findManyMock.mockResolvedValueOnce([
      { question: "a", sql: null, params: null, createdAt: new Date("2026-01-01") },
      { question: "b", sql: "SELECT 1", params: { summary: { source: "x" }, assistantText: "Here you go." }, createdAt: new Date("2026-01-02") },
    ]);
    const turns = await loadPriorTurns("conv-1", "user-1");
    expect(turns.length).toBe(2);
    expect(turns[0]!.question).toBe("a");
    expect(turns[1]!.summary?.source).toBe("x");
    expect(turns[1]!.assistantText).toBe("Here you go.");
  });

  it("persists with conversationId + user, includes assistantText in params", async () => {
    createMock.mockResolvedValueOnce({ id: 1 });
    await saveTurn({
      userId: "user-1",
      conversationId: "conv-1",
      question: "hello",
      sql: "SELECT 1",
      summary: { source: "s" },
      assistantText: "Here are the results.",
      rowCount: 0,
      executionTimeMs: 10,
    });
    expect(createMock).toHaveBeenCalled();
    const args = createMock.mock.calls[0]![0]!.data;
    expect(args.conversationId).toBe("conv-1");
    expect(args.userId).toBe("user-1");
    expect(args.params).toEqual({ summary: { source: "s" }, assistantText: "Here are the results." });
  });
});
