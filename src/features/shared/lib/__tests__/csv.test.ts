import { describe, it, expect } from "vitest";
import { rowsToCsv, slugifyForFilename } from "../csv";

describe("rowsToCsv", () => {
  it("renders header and rows", () => {
    const csv = rowsToCsv(
      ["name", "bookings"],
      [
        { name: "Houston ISD", bookings: 12500 },
        { name: "Austin ISD", bookings: 8200 },
      ],
    );
    expect(csv).toBe("name,bookings\nHouston ISD,12500\nAustin ISD,8200\n");
  });

  it("returns header-only output when rows is empty", () => {
    expect(rowsToCsv(["a", "b"], [])).toBe("a,b\n");
  });

  it("escapes quotes, commas, and newlines", () => {
    const csv = rowsToCsv(
      ["note"],
      [
        { note: 'has "quotes" and, comma' },
        { note: "has\nnewline" },
      ],
    );
    expect(csv).toBe(
      'note\n"has ""quotes"" and, comma"\n"has\nnewline"\n',
    );
  });

  it("renders null/undefined as empty", () => {
    const csv = rowsToCsv(["a"], [{ a: null }, { a: undefined }, { a: 0 }]);
    expect(csv).toBe("a\n\n\n0\n");
  });

  it("serializes Date as ISO and objects as JSON", () => {
    const d = new Date("2026-04-01T00:00:00Z");
    const csv = rowsToCsv(
      ["d", "obj"],
      [{ d, obj: { a: 1 } }],
    );
    expect(csv).toBe(`d,obj\n2026-04-01T00:00:00.000Z,"{""a"":1}"\n`);
  });
});

describe("slugifyForFilename", () => {
  it("lowercases, replaces non-alphanumerics with dashes, strips edges", () => {
    expect(slugifyForFilename("Texas Districts — FY26 Closed-Won")).toBe(
      "texas-districts-fy26-closed-won",
    );
  });

  it("falls back to 'report' for empty input", () => {
    expect(slugifyForFilename("")).toBe("report");
    expect(slugifyForFilename("$$$")).toBe("report");
  });

  it("clamps length to 60 chars", () => {
    const long = "a".repeat(200);
    expect(slugifyForFilename(long).length).toBe(60);
  });
});
