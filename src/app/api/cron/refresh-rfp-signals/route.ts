import { NextRequest, NextResponse } from "next/server";
import { refreshRfpSignals } from "@/features/rfps/lib/refresh-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/refresh-rfp-signals
 *
 * Recomputes district_pipeline_state on every RFP with a resolved leaid.
 * One SQL UPDATE; idempotent. Schedule nightly after the opportunities sync.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const rowsUpdated = await refreshRfpSignals();
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({ rowsUpdated, elapsedMs });
}
