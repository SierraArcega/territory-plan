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
    const { metrics } = body as {
      metrics: { action: string; label: string; pointValue: number; weight: number }[];
    };

    if (!Array.isArray(metrics)) {
      return NextResponse.json({ error: "metrics must be an array" }, { status: 400 });
    }

    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    // Replace all metrics for the season in a transaction
    await prisma.$transaction([
      prisma.seasonMetric.deleteMany({ where: { seasonId: season.id } }),
      ...metrics.map((m) =>
        prisma.seasonMetric.create({
          data: {
            seasonId: season.id,
            action: m.action,
            label: m.label,
            pointValue: m.pointValue,
            weight: m.weight,
          },
        })
      ),
    ]);

    const updated = await prisma.seasonMetric.findMany({
      where: { seasonId: season.id },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ success: true, metrics: updated });
  } catch (error) {
    console.error("Error updating metrics:", error);
    return NextResponse.json({ error: "Failed to update metrics" }, { status: 500 });
  }
}
