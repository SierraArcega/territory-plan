import PQueue from "p-queue";
import { prisma } from "@/lib/prisma";
import {
  BROAD_QUERIES,
  EDU_FEEDS,
  ROLLING_BATCH_SIZE,
  perStateQuery,
} from "./config";
import { fetchGoogleNewsRss, fetchRssFeed, type RawArticle } from "./rss";
import { selectNextRollingBatch } from "./rolling-batch";
import { upsertArticle } from "./store-article";

export interface IngestStats {
  articlesNew: number;
  articlesDup: number;
  articlesSkippedStale: number;
  districtsProcessed: number;
  errors: string[];
  newArticleIds: string[];
}

function emptyStats(): IngestStats {
  return {
    articlesNew: 0,
    articlesDup: 0,
    articlesSkippedStale: 0,
    districtsProcessed: 0,
    errors: [],
    newArticleIds: [],
  };
}

// Minimum bar for trusting a source-scoped article: title or description
// must contain an edu-context word. Kills obituaries, city-budget stories,
// and unrelated-school articles that Google News returns for local queries.
const EDU_CONTEXT_RE = /\b(schools?|districts?|superintendents?|boards?|teachers?|students?|pupils?|classrooms?|education|curriculum|enrollment|academic|tutoring|literacy)\b/i;

async function ingestFeed(
  articles: RawArticle[],
  feedSource: string,
  stats: IngestStats,
  sourceLeaid?: string
): Promise<void> {
  for (const raw of articles) {
    try {
      const result = await upsertArticle(raw, feedSource);
      if ("skipped" in result) {
        stats.articlesSkippedStale++;
        continue;
      }
      const { article, isNew } = result;
      if (isNew) {
        stats.articlesNew++;
        stats.newArticleIds.push(article.id);
      } else {
        stats.articlesDup++;
      }

      // "Trust the source" — when an article was fetched via a query scoped
      // to a specific district (Layer 3 rolling or Layer 4 on-demand refresh),
      // the query itself is strong evidence that the article is about that
      // district, even if the title doesn't name it verbatim. Gate this trust
      // behind a minimal edu-context check: the title or description must
      // contain at least one school/district/etc. word. Google News returns
      // lots of obituaries, city-budget, and unrelated-school articles for
      // district name queries — this filter kills them.
      if (sourceLeaid) {
        const text = `${raw.title} ${raw.description ?? ""}`;
        if (EDU_CONTEXT_RE.test(text)) {
          try {
            await prisma.newsArticleDistrict.upsert({
              where: { articleId_leaid: { articleId: article.id, leaid: sourceLeaid } },
              create: { articleId: article.id, leaid: sourceLeaid, confidence: "source" },
              update: {},
            });
          } catch (err) {
            stats.errors.push(`source-link failed for ${raw.url}: ${String(err)}`);
          }
        }
      }
    } catch (err) {
      stats.errors.push(`upsert failed for ${raw.url}: ${String(err)}`);
    }
  }
}

/**
 * Layer 1 + Layer 2: national edu RSS + broad Google News RSS.
 * Intended to run nightly from /api/cron/ingest-news-daily.
 *
 * Per-state queries are NOT included here — they live in
 * /api/cron/ingest-news-state which fans them out one-per-minute. Bundling all
 * 51 states into the daily run blew the function timeout (every daily run was
 * orphan-swept), so coverage moved to a slow drip.
 */
export async function ingestDailyLayers(): Promise<IngestStats> {
  const t0 = Date.now();
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

  await queue.onIdle();
  const elapsedMs = Date.now() - t0;
  console.log(
    `[news.ingest.daily] articlesNew=${stats.articlesNew} articlesDup=${stats.articlesDup} ` +
    `articlesSkippedStale=${stats.articlesSkippedStale} ` +
    `errors=${stats.errors.length} ms=${elapsedMs}`
  );
  return stats;
}

/**
 * Layer 2b: single per-state Google News query. Intended to be called once per
 * minute by /api/cron/ingest-news-state with a rotating state index, so all 51
 * states are swept ~every 51 minutes. Cheap (1 fetch + dedup) so it fits well
 * under any function timeout.
 */
export async function ingestOneState(stateName: string): Promise<IngestStats> {
  const stats = emptyStats();
  try {
    const raws = await fetchGoogleNewsRss(perStateQuery(stateName));
    await ingestFeed(raws, "google_news_query", stats);
  } catch (err) {
    stats.errors.push(`state "${stateName}": ${String(err)}`);
  }
  return stats;
}

/**
 * Layer 3: rolling per-district Google News RSS queries. Pulls the next batch
 * via selectNextRollingBatch (T1 customer/pipeline @ 6h SLA, T2 plan/recent-
 * activity @ 24h, T3 long tail @ 30d), tier-first then oldest-fetched within
 * tier. Runs every 15 minutes on Vercel Pro cron.
 */
export async function ingestRollingLayer(
  batchSize = ROLLING_BATCH_SIZE
): Promise<IngestStats> {
  const t0 = Date.now();
  const stats = emptyStats();
  const queue = new PQueue({ concurrency: 6 });

  const fetches = await selectNextRollingBatch(batchSize);

  for (const row of fetches) {
    queue.add(async () => {
      const disambig = row.cityLocation ?? row.stateAbbrev ?? "";
      const query = `"${row.name}" ${disambig}`.trim();
      try {
        const raws = await fetchGoogleNewsRss(query);
        await ingestFeed(raws, "google_news_district", stats, row.leaid);
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
  const elapsedMs = Date.now() - t0;
  console.log(
    `[news.ingest.rolling] batch=${fetches.length} ` +
    `articlesNew=${stats.articlesNew} articlesDup=${stats.articlesDup} ` +
    `articlesSkippedStale=${stats.articlesSkippedStale} ` +
    `districtsProcessed=${stats.districtsProcessed} errors=${stats.errors.length} ` +
    `ms=${elapsedMs}`
  );
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
    await ingestFeed(raws, "manual_refresh", stats, leaid);
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
