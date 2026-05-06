import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestOneState } from "@/features/news/lib/ingest";
import { US_STATES } from "@/features/news/lib/config";
import { sweepOrphanedNewsRuns } from "@/features/news/lib/orphan-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/ingest-news-state
 *
 * Per-minute slow drip of the 51 per-state Google News queries. Picks a state
 * deterministically by epoch-minute index so all states cycle every ~51 min,
 * regardless of when individual cron firings land. One RSS fetch per call,
 * fits comfortably under any function timeout.
 *
 * Replaces the per-state fan-out that used to live in ingestDailyLayers — that
 * version reliably blew the function timeout, so daily ingest never completed.
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

  await sweepOrphanedNewsRuns();

  // Optional ?state=XX override for manual replays; otherwise rotate by minute.
  const stateOverride = searchParams.get("state")?.toUpperCase();
  const state = stateOverride
    ? US_STATES.find((s) => s.abbrev === stateOverride)
    : US_STATES[Math.floor(Date.now() / 60_000) % US_STATES.length];

  if (!state) {
    return NextResponse.json({ error: `unknown state ${stateOverride}` }, { status: 400 });
  }

  const run = await prisma.newsIngestRun.create({
    data: { layer: "state", status: "running" },
  });

  try {
    const ingestStats = await ingestOneState(state.name);

    await prisma.newsIngestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        articlesNew: ingestStats.articlesNew,
        articlesDup: ingestStats.articlesDup,
        status: ingestStats.errors.length > 0 ? "error" : "ok",
        error: ingestStats.errors.length > 0 ? ingestStats.errors.slice(0, 5).join("; ").slice(0, 2000) : null,
      },
    });

    return NextResponse.json({
      runId: run.id,
      state: state.abbrev,
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
