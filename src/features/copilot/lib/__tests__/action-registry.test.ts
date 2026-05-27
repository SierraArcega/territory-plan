import { describe, it, expect } from "vitest";
import { getAction } from "../action-registry";

describe("copilot action registry", () => {
  it("exposes task.create and task.update, not unknown actions", () => {
    expect(getAction("task", "create")).toBeDefined();
    expect(getAction("task", "update")).toBeDefined();
    expect(getAction("task", "delete")).toBeUndefined();
    expect(getAction("district", "create")).toBeUndefined();
  });

  it("task.create requires a title", () => {
    const a = getAction("task", "create")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ title: "" }).ok).toBe(false);
    expect(a.parse({ title: "Call the school" }).ok).toBe(true);
  });

  it("task.create rejects invalid status / priority / dueDate", () => {
    const a = getAction("task", "create")!;
    expect(a.parse({ title: "x", status: "nope" }).ok).toBe(false);
    expect(a.parse({ title: "x", priority: "sometime" }).ok).toBe(false);
    expect(a.parse({ title: "x", dueDate: "not-a-date" }).ok).toBe(false);
    expect(
      a.parse({ title: "x", status: "todo", priority: "high", dueDate: "2026-06-02" }).ok,
    ).toBe(true);
  });

  it("task.update needs a target and at least one field", () => {
    const a = getAction("task", "update")!;
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ status: "done" }).ok).toBe(true);
  });

  it("task.create is not flagged as needing a target", () => {
    expect(getAction("task", "create")!.needsTarget).toBe(false);
  });

  it("buildPreview renders a non-destructive confirm card", () => {
    const a = getAction("task", "create")!;
    const parsed = a.parse({ title: "Call Austin ISD", priority: "high" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const preview = a.buildPreview(parsed.fields, { summary: "Follow up call" });
    expect(preview.title).toBe("Create task");
    expect(preview.summary).toBe("Follow up call");
    expect(preview.destructive).toBe(false);
    expect(preview.rows.some((r) => r.label === "Title")).toBe(true);
    expect(preview.rows.some((r) => r.label === "Priority")).toBe(true);
  });

  it("buildPreview falls back to the title when no summary is given", () => {
    const a = getAction("task", "create")!;
    const parsed = a.parse({ title: "Email superintendent" });
    if (!parsed.ok) throw new Error("expected valid");
    const preview = a.buildPreview(parsed.fields, {});
    expect(preview.summary).toBe("Email superintendent");
  });
});
