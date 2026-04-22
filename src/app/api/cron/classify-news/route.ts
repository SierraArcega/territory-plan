import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyUnclassified } from "@/features/news/lib/classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/classify-news
 *
 * Runs the Haiku classifier over any articles with `classifiedAt IS NULL`.
 * Time-budgeted; re-invoke until queueRemaining=0 for a full backfill.
 *
 * Query params:
 *   ?batch=N        — max articles per invocation (default 200, max 2000)
 *   ?concurrency=N  — parallel Haiku calls (default 8)
 *   ?budgetMs=N     — soft time budget (default 250000, max 900000)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = Math.min(parseInt(searchParams.get("batch") || "200", 10), 2000);
  const concurrency = Math.min(parseInt(searchParams.get("concurrency") || "8", 10), 16);
  const budgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    900_000
  );

  const stats = await classifyUnclassified(batch, concurrency, budgetMs);
  const queueRemaining = await prisma.newsArticle.count({
    where: { classifiedAt: null },
  });

  return NextResponse.json({ ...stats, queueRemaining });
}
