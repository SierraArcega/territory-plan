import React from "react";

function RenderInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-[#322a5a]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface ListBlock {
  kind: "ul" | "ol";
  items: string[];
}
type Block = { kind: "p"; text: string } | ListBlock;

// Group consecutive `- foo` / `* foo` lines into a <ul>, `1. foo` lines into
// an <ol>, and anything else into <p>. Blank lines separate paragraphs.
function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let paragraphBuf: string[] = [];
  let listBuf: ListBlock | null = null;

  const flushParagraph = (): void => {
    if (paragraphBuf.length === 0) return;
    blocks.push({ kind: "p", text: paragraphBuf.join(" ") });
    paragraphBuf = [];
  };
  const flushList = (): void => {
    if (listBuf) {
      blocks.push(listBuf);
      listBuf = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!listBuf || listBuf.kind !== "ul") {
        flushList();
        listBuf = { kind: "ul", items: [] };
      }
      listBuf.items.push(bullet[1]!);
    } else if (numbered) {
      flushParagraph();
      if (!listBuf || listBuf.kind !== "ol") {
        flushList();
        listBuf = { kind: "ol", items: [] };
      }
      listBuf.items.push(numbered[1]!);
    } else {
      flushList();
      paragraphBuf.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Lightweight Markdown subset for assistant replies: paragraphs, bullet
 *  lists, numbered lists, and **bold** inline. Shared by the reports chat and
 *  the copilot rail so both render the agent's markdown identically. */
export function AssistantMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="leading-relaxed">
              <RenderInline text={b.text} />
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4 marker:text-[#A69DC0]">
              {b.items.map((it, j) => (
                <li key={j} className="leading-relaxed">
                  <RenderInline text={it} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal space-y-1 pl-4 marker:text-[#A69DC0]">
            {b.items.map((it, j) => (
              <li key={j} className="leading-relaxed">
                <RenderInline text={it} />
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}
