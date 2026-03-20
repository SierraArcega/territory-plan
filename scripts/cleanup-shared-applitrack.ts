/**
 * One-time cleanup: delete mis-mapped vacancies from shared AppliTrack instances,
 * then re-fetch and redistribute using the existing pipeline.
 *
 * Usage:
 *   npx tsx scripts/cleanup-shared-applitrack.ts [--dry-run] [--instance <name>]
 *
 * Flags:
 *   --dry-run      Show what would be deleted/redistributed without making changes
 *   --instance X   Only process a single AppliTrack instance (e.g., "alaskateacher")
 */
import prisma from "../src/lib/prisma";
import { detectPlatform } from "../src/features/vacancies/lib/platform-detector";
import { getParser } from "../src/features/vacancies/lib/parsers";
import { processVacancies } from "../src/features/vacancies/lib/post-processor";
import type { RawVacancy } from "../src/features/vacancies/lib/parsers/types";

// ---- Reuse fuzzy matching from scan-runner ----

const NOISE_WORDS = [
  "school", "schools", "district", "public", "city", "county",
  "unified", "consolidated", "independent", "regional", "area",
  "township", "borough", "union", "free", "central", "community",
];

function normalizeForMatch(name: string): string {
  let n = name.toLowerCase().trim();
  for (const word of NOISE_WORDS) {
    n = n.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }
  return n.replace(/\s+/g, " ").trim();
}

function bigrams(str: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    result.add(str.substring(i, i + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

const MIN_NAME_LENGTH_FOR_FUZZY = 5;
const REDISTRIBUTION_DICE_THRESHOLD = 0.6;

interface DistrictCandidate {
  leaid: string;
  name: string;
  normalized: string;
}

function findBestDistrict(
  employerName: string,
  districts: DistrictCandidate[],
  schoolToDistrict: Map<string, string>
): { leaid: string; name: string } | null {
  const normEmployer = normalizeForMatch(employerName);

  if (!normEmployer || normEmployer.length < MIN_NAME_LENGTH_FOR_FUZZY) {
    // Still try exact school name lookup below
  } else {
    for (const d of districts) {
      if (d.normalized.length < MIN_NAME_LENGTH_FOR_FUZZY) continue;
      if (normEmployer.includes(d.normalized) || d.normalized.includes(normEmployer)) {
        return { leaid: d.leaid, name: d.name };
      }
    }

    let bestScore = 0;
    let bestMatch: DistrictCandidate | null = null;
    for (const d of districts) {
      if (d.normalized.length < MIN_NAME_LENGTH_FOR_FUZZY) continue;
      const score = diceCoefficient(normEmployer, d.normalized);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = d;
      }
    }
    if (bestMatch && bestScore >= REDISTRIBUTION_DICE_THRESHOLD) {
      return { leaid: bestMatch.leaid, name: bestMatch.name };
    }
  }

  const schoolLeaid = schoolToDistrict.get(employerName.toLowerCase().trim());
  if (schoolLeaid) {
    const district = districts.find((d) => d.leaid === schoolLeaid);
    if (district) return { leaid: district.leaid, name: district.name };
  }

  return null;
}

// ---- Delay helper ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const instanceIdx = args.indexOf("--instance");
  const onlyInstance = instanceIdx !== -1 ? args[instanceIdx + 1] : null;

  if (dryRun) console.log("=== DRY RUN MODE ===\n");

  // 1. Find all shared AppliTrack instances
  const sharedInstances: { instance: string; district_count: bigint }[] = await prisma.$queryRaw`
    SELECT
      LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)')) as instance,
      COUNT(*) as district_count
    FROM districts
    WHERE job_board_url LIKE '%applitrack.com%'
    GROUP BY LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)'))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  const instances = onlyInstance
    ? sharedInstances.filter((i) => i.instance === onlyInstance)
    : sharedInstances;

  if (instances.length === 0) {
    console.log("No shared AppliTrack instances found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${instances.length} shared AppliTrack instances to process.\n`);

  let totalDeleted = 0;
  let totalRedistributed = 0;
  let totalInstancesProcessed = 0;

  for (const inst of instances) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Instance: ${inst.instance} (${inst.district_count} districts)`);
    console.log("=".repeat(80));

    // 2. Get all districts pointing to this instance
    const districts: { leaid: string; name: string; enrollment: number | null; jobBoardUrl: string }[] =
      await prisma.district.findMany({
        where: {
          jobBoardUrl: { contains: `applitrack.com/${inst.instance}`, mode: "insensitive" },
        },
        select: { leaid: true, name: true, enrollment: true, jobBoardUrl: true },
      });

    // 3. Count existing open vacancies across all these districts
    const leaids = districts.map((d) => d.leaid);
    const existingCount = await prisma.vacancy.count({
      where: { leaid: { in: leaids }, status: "open" },
    });

    console.log(`  Districts: ${districts.length}`);
    console.log(`  Total open vacancies across all districts: ${existingCount}`);

    if (existingCount === 0) {
      console.log("  No vacancies to clean up — skipping.");
      continue;
    }

    // 4. Delete all open vacancies for these districts
    if (!dryRun) {
      const deleted = await prisma.vacancy.deleteMany({
        where: { leaid: { in: leaids }, status: "open" },
      });
      console.log(`  Deleted ${deleted.count} mis-mapped vacancies.`);
      totalDeleted += deleted.count;
    } else {
      console.log(`  [DRY RUN] Would delete ${existingCount} vacancies.`);
      totalDeleted += existingCount;
    }

    // 5. Pick representative district and re-fetch
    const representative = districts[0];
    const url = representative.jobBoardUrl;
    const platform = detectPlatform(url);
    const parser = getParser(platform);

    if (!parser) {
      console.log(`  No parser for platform "${platform}" — skipping re-fetch.`);
      continue;
    }

    console.log(`  Re-fetching from: ${url.substring(0, 80)}...`);

    let allJobs: RawVacancy[];
    try {
      allJobs = await parser(url);
    } catch (err) {
      console.error(`  Failed to fetch: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    console.log(`  Fetched ${allJobs.length} raw vacancies.`);

    if (allJobs.length === 0) {
      continue;
    }

    // 6. Load state districts + schools for matching
    const fipsPrefix = representative.leaid.substring(0, 2);
    const [stateDistricts, stateSchools] = await Promise.all([
      prisma.district.findMany({
        where: { leaid: { startsWith: fipsPrefix } },
        select: { leaid: true, name: true },
      }),
      prisma.school.findMany({
        where: { leaid: { startsWith: fipsPrefix } },
        select: { schoolName: true, leaid: true },
      }),
    ]);

    const candidates: DistrictCandidate[] = stateDistricts.map((d) => ({
      ...d,
      normalized: normalizeForMatch(d.name),
    }));

    const schoolToDistrict = new Map<string, string>();
    for (const s of stateSchools) {
      schoolToDistrict.set(s.schoolName.toLowerCase().trim(), s.leaid);
    }

    // 7. Group jobs by matched district
    const buckets = new Map<string, { districtName: string; jobs: RawVacancy[] }>();
    let unmatched = 0;

    for (const job of allJobs) {
      if (!job.employerName) {
        unmatched++;
        continue;
      }

      const match = findBestDistrict(job.employerName, candidates, schoolToDistrict);
      if (match) {
        if (!buckets.has(match.leaid)) {
          buckets.set(match.leaid, { districtName: match.name, jobs: [] });
        }
        buckets.get(match.leaid)!.jobs.push(job);
      } else {
        unmatched++;
      }
    }

    console.log(`  Matched to ${buckets.size} districts, ${unmatched} unmatched (dropped).`);

    // 8. Process each bucket through the normal pipeline
    if (!dryRun) {
      const scan = await prisma.vacancyScan.create({
        data: {
          leaid: representative.leaid,
          status: "running",
          platform,
          triggeredBy: "cleanup-script",
        },
      });

      let instanceTotal = 0;
      const CONCURRENCY = 5;
      const entries = [...buckets.entries()];

      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(([leaid, bucket]) =>
            processVacancies(leaid, scan.id, bucket.jobs, platform, bucket.districtName)
          )
        );
        for (const r of results) {
          instanceTotal += r.vacancyCount;
        }
      }

      await prisma.vacancyScan.update({
        where: { id: scan.id },
        data: {
          status: "completed",
          vacancyCount: instanceTotal,
          districtsMatched: buckets.size,
          completedAt: new Date(),
        },
      });

      console.log(`  Redistributed ${instanceTotal} vacancies to ${buckets.size} districts.`);
      totalRedistributed += instanceTotal;
    } else {
      const jobCount = [...buckets.values()].reduce((s, b) => s + b.jobs.length, 0);
      console.log(`  [DRY RUN] Would redistribute ${jobCount} vacancies to ${buckets.size} districts.`);
      totalRedistributed += jobCount;

      // Show top 5 districts by vacancy count
      const sorted = [...buckets.entries()]
        .sort((a, b) => b[1].jobs.length - a[1].jobs.length)
        .slice(0, 5);
      for (const [leaid, bucket] of sorted) {
        console.log(`    ${leaid} ${bucket.districtName}: ${bucket.jobs.length} vacancies`);
      }
    }

    totalInstancesProcessed++;

    // Rate-limit: wait 2s between instances to avoid hammering job boards
    if (instances.indexOf(inst) < instances.length - 1) {
      console.log("  Waiting 2s before next instance...");
      await delay(2000);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Instances processed: ${totalInstancesProcessed}`);
  console.log(`  Vacancies deleted:   ${totalDeleted}`);
  console.log(`  Vacancies redistributed: ${totalRedistributed}`);
  if (dryRun) console.log("\n  (DRY RUN — no changes were made)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
