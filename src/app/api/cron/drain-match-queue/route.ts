import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processMatchQueue } from "@/features/news/lib/matcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/drain-match-queue
 *
 * Drains the NewsMatchQueue (Pass 2 LLM disambiguation) until empty or
 * the time budget expires. Doesn't re-run Pass 1. Re-invokable to pick
 * up where it left off.
 *
 * Query params:
 *   ?limit=N        — articles per batch (default 100, max 500)
 *   ?concurrency=N  — parallel Haiku calls (default 8, max 16)
 *   ?budgetMs=N     — soft time budget (default 250000, max 900000)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
  const concurrency = Math.min(parseInt(searchParams.get("concurrency") || "8", 10), 16);
  const budgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    900_000
  );
  const deadline = Date.now() + budgetMs;

  let totalLlmCalls = 0;
  let districtMatches = 0;
  let schoolMatches = 0;
  let contactMatches = 0;
  let errors = 0;
  let loops = 0;

  while (Date.now() < deadline) {
    const stats = await processMatchQueue(limit, concurrency);
    totalLlmCalls += stats.llmCalls;
    districtMatches += stats.districtMatches;
    schoolMatches += stats.schoolMatches;
    contactMatches += stats.contactMatches;
    errors += stats.errors.length;
    loops++;
    if (stats.articlesProcessed === 0) break;
  }

  const queueRemaining = await prisma.newsMatchQueue.count({
    where: { processedAt: null },
  });

  return NextResponse.json({
    llmCalls: totalLlmCalls,
    districtMatches,
    schoolMatches,
    contactMatches,
    errors,
    loops,
    queueRemaining,
    timedOut: Date.now() > deadline,
  });
}
