import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestDailyLayers } from "@/features/news/lib/ingest";
import { matchArticles, processMatchQueue } from "@/features/news/lib/matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-daily
 *
 * Nightly news ingest: Layer 1 (edu RSS feeds) + Layer 2 (broad Google News
 * RSS queries + per-state queries). After ingest, runs keyword matcher on
 * new articles, then processes LLM match queue.
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

  const run = await prisma.newsIngestRun.create({
    data: { layer: "daily", status: "running" },
  });

  try {
    const ingestStats = await ingestDailyLayers();
    const matchStats = await matchArticles(ingestStats.newArticleIds);
    const queueStats = await processMatchQueue(20);

    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        articlesNew: ingestStats.articlesNew,
        articlesDup: ingestStats.articlesDup,
        districtsProcessed: ingestStats.districtsProcessed,
        llmCalls: matchStats.llmCalls + queueStats.llmCalls,
        status: ingestStats.errors.length > 0 ? "ok" : "ok",
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
      llmCalls: matchStats.llmCalls + queueStats.llmCalls,
      errors: ingestStats.errors.length + matchStats.errors.length + queueStats.errors.length,
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
