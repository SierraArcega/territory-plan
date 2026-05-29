/** A web source backing a research answer. */
export interface CopilotCitation {
  url: string;
  title: string;
}

/** Minimal structural shape of an assistant content block carrying citations.
 *  Endpoint-agnostic so it accepts both stable and beta SDK content blocks. */
interface CitationCarrier {
  type: string;
  citations?: Array<{ url?: string | null; title?: string | null }> | null;
}

/**
 * Pull web citations off an assistant message's content blocks: only `text`
 * blocks carry them. Dedupe by URL (first-seen wins) preserving order, and fall
 * back to the URL host when a citation has no usable title.
 */
export function extractCitations(content: CitationCarrier[]): CopilotCitation[] {
  const seen = new Set<string>();
  const out: CopilotCitation[] = [];
  for (const block of content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      const url = c.url ?? undefined;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const title = c.title?.trim();
      out.push({ url, title: title || hostOf(url) });
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
