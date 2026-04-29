import { describe, it, expect } from "vitest";
import { AGENT_TOOLS, RUN_SQL_TOOL_NAME } from "../tool-definitions";

describe("AGENT_TOOLS", () => {
  it("exposes all 9 expected tools", () => {
    const names = AGENT_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual([
      "count_rows",
      "describe_table",
      "get_column_values",
      "get_saved_report",
      "list_tables",
      "run_sql",
      "sample_rows",
      "search_metadata",
      "search_saved_reports",
    ]);
  });

  it("run_sql requires a summary with a source field", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === RUN_SQL_TOOL_NAME);
    const props = tool!.input_schema.properties as Record<string, unknown>;
    expect(props.sql).toBeDefined();
    expect(props.summary).toBeDefined();
    const summary = props.summary as { required: string[]; properties: Record<string, unknown> };
    expect(summary.required).toEqual(["source"]);
    expect(summary.properties.source).toBeDefined();
  });

  it("every tool has a description with at least 20 characters", () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.description!.length).toBeGreaterThan(20);
    }
  });
});
