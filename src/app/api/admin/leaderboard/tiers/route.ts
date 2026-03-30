import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { thresholds } = body as {
      thresholds: { tier: string; minPoints: number }[];
    };

    if (!Array.isArray(thresholds)) {
      return NextResponse.json({ error: "thresholds must be an array" }, { status: 400 });
    }

    const initiative = await prisma.initiative.findFirst({ where: { isActive: true } });
    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    // Upsert each threshold
    await prisma.$transaction(
      thresholds.map((t) =>
        prisma.initiativeTierThreshold.upsert({
          where: { initiativeId_tier: { initiativeId: initiative.id, tier: t.tier } },
          update: { minPoints: t.minPoints },
          create: { initiativeId: initiative.id, tier: t.tier, minPoints: t.minPoints },
        })
      )
    );

    // Recalculate tiers for all reps in this initiative
    const scores = await prisma.initiativeScore.findMany({
      where: { initiativeId: initiative.id },
    });
    const updatedThresholds = await prisma.initiativeTierThreshold.findMany({
      where: { initiativeId: initiative.id },
    });
    const sorted = [...updatedThresholds].sort((a, b) => b.minPoints - a.minPoints);

    await prisma.$transaction(
      scores.map((s) => {
        const matched = sorted.find((t) => s.totalPoints >= t.minPoints);
        const newTier = matched?.tier ?? "freshman";
        return prisma.initiativeScore.update({
          where: { id: s.id },
          data: { tier: newTier },
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating tiers:", error);
    return NextResponse.json({ error: "Failed to update tiers" }, { status: 500 });
  }
}
