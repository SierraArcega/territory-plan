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

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        metrics: { orderBy: { id: "asc" } },
        thresholds: { orderBy: { minPoints: "desc" } },
      },
    });

    if (!season) {
      return NextResponse.json({ season: null, metrics: [], thresholds: [], repCounts: {} });
    }

    // Count reps per tier for the active season
    const tierCounts = await prisma.seasonScore.groupBy({
      by: ["tier"],
      where: { seasonId: season.id },
      _count: { tier: true },
    });

    const repCounts: Record<string, number> = {};
    for (const row of tierCounts) {
      repCounts[row.tier] = row._count.tier;
    }

    return NextResponse.json({
      season: {
        id: season.id,
        name: season.name,
        seasonUid: season.seasonUid,
        startDate: season.startDate.toISOString(),
        endDate: season.endDate?.toISOString() ?? null,
        isActive: season.isActive,
        showName: season.showName,
        showDates: season.showDates,
        softResetTiers: season.softResetTiers,
        seasonWeight: Number(season.seasonWeight),
        pipelineWeight: Number(season.pipelineWeight),
        takeWeight: Number(season.takeWeight),
      },
      metrics: season.metrics.map((m) => ({
        id: m.id,
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
        weight: Number(m.weight),
      })),
      thresholds: season.thresholds.map((t) => ({
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
