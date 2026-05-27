import { describe, it, expect } from "vitest";
import { formatActionLogEntry } from "../action-log";

const base = {
  id: 1,
  objectType: "task",
  operation: "create",
  status: "success",
  beforeJson: null,
  afterJson: null,
  createdAt: new Date("2026-05-27T12:00:00Z"),
};

describe("formatActionLogEntry", () => {
  it("derives a human label with the record's title", () => {
    const e = formatActionLogEntry({ ...base, afterJson: { id: "t1", title: "Follow up with Austin ISD" } });
    expect(e.label).toBe("Created task: Follow up with Austin ISD");
    // The raw target id must not leak into the label.
    expect(e.label).not.toContain("t1");
  });

  it("uses name when there's no title (plans)", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "update",
      afterJson: { id: "p1", name: "Texas FY26" },
    });
    expect(e.label).toBe("Updated plan: Texas FY26");
  });

  it("falls back to verb + noun when there's no name", () => {
    expect(formatActionLogEntry(base).label).toBe("Created task");
    expect(formatActionLogEntry({ ...base, objectType: "district_note" }).label).toBe(
      "Created district note",
    );
  });

  it("serializes createdAt and carries status through", () => {
    const e = formatActionLogEntry({ ...base, status: "error" });
    expect(e.status).toBe("error");
    expect(e.createdAt).toBe("2026-05-27T12:00:00.000Z");
  });
});
