import { describe, it, expect } from "vitest";
import { formatPageContextBlock, withPageContext } from "../page-context";

describe("formatPageContextBlock", () => {
  it("returns null for empty context", () => {
    expect(formatPageContextBlock(undefined)).toBeNull();
    expect(formatPageContextBlock({})).toBeNull();
  });

  it("includes the open district and multi-selected districts", () => {
    const block = formatPageContextBlock({
      tab: "map",
      openDistrict: { leaid: "0601234", name: "Austin ISD" },
      selectedLeaids: ["0601234", "4800001", "4800002"],
    });
    expect(block).toContain("<current_view>");
    expect(block).toContain("Austin ISD");
    // The multi-select set is exposed so the copilot can act on "these districts".
    expect(block).toContain("Selected districts (3)");
    expect(block).toContain("4800001");
  });

  it("caps the selected-district list and notes the overflow", () => {
    const leaids = Array.from({ length: 60 }, (_, i) => String(100000 + i));
    const block = formatPageContextBlock({ selectedLeaids: leaids })!;
    expect(block).toContain("Selected districts (60");
    expect(block).toContain("capped");
  });

  it("withPageContext prepends the block to the message", () => {
    const out = withPageContext("add a task", { selectedLeaids: ["0601234"] });
    expect(out.startsWith("<current_view>")).toBe(true);
    expect(out).toContain("add a task");
  });

  it("withPageContext returns the message unchanged when there is no context", () => {
    expect(withPageContext("hi", {})).toBe("hi");
  });
});
