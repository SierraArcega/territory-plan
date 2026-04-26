import prisma from "@/lib/prisma";
import type { RawVacancy } from "./parsers/types";
import { filterExcludedRoles } from "./role-filter";
import { categorize } from "./categorizer";
import { generateFingerprint } from "./fingerprint";

interface ProcessResult {
  vacancyCount: number;
  fullmindRelevantCount: number;
}

/**
 * Parses a date string into a Date object, returning null if invalid.
 */
function parseDatePosted(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Minimum open vacancy count before we allow auto-closing on a zero-result scan */
const PARTIAL_SCRAPE_THRESHOLD = 3;

// ----- School matching helpers (inline to avoid N+1) -----

const COMMON_SUFFIXES = [
  "school", "elementary", "middle", "high", "es", "ms", "hs", "academy", "center",
];

function normalizeSchoolName(name: string): string {
  let normalized = name.toLowerCase().trim();
  for (const suffix of COMMON_SUFFIXES) {
    normalized = normalized.replace(new RegExp(`\\b${suffix}\\b`, "gi"), "");
  }
  return normalized.replace(/\s+/g, " ").trim();
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
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

const DICE_THRESHOLD = 0.8;

/**
 * Main post-processing pipeline for scraped vacancies.
 *
 * Pre-loads all lookup data (keyword configs, schools, contacts) once,
 * then processes each vacancy without additional DB queries.
 */
/** Dice coefficient threshold for district name affinity matching (looser than school matching) */
const DISTRICT_DICE_THRESHOLD = 0.4;

/** Common words stripped from district names before affinity comparison */
const DISTRICT_NOISE_WORDS = [
  "school", "schools", "district", "public", "city", "county",
  "unified", "consolidated", "independent", "regional", "area",
  "township", "borough", "union", "free", "central",
];

/** Normalize a district/employer name for affinity comparison by stripping noise words */
function normalizeDistrictName(name: string): string {
  let normalized = name.toLowerCase().trim();
  for (const word of DISTRICT_NOISE_WORDS) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }
  return normalized.replace(/\s+/g, " ").trim();
}

/**
 * Check whether a vacancy's employer name matches the expected district.
 * Only called from redistribution paths (isOwnDistrict=false), where the
 * vacancy came from a shared board and the target district must be verified
 * by employer-name match.
 */
function checkDistrictAffinity(
  raw: RawVacancy,
  districtName: string | undefined
): boolean {
  // No district name to compare against — benefit of the doubt
  if (!districtName) return true;
  // No employer info available — benefit of the doubt
  if (!raw.employerName) return true;

  const normalizedEmployer = normalizeDistrictName(raw.employerName);
  const normalizedDistrict = normalizeDistrictName(districtName);

  // If stripping noise words leaves nothing, benefit of the doubt
  if (!normalizedEmployer || !normalizedDistrict) return true;

  // Exact substring match (handles "Springfield" appearing in "Springfield Public Schools")
  if (
    normalizedEmployer.includes(normalizedDistrict) ||
    normalizedDistrict.includes(normalizedEmployer)
  ) {
    return true;
  }

  // Fuzzy match with looser threshold
  const score = diceCoefficient(normalizedEmployer, normalizedDistrict);
  return score >= DISTRICT_DICE_THRESHOLD;
}

export async function processVacancies(
  leaid: string,
  scanId: string,
  rawVacancies: RawVacancy[],
  platform: string = "unknown",
  districtName?: string,
  /** When true, skip district affinity check — vacancies are known to belong to this district */
  isOwnDistrict: boolean = true
): Promise<ProcessResult> {
  // Pre-load all lookup data in parallel (fixes N+1 queries)
  const [relevanceConfigs, schools, contacts, filtered] = await Promise.all([
    prisma.vacancyKeywordConfig.findMany({
      where: { type: "relevance" },
      select: { label: true, keywords: true, serviceLine: true },
    }),
    prisma.school.findMany({
      where: { leaid },
      select: { ncessch: true, schoolName: true },
    }),
    prisma.contact.findMany({
      where: { leaid, email: { not: null } },
      select: { id: true, email: true },
    }),
    filterExcludedRoles(rawVacancies),
  ]);

  // Build contact email lookup map
  const contactsByEmail = new Map<string, number>();
  for (const c of contacts) {
    if (c.email) {
      contactsByEmail.set(c.email.toLowerCase().trim(), c.id);
    }
  }

  // Pre-normalize school names for matching
  const normalizedSchools = schools.map((s) => ({
    ncessch: s.ncessch,
    normalized: normalizeSchoolName(s.schoolName),
  }));

  const now = new Date();
  const processedFingerprints: string[] = [];
  let fullmindRelevantCount = 0;

  for (const raw of filtered) {
    const category = categorize(raw.title);

    // Inline relevance flagging (uses pre-loaded configs)
    let fullmindRelevant = false;
    let relevanceReason: string | null = null;
    const textToSearch = [raw.title, raw.rawText ?? ""].join(" ").toLowerCase();
    for (const config of relevanceConfigs) {
      for (const keyword of config.keywords) {
        if (textToSearch.includes(keyword.toLowerCase())) {
          fullmindRelevant = true;
          relevanceReason = config.serviceLine
            ? `${config.label} (${config.serviceLine})`
            : config.label;
          break;
        }
      }
      if (fullmindRelevant) break;
    }

    // Inline school matching (uses pre-loaded schools)
    let schoolNcessch: string | null = null;
    if (raw.schoolName && normalizedSchools.length > 0) {
      const normalizedInput = normalizeSchoolName(raw.schoolName);
      // Exact match first
      const exact = normalizedSchools.find((s) => s.normalized === normalizedInput);
      if (exact) {
        schoolNcessch = exact.ncessch;
      } else {
        // Fuzzy match
        let bestScore = 0;
        for (const s of normalizedSchools) {
          const score = diceCoefficient(s.normalized, normalizedInput);
          if (score > bestScore) {
            bestScore = score;
            schoolNcessch = s.ncessch;
          }
        }
        if (bestScore < DICE_THRESHOLD) schoolNcessch = null;
      }
    }

    // Inline contact matching (uses pre-loaded contacts)
    const contactId = raw.hiringEmail
      ? contactsByEmail.get(raw.hiringEmail.toLowerCase().trim()) ?? null
      : null;

    const fingerprint = generateFingerprint(leaid, raw.title, raw.schoolName);
    processedFingerprints.push(fingerprint);

    if (fullmindRelevant) fullmindRelevantCount++;

    const datePosted = parseDatePosted(raw.datePosted);
    const districtVerified = isOwnDistrict || checkDistrictAffinity(raw, districtName);

    // Upsert vacancy
    await prisma.vacancy.upsert({
      where: { fingerprint },
      create: {
        leaid,
        scanId,
        fingerprint,
        status: "open",
        title: raw.title,
        category,
        schoolNcessch,
        schoolName: raw.schoolName ?? null,
        hiringManager: raw.hiringManager ?? null,
        hiringEmail: raw.hiringEmail ?? null,
        contactId,
        startDate: raw.startDate ?? null,
        datePosted,
        fullmindRelevant,
        relevanceReason,
        districtVerified,
        sourceUrl: raw.sourceUrl ?? null,
        rawText: raw.rawText ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        status: "open",
        scanId,
        lastSeenAt: now,
        title: raw.title,
        category,
        schoolNcessch,
        schoolName: raw.schoolName ?? null,
        hiringManager: raw.hiringManager ?? null,
        hiringEmail: raw.hiringEmail ?? null,
        contactId,
        startDate: raw.startDate ?? null,
        datePosted,
        fullmindRelevant,
        relevanceReason,
        districtVerified,
        sourceUrl: raw.sourceUrl ?? null,
        rawText: raw.rawText ?? null,
      },
    });
  }

  // Mark closed — find open vacancies for this leaid NOT in current scan
  if (processedFingerprints.length > 0) {
    await prisma.vacancy.updateMany({
      where: {
        leaid,
        status: "open",
        fingerprint: { notIn: processedFingerprints },
      },
      data: {
        status: "closed",
      },
    });
  } else {
    // Safety check: if scan found 0 vacancies but district had >3 open,
    // skip closing (likely a partial/failed scrape)
    const openCount = await prisma.vacancy.count({
      where: { leaid, status: "open" },
    });

    if (openCount <= PARTIAL_SCRAPE_THRESHOLD) {
      await prisma.vacancy.updateMany({
        where: { leaid, status: "open" },
        data: { status: "closed" },
      });
    }
    // If openCount > threshold, we skip closing to avoid false closures
  }

  return {
    vacancyCount: filtered.length,
    fullmindRelevantCount,
  };
}
