import { describe, it, expect } from "vitest";
import { summarizeNoteRows, type NoteSummaryRow } from "../district-notes-summary";

describe("summarizeNoteRows", () => {
  it("maps each leaid to its latest snippet + count", () => {
    const rows: NoteSummaryRow[] = [
      { district_leaid: "A", count: 3, latest_text: "newest A", latest_type: "risk_flag" },
      { district_leaid: "B", count: 1, latest_text: "only B", latest_type: "good_news" },
    ];
    const m = summarizeNoteRows(rows);
    expect(m.get("A")).toEqual({ latest: "newest A", count: 3, latestType: "risk_flag" });
    expect(m.get("B")).toEqual({ latest: "only B", count: 1, latestType: "good_news" });
    expect(m.get("C")).toBeUndefined();
  });

  it("coerces a bigint/string count to a number", () => {
    const m = summarizeNoteRows([{ district_leaid: "A", count: "5" as unknown as number, latest_text: "x", latest_type: "x" }]);
    expect(m.get("A")).toEqual({ latest: "x", count: 5, latestType: "x" });
  });
});
