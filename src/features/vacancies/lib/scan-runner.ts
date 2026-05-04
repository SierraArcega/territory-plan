import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { detectPlatform, isStatewideBoardAsync, getAppliTrackInstance } from "./platform-detector";
import { processVacancies } from "./post-processor";
import { getParser } from "./parsers";
import { categorizeFailure } from "./failure-reasons";
import { parseWithPlaywright } from "./parsers/playwright-fallback";
import { parseWithClaude } from "./parsers/claude-fallback";
import type { RawVacancy } from "./parsers/types";

/** Maximum time (ms) a single scan is allowed to run before timing out. */
const SCAN_TIMEOUT_MS = 180_000; // 3 min for state-wide redistribution

async function markDistrictScanSuccess(leaid: string) {
  await prisma.district.update({
    where: { leaid },
    data: { vacancyConsecutiveFailures: 0, vacancyLastFailureAt: null },
  });
}

async function markDistrictScanFailure(leaid: string) {
  await prisma.district.update({
    where: { leaid },
    data: {
      vacancyConsecutiveFailures: { increment: 1 },
      vacancyLastFailureAt: new Date(),
    },
  });
}

/**
 * Orchestrates a single district vacancy scan:
 * 1. Fetches the VacancyScan row and associated district data
 * 2. Detects the job board platform
 * 3. Parses the job board page for vacancies
 * 4. Runs post-processing (categorize, flag relevance, match schools/contacts, upsert)
 * 5. Updates the VacancyScan with results
 *
 * Wrapped with a 60-second timeout. On error, marks the scan as failed.
 */
export async function runScan(scanId: string): Promise<void> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), SCAN_TIMEOUT_MS);

  // Hoisted so the catch block can reach it for the per-district health update.
  let scan: Prisma.VacancyScanGetPayload<{
    include: {
      district: {
        select: {
          leaid: true;
          name: true;
          jobBoardUrl: true;
          jobBoardPlatform: true;
          enrollment: true;
        };
      };
    };
  }> | null = null;

  try {
    // Step 1: Fetch scan + district
    scan = await prisma.vacancyScan.findUnique({
      where: { id: scanId },
      include: {
        district: {
          select: {
            leaid: true,
            name: true,
            jobBoardUrl: true,
            jobBoardPlatform: true,
            enrollment: true,
          },
        },
      },
    });

    if (!scan) {
      console.error(`[scan-runner] Scan ${scanId} not found`);
      return;
    }

    if (!scan.district.jobBoardUrl) {
      await prisma.vacancyScan.update({
        where: { id: scanId },
        data: {
          status: "failed",
          errorMessage: "District has no job board URL",
          completedAt: new Date(),
        },
      });
      await markDistrictScanFailure(scan.district.leaid);
      return;
    }

    // Step 2: Set status to running
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: { status: "running" },
    });

    // Step 3: Detect platform
    const platform = detectPlatform(scan.district.jobBoardUrl);

    // Update district platform if different
    if (platform !== scan.district.jobBoardPlatform) {
      await prisma.district.update({
        where: { leaid: scan.district.leaid },
        data: { jobBoardPlatform: platform },
      });
    }

    // Update scan with detected platform
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: { platform },
    });

    // Step 4: Get parser and run it
    const parser = getParser(platform);
    let rawVacancies: RawVacancy[];
    const isServerless = !!process.env.VERCEL;

    // Unknown platforms fall back to Playwright locally or Claude on Vercel.
    // All known parsers (applitrack, olas, schoolspring) use plain fetch — no Playwright.
    const needsPlaywright = !parser;

    if (parser && !(isServerless && needsPlaywright)) {
      // Use dedicated parser (works for applitrack, olas on all envs;
      // schoolspring only locally where Playwright is available)
      rawVacancies = await parser(scan.district.jobBoardUrl);
    } else if (isServerless) {
      // Serverless (Vercel): Playwright is not available — use Claude
      if (process.env.ANTHROPIC_API_KEY) {
        console.log(`[scan-runner] Serverless env, using Claude fallback for "${platform}"...`);
        rawVacancies = await parseWithClaude(scan.district.jobBoardUrl);
      } else {
        console.log(`[scan-runner] Serverless env, no ANTHROPIC_API_KEY — cannot parse "${platform}"`);
        rawVacancies = [];
      }
    } else {
      // Local / self-hosted: try Playwright first (free, no API cost),
      // fall back to Claude if Playwright finds nothing
      console.log(`[scan-runner] No parser for platform "${platform}", trying Playwright...`);
      rawVacancies = await parseWithPlaywright(scan.district.jobBoardUrl);

      if (rawVacancies.length === 0 && process.env.ANTHROPIC_API_KEY) {
        console.log(`[scan-runner] Playwright found nothing, trying Claude fallback...`);
        rawVacancies = await parseWithClaude(scan.district.jobBoardUrl);
      }
    }

    // Check if aborted
    if (timeoutController.signal.aborted) {
      throw new Error("Scan timed out");
    }

    // Step 5: Post-process
    const isStwide = await isStatewideBoardAsync(platform, scan.district.jobBoardUrl);
    if (isStwide && rawVacancies.length > 0) {
      // Safety net: if most vacancies lack employerName on a statewide board,
      // groupByDistrict would assign them all to the scanning district.
      // Skip importing when this happens — the data is unattributable.
      const withoutEmployer = rawVacancies.filter((v) => !v.employerName).length;
      if (rawVacancies.length > 20 && withoutEmployer / rawVacancies.length > 0.5) {
        console.warn(
          `[scan-runner] Statewide board "${platform}" returned ${rawVacancies.length} vacancies ` +
          `but ${withoutEmployer} lack employerName — cannot attribute. Skipping.`
        );
        await prisma.vacancyScan.update({
          where: { id: scanId },
          data: {
            status: "completed_partial",
            vacancyCount: 0,
            errorMessage: `Skipped: statewide board returned ${rawVacancies.length} vacancies but ${withoutEmployer} lack employer info (cannot attribute to district)`,
            completedAt: new Date(),
          },
        });
        await markDistrictScanSuccess(scan.district.leaid);
        return;
      }

      // Shared AppliTrack without client-scoping params fetches the entire
      // state board. Only process the scanning district's own jobs — do NOT
      // redistribute to other districts via fuzzy matching (causes massive
      // vacancy inflation). Redistribution is only safe when the URL includes
      // applitrackclient to scope results.
      const unscopedSharedAppliTrack =
        platform === "applitrack" &&
        getAppliTrackInstance(scan.district.jobBoardUrl!) &&
        !new URL(scan.district.jobBoardUrl!).searchParams.has("applitrackclient");

      // State-wide board: process THIS district's jobs first (fast),
      // then redistribute the rest in the background.
      const { ownJobs, otherJobs, districtsMatched } = groupByDistrict(
        scan.district.leaid,
        scan.district.name,
        rawVacancies
      );

      // Process the scanning district's own jobs synchronously (fast — usually just a few)
      const result = await processVacancies(
        scan.district.leaid,
        scanId,
        ownJobs,
        platform,
        scan.district.name
      );

      // Mark scan as completed immediately so the UI gets results
      await prisma.vacancyScan.update({
        where: { id: scanId },
        data: {
          status: "completed",
          vacancyCount: result.vacancyCount,
          fullmindRelevantCount: result.fullmindRelevantCount,
          districtsMatched: unscopedSharedAppliTrack ? 0 : districtsMatched,
          completedAt: new Date(),
        },
      });
      await markDistrictScanSuccess(scan.district.leaid);

      // Redistribute remaining jobs to other districts in the background
      // — but ONLY if the URL is properly scoped (has applitrackclient param)
      if (otherJobs.size > 0 && !unscopedSharedAppliTrack) {
        console.log(
          `[scan-runner] Background redistribution: ${[...otherJobs.values()].reduce((sum, b) => sum + b.jobs.length, 0)} jobs to ${otherJobs.size} districts`
        );
        redistributeInBackground(otherJobs, scanId, platform).catch((err) => {
          console.error("[scan-runner] Background redistribution failed:", err);
        });
      } else if (unscopedSharedAppliTrack && otherJobs.size > 0) {
        console.log(
          `[scan-runner] Skipping redistribution: shared AppliTrack "${getAppliTrackInstance(scan.district.jobBoardUrl!)}" has no applitrackclient param — ${[...otherJobs.values()].reduce((sum, b) => sum + b.jobs.length, 0)} jobs dropped`
        );
      }
    } else {
      // Safety check: if ANY platform returns a suspicious number of vacancies
      // relative to district size, skip importing — it's likely a regional
      // aggregator that wasn't detected as shared.
      const enrollment = scan.district.enrollment ?? 0;
      if (rawVacancies.length > 100 && enrollment > 0 && enrollment < 5000) {
        const ratio = rawVacancies.length / enrollment;
        if (ratio > 0.5) {
          console.warn(
            `[scan-runner] Suspicious: ${rawVacancies.length} vacancies from "${platform}" ` +
            `for ${scan.district.name} (enrollment: ${enrollment}, ratio: ${ratio.toFixed(2)}). Skipping.`
          );
          await prisma.vacancyScan.update({
            where: { id: scanId },
            data: {
              status: "completed_partial",
              vacancyCount: 0,
              errorMessage: `Skipped: ${rawVacancies.length} vacancies looks like a regional aggregator (enrollment: ${enrollment}, ratio: ${ratio.toFixed(2)})`,
              completedAt: new Date(),
            },
          });
          await markDistrictScanSuccess(scan.district.leaid);
          return;
        }
      }

      // District-scoped board — process normally
      const result = await processVacancies(
        scan.district.leaid,
        scanId,
        rawVacancies,
        platform,
        scan.district.name
      );

      // Check if aborted
      if (timeoutController.signal.aborted) {
        throw new Error("Scan timed out");
      }

      await prisma.vacancyScan.update({
        where: { id: scanId },
        data: {
          status: "completed",
          vacancyCount: result.vacancyCount,
          fullmindRelevantCount: result.fullmindRelevantCount,
          completedAt: new Date(),
        },
      });
      await markDistrictScanSuccess(scan.district.leaid);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`[scan-runner] Scan ${scanId} failed:`, errorMessage);

    try {
      const failureReason = categorizeFailure({
        errorMessage,
        context: "thrown_error",
      });
      await prisma.vacancyScan.update({
        where: { id: scanId },
        data: {
          status: "failed",
          errorMessage,
          failureReason,
          completedAt: new Date(),
        },
      });
      if (scan?.district?.leaid) {
        await markDistrictScanFailure(scan.district.leaid);
      }
    } catch (updateError) {
      console.error(
        `[scan-runner] Failed to update scan ${scanId} status:`,
        updateError,
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── State-wide redistribution helpers ─────────────────────────────

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

interface DistrictCandidate {
  leaid: string;
  name: string;
  normalized: string;
}

/** Minimum length for normalized names to be eligible for fuzzy matching.
 *  Short names like "bath", "union", "troy" produce too many false positives. */
const MIN_NAME_LENGTH_FOR_FUZZY = 5;

/** Dice threshold for redistribution matching (raised from 0.5 to reduce false positives) */
const REDISTRIBUTION_DICE_THRESHOLD = 0.6;

function findBestDistrict(
  employerName: string,
  districts: DistrictCandidate[],
  schoolToDistrict: Map<string, string>
): { leaid: string; name: string } | null {
  const normEmployer = normalizeForMatch(employerName);

  // Too short after normalization — skip fuzzy matching to avoid false positives
  // (e.g., "Union" → "" after stripping, or "Bath Schools" → "bath")
  if (!normEmployer || normEmployer.length < MIN_NAME_LENGTH_FOR_FUZZY) {
    // Still try exact school name lookup below
  } else {
    // Try exact substring match (high confidence)
    for (const d of districts) {
      if (d.normalized.length < MIN_NAME_LENGTH_FOR_FUZZY) continue;
      if (normEmployer.includes(d.normalized) || d.normalized.includes(normEmployer)) {
        return { leaid: d.leaid, name: d.name };
      }
    }

    // Fuzzy match with tighter threshold
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

  // Fallback: exact school name lookup (no fuzzy — must be exact match)
  const schoolLeaid = schoolToDistrict.get(employerName.toLowerCase().trim());
  if (schoolLeaid) {
    const district = districts.find((d) => d.leaid === schoolLeaid);
    if (district) return { leaid: district.leaid, name: district.name };
  }

  return null;
}

/**
 * Group raw vacancies by district: separates the scanning district's own jobs
 * from jobs belonging to other districts. Uses employer name matching against
 * state districts and school names.
 */
function groupByDistrict(
  sourceLeaid: string,
  sourceDistrictName: string,
  rawVacancies: RawVacancy[]
): {
  ownJobs: RawVacancy[];
  otherJobs: Map<string, { districtName: string; jobs: RawVacancy[] }>;
  districtsMatched: number;
} {
  // We can't do async DB lookups here since this needs to be fast.
  // Use the employer name to split: jobs whose employerName fuzzy-matches
  // the source district go into ownJobs, everything else into otherJobs
  // (keyed by employerName for now — background redistribution resolves to leaids).
  const ownJobs: RawVacancy[] = [];
  const otherJobs = new Map<string, { districtName: string; jobs: RawVacancy[] }>();
  const normSource = normalizeForMatch(sourceDistrictName);

  for (const job of rawVacancies) {
    if (!job.employerName) {
      // No employer info — assume it belongs to scanning district
      ownJobs.push(job);
      continue;
    }

    const normEmployer = normalizeForMatch(job.employerName);

    // Check if it matches the scanning district
    let isOwn: boolean;
    if (!normEmployer || !normSource) {
      // Can't compare — benefit of the doubt
      isOwn = true;
    } else if (normEmployer.length < MIN_NAME_LENGTH_FOR_FUZZY || normSource.length < MIN_NAME_LENGTH_FOR_FUZZY) {
      // Short names (e.g., "waco", "bath") — only exact match, no fuzzy
      isOwn = normEmployer === normSource;
    } else {
      isOwn =
        normEmployer.includes(normSource) ||
        normSource.includes(normEmployer) ||
        diceCoefficient(normEmployer, normSource) >= REDISTRIBUTION_DICE_THRESHOLD;
    }

    if (isOwn) {
      ownJobs.push(job);
    } else {
      // Group by employer name — we'll resolve to leaids in the background
      const key = job.employerName;
      if (!otherJobs.has(key)) {
        otherJobs.set(key, { districtName: key, jobs: [] });
      }
      otherJobs.get(key)!.jobs.push(job);
    }
  }

  console.log(
    `[scan-runner] State-wide split: ${ownJobs.length} own, ` +
    `${[...otherJobs.values()].reduce((s, b) => s + b.jobs.length, 0)} for other districts`
  );

  return { ownJobs, otherJobs, districtsMatched: otherJobs.size };
}

/**
 * Redistribute jobs to other districts in the background.
 * Resolves employer names to leaids via DB lookup, then processes in batches.
 */
async function redistributeInBackground(
  employerBuckets: Map<string, { districtName: string; jobs: RawVacancy[] }>,
  scanId: string,
  platform: string
): Promise<void> {
  // We need to figure out the state FIPS from the scan
  const scan = await prisma.vacancyScan.findUnique({
    where: { id: scanId },
    select: { leaid: true },
  });
  if (!scan) return;

  const fipsPrefix = scan.leaid.substring(0, 2);

  // Load state districts and schools for matching
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

  // Resolve employer names to leaids and regroup
  const leaidBuckets = new Map<string, { districtName: string; jobs: RawVacancy[] }>();

  for (const [employerName, bucket] of employerBuckets) {
    const match = findBestDistrict(employerName, candidates, schoolToDistrict);
    if (match) {
      if (!leaidBuckets.has(match.leaid)) {
        leaidBuckets.set(match.leaid, { districtName: match.name, jobs: [] });
      }
      leaidBuckets.get(match.leaid)!.jobs.push(...bucket.jobs);
    }
    // Unmatched jobs are silently dropped — they were already excluded
    // from the scanning district's results
  }

  console.log(
    `[scan-runner] Background redistribution: resolved to ${leaidBuckets.size} districts`
  );

  // Process in parallel with capped concurrency
  const CONCURRENCY = 5;
  const entries = [...leaidBuckets.entries()];

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(([leaid, bucket]) =>
        processVacancies(leaid, scanId, bucket.jobs, platform, bucket.districtName, false)
      )
    );
  }

  console.log("[scan-runner] Background redistribution complete");
}
