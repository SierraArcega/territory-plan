import { describe, it, expect } from "vitest";
import { plainTextToNoteDoc } from "../note-doc";

describe("plainTextToNoteDoc", () => {
  it("wraps a single line in a TipTap doc with one paragraph", () => {
    const { bodyJson, bodyText } = plainTextToNoteDoc("Met with the superintendent.");
    expect(bodyText).toBe("Met with the superintendent.");
    expect(bodyJson).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Met with the superintendent." }] },
      ],
    });
  });

  it("creates one paragraph per line, with empty paragraphs for blank lines", () => {
    const { bodyJson } = plainTextToNoteDoc("Line one\n\nLine three") as {
      bodyJson: { content: Array<Record<string, unknown>> };
    };
    expect(bodyJson.content).toHaveLength(3);
    expect(bodyJson.content[1]).toEqual({ type: "paragraph" });
    expect(bodyJson.content[2]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Line three" }],
    });
  });

  it("trims surrounding whitespace for bodyText and produces a non-empty doc", () => {
    const { bodyText, bodyJson } = plainTextToNoteDoc("  spaced  ") as {
      bodyText: string;
      bodyJson: { content: unknown[] };
    };
    expect(bodyText).toBe("spaced");
    expect(bodyJson.content.length).toBeGreaterThan(0);
  });
});
