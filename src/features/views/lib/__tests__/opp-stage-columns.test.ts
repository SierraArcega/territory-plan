import { describe, it, expect } from "vitest";
import {
  OPP_STAGE_COLUMNS,
  OPP_KANBAN_STAGES,
  columnForStage,
} from "../opp-stage-columns";

describe("OPP_STAGE_COLUMNS", () => {
  it("has eight columns in funnel order ending with the closed outcomes", () => {
    expect(OPP_STAGE_COLUMNS.map((c) => c.id)).toEqual([
      "meeting_booked",
      "discovery",
      "presentation",
      "proposal",
      "negotiation",
      "commitment",
      "closed_won",
      "closed_lost",
    ]);
  });

  it("gives every column a label, exact stage string, and accent hex", () => {
    for (const c of OPP_STAGE_COLUMNS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.stage.length).toBeGreaterThan(0);
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("OPP_KANBAN_STAGES", () => {
  it("is the eight matched stage strings for the SQL allowlist", () => {
    expect(OPP_KANBAN_STAGES).toHaveLength(8);
    expect(OPP_KANBAN_STAGES).toContain("0 - Meeting Booked");
    expect(OPP_KANBAN_STAGES).toContain("5 - Commitment");
    expect(OPP_KANBAN_STAGES).toContain("Closed Won");
    expect(OPP_KANBAN_STAGES).toContain("Closed Lost");
  });
});

describe("columnForStage", () => {
  it("maps a known stage string to its column", () => {
    expect(columnForStage("1 - Discovery")?.id).toBe("discovery");
    expect(columnForStage("Closed Lost")?.id).toBe("closed_lost");
  });

  it("returns undefined for excluded / unknown / null stages", () => {
    expect(columnForStage("Position Purchased")).toBeUndefined();
    expect(columnForStage("Active")).toBeUndefined();
    expect(columnForStage(null)).toBeUndefined();
    expect(columnForStage(undefined)).toBeUndefined();
  });
});
