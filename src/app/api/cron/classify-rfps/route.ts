import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyUnclassified } from "@/features/rfps/lib/classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/classify-rfps
 *
 * Runs the Haiku classifier over any RFPs with `classifiedAt IS NULL`.
 * Time-budgeted; re-invoke until queueRemaining=0 for a full backfill.
 *
 * Query params:
 *   ?batch=N        — max RFPs per invocation (default 100, max 500)
 *   ?concurrency=N  — parallel Haiku calls (default 4)
 *   ?budgetMs=N     — soft time budget (default 250000, max 290000)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = Math.min(parseInt(searchParams.get("batch") || "100", 10), 500);
  const concurrency = Math.min(parseInt(searchParams.get("concurrency") || "4", 10), 8);
  const budgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    290_000,
  );

  const stats = await classifyUnclassified(batch, concurrency, budgetMs);
  const queueRemaining = await prisma.rfp.count({
    where: { classifiedAt: null },
  });

  return NextResponse.json({ ...stats, queueRemaining });
}
