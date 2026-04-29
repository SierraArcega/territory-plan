import { NextRequest, NextResponse } from "next/server";
import PQueue from "p-queue";
import prisma from "@/lib/prisma";
import { detectPlatform, isStatewideBoard, loadSharedJobBoardUrls, normalizeJobBoardKey } from "@/features/vacancies/lib/platform-detector";
import { runScan } from "@/features/vacancies/lib/scan-runner";
import { buildSiblingCoverageRecords } from "@/features/vacancies/lib/shared-board-coverage";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Vercel Pro limit

const CRON_SECRET = process.env.CRON_SECRET;

/** Max scans to run per cron invocation (keep under Vercel Pro 60s limit) */
const SCANS_PER_RUN = 5;

/** Number of scans to run in parallel */
const CONCURRENCY = 5;

/**
 * GET /api/cron/scan-vacancies
 *
 * Automated vacancy scanning. Called by Vercel Cron (which sends GET requests).
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
export async function GET(request: NextRequest) {
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

    // Warm shared job-board cache before grouping
    await loadSharedJobBoardUrls();

    // Find all districts with job board URLs.
    // Skip districts at >=5 consecutive failures so dead URLs auto-shed
    // from rotation; an admin can manually reset the counter if needed.
    const districts = await prisma.district.findMany({
      where: {
        jobBoardUrl: { not: null },
        vacancyConsecutiveFailures: { lt: 5 },
      },
      select: { leaid: true, name: true, jobBoardUrl: true },
    });

    // Districts recently scanned (excluded from this run's stale pool)
    const recentScans = await prisma.vacancyScan.groupBy({
      by: ["leaid"],
      where: {
        status: { in: ["completed", "completed_partial"] },
        completedAt: { gte: staleDate },
      },
    });
    const recentlyScanned = new Set(recentScans.map((s) => s.leaid));

    // Districts that have EVER completed a scan — used to prioritize never-scanned groups
    const everCompleted = await prisma.vacancyScan.groupBy({
      by: ["leaid"],
      where: { status: { in: ["completed", "completed_partial"] } },
    });
    const everScanned = new Set(everCompleted.map((s) => s.leaid));

    const staleDistricts = districts.filter(
      (d) => d.jobBoardUrl && !recentlyScanned.has(d.leaid)
    );

    // Group by unique job board URL to deduplicate shared boards
    const urlGroups = new Map<
      string,
      { url: string; platform: string; districts: typeof staleDistricts; hasNeverScanned: boolean }
    >();

    for (const d of staleDistricts) {
      const url = d.jobBoardUrl!;
      const platform = detectPlatform(url);
      const isShared = isStatewideBoard(platform, url);

      // Shared boards: group by normalized URL (one scan covers all)
      // District-scoped: unique key per district
      const groupKey = isShared
        ? normalizeJobBoardKey(url) ?? `district:${d.leaid}`
        : `district:${d.leaid}`;

      let group = urlGroups.get(groupKey);
      if (!group) {
        group = { url, platform, districts: [], hasNeverScanned: false };
        urlGroups.set(groupKey, group);
      }
      group.districts.push(d);
      if (!everScanned.has(d.leaid)) group.hasNeverScanned = true;
    }

    // Sort priority:
    //   1. Shared boards first (one scan covers many districts)
    //   2. Groups containing at least one never-scanned district
    //      (prevents cycling-through-covered starvation; critical for coverage growth)
    //   3. Larger groups before smaller ones
    const sortedGroups = [...urlGroups.values()].sort((a, b) => {
      const aShared = isStatewideBoard(a.platform, a.url) ? 1 : 0;
      const bShared = isStatewideBoard(b.platform, b.url) ? 1 : 0;
      if (aShared !== bShared) return bShared - aShared;
      const aNever = a.hasNeverScanned ? 1 : 0;
      const bNever = b.hasNeverScanned ? 1 : 0;
      if (aNever !== bNever) return bNever - aNever;
      return b.districts.length - a.districts.length;
    });

    // Cap unknown-platform groups in the per-run batch to MAX_UNKNOWN_PER_RUN.
    // The Claude fallback path is failure-prone (~80% timeout rate as of the
    // 2026-04-23 regression); reserving most slots for districts with a
    // dedicated parser keeps the pipeline producing while the unknown URLs
    // are addressed separately (backfill, manual triage).
    const MAX_UNKNOWN_PER_RUN = 1;
    const cappedGroups: typeof sortedGroups = [];
    let unknownPicked = 0;
    for (const g of sortedGroups) {
      if (g.platform === "unknown") {
        if (unknownPicked >= MAX_UNKNOWN_PER_RUN) continue;
        unknownPicked++;
      }
      cappedGroups.push(g);
      if (cappedGroups.length >= SCANS_PER_RUN) break;
    }
    // Append remaining sortedGroups after the capped batch so coverage stats
    // (`remaining`, `neverScannedGroupsRemaining`) still reflect the full pool.
    const tail = sortedGroups.filter((g) => !cappedGroups.includes(g));
    const orderedGroups = [...cappedGroups, ...tail];

    // Run scans in parallel with capped concurrency
    const batchId = crypto.randomUUID();
    const results: { leaid: string; name: string; status: string; statewide: boolean }[] = [];

    const batch = orderedGroups.slice(0, SCANS_PER_RUN);
    const queue = new PQueue({ concurrency: CONCURRENCY });

    // Create all scan records upfront, then execute in parallel
    const scanJobs = await Promise.all(
      batch.map(async (group) => {
        const representative = group.districts[0];
        const scan = await prisma.vacancyScan.create({
          data: {
            leaid: representative.leaid,
            status: "pending",
            triggeredBy: "cron",
            batchId,
          },
        });
        return { scan, group, representative };
      })
    );

    let siblingCoverageCreated = 0;

    await queue.addAll(
      scanJobs.map(({ scan, group, representative }) => async () => {
        await runScan(scan.id);

        const result = await prisma.vacancyScan.findUnique({
          where: { id: scan.id },
          select: { status: true, platform: true, startedAt: true, completedAt: true },
        });

        const isStatewide = isStatewideBoard(group.platform, group.url);

        // For shared boards, create coverage records for sibling districts so
        // the coverage metric reflects the real number of districts whose
        // board was checked this run (not just the representative).
        if (isStatewide && result && group.districts.length > 1) {
          const siblingRecords = buildSiblingCoverageRecords({
            districts: group.districts,
            representativeLeaid: representative.leaid,
            representativeScan: result,
            batchId,
          });
          if (siblingRecords.length > 0) {
            await prisma.vacancyScan.createMany({ data: siblingRecords });
            siblingCoverageCreated += siblingRecords.length;
          }
        }

        results.push({
          leaid: representative.leaid,
          name: representative.name,
          status: result?.status ?? "unknown",
          statewide: isStatewide,
        });
      })
    );

    const districtsProcessed = batch.reduce((sum, group) => {
      const isStatewide = isStatewideBoard(group.platform, group.url);
      return sum + (isStatewide ? group.districts.length : 1);
    }, 0);

    const neverScannedGroupsPicked = batch.filter((g) => g.hasNeverScanned).length;
    const neverScannedGroupsRemaining = orderedGroups
      .slice(batch.length)
      .filter((g) => g.hasNeverScanned).length;

    return NextResponse.json({
      batchId,
      totalStale: staleDistricts.length,
      uniqueUrls: urlGroups.size,
      scansRun: batch.length,
      districtsProcessed,
      remaining: Math.max(0, urlGroups.size - batch.length),
      neverScannedGroupsPicked,
      neverScannedGroupsRemaining,
      siblingCoverageCreated,
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
