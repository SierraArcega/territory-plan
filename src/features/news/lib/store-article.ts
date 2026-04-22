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

  // Try insert; on unique violation we fetch existing.
  const existing = await prisma.newsArticle.findUnique({ where: { urlHash } });
  if (existing) {
    return { article: existing, isNew: false };
  }

  const article = await prisma.newsArticle.create({
    data: {
      url: normalized.slice(0, 2000),
      urlHash,
      title,
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
