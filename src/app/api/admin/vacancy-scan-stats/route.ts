import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/vacancy-scan-stats
 *
 * Returns vacancy scanning stats for the admin monitoring card.
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      totalVacancies,
      verifiedVacancies,
      districtsWithVacancies,
      totalDistrictsWithUrl,
      recentScans,
      failedScans24h,
      lastScan,
      byPlatform,
    ] = await Promise.all([
      prisma.vacancy.count({ where: { status: "open" } }),
      prisma.vacancy.count({ where: { status: "open", districtVerified: true } }),
      prisma.vacancy.groupBy({ by: ["leaid"], where: { status: "open", districtVerified: true } }),
      prisma.district.count({ where: { jobBoardUrl: { not: null } } }),
      prisma.vacancyScan.count({
        where: {
          status: { in: ["completed", "completed_partial"] },
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.vacancyScan.count({
        where: {
          status: "failed",
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.vacancyScan.findFirst({
        where: { status: { in: ["completed", "completed_partial"] } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, platform: true, districtsMatched: true },
      }),
      prisma.vacancyScan.groupBy({
        by: ["platform"],
        where: {
          status: { in: ["completed", "completed_partial"] },
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _count: true,
      }),
    ]);

    // Districts scanned (unique leaids with a completed scan)
    const scannedDistricts = await prisma.vacancyScan.groupBy({
      by: ["leaid"],
      where: { status: { in: ["completed", "completed_partial"] } },
    });

    const coveragePct = totalDistrictsWithUrl > 0
      ? Math.round((scannedDistricts.length / totalDistrictsWithUrl) * 100)
      : 0;

    return NextResponse.json({
      totalVacancies,
      verifiedVacancies,
      districtsWithVacancies: districtsWithVacancies.length,
      totalDistrictsWithUrl,
      districtsScanned: scannedDistricts.length,
      coveragePct,
      scansLast7d: recentScans,
      failedLast24h: failedScans24h,
      lastScanAt: lastScan?.completedAt?.toISOString() ?? null,
      byPlatform: byPlatform.map((p) => ({
        platform: p.platform || "unknown",
        count: p._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching vacancy scan stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
