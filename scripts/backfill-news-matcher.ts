/**
 * Re-runs the news matcher (matchArticles) over previously-ingested articles
 * with the current matcher logic. Used to backfill matcher improvements.
 *
 * Behavior:
 *   • Selects articles published in the last DAYS days (default 90).
 *   • If --clean: first deletes news_article_districts rows with
 *     confidence IN ('high','llm') for those articles. confidence='source'
 *     rows are preserved (they're stamped at ingest, not by the matcher).
 *   • Runs matchArticles() in batches; writes new high/llm links and queues
 *     ambiguous articles into news_match_queue.
 *   • Does NOT drain the LLM queue (Pass 2). To run Pass 2 separately, hit
 *     /api/cron/rematch-news?drain=true after deploy, or pass --pass2 here.
 *
 * Usage:
 *   npx tsx scripts/backfill-news-matcher.ts                          # dry run, 90d
 *   npx tsx scripts/backfill-news-matcher.ts --commit                 # actually do it
 *   DAYS=30 npx tsx scripts/backfill-news-matcher.ts --commit         # smaller scope
 *   npx tsx scripts/backfill-news-matcher.ts --commit --no-clean      # additive only
 *   npx tsx scripts/backfill-news-matcher.ts --commit --pass2         # also drain LLM queue
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { matchArticles, processMatchQueue } from "@/features/news/lib/matcher";

const DAYS = parseInt(process.env.DAYS ?? "90", 10);
const BATCH = parseInt(process.env.BATCH ?? "200", 10);
const COMMIT = process.argv.includes("--commit");
const CLEAN = !process.argv.includes("--no-clean");
const PASS2 = process.argv.includes("--pass2");

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000);
  console.log(`[backfill] mode=${COMMIT ? "COMMIT" : "DRY-RUN"} days=${DAYS} since=${since.toISOString().slice(0, 10)} clean=${CLEAN} pass2=${PASS2}`);

  const articles = await prisma.newsArticle.findMany({
    where: { publishedAt: { gte: since } },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });
  console.log(`[backfill] articles in scope: ${articles.length}`);

  const articleIds = articles.map((a) => a.id);

  if (CLEAN) {
    const stale = await prisma.newsArticleDistrict.count({
      where: { articleId: { in: articleIds }, confidence: { in: ["high", "llm"] } },
    });
    console.log(`[backfill] keyword/llm links to clear: ${stale}`);

    const sourceLinks = await prisma.newsArticleDistrict.count({
      where: { articleId: { in: articleIds }, confidence: "source" },
    });
    console.log(`[backfill] source links preserved: ${sourceLinks}`);
  }

  if (!COMMIT) {
    console.log(`[backfill] DRY-RUN — exiting. Re-run with --commit to execute.`);
    return;
  }

  if (CLEAN) {
    console.log(`[backfill] deleting stale keyword/llm links…`);
    // Chunk the IN clause to keep below pgbouncer / pg parameter caps.
    const CHUNK = 1000;
    let deleted = 0;
    for (let i = 0; i < articleIds.length; i += CHUNK) {
      const slice = articleIds.slice(i, i + CHUNK);
      const result = await prisma.newsArticleDistrict.deleteMany({
        where: { articleId: { in: slice }, confidence: { in: ["high", "llm"] } },
      });
      deleted += result.count;
    }
    // Also clear school + contact keyword/llm links for the same scope.
    let schoolsDeleted = 0;
    let contactsDeleted = 0;
    for (let i = 0; i < articleIds.length; i += CHUNK) {
      const slice = articleIds.slice(i, i + CHUNK);
      schoolsDeleted += (
        await prisma.newsArticleSchool.deleteMany({
          where: { articleId: { in: slice }, confidence: { in: ["high", "llm"] } },
        })
      ).count;
      contactsDeleted += (
        await prisma.newsArticleContact.deleteMany({
          where: { articleId: { in: slice }, confidence: { in: ["high", "llm"] } },
        })
      ).count;
    }
    // Reset matched_at so matchArticles will reprocess these. (matchArticles
    // sets matched_at unconditionally at the end, so this isn't strictly
    // necessary for it to run — but clearing it is a clean signal that the
    // data is being rebuilt.)
    let resetMatchedAt = 0;
    for (let i = 0; i < articleIds.length; i += CHUNK) {
      const slice = articleIds.slice(i, i + CHUNK);
      const r = await prisma.newsArticle.updateMany({
        where: { id: { in: slice } },
        data: { matchedAt: null },
      });
      resetMatchedAt += r.count;
    }
    console.log(
      `[backfill] cleared ${deleted} district links, ${schoolsDeleted} school links, ${contactsDeleted} contact links, reset matched_at on ${resetMatchedAt} articles`
    );
  }

  // Run matchArticles in batches.
  const startedAt = Date.now();
  let totalDistricts = 0;
  let totalSchools = 0;
  let totalContacts = 0;
  let totalQueued = 0;
  let errors = 0;
  for (let i = 0; i < articleIds.length; i += BATCH) {
    const slice = articleIds.slice(i, i + BATCH);
    const stats = await matchArticles(slice);
    totalDistricts += stats.districtMatches;
    totalSchools += stats.schoolMatches;
    totalContacts += stats.contactMatches;
    totalQueued += stats.queuedForLlm;
    errors += stats.errors.length;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const done = Math.min(i + BATCH, articleIds.length);
    console.log(
      `[backfill] ${done}/${articleIds.length} | +${stats.districtMatches}d/${stats.schoolMatches}s/${stats.contactMatches}c, queued=${stats.queuedForLlm}, errors=${stats.errors.length} | ${elapsed}s`
    );
  }
  console.log("");
  console.log(`[backfill] keyword pass complete: districts=${totalDistricts} schools=${totalSchools} contacts=${totalContacts} queued=${totalQueued} errors=${errors}`);

  if (PASS2) {
    console.log(`[backfill] draining LLM queue…`);
    let totalLlm = 0;
    let pass2Districts = 0;
    let loop = 0;
    while (true) {
      const stats = await processMatchQueue(50, 5);
      pass2Districts += stats.districtMatches;
      totalLlm += stats.llmCalls;
      loop++;
      if (stats.articlesProcessed === 0) break;
      console.log(`[backfill] pass2 loop ${loop}: processed=${stats.articlesProcessed} llmCalls=${stats.llmCalls} districtMatches=${stats.districtMatches}`);
    }
    const remaining = await prisma.newsMatchQueue.count({ where: { processedAt: null } });
    console.log(`[backfill] pass2 complete: llmCalls=${totalLlm} districtMatches=${pass2Districts} remaining=${remaining}`);
  } else {
    console.log(`[backfill] (skipping Pass 2 — set --pass2 to drain LLM queue, or hit /api/cron/rematch-news?drain=true)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
