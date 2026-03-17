import prisma from "@/lib/prisma";
import type { RawVacancy } from "./parsers/types";
import { filterExcludedRoles } from "./role-filter";
import { categorize } from "./categorizer";
import { flagRelevance } from "./relevance-flagger";
import { matchSchool } from "./school-matcher";
import { matchContact } from "./contact-matcher";
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

/**
 * Main post-processing pipeline for scraped vacancies.
 *
 * Steps:
 * 1. Filter excluded roles
 * 2. For each remaining vacancy: categorize, flag relevance, match school/contact, fingerprint
 * 3. Upsert vacancies (insert new, update existing, reopen closed)
 * 4. Mark stale vacancies as closed (with partial-scrape safety check)
 */
export async function processVacancies(
  leaid: string,
  scanId: string,
  rawVacancies: RawVacancy[]
): Promise<ProcessResult> {
  // Step 1: Filter excluded roles
  const filtered = await filterExcludedRoles(rawVacancies);

  // Step 2: Process each vacancy
  const now = new Date();
  const processedFingerprints: string[] = [];
  let fullmindRelevantCount = 0;

  for (const raw of filtered) {
    const category = categorize(raw.title);
    const relevance = await flagRelevance({
      title: raw.title,
      rawText: raw.rawText,
    });

    const schoolNcessch = raw.schoolName
      ? await matchSchool(raw.schoolName, leaid)
      : null;

    const contactId = raw.hiringEmail
      ? await matchContact(raw.hiringEmail, leaid)
      : null;

    const fingerprint = generateFingerprint(leaid, raw.title, raw.schoolName);
    processedFingerprints.push(fingerprint);

    if (relevance.fullmindRelevant) {
      fullmindRelevantCount++;
    }

    const datePosted = parseDatePosted(raw.datePosted);

    // Step 3: Upsert vacancy
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
        fullmindRelevant: relevance.fullmindRelevant,
        relevanceReason: relevance.relevanceReason,
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
        fullmindRelevant: relevance.fullmindRelevant,
        relevanceReason: relevance.relevanceReason,
        sourceUrl: raw.sourceUrl ?? null,
        rawText: raw.rawText ?? null,
      },
    });
  }

  // Step 4: Mark closed - find open vacancies for this leaid NOT in current scan
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
