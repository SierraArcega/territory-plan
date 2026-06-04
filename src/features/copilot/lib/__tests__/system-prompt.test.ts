import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/reports/lib/agent/system-prompt", () => ({
  buildSystemPrompt: vi.fn(async () => "DB_REFERENCE"),
}));

import { buildCopilotSystemPrompt } from "../system-prompt";

describe("buildCopilotSystemPrompt — web research", () => {
  it("documents the web research tools and the internal/external boundary", async () => {
    const prompt = await buildCopilotSystemPrompt({ id: "u1", email: "rep@x.com" });
    expect(prompt).toMatch(/web_search/);
    expect(prompt).toMatch(/web_fetch/);
    // never use it for internal data
    expect(prompt).toMatch(/never.*internal data/i);
    // prefer authoritative sources
    expect(prompt).toMatch(/\.gov.*\.edu|authoritative/i);
  });
});
