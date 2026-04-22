import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { NewsArticle } from "@prisma/client";
import { TRACKING_PARAMS } from "./config";
import type { RawArticle } from "./rss";

export interface UpsertResult {
  article: NewsArticle;
  isNew: boolean;
}

/** Strip tracking params (utm_*, fbclid, etc.) so the same article hashes
 *  identically regardless of how we discovered it. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const [k] of Array.from(u.searchParams)) {
      if (TRACKING_PARAMS.has(k) || k.toLowerCase().startsWith("utm_")) {
        u.searchParams.delete(k);
      }
    }
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function hashUrl(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

/** Cross-publisher syndication window: if we already have an article with the
 *  same normalized title published within this window of the incoming one,
 *  treat them as duplicates. 24h covers same-day wire-syndication cases like
 *  NBC News → MSN → NBC regional affiliates. */
const DUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Normalize a title for dup comparison: trim, collapse whitespace, strip
 *  trailing " - {publisher}" suffixes the RSS parser didn't catch. */
function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+[^-]{3,50}$/, "")
    .trim();
}

export async function upsertArticle(
  raw: RawArticle,
  feedSource: string
): Promise<UpsertResult> {
  const normalized = normalizeUrl(raw.url);
  const urlHash = hashUrl(raw.url);

  // Title and description are capped to column widths.
  const title = raw.title.slice(0, 500);
  const description = raw.description?.slice(0, 10_000) ?? null;
  const imageUrl = raw.imageUrl?.slice(0, 1000) ?? null;
  const author = raw.author?.slice(0, 255) ?? null;

  // Primary dedup: URL hash.
  const byUrl = await prisma.newsArticle.findUnique({ where: { urlHash } });
  if (byUrl) {
    return { article: byUrl, isNew: false };
  }

  // Secondary dedup: cross-publisher syndication — same normalized title
  // published within DUP_WINDOW_MS of the new article. Covers wire stories
  // on NBC/MSN/regional affiliates, NPR member stations, Sinclair, etc.
  const titleNorm = normalizeTitle(title);
  const windowStart = new Date(raw.publishedAt.getTime() - DUP_WINDOW_MS);
  const windowEnd = new Date(raw.publishedAt.getTime() + DUP_WINDOW_MS);
  const byTitle = await prisma.newsArticle.findFirst({
    where: {
      title: titleNorm,
      publishedAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { publishedAt: "asc" },
  });
  if (byTitle) {
    return { article: byTitle, isNew: false };
  }

  const article = await prisma.newsArticle.create({
    data: {
      url: normalized.slice(0, 2000),
      urlHash,
      title: titleNorm.slice(0, 500),
      description,
      content: raw.content ?? null,
      imageUrl,
      author,
      source: raw.source.slice(0, 255),
      feedSource: feedSource.slice(0, 40),
      publishedAt: raw.publishedAt,
      stateAbbrevs: [],
    },
  });
  return { article, isNew: true };
}
