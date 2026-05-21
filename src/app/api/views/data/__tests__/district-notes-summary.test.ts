import { describe, it, expect } from "vitest";
import { summarizeNoteRows, type NoteSummaryRow } from "../district-notes-summary";

describe("summarizeNoteRows", () => {
  it("maps each leaid to its latest snippet + count", () => {
    const rows: NoteSummaryRow[] = [
      { district_leaid: "A", count: 3, latest_text: "newest A" },
      { district_leaid: "B", count: 1, latest_text: "only B" },
    ];
    const m = summarizeNoteRows(rows);
    expect(m.get("A")).toEqual({ latest: "newest A", count: 3 });
    expect(m.get("B")).toEqual({ latest: "only B", count: 1 });
    expect(m.get("C")).toBeUndefined();
  });

  it("coerces a bigint/string count to a number", () => {
    const m = summarizeNoteRows([{ district_leaid: "A", count: "5" as unknown as number, latest_text: "x" }]);
    expect(m.get("A")).toEqual({ latest: "x", count: 5 });
  });
});
