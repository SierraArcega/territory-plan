import { describe, it, expect } from "vitest";
import type { CopilotTurnResult } from "../types";

describe("CopilotTurnResult research variant", () => {
  it("accepts a research result with citations", () => {
    const r: CopilotTurnResult = {
      kind: "research",
      conversationId: "c1",
      assistantText: "Austin ISD passed a bond.",
      citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
    };
    expect(r.kind).toBe("research");
    expect(r.citations).toHaveLength(1);
  });
});
