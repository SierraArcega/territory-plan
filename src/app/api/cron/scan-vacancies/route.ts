import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { detectPlatform, isStatewideBoard, loadSharedAppliTrackInstances } from "@/features/vacancies/lib/platform-detector";
import { runScan } from "@/features/vacancies/lib/scan-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Vercel Pro limit

const CRON_SECRET = process.env.CRON_SECRET;

/** Max scans to run per cron invocation */
const SCANS_PER_RUN = 30;

/**
 * POST /api/cron/scan-vacancies
 *
 * Automated vacancy scanning. Called by Vercel Cron or external scheduler.
 *
 * Smart batching:
 * - State-wide boards (OLAS, SchoolSpring): one scan per unique URL,
 *   auto-redistributes to all matching districts
 * - District-scoped boards (AppliTrack): one scan per district
 * - Prioritizes state-wide boards (one scan covers many districts)
 * - Only scans districts not scanned within `stale` days
 * - Runs up to SCANS_PER_RUN scans sequentially per invocation
 *
 * Query params:
 *   ?stale=7   — only scan districts not scanned in N days (default 7)
 *
 * Auth: CRON_SECRET via Bearer token or query param
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleDays = parseInt(searchParams.get("stale") || "7", 10);

  try {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    // Warm shared AppliTrack cache before grouping
    await loadSharedAppliTrackInstances();

    // Find all districts with job board URLs
    const districts = await prisma.district.findMany({
      where: { jobBoardUrl: { not: null } },
      select: { leaid: true, name: true, jobBoardUrl: true },
    });

    // Find which districts were recently scanned
    const recentScans = await prisma.vacancyScan.groupBy({
      by: ["leaid"],
      where: {
        status: { in: ["completed", "completed_partial"] },
        completedAt: { gte: staleDate },
      },
    });
    const recentlyScanned = new Set(recentScans.map((s) => s.leaid));

    const staleDistricts = districts.filter(
      (d) => d.jobBoardUrl && !recentlyScanned.has(d.leaid)
    );

    // Group by unique job board URL to deduplicate state-wide boards
    const urlGroups = new Map<
      string,
      { url: string; platform: string; districts: typeof staleDistricts }
    >();

    for (const d of staleDistricts) {
      const url = d.jobBoardUrl!;
      const platform = detectPlatform(url);

      // State-wide boards: group by base URL (one scan covers all)
      // District-scoped: unique key per district
      const groupKey = isStatewideBoard(platform, url)
        ? new URL(url).origin + new URL(url).pathname
        : `district:${d.leaid}`;

      if (!urlGroups.has(groupKey)) {
        urlGroups.set(groupKey, { url, platform, districts: [] });
      }
      urlGroups.get(groupKey)!.districts.push(d);
    }

    // Sort: state-wide boards first (high value), then by district count
    const sortedGroups = [...urlGroups.values()].sort((a, b) => {
      const aStatewide = isStatewideBoard(a.platform, a.url) ? 1 : 0;
      const bStatewide = isStatewideBoard(b.platform, b.url) ? 1 : 0;
      if (aStatewide !== bStatewide) return bStatewide - aStatewide;
      return b.districts.length - a.districts.length;
    });

    // Run scans sequentially, up to SCANS_PER_RUN
    const batchId = crypto.randomUUID();
    let scansRun = 0;
    let districtsProcessed = 0;
    const results: { leaid: string; name: string; status: string; statewide: boolean }[] = [];

    for (const group of sortedGroups) {
      if (scansRun >= SCANS_PER_RUN) break;

      // Pick the representative district for the scan
      const representative = group.districts[0];

      const scan = await prisma.vacancyScan.create({
        data: {
          leaid: representative.leaid,
          status: "pending",
          triggeredBy: "cron",
          batchId,
        },
      });

      // Run synchronously so we stay within Vercel's request lifecycle
      await runScan(scan.id);

      // Check result
      const result = await prisma.vacancyScan.findUnique({
        where: { id: scan.id },
        select: { status: true },
      });

      const isStatewide = isStatewideBoard(group.platform, group.url);
      results.push({
        leaid: representative.leaid,
        name: representative.name,
        status: result?.status ?? "unknown",
        statewide: isStatewide,
      });

      scansRun++;
      districtsProcessed += isStatewide ? group.districts.length : 1;
    }

    return NextResponse.json({
      batchId,
      totalStale: staleDistricts.length,
      uniqueUrls: urlGroups.size,
      scansRun,
      districtsProcessed,
      remaining: Math.max(0, urlGroups.size - scansRun),
      results,
    });
  } catch (error) {
    console.error("[cron] scan-vacancies failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
