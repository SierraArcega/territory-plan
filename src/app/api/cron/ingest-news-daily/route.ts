import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestDailyLayers } from "@/features/news/lib/ingest";
import { matchArticles } from "@/features/news/lib/matcher";
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-daily
 *
 * Nightly news ingest: Layer 1 (edu RSS feeds) + Layer 2 (broad Google News
 * RSS queries + per-state queries). Keyword matcher fires inline on new
 * articles; LLM-heavy steps are deferred to their dedicated crons
 * (classify-news hourly, drain-match-queue every 2h) so this stays under
 * Vercel's 300s maxDuration.
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
      articlesNew: ingestStats.articlesNew,
      articlesDup: ingestStats.articlesDup,
      districtMatches: matchStats.districtMatches,
      schoolMatches: matchStats.schoolMatches,
      contactMatches: matchStats.contactMatches,
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
