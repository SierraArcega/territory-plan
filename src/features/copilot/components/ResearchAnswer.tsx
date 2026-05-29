"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { AssistantMarkdown } from "@/features/shared/components/AssistantMarkdown";
import { hostOf, type CopilotCitation } from "../lib/citations";

function SourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Globe className="h-3.5 w-3.5 shrink-0 text-[#8A80A8]" aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=32`}
      alt=""
      className="h-3.5 w-3.5 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

/** Prose research answer followed by a compact, numbered Sources list. When
 *  `text` is empty, only the Sources list renders (the panel draws the prose
 *  itself). */
export function ResearchAnswer({
  text,
  citations,
}: {
  text: string;
  citations: CopilotCitation[];
}) {
  return (
    <div className="space-y-2">
      {text && (
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-[#EFEDF5] px-3 py-2 text-sm text-[#403770]">
          <AssistantMarkdown text={text} />
        </div>
      )}

      {citations.length > 0 && (
        <div className="rounded-lg border border-[#E2DEEC] bg-[#F7F5FA] px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A80A8]">
            Sources
          </p>
          <ol className="space-y-1">
            {citations.map((c, i) => (
              <li key={c.url} className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-[#8A80A8]">{i + 1}.</span>
                <SourceFavicon url={c.url} />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-[#403770] underline decoration-[#C9C1DE] hover:decoration-[#403770]"
                  title={c.title}
                >
                  <span className="text-[#8A80A8] whitespace-nowrap">{hostOf(c.url)}</span>
                  {" — "}
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
