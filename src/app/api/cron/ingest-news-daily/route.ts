import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestDailyLayers } from "@/features/news/lib/ingest";
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-daily
 *
 * Nightly news ingest: Layer 1 (edu RSS feeds) + Layer 2 (broad Google News
 * RSS queries + per-state queries). Matching is fully decoupled — this cron
 * only fetches and stores articles. Pass 1 keyword matching runs in
 * /api/cron/match-articles, Pass 2 LLM disambiguation in
 * /api/cron/drain-match-queue. Keeps the daily fan-out (~65 RSS fetches)
 * comfortably under Vercel's 300s maxDuration.
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
    console.log(`[ingest-news-daily] swept ${orphansSwept} orphaned runs`);
  }

  const run = await prisma.newsIngestRun.create({
    data: { layer: "daily", status: "running" },
  });

  try {
    const ingestStats = await ingestDailyLayers();

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
