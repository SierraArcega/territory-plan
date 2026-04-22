import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestRollingLayer } from "@/features/news/lib/ingest";
import { matchArticles, processMatchQueue } from "@/features/news/lib/matcher";
import { classifyArticles } from "@/features/news/lib/classifier";
import { ROLLING_BATCH_SIZE } from "@/features/news/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-rolling
 *
 * Every-15-min rolling ingest: pulls the next batch of districts off the
 * DistrictNewsFetch queue (priority DESC, oldest-fetched first) and runs a
 * per-district Google News RSS query for each. Matches fire after each run.
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

  const batchSize = Math.min(
    parseInt(searchParams.get("batch") || String(ROLLING_BATCH_SIZE), 10),
    200
  );

  const run = await prisma.newsIngestRun.create({
    data: { layer: "rolling", status: "running" },
  });

  try {
    const ingestStats = await ingestRollingLayer(batchSize);
    const matchStats = await matchArticles(ingestStats.newArticleIds);
    const queueStats = await processMatchQueue(20);
    const classifyStats = await classifyArticles(ingestStats.newArticleIds, 4, 45_000);

    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        articlesNew: ingestStats.articlesNew,
        articlesDup: ingestStats.articlesDup,
        districtsProcessed: ingestStats.districtsProcessed,
        llmCalls: matchStats.llmCalls + queueStats.llmCalls,
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
      llmCalls: matchStats.llmCalls + queueStats.llmCalls + classifyStats.llmCalls,
      classified: classifyStats.classified,
      errors: ingestStats.errors.length + matchStats.errors.length + queueStats.errors.length + classifyStats.errors,
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
