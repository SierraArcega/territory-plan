import { describe, it, expect } from "vitest";
import { extractCitations } from "../citations";

describe("extractCitations", () => {
  it("pulls url + title from text-block citations", () => {
    const content = [
      {
        type: "text",
        text: "Austin ISD passed a bond.",
        citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
      },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://austinisd.org/bond", title: "2024 Bond" },
    ]);
  });

  it("dedupes by url, first-seen wins, and preserves order", () => {
    const content = [
      { type: "text", text: "a", citations: [{ url: "https://x.org/a", title: "A" }] },
      { type: "text", text: "b", citations: [{ url: "https://y.org/b", title: "B" }] },
      { type: "text", text: "c", citations: [{ url: "https://x.org/a", title: "A again" }] },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://x.org/a", title: "A" },
      { url: "https://y.org/b", title: "B" },
    ]);
  });

  it("falls back to the host (sans www) when title is missing/blank", () => {
    const content = [
      { type: "text", text: "a", citations: [{ url: "https://www.kut.org/news/123", title: "" }] },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://www.kut.org/news/123", title: "kut.org" },
    ]);
  });

  it("ignores non-text blocks and citation entries with no url", () => {
    const content = [
      { type: "server_tool_use", text: "" },
      { type: "text", text: "x", citations: [{ title: "no url" }] },
      { type: "text", text: "y" },
    ];
    expect(extractCitations(content)).toEqual([]);
  });
});
