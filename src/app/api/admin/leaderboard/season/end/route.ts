import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        scores: {
          orderBy: { totalPoints: "desc" },
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    await prisma.season.update({
      where: { id: season.id },
      data: { isActive: false, endDate: new Date() },
    });

    const standings = season.scores.map((s, i) => ({
      rank: i + 1,
      fullName: s.user.fullName ?? "Unknown",
      totalPoints: s.totalPoints,
      tier: s.tier,
    }));

    return NextResponse.json({ success: true, standings });
  } catch (error) {
    console.error("Error ending season:", error);
    return NextResponse.json({ error: "Failed to end season" }, { status: 500 });
  }
}
