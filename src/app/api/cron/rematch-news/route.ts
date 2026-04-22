import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchArticles, processMatchQueue } from "@/features/news/lib/matcher";

export const dynamic = "force-dynamic";
// 300 is Vercel Pro's hard cap. Dev can run longer; call re-invoked if needed.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/rematch-news
 *
 * Operational utility: re-runs the keyword matcher over already-ingested
 * articles. Useful after matcher logic changes. Processes in batches.
 *
 * Query params:
 *   ?since=ISO8601 — only rematch articles published on/after this date
 *   ?batch=N       — articles per internal batch (default 500)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  const batch = Math.min(parseInt(searchParams.get("batch") || "500", 10), 2000);

  const ids = (
    await prisma.newsArticle.findMany({
      where: sinceDate && !Number.isNaN(sinceDate.getTime()) ? { publishedAt: { gte: sinceDate } } : undefined,
      select: { id: true },
      orderBy: { publishedAt: "desc" },
    })
  ).map((a) => a.id);

  const drainQueue = searchParams.get("drain") !== "false";
  // Soft time budget — long enough to process meaningful backfill in dev.
  // In prod, Vercel caps at maxDuration (300s); the caller can re-invoke.
  const timeBudgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    900_000
  );
  const deadline = Date.now() + timeBudgetMs;

  let districtMatches = 0;
  let schoolMatches = 0;
  let contactMatches = 0;
  let queuedForLlm = 0;
  let llmCalls = 0;
  let llmLoops = 0;
  let errors = 0;

  for (let i = 0; i < ids.length; i += batch) {
    if (Date.now() > deadline) break;
    const slice = ids.slice(i, i + batch);
    const stats = await matchArticles(slice);
    districtMatches += stats.districtMatches;
    schoolMatches += stats.schoolMatches;
    contactMatches += stats.contactMatches;
    queuedForLlm += stats.queuedForLlm;
    errors += stats.errors.length;
  }

  if (drainQueue) {
    while (Date.now() < deadline) {
      const stats = await processMatchQueue(25);
      llmCalls += stats.llmCalls;
      districtMatches += stats.districtMatches;
      schoolMatches += stats.schoolMatches;
      contactMatches += stats.contactMatches;
      errors += stats.errors.length;
      llmLoops++;
      if (stats.articlesProcessed === 0) break; // queue drained
    }
  }

  const queueRemaining = await prisma.newsMatchQueue.count({
    where: { processedAt: null },
  });

  return NextResponse.json({
    processed: ids.length,
    districtMatches,
    schoolMatches,
    contactMatches,
    queuedForLlm,
    llmCalls,
    llmLoops,
    queueRemaining,
    errors,
    timedOut: Date.now() > deadline,
  });
}
