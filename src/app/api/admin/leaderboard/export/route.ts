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

    const seasons = await prisma.season.findMany({
      orderBy: { startDate: "desc" },
      include: {
        metrics: true,
        thresholds: true,
        scores: {
          orderBy: { totalPoints: "desc" },
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
    });

    // Build CSV
    const rows: string[] = [
      "Season Name,Season UID,Start Date,End Date,Active,Rep Name,Rep Email,Total Points,Tier,Rank",
    ];

    for (const season of seasons) {
      for (const score of season.scores) {
        rows.push(
          [
            `"${season.name}"`,
            season.seasonUid ?? "",
            season.startDate.toISOString().split("T")[0],
            season.endDate?.toISOString().split("T")[0] ?? "",
            season.isActive ? "Yes" : "No",
            `"${score.user.fullName ?? ""}"`,
            `"${score.user.email ?? ""}"`,
            score.totalPoints,
            score.tier,
            score.rank,
          ].join(",")
        );
      }
    }

    const csv = rows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leaderboard-history-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting leaderboard:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
