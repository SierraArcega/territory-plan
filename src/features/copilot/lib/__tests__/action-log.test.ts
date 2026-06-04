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

  it("labels a plan add_districts action with its count", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "add_districts",
      afterJson: { added: 3, planId: "p1" },
    });
    expect(e.label).toBe("Added 3 districts to plan");
    expect(e.label).not.toContain("p1");
  });

  it("labels a plan remove_districts action with its count", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "remove_districts",
      afterJson: { removed: 2, planId: "p1" },
    });
    expect(e.label).toBe("Removed 2 districts from plan");
    expect(e.label).not.toContain("p1");
  });

  it("labels a plan add_activities action with its count (plural)", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "add_activities",
      afterJson: { added: 3, planId: "p1" },
    });
    expect(e.label).toBe("Added 3 activities to plan");
    expect(e.label).not.toContain("p1");
  });

  it("labels a plan add_activities action with its count (singular)", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "add_activities",
      afterJson: { added: 1, planId: "p1" },
    });
    expect(e.label).toBe("Added 1 activity to plan");
  });

  it("falls back to no-count label for add_activities when count is absent", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "add_activities",
      afterJson: { planId: "p1" },
    });
    expect(e.label).toBe("Added activities to plan");
  });

  it("labels a plan remove_activities action with its count (plural)", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "remove_activities",
      afterJson: { removed: 2, planId: "p1" },
    });
    expect(e.label).toBe("Removed 2 activities from plan");
    expect(e.label).not.toContain("p1");
  });

  it("labels a plan remove_activities action with its count (singular)", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "remove_activities",
      afterJson: { removed: 1, planId: "p1" },
    });
    expect(e.label).toBe("Removed 1 activity from plan");
  });

  it("falls back to no-count label for remove_activities when count is absent", () => {
    const e = formatActionLogEntry({
      ...base,
      objectType: "plan",
      operation: "remove_activities",
      afterJson: { planId: "p1" },
    });
    expect(e.label).toBe("Removed activities from plan");
  });

  it("serializes createdAt and carries status through", () => {
    const e = formatActionLogEntry({ ...base, status: "error" });
    expect(e.status).toBe("error");
    expect(e.createdAt).toBe("2026-05-27T12:00:00.000Z");
  });
});
