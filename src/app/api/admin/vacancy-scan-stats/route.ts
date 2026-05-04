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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalVacancies,
      verifiedVacancies,
      districtsWithVacancies,
      totalDistrictsWithUrl,
      tarpitTotal,
      recentScans,
      failedScans24h,
      lastScan,
      byPlatform,
      scannedDistricts,
      failureReasonGroups,
      tarpitByPlatformRaw,
    ] = await Promise.all([
      prisma.vacancy.count({ where: { status: "open" } }),
      prisma.vacancy.count({ where: { status: "open", districtVerified: true } }),
      prisma.vacancy.groupBy({ by: ["leaid"], where: { status: "open", districtVerified: true } }),
      prisma.district.count({ where: { jobBoardUrl: { not: null } } }),
      prisma.district.count({
        where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
      }),
      prisma.vacancyScan.count({
        where: {
          status: { in: ["completed", "completed_partial"] },
          completedAt: { gte: sevenDaysAgo },
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
          completedAt: { gte: sevenDaysAgo },
        },
        _count: true,
      }),
      prisma.vacancyScan.groupBy({
        by: ["leaid"],
        where: { status: { in: ["completed", "completed_partial"] } },
      }),
      prisma.vacancyScan.groupBy({
        by: ["failureReason"],
        where: {
          status: { in: ["failed", "completed_partial"] },
          completedAt: { gte: sevenDaysAgo },
          failureReason: { not: null },
        },
        _count: true,
      }),
      prisma.district.groupBy({
        by: ["jobBoardPlatform"],
        where: { jobBoardUrl: { not: null }, vacancyConsecutiveFailures: { gte: 5 } },
        _count: true,
      }),
    ]);

    const coveragePct = totalDistrictsWithUrl > 0
      ? Math.round((scannedDistricts.length / totalDistrictsWithUrl) * 100)
      : 0;

    const adjustedDenominator = Math.max(1, totalDistrictsWithUrl - tarpitTotal);
    const adjustedCoveragePct = Math.round(
      (scannedDistricts.length / adjustedDenominator) * 100,
    );

    const tarpitByPlatform = tarpitByPlatformRaw
      .map((r) => ({
        platform: r.jobBoardPlatform || "unknown",
        count: r._count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const totalFailures7d = failureReasonGroups.reduce((s, g) => s + g._count, 0);
    const topGroup = failureReasonGroups
      .slice()
      .sort((a, b) => b._count - a._count)[0];
    const topFailureReason7d = topGroup && totalFailures7d > 0
      ? {
          reason: topGroup.failureReason!,
          pct: Math.round((topGroup._count / totalFailures7d) * 100),
        }
      : null;

    return NextResponse.json({
      totalVacancies,
      verifiedVacancies,
      districtsWithVacancies: districtsWithVacancies.length,
      totalDistrictsWithUrl,
      districtsScanned: scannedDistricts.length,
      coveragePct,
      adjustedCoveragePct,
      tarpit: {
        total: tarpitTotal,
        byPlatform: tarpitByPlatform,
      },
      topFailureReason7d,
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
