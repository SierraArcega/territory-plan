import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchArticles, processMatchQueue } from "@/features/news/lib/matcher";

export const dynamic = "force-dynamic";
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

  let districtMatches = 0;
  let schoolMatches = 0;
  let contactMatches = 0;
  let queuedForLlm = 0;
  let errors = 0;
  for (let i = 0; i < ids.length; i += batch) {
    const slice = ids.slice(i, i + batch);
    const stats = await matchArticles(slice);
    districtMatches += stats.districtMatches;
    schoolMatches += stats.schoolMatches;
    contactMatches += stats.contactMatches;
    queuedForLlm += stats.queuedForLlm;
    errors += stats.errors.length;
  }
  const queueStats = await processMatchQueue(50);

  return NextResponse.json({
    processed: ids.length,
    districtMatches,
    schoolMatches,
    contactMatches,
    queuedForLlm,
    llmCalls: queueStats.llmCalls,
    errors,
  });
}
