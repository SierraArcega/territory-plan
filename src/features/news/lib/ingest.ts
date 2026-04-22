import PQueue from "p-queue";
import { prisma } from "@/lib/prisma";
import {
  BROAD_QUERIES,
  EDU_FEEDS,
  ROLLING_BATCH_SIZE,
  US_STATES,
  perStateQuery,
} from "./config";
import { fetchGoogleNewsRss, fetchRssFeed, type RawArticle } from "./rss";
import { upsertArticle } from "./store-article";

export interface IngestStats {
  articlesNew: number;
  articlesDup: number;
  districtsProcessed: number;
  errors: string[];
  newArticleIds: string[];
}

function emptyStats(): IngestStats {
  return {
    articlesNew: 0,
    articlesDup: 0,
    districtsProcessed: 0,
    errors: [],
    newArticleIds: [],
  };
}

async function ingestFeed(
  articles: RawArticle[],
  feedSource: string,
  stats: IngestStats
): Promise<void> {
  for (const raw of articles) {
    try {
      const { article, isNew } = await upsertArticle(raw, feedSource);
      if (isNew) {
        stats.articlesNew++;
        stats.newArticleIds.push(article.id);
      } else {
        stats.articlesDup++;
      }
    } catch (err) {
      stats.errors.push(`upsert failed for ${raw.url}: ${String(err)}`);
    }
  }
}

/**
 * Layer 1 + Layer 2: national edu RSS + broad Google News RSS + per-state queries.
 * Intended to run nightly from /api/cron/ingest-news-daily.
 */
export async function ingestDailyLayers(): Promise<IngestStats> {
  const stats = emptyStats();
  const queue = new PQueue({ concurrency: 4 });

  // Layer 1 — edu RSS
  for (const feed of EDU_FEEDS) {
    queue.add(async () => {
      try {
        const raws = await fetchRssFeed(feed.url, feed.source);
        await ingestFeed(raws, feed.id, stats);
      } catch (err) {
        stats.errors.push(`${feed.id}: ${String(err)}`);
      }
    });
  }

  // Layer 2 — broad queries
  for (const q of BROAD_QUERIES) {
    queue.add(async () => {
      try {
        const raws = await fetchGoogleNewsRss(q);
        await ingestFeed(raws, "google_news_query", stats);
      } catch (err) {
        stats.errors.push(`broad "${q}": ${String(err)}`);
      }
    });
  }

  // Layer 2b — per-state queries
  for (const s of US_STATES) {
    queue.add(async () => {
      try {
        const raws = await fetchGoogleNewsRss(perStateQuery(s.name));
        await ingestFeed(raws, "google_news_query", stats);
      } catch (err) {
        stats.errors.push(`state "${s.abbrev}": ${String(err)}`);
      }
    });
  }

  await queue.onIdle();
  return stats;
}

/**
 * Layer 3: rolling per-district Google News RSS queries. Pulls oldest-priority
 * districts from the DistrictNewsFetch queue and fetches news for each.
 * Runs every 15 minutes on Vercel Pro cron.
 */
export async function ingestRollingLayer(
  batchSize = ROLLING_BATCH_SIZE
): Promise<IngestStats> {
  const stats = emptyStats();
  const queue = new PQueue({ concurrency: 4 });

  const fetches = await prisma.districtNewsFetch.findMany({
    take: batchSize,
    orderBy: [{ priority: "desc" }, { lastFetchedAt: { sort: "asc", nulls: "first" } }],
    include: {
      district: {
        select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true },
      },
    },
  });

  for (const row of fetches) {
    queue.add(async () => {
      const disambig = row.district.cityLocation ?? row.district.stateAbbrev ?? "";
      const query = `"${row.district.name}" ${disambig}`.trim();
      try {
        const raws = await fetchGoogleNewsRss(query);
        await ingestFeed(raws, "google_news_district", stats);
        await prisma.districtNewsFetch.update({
          where: { leaid: row.leaid },
          data: { lastFetchedAt: new Date(), lastStatus: "ok", lastError: null },
        });
        stats.districtsProcessed++;
      } catch (err) {
        await prisma.districtNewsFetch.update({
          where: { leaid: row.leaid },
          data: { lastFetchedAt: new Date(), lastStatus: "error", lastError: String(err).slice(0, 1000) },
        });
        stats.errors.push(`district ${row.leaid}: ${String(err)}`);
      }
    });
  }

  await queue.onIdle();
  return stats;
}

/**
 * Layer 4: on-demand single-district refresh triggered by the UI.
 * Returns just the new article IDs so the caller can run matcher immediately.
 */
export async function ingestOneDistrict(leaid: string): Promise<IngestStats> {
  const stats = emptyStats();
  const district = await prisma.district.findUnique({
    where: { leaid },
    select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true },
  });
  if (!district) {
    stats.errors.push(`district ${leaid} not found`);
    return stats;
  }

  const disambig = district.cityLocation ?? district.stateAbbrev ?? "";
  const query = `"${district.name}" ${disambig}`.trim();
  try {
    const raws = await fetchGoogleNewsRss(query);
    await ingestFeed(raws, "manual_refresh", stats);
    await prisma.districtNewsFetch.upsert({
      where: { leaid },
      create: { leaid, lastFetchedAt: new Date(), lastStatus: "ok" },
      update: { lastFetchedAt: new Date(), lastStatus: "ok", lastError: null },
    });
    stats.districtsProcessed = 1;
  } catch (err) {
    stats.errors.push(`district ${leaid}: ${String(err)}`);
  }
  return stats;
}
