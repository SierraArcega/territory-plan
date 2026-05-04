import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestRollingLayer } from "@/features/news/lib/ingest";
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
 *
 * Matching is fully decoupled — this cron only fetches and stores articles
 * (plus the implicit district "source" links from ingestFeed). Pass 1 keyword
 * matching runs in /api/cron/match-articles, and Pass 2 LLM disambiguation in
 * /api/cron/drain-match-queue. Keeping ingest cheap stops it timing out under
 * Vercel's 300s maxDuration.
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

    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        articlesNew: ingestStats.articlesNew,
        articlesDup: ingestStats.articlesDup,
        districtsProcessed: ingestStats.districtsProcessed,
        status: "ok",
        error: ingestStats.errors.length > 0 ? ingestStats.errors.slice(0, 5).join("; ").slice(0, 2000) : null,
      },
    });

    return NextResponse.json({
      runId: run.id,
      districtsProcessed: ingestStats.districtsProcessed,
      articlesNew: ingestStats.articlesNew,
      articlesDup: ingestStats.articlesDup,
      errors: ingestStats.errors.length,
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
