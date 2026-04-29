import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // well under Vercel Pro 300s cap

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/pipeline-snapshot
 *
 * Writes one row per opportunity to opportunity_snapshots for the current
 * snapshot_date. Intended to run weekly (see vercel.json). Re-running on the
 * same day is safe — the unique (opportunity_id, snapshot_date) constraint
 * combined with ON CONFLICT DO UPDATE means the row is refreshed, not
 * duplicated.
 *
 * Auth: CRON_SECRET via Authorization: Bearer ... or ?secret=... query param.
 */
export async function GET(request: NextRequest) {
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

  // Upsert so a second run on the same day updates rather than duplicates.
  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < opps.length; i += CHUNK) {
    const chunk = opps.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((o) =>
        prisma.opportunitySnapshot.upsert({
          where: {
            opportunityId_snapshotDate: {
              opportunityId: o.id,
              snapshotDate: today,
            },
          },
          create: {
            opportunityId: o.id,
            snapshotDate: today,
            stage: o.stage,
            netBookingAmount: o.netBookingAmount,
            minimumPurchaseAmount: o.minimumPurchaseAmount,
            maximumBudget: o.maximumBudget,
            schoolYr: o.schoolYr,
            salesRepId: o.salesRepId,
            districtLeaId: o.districtLeaId,
            closeDate: o.closeDate,
            expiration: o.expiration,
          },
          update: {
            stage: o.stage,
            netBookingAmount: o.netBookingAmount,
            minimumPurchaseAmount: o.minimumPurchaseAmount,
            maximumBudget: o.maximumBudget,
            schoolYr: o.schoolYr,
            salesRepId: o.salesRepId,
            districtLeaId: o.districtLeaId,
            closeDate: o.closeDate,
            expiration: o.expiration,
            capturedAt: new Date(),
          },
        })
      )
    );
    inserted += chunk.length;
  }

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({
    snapshotDate: today.toISOString().slice(0, 10),
    oppsSnapshotted: inserted,
    elapsedMs,
  });
}
