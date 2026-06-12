import { describe, it, expect } from "vitest";
import { parseCsv, rowsToCsv, slugifyForFilename } from "../csv";

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

describe("parseCsv", () => {
  it("parses a header row plus data rows into objects", () => {
    const out = parseCsv("name,email\nKaren,k@x.org\nTom,t@y.org\n");
    expect(out.headers).toEqual(["name", "email"]);
    expect(out.rows).toEqual([
      { name: "Karen", email: "k@x.org" },
      { name: "Tom", email: "t@y.org" },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const out = parseCsv('org,state\n"Mesa Valley USD 51, District Office",CO\n');
    expect(out.rows[0].org).toBe("Mesa Valley USD 51, District Office");
    expect(out.rows[0].state).toBe("CO");
  });

  it("unescapes doubled quotes inside quoted fields", () => {
    const out = parseCsv('note\n"Attended ""IEP staffing"" webinar"\n');
    expect(out.rows[0].note).toBe('Attended "IEP staffing" webinar');
  });

  it("keeps newlines inside quoted fields", () => {
    const out = parseCsv('note,who\n"line one\nline two",Karen\n');
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].note).toBe("line one\nline two");
    expect(out.rows[0].who).toBe("Karen");
  });

  it("accepts CRLF and bare-CR line endings", () => {
    const crlf = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(crlf.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
    const cr = parseCsv("a,b\r1,2\r3,4");
    expect(cr.rows).toHaveLength(2);
  });

  it("survives a missing trailing newline", () => {
    const out = parseCsv("a,b\n1,2");
    expect(out.rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("skips blank lines and rows of empty cells", () => {
    const out = parseCsv("a,b\n\n1,2\n,\n3,4\n\n");
    expect(out.rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("fills missing cells with empty strings and drops extras", () => {
    const out = parseCsv("a,b,c\n1,2\n1,2,3,4\n");
    expect(out.rows[0]).toEqual({ a: "1", b: "2", c: "" });
    expect(out.rows[1]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("skips columns with an empty header name", () => {
    const out = parseCsv("name,,email\nKaren,dropped,k@x.org\n");
    expect(out.headers).toEqual(["name", "email"]);
    expect(out.rows[0]).toEqual({ name: "Karen", email: "k@x.org" });
    expect(Object.keys(out.rows[0])).not.toContain("");
  });

  it("dedupes duplicate header names with a numeric suffix so both columns survive", () => {
    const out = parseCsv("Phone Number,City,Phone Number\n(956) 464-1650,Donna,(956) 464-9999\n");
    expect(out.headers).toEqual(["Phone Number", "City", "Phone Number (2)"]);
    expect(out.rows[0]).toEqual({
      "Phone Number": "(956) 464-1650",
      City: "Donna",
      "Phone Number (2)": "(956) 464-9999",
    });
  });

  it("bumps the dedupe suffix past a literal 'Name (2)' header", () => {
    const out = parseCsv("a,a,a (2)\n1,2,3\n");
    expect(out.headers).toEqual(["a", "a (3)", "a (2)"]);
    expect(out.rows[0]).toEqual({ a: "1", "a (3)": "2", "a (2)": "3" });
  });

  it("strips a UTF-8 BOM from the first header", () => {
    const out = parseCsv("﻿name\nKaren\n");
    expect(out.headers).toEqual(["name"]);
  });

  it("trims header and cell whitespace", () => {
    const out = parseCsv(" name , email \n Karen , k@x.org \n");
    expect(out.headers).toEqual(["name", "email"]);
    expect(out.rows[0]).toEqual({ name: "Karen", email: "k@x.org" });
  });

  it("returns empty output for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("\n\n")).toEqual({ headers: [], rows: [] });
  });

  it("round-trips rowsToCsv output", () => {
    const csv = rowsToCsv(
      ["name", "note"],
      [{ name: "Karen", note: 'has "quotes", commas\nand a newline' }],
    );
    const out = parseCsv(csv);
    expect(out.rows[0]).toEqual({
      name: "Karen",
      note: 'has "quotes", commas\nand a newline',
    });
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
