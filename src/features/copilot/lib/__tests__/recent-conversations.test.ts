import { describe, it, expect, vi } from "vitest";
import { loadRecentConversations } from "../recent-conversations";

describe("loadRecentConversations", () => {
  it("groups turns by conversation, titled by the first question, newest first", async () => {
    const db = {
      copilotTurn: {
        findMany: vi.fn().mockResolvedValue([
          { conversationId: "c1", question: "iowa fits", createdAt: new Date("2026-05-25") },
          { conversationId: "c2", question: "add lake mills", createdAt: new Date("2026-05-26") },
          { conversationId: "c1", question: "and minnesota?", createdAt: new Date("2026-05-25T01:00:00") },
        ]),
      },
    } as never;
    const out = await loadRecentConversations(db, "u1", 5);
    expect(out).toEqual([
      { conversationId: "c2", title: "add lake mills", updatedAt: new Date("2026-05-26").toISOString() },
      { conversationId: "c1", title: "iowa fits", updatedAt: new Date("2026-05-25T01:00:00").toISOString() },
    ]);
  });
});
