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

describe("contact actions", () => {
  it("exposes contact.create and contact.update", () => {
    expect(getAction("contact", "create")).toBeDefined();
    expect(getAction("contact", "update")).toBeDefined();
    expect(getAction("contact", "delete")).toBeUndefined();
  });

  it("contact.create requires leaid and name", () => {
    const a = getAction("contact", "create")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ name: "Jane Doe" }).ok).toBe(false);
    expect(a.parse({ leaid: "0601234" }).ok).toBe(false);
    expect(a.parse({ leaid: "0601234", name: "Jane Doe" }).ok).toBe(true);
  });

  it("contact.create rejects an invalid persona", () => {
    const a = getAction("contact", "create")!;
    expect(a.parse({ leaid: "0601234", name: "Jane", persona: "not-a-persona" }).ok).toBe(false);
  });

  it("contact.create confirm card never exposes the raw leaid", () => {
    const a = getAction("contact", "create")!;
    const parsed = a.parse({ leaid: "0601234", name: "Jane Doe", title: "Superintendent" });
    if (!parsed.ok) throw new Error("expected valid");
    const preview = a.buildPreview(parsed.fields, { summary: "Add Jane Doe at Austin ISD" });
    expect(preview.title).toBe("Create contact");
    expect(preview.destructive).toBe(false);
    // The leaid is an internal id — it must not appear as a confirm-card value.
    expect(preview.rows.some((r) => r.value === "0601234")).toBe(false);
    expect(preview.rows.some((r) => r.label === "Name")).toBe(true);
  });

  it("contact.update needs a target and at least one field", () => {
    const a = getAction("contact", "update")!;
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ title: "VP of Curriculum" }).ok).toBe(true);
  });
});

describe("district_note actions", () => {
  it("exposes district_note.create and district_note.update", () => {
    expect(getAction("district_note", "create")).toBeDefined();
    expect(getAction("district_note", "update")).toBeDefined();
    expect(getAction("district_note", "delete")).toBeUndefined();
  });

  it("district_note.create requires leaid and text", () => {
    const a = getAction("district_note", "create")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ leaid: "0601234" }).ok).toBe(false);
    expect(a.parse({ text: "Met the super." }).ok).toBe(false);
    expect(a.parse({ leaid: "0601234", text: "Met the super." }).ok).toBe(true);
  });

  it("district_note.create rejects an invalid noteType", () => {
    const a = getAction("district_note", "create")!;
    expect(a.parse({ leaid: "0601234", text: "hi", noteType: "rumor" }).ok).toBe(false);
    expect(a.parse({ leaid: "0601234", text: "hi", noteType: "risk_flag" }).ok).toBe(true);
  });

  it("district_note.create confirm card shows the note, not the raw leaid", () => {
    const a = getAction("district_note", "create")!;
    const parsed = a.parse({ leaid: "0601234", text: "Budget approved for FY27." });
    if (!parsed.ok) throw new Error("expected valid");
    const preview = a.buildPreview(parsed.fields, { summary: "Note on Austin ISD" });
    expect(preview.destructive).toBe(false);
    expect(preview.rows.some((r) => r.value === "0601234")).toBe(false);
    expect(preview.rows.some((r) => r.value.includes("Budget approved"))).toBe(true);
  });

  it("district_note.update needs a target plus leaid and text", () => {
    const a = getAction("district_note", "update")!;
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ text: "Revised." }).ok).toBe(false);
    expect(a.parse({ leaid: "0601234", text: "Revised." }).ok).toBe(true);
  });
});

describe("activity actions", () => {
  it("exposes activity.create and activity.update", () => {
    expect(getAction("activity", "create")).toBeDefined();
    expect(getAction("activity", "update")).toBeDefined();
    expect(getAction("activity", "delete")).toBeUndefined();
  });

  it("activity.create requires a valid type and a title", () => {
    const a = getAction("activity", "create")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ title: "Demo" }).ok).toBe(false);
    expect(a.parse({ type: "discovery_call" }).ok).toBe(false);
    expect(a.parse({ type: "not_a_type", title: "Demo" }).ok).toBe(false);
    expect(a.parse({ type: "discovery_call", title: "Demo" }).ok).toBe(true);
  });

  it("activity.create rejects an invalid status", () => {
    const a = getAction("activity", "create")!;
    expect(a.parse({ type: "discovery_call", title: "Demo", status: "bogus" }).ok).toBe(false);
    expect(a.parse({ type: "discovery_call", title: "Demo", status: "completed" }).ok).toBe(true);
  });

  it("activity.create confirm card does not expose linked district leaids", () => {
    const a = getAction("activity", "create")!;
    const parsed = a.parse({ type: "discovery_call", title: "Demo", leaids: ["0601234"] });
    if (!parsed.ok) throw new Error("expected valid");
    const preview = a.buildPreview(parsed.fields, { summary: "Demo call with Austin ISD" });
    expect(preview.destructive).toBe(false);
    expect(preview.rows.some((r) => r.value === "0601234")).toBe(false);
  });

  it("activity.update needs a target and at least one field", () => {
    const a = getAction("activity", "update")!;
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ status: "completed" }).ok).toBe(true);
    expect(a.parse({ status: "bogus" }).ok).toBe(false);
  });
});

describe("plan actions", () => {
  it("exposes plan.create and plan.update", () => {
    expect(getAction("plan", "create")).toBeDefined();
    expect(getAction("plan", "update")).toBeDefined();
    expect(getAction("plan", "delete")).toBeUndefined();
  });

  it("plan.create requires a name and a valid fiscalYear", () => {
    const a = getAction("plan", "create")!;
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ name: "Texas FY26" }).ok).toBe(false);
    expect(a.parse({ name: "Texas FY26", fiscalYear: 1999 }).ok).toBe(false);
    expect(a.parse({ name: "Texas FY26", fiscalYear: 2026 }).ok).toBe(true);
  });

  it("plan.create rejects a bad status and a bad color", () => {
    const a = getAction("plan", "create")!;
    expect(a.parse({ name: "P", fiscalYear: 2026, status: "nope" }).ok).toBe(false);
    expect(a.parse({ name: "P", fiscalYear: 2026, color: "red" }).ok).toBe(false);
    expect(a.parse({ name: "P", fiscalYear: 2026, color: "#403770", status: "working" }).ok).toBe(true);
  });

  it("plan.update needs a target and at least one field", () => {
    const a = getAction("plan", "update")!;
    expect(a.needsTarget).toBe(true);
    expect(a.parse({}).ok).toBe(false);
    expect(a.parse({ status: "working" }).ok).toBe(true);
  });
});
