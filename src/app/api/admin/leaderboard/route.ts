import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: {
        metrics: { orderBy: { id: "asc" } },
        thresholds: { orderBy: { minPoints: "desc" } },
      },
    });

    if (!initiative) {
      return NextResponse.json({ initiative: null, metrics: [], thresholds: [], repCounts: {} });
    }

    // Count reps per tier for the active initiative
    const tierCounts = await prisma.initiativeScore.groupBy({
      by: ["tier"],
      where: { initiativeId: initiative.id },
      _count: { tier: true },
    });

    const repCounts: Record<string, number> = {};
    for (const row of tierCounts) {
      repCounts[row.tier] = row._count.tier;
    }

    return NextResponse.json({
      initiative: {
        id: initiative.id,
        name: initiative.name,
        initiativeUid: initiative.initiativeUid,
        startDate: initiative.startDate.toISOString(),
        endDate: initiative.endDate?.toISOString() ?? null,
        isActive: initiative.isActive,
        showName: initiative.showName,
        showDates: initiative.showDates,
        softResetTiers: initiative.softResetTiers,
        initiativeWeight: Number(initiative.initiativeWeight),
        pipelineWeight: Number(initiative.pipelineWeight),
        takeWeight: Number(initiative.takeWeight),
        revenueWeight: Number(initiative.revenueWeight),
        revenueTargetedWeight: Number(initiative.revenueTargetedWeight),
        pipelineFiscalYear: initiative.pipelineFiscalYear,
        takeFiscalYear: initiative.takeFiscalYear,
        revenueFiscalYear: initiative.revenueFiscalYear,
        revenueTargetedFiscalYear: initiative.revenueTargetedFiscalYear,
      },
      metrics: initiative.metrics.map((m) => ({
        id: m.id,
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
        weight: Number(m.weight),
      })),
      thresholds: initiative.thresholds.map((t) => ({
        id: t.id,
        tier: t.tier,
        minPoints: t.minPoints,
      })),
      repCounts,
    });
  } catch (error) {
    console.error("Error fetching admin leaderboard config:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard config" }, { status: 500 });
  }
}
