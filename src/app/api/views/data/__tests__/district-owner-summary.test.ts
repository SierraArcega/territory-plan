import { describe, it, expect } from "vitest";
import { summarizeOwnerRows, type OwnerSummaryRow } from "../district-owner-summary";

describe("summarizeOwnerRows", () => {
  it("maps each leaid with an owner to a renderable person", () => {
    const rows: OwnerSummaryRow[] = [
      { leaid: "A", owner_id: "u1", full_name: "Ada Lovelace", avatar_url: "http://x/a.png" },
      { leaid: "B", owner_id: "u2", full_name: null, avatar_url: null },
    ];
    const m = summarizeOwnerRows(rows);
    expect(m.get("A")).toEqual({ id: "u1", fullName: "Ada Lovelace", avatarUrl: "http://x/a.png" });
    expect(m.get("B")).toEqual({ id: "u2", fullName: null, avatarUrl: null });
    expect(m.get("C")).toBeUndefined();
  });

  it("skips rows with no owner_id", () => {
    const m = summarizeOwnerRows([{ leaid: "A", owner_id: null, full_name: null, avatar_url: null }]);
    expect(m.has("A")).toBe(false);
  });
});
