/**
 * Redistribute vacancies from a state-wide job board scan to the correct districts.
 *
 * Usage:
 *   npx tsx scripts/redistribute-statewide-vacancies.ts <leaid>
 *
 * 1. Fetches jobs from the district's state-wide job board URL
 * 2. Matches each job's employer name to an Iowa district in the DB
 * 3. Runs the normal post-processor for each matched district
 * 4. Unmatched jobs stay under the original district with districtVerified = false
 */
import prisma from "../src/lib/prisma";
import { parseSchoolSpring } from "../src/features/vacancies/lib/parsers/schoolspring";
import { parseOlas } from "../src/features/vacancies/lib/parsers/olas";
import { detectPlatform } from "../src/features/vacancies/lib/platform-detector";
import { processVacancies } from "../src/features/vacancies/lib/post-processor";
import type { RawVacancy } from "../src/features/vacancies/lib/parsers/types";

// ---- Fuzzy matching helpers ----

const NOISE_WORDS = [
  "school", "schools", "district", "public", "city", "county",
  "unified", "consolidated", "independent", "regional", "area",
  "township", "borough", "union", "free", "central", "community",
];

function normalize(name: string): string {
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

function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

function findBestDistrict(
  employerName: string,
  districts: { leaid: string; name: string; normalized: string }[]
): { leaid: string; name: string; score: number } | null {
  const normEmployer = normalize(employerName);
  if (!normEmployer) return null;

  let best: { leaid: string; name: string; score: number } | null = null;

  for (const d of districts) {
    // Exact substring match
    if (normEmployer.includes(d.normalized) || d.normalized.includes(normEmployer)) {
      return { leaid: d.leaid, name: d.name, score: 1.0 };
    }

    const score = dice(normEmployer, d.normalized);
    if (score > (best?.score ?? 0)) {
      best = { leaid: d.leaid, name: d.name, score };
    }
  }

  // Require a reasonable match
  return best && best.score >= 0.5 ? best : null;
}

// ---- Main ----

async function main() {
  const sourceLeaid = process.argv[2];
  if (!sourceLeaid) {
    console.error("Usage: npx tsx scripts/redistribute-statewide-vacancies.ts <leaid>");
    process.exit(1);
  }

  // 1. Get the source district
  const sourceDistrict = await prisma.district.findUnique({
    where: { leaid: sourceLeaid },
    select: { leaid: true, name: true, jobBoardUrl: true },
  });

  if (!sourceDistrict?.jobBoardUrl) {
    console.error(`District ${sourceLeaid} not found or has no job board URL`);
    process.exit(1);
  }

  console.log(`Source: ${sourceDistrict.name} (${sourceLeaid})`);
  console.log(`URL: ${sourceDistrict.jobBoardUrl}`);

  // 2. Detect platform and parse
  const platform = detectPlatform(sourceDistrict.jobBoardUrl);
  console.log(`Platform: ${platform}`);

  let allJobs: RawVacancy[];
  if (platform === "schoolspring") {
    allJobs = await parseSchoolSpring(sourceDistrict.jobBoardUrl);
  } else if (platform === "olas") {
    allJobs = await parseOlas(sourceDistrict.jobBoardUrl);
  } else {
    console.error(`Platform "${platform}" is not a state-wide board`);
    process.exit(1);
  }

  console.log(`Fetched ${allJobs.length} total jobs\n`);

  // 3. Load all districts in same state (by FIPS prefix)
  const fipsPrefix = sourceLeaid.substring(0, 2);
  const stateDistricts = await prisma.district.findMany({
    where: { leaid: { startsWith: fipsPrefix } },
    select: { leaid: true, name: true },
  });

  const districtsWithNorm = stateDistricts.map((d) => ({
    ...d,
    normalized: normalize(d.name),
  }));

  console.log(`Loaded ${districtsWithNorm.length} state districts for matching`);

  // 3b. Load all schools in same state for fallback matching
  const stateSchools = await prisma.school.findMany({
    where: { leaid: { startsWith: fipsPrefix } },
    select: { schoolName: true, leaid: true },
  });

  // Build a map: normalized school name → leaid
  const schoolToDistrict = new Map<string, string>();
  for (const s of stateSchools) {
    schoolToDistrict.set(s.schoolName.toLowerCase().trim(), s.leaid);
  }
  console.log(`Loaded ${stateSchools.length} state schools for fallback matching\n`);

  // 4. Group jobs by matched district
  const buckets = new Map<string, { districtName: string; jobs: RawVacancy[] }>();
  const unmatched: RawVacancy[] = [];
  let matchedByDistrict = 0;
  let matchedBySchool = 0;

  for (const job of allJobs) {
    if (!job.employerName) {
      unmatched.push(job);
      continue;
    }

    // Try district name match first
    const districtMatch = findBestDistrict(job.employerName, districtsWithNorm);
    if (districtMatch) {
      if (!buckets.has(districtMatch.leaid)) {
        buckets.set(districtMatch.leaid, { districtName: districtMatch.name, jobs: [] });
      }
      buckets.get(districtMatch.leaid)!.jobs.push(job);
      matchedByDistrict++;
      continue;
    }

    // Fallback: try matching employer name as a school name
    const schoolLeaid = schoolToDistrict.get(job.employerName.toLowerCase().trim());
    if (schoolLeaid) {
      const district = districtsWithNorm.find((d) => d.leaid === schoolLeaid);
      const districtName = district?.name ?? schoolLeaid;
      if (!buckets.has(schoolLeaid)) {
        buckets.set(schoolLeaid, { districtName, jobs: [] });
      }
      buckets.get(schoolLeaid)!.jobs.push(job);
      matchedBySchool++;
      continue;
    }

    unmatched.push(job);
  }

  console.log(`Matched to ${buckets.size} districts`);
  console.log(`  via district name: ${matchedByDistrict}`);
  console.log(`  via school name:   ${matchedBySchool}`);
  console.log(`  unmatched:         ${unmatched.length}\n`);

  // 5. Create a single scan record and process each bucket
  const scan = await prisma.vacancyScan.create({
    data: {
      leaid: sourceLeaid,
      status: "running",
      triggeredBy: "redistribute-script",
    },
  });

  let totalProcessed = 0;

  for (const [leaid, bucket] of buckets) {
    const result = await processVacancies(
      leaid,
      scan.id,
      bucket.jobs,
      platform,
      bucket.districtName
    );
    console.log(`  ${bucket.districtName} (${leaid}): ${result.vacancyCount} vacancies, ${result.fullmindRelevantCount} relevant`);
    totalProcessed += result.vacancyCount;
  }

  // Process unmatched under source district with districtVerified = false
  if (unmatched.length > 0) {
    const result = await processVacancies(
      sourceLeaid,
      scan.id,
      unmatched,
      platform,
      sourceDistrict.name
    );
    console.log(`  [unmatched → ${sourceDistrict.name}]: ${result.vacancyCount} vacancies`);
    totalProcessed += result.vacancyCount;
  }

  // Update scan record
  await prisma.vacancyScan.update({
    where: { id: scan.id },
    data: {
      status: "completed",
      vacancyCount: totalProcessed,
      completedAt: new Date(),
    },
  });

  console.log(`\nDone. ${totalProcessed} vacancies distributed across ${buckets.size} districts.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
