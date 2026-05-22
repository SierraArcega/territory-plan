import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro cap; gives the bulk insert headroom

/**
 * GET /api/cron/pipeline-snapshot
 *
 * Writes one row per opportunity to opportunity_snapshots for the current
 * snapshot_date. Runs daily (see vercel.json). Re-running on the same day is
 * idempotent: the (opportunity_id, snapshot_date) unique constraint plus
 * delete-then-bulk-insert refreshes the rows instead of duplicating.
 *
 * History: this used to chunk into prisma.$transaction([...500 upserts]) which
 * silently capped at 500 rows because chunk 2 was killed by the function
 * timeout (~50s of round-trips into Supabase). Rewritten 2026-05-18 to use a
 * single createMany bulk insert. See:
 *   ~/Fullmind LMS/es-bi/Update Examples/2026.05.18 Fullmind Weekly Company Update.md
 *
 * Auth: CRON_SECRET via Authorization: Bearer ... or ?secret=... query param.
 */
export async function GET(request: NextRequest) {
  // Read at handler time so vitest can stub process.env without juggling
  // import order. CRON_SECRET should always be set in deployed envs.
  const CRON_SECRET = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? secretParam;
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Pull only the fields we snapshot. school_yr filter excludes completed
  // cycles to keep volume bounded; adjust as needed.
  const opps = await prisma.opportunity.findMany({
    where: {
      schoolYr: { in: ["2024-25", "2025-26", "2026-27", "2027-28"] },
    },
    select: {
      id: true,
      stage: true,
      netBookingAmount: true,
      minimumPurchaseAmount: true,
      maximumBudget: true,
      schoolYr: true,
      salesRepId: true,
      districtLeaId: true,
      closeDate: true,
      expiration: true,
    },
  });

  // Refresh today's snapshot atomically: delete then bulk-insert. Both
  // statements are single round-trips; total runtime is seconds even at 2,500+
  // opps. The unique constraint on (opportunity_id, snapshot_date) guarantees
  // the delete clears exactly today's rows.
  const capturedAt = new Date();
  const rows = opps.map((o) => ({
    snapshotDate: today,
    opportunityId: o.id,
    stage: o.stage,
    netBookingAmount: o.netBookingAmount,
    minimumPurchaseAmount: o.minimumPurchaseAmount,
    maximumBudget: o.maximumBudget,
    schoolYr: o.schoolYr,
    salesRepId: o.salesRepId,
    districtLeaId: o.districtLeaId,
    closeDate: o.closeDate,
    expiration: o.expiration,
    capturedAt,
  }));

  let inserted = 0;
  await prisma.$transaction(async (tx) => {
    await tx.opportunitySnapshot.deleteMany({ where: { snapshotDate: today } });
    if (rows.length > 0) {
      const result = await tx.opportunitySnapshot.createMany({ data: rows });
      inserted = result.count;
    }
  });

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    snapshotDate: today.toISOString().slice(0, 10),
    oppsScanned: opps.length,
    oppsSnapshotted: inserted,
    elapsedMs,
  });
}
