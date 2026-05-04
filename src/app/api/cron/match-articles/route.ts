import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchArticles } from "@/features/news/lib/matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/match-articles
 *
 * Drains Pass 1 of the news matcher (keyword matching + LLM-queue prep) over
 * articles where matched_at IS NULL. Pass 1 used to run inline at ingest, but
 * with ~14k articles a day that path was timing out the rolling cron. This
 * cron processes batches until the queue is empty or the time budget expires.
 *
 * Query params:
 *   ?limit=N        — articles per batch (default 200, max 1000)
 *   ?budgetMs=N     — soft time budget (default 250000, max 290000)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);
  const budgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    290_000
  );
  const deadline = Date.now() + budgetMs;

  let articlesProcessed = 0;
  let districtMatches = 0;
  let schoolMatches = 0;
  let contactMatches = 0;
  let queuedForLlm = 0;
  let errors = 0;
  let loops = 0;

  while (Date.now() < deadline) {
    const next = await prisma.newsArticle.findMany({
      where: { matchedAt: null },
      select: { id: true },
      orderBy: { fetchedAt: "asc" },
      take: limit,
    });
    if (next.length === 0) break;

    const stats = await matchArticles(next.map((a) => a.id));
    articlesProcessed += stats.articlesProcessed;
    districtMatches += stats.districtMatches;
    schoolMatches += stats.schoolMatches;
    contactMatches += stats.contactMatches;
    queuedForLlm += stats.queuedForLlm;
    errors += stats.errors.length;
    loops++;
  }

  const queueRemaining = await prisma.newsArticle.count({
    where: { matchedAt: null },
  });

  return NextResponse.json({
    articlesProcessed,
    districtMatches,
    schoolMatches,
    contactMatches,
    queuedForLlm,
    errors,
    loops,
    queueRemaining,
    timedOut: Date.now() > deadline,
  });
}
