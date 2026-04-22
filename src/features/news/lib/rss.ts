import { XMLParser } from "fast-xml-parser";
import { EXCLUDED_DOMAINS, GOOGLE_NEWS_RSS_URL } from "./config";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (news-ingest)";
const FETCH_TIMEOUT_MS = 10_000;

export interface RawArticle {
  url: string;
  title: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  author?: string;
  source: string;
  publishedAt: Date;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
});

interface RssItemNode {
  title?: string | { "#text"?: string };
  link?: string | { "#text"?: string; href?: string };
  description?: string;
  "content:encoded"?: string;
  content?: string;
  "dc:creator"?: string;
  author?: string | { name?: string };
  pubDate?: string;
  published?: string;
  updated?: string;
  source?: string | { "#text"?: string; url?: string };
  enclosure?: { url?: string };
  "media:thumbnail"?: { url?: string };
  "media:content"?: { url?: string } | Array<{ url?: string }>;
}

function asText(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in v && typeof (v as Record<string, unknown>)["#text"] === "string") {
    return (v as Record<string, unknown>)["#text"] as string;
  }
  return undefined;
}

function asLink(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.href === "string") return o.href;
    if (typeof o["#text"] === "string") return o["#text"];
  }
  return undefined;
}

function asAuthor(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) {
    return typeof (v as Record<string, unknown>).name === "string"
      ? ((v as Record<string, unknown>).name as string)
      : undefined;
  }
  return undefined;
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isExcluded(url: string): boolean {
  const host = extractHost(url);
  return EXCLUDED_DOMAINS.has(host);
}

function extractImage(item: RssItemNode): string | undefined {
  const enc = item.enclosure?.url;
  if (typeof enc === "string") return enc;
  const thumb = item["media:thumbnail"]?.url;
  if (typeof thumb === "string") return thumb;
  const media = item["media:content"];
  if (Array.isArray(media) && typeof media[0]?.url === "string") return media[0].url;
  if (media && !Array.isArray(media) && typeof media.url === "string") return media.url;
  return undefined;
}

/** Fetch and parse an RSS 2.0 or Atom feed. Filters excluded domains. */
export async function fetchRssFeed(url: string, defaultSource: string): Promise<RawArticle[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const xml = await res.text();
  return parseRssXml(xml, defaultSource);
}

export function parseRssXml(xml: string, defaultSource: string): RawArticle[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  // RSS 2.0: rss.channel.item
  const rss = doc.rss as { channel?: { item?: RssItemNode | RssItemNode[] } } | undefined;
  const items: RssItemNode[] = rss?.channel?.item
    ? Array.isArray(rss.channel.item)
      ? rss.channel.item
      : [rss.channel.item]
    : [];

  // Atom: feed.entry
  const feed = doc.feed as { entry?: RssItemNode | RssItemNode[] } | undefined;
  const entries: RssItemNode[] = feed?.entry
    ? Array.isArray(feed.entry)
      ? feed.entry
      : [feed.entry]
    : [];

  const all = [...items, ...entries];
  const out: RawArticle[] = [];

  for (const item of all) {
    const url = asLink(item.link);
    if (!url) continue;
    if (isExcluded(url)) continue;

    const title = asText(item.title);
    if (!title) continue;

    const published = item.pubDate ?? item.published ?? item.updated;
    const publishedAt = published ? new Date(published) : new Date();
    if (Number.isNaN(publishedAt.getTime())) continue;

    // Source: prefer explicit <source> (common in Google News RSS), else host, else default.
    const srcText = asText(item.source);
    const source = srcText || extractHost(url) || defaultSource;

    out.push({
      url,
      title: cleanTitle(title, source),
      description: typeof item.description === "string" ? item.description : undefined,
      content:
        typeof item["content:encoded"] === "string"
          ? item["content:encoded"]
          : typeof item.content === "string"
            ? item.content
            : undefined,
      author: asText(item["dc:creator"]) ?? asAuthor(item.author),
      imageUrl: extractImage(item),
      source,
      publishedAt,
    });
  }
  return out;
}

/** Strip trailing " - {source}" appended by Google News RSS. */
function cleanTitle(title: string, source: string): string {
  const suffix = ` - ${source}`;
  if (title.endsWith(suffix)) return title.slice(0, -suffix.length).trim();
  // Google sometimes uses the publisher domain root instead of the display name.
  const match = title.match(/\s-\s([^-]+)$/);
  if (match) {
    const tail = match[1].trim();
    if (extractHost(`https://${tail.replace(/\s/g, "")}.com`).length > 0) {
      return title.slice(0, match.index!).trim();
    }
  }
  return title.trim();
}

/**
 * Build a Google News RSS search URL.
 *
 * IMPORTANT: Google News <link> values are redirect URLs (news.google.com/rss/articles/...).
 * We store those redirect URLs as-is — they are stable identifiers and hash consistently
 * across runs. Following the redirect to the publisher URL is done lazily on click by the
 * browser. See docs/superpowers/plans/2026-04-22-news-events-integration-plan.md §P2.2.
 */
export function buildGoogleNewsRssUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });
  return `${GOOGLE_NEWS_RSS_URL}?${params.toString()}`;
}

export async function fetchGoogleNewsRss(query: string): Promise<RawArticle[]> {
  return fetchRssFeed(buildGoogleNewsRssUrl(query), "news.google.com");
}
