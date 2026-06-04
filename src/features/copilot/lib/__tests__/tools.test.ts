import { describe, it, expect } from "vitest";
import { COPILOT_TOOLS, PROPOSE_ACTIONS_TOOL_NAME } from "../tools";
import { AGENT_TOOLS } from "@/features/reports/lib/agent/tool-definitions";

describe("propose_actions tool schema", () => {
  it("exposes exactly the six supported operations in the operation enum", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = COPILOT_TOOLS.find((t) => (t as any).name === PROPOSE_ACTIONS_TOOL_NAME)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = (tool as any).input_schema;
    const ops = schema.properties.actions.items.properties.operation.enum as string[];
    expect(ops).toHaveLength(6);
    expect(ops).toEqual(
      expect.arrayContaining([
        "create",
        "update",
        "add_districts",
        "remove_districts",
        "add_activities",
        "remove_activities",
      ]),
    );
  });

  it("exposes web_search and web_fetch to the copilot", () => {
    const names = COPILOT_TOOLS.map((t) => (t as { name: string }).name);
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
  });

  it("caps web tool usage at 5 per turn", () => {
    const ws = COPILOT_TOOLS.find((t) => (t as { name: string }).name === "web_search");
    const wf = COPILOT_TOOLS.find((t) => (t as { name: string }).name === "web_fetch");
    expect((ws as { max_uses?: number }).max_uses).toBe(5);
    expect((wf as { max_uses?: number }).max_uses).toBe(5);
  });

  it("does not add web tools to the reports AGENT_TOOLS set", () => {
    const names = AGENT_TOOLS.map((t) => (t as { name: string }).name);
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("web_fetch");
  });
});
