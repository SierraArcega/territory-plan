import { describe, it, expect } from "vitest";
import { COPILOT_TOOLS, PROPOSE_ACTIONS_TOOL_NAME } from "../tools";

describe("propose_actions tool schema", () => {
  it("exposes exactly the six supported operations in the operation enum", () => {
    const tool = COPILOT_TOOLS.find((t) => t.name === PROPOSE_ACTIONS_TOOL_NAME)!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = tool.input_schema as any;
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
});
