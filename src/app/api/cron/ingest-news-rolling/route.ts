import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestRollingLayer } from "@/features/news/lib/ingest";
import { matchArticles } from "@/features/news/lib/matcher";
import { ROLLING_BATCH_SIZE } from "@/features/news/lib/config";
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-rolling
 *
 * Every-15-min rolling ingest: pulls the next batch of districts via
 * selectNextRollingBatch (tier-first ordering — T1 customer/pipeline @ 6h SLA,
 * T2 plan/recent-activity @ 24h, T3 long tail @ 30d, then oldest-fetched
 * within tier) and runs a per-district Google News RSS query for each.
 * Keyword matcher fires inline;
 * LLM-heavy steps are deferred to their dedicated crons (classify-news
 * hourly, drain-match-queue every 2h) so this stays under Vercel's 300s
 * maxDuration.
 *
 * Requires Vercel Pro for minute-level cron granularity.
 *
 * Auth: CRON_SECRET via Bearer token or ?secret= query param.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orphansSwept = await sweepOrphanedNewsRuns();
  if (orphansSwept > 0) {
    console.log(`[ingest-news-rolling] swept ${orphansSwept} orphaned runs`);
  }

  const batchSize = Math.min(
    parseInt(searchParams.get("batch") || String(ROLLING_BATCH_SIZE), 10),
    200
  );

  const run = await prisma.newsIngestRun.create({
    data: { layer: "rolling", status: "running" },
  });

  try {
    const ingestStats = await ingestRollingLayer(batchSize);

    // Checkpoint fetch stats before the matcher. If the function is killed
    // mid-match we still see what was ingested.
    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        articlesNew: ingestStats.articlesNew,
        articlesDup: ingestStats.articlesDup,
        districtsProcessed: ingestStats.districtsProcessed,
      },
    });

    const matchStats = await matchArticles(ingestStats.newArticleIds);

    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        llmCalls: matchStats.llmCalls,
        status: "ok",
        error: ingestStats.errors.length > 0 ? ingestStats.errors.slice(0, 5).join("; ").slice(0, 2000) : null,
      },
    });

    return NextResponse.json({
      runId: run.id,
      districtsProcessed: ingestStats.districtsProcessed,
      articlesNew: ingestStats.articlesNew,
      articlesDup: ingestStats.articlesDup,
      districtMatches: matchStats.districtMatches,
      queuedForLlm: matchStats.queuedForLlm,
      llmCalls: matchStats.llmCalls,
      errors: ingestStats.errors.length + matchStats.errors.length,
    });
  } catch (err) {
    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "error",
        error: String(err).slice(0, 2000),
      },
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
