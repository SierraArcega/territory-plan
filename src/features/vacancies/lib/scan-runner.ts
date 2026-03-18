import prisma from "@/lib/prisma";
import { detectPlatform } from "./platform-detector";
import { processVacancies } from "./post-processor";
import { getParser } from "./parsers";
import { parseWithPlaywright } from "./parsers/playwright-fallback";
import { parseWithClaude } from "./parsers/claude-fallback";
import type { RawVacancy } from "./parsers/types";

/** Maximum time (ms) a single scan is allowed to run before timing out. */
const SCAN_TIMEOUT_MS = 60_000;

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

  try {
    // Step 1: Fetch scan + district
    const scan = await prisma.vacancyScan.findUnique({
      where: { id: scanId },
      include: {
        district: {
          select: {
            leaid: true,
            name: true,
            jobBoardUrl: true,
            jobBoardPlatform: true,
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

    if (parser) {
      rawVacancies = await parser(scan.district.jobBoardUrl);
    } else {
      // Unknown platform — try Playwright first (free, no API cost),
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
    const result = await processVacancies(
      scan.district.leaid,
      scanId,
      rawVacancies
    );

    // Check if aborted
    if (timeoutController.signal.aborted) {
      throw new Error("Scan timed out");
    }

    // Step 6: Update scan as completed
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        vacancyCount: result.vacancyCount,
        fullmindRelevantCount: result.fullmindRelevantCount,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`[scan-runner] Scan ${scanId} failed:`, errorMessage);

    try {
      await prisma.vacancyScan.update({
        where: { id: scanId },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error(
        `[scan-runner] Failed to update scan ${scanId} status:`,
        updateError
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
