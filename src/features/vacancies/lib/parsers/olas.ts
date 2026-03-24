import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";

/**
 * Parse job listings from an OLAS (Online Application System for Educators) page.
 *
 * OLAS job boards at olasjobs.org list positions with title, district,
 * location, and dates. The listings page may use table rows or div-based
 * card layouts depending on the version.
 */
export async function parseOlas(url: string): Promise<RawVacancy[]> {
  const html = await fetchPage(url);
  return extractListings(html, url);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch OLAS page: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/**
 * Extract listings from OLAS HTML.
 *
 * Strategy: first try table-based extraction, then fall back to
 * div/card-based extraction if no table results are found.
 */
function extractListings(html: string, baseUrl: string): RawVacancy[] {
  const tableResults = extractFromTable(html, baseUrl);
  if (tableResults.length > 0) return tableResults;

  return extractFromCards(html, baseUrl);
}

function extractFromTable(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells = extractCells(rowHtml);
    if (cells.length < 2) continue;

    const linkMatch = rowHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const title = stripHtml(linkMatch[2]).trim();
    if (!title || isHeaderText(title)) continue;

    let sourceUrl: string | undefined;
    try {
      sourceUrl = new URL(linkMatch[1], baseUrl).toString();
    } catch {
      sourceUrl = linkMatch[1];
    }

    const vacancy: RawVacancy = { title, sourceUrl };

    const cleanCells = cells
      .map((c) => stripHtml(c).trim())
      .filter((c) => c.length > 0);

    // Look for date patterns (M/D/YYYY, YYYY-MM-DD, Month D YYYY, MM-DD-YYYY)
    for (const cell of cleanCells) {
      const dateMatch = cell.match(
        /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b|\b(\d{4}-\d{2}-\d{2})\b|\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b|\b(\d{2}-\d{2}-\d{4})\b/i
      );
      if (dateMatch) {
        vacancy.datePosted = (dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4]);
        break;
      }
    }

    // Look for school/location (non-title, non-date cell)
    // On state-wide OLAS boards, the first "other" cell is typically the
    // district/employer name, not a specific school.  Store it as
    // employerName so the post-processor can verify district affinity.
    const otherCells = cleanCells.filter(
      (c) =>
        c !== title &&
        !c.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) &&
        !c.match(/^\d{4}-\d{2}-\d{2}$/) &&
        !c.match(/^\d{2}-\d{2}-\d{4}$/) &&
        !c.match(/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i)
    );
    if (otherCells.length > 0) {
      if (otherCells.length === 1 && looksLikeSchoolName(otherCells[0])) {
        // Single cell that looks like a school — assign to schoolName
        vacancy.schoolName = otherCells[0];
      } else {
        vacancy.employerName = otherCells[0] || undefined;
        // If there's a second non-title/non-date cell, treat it as school/location
        if (otherCells.length > 1) {
          vacancy.schoolName = otherCells[1] || undefined;
        }
      }
    }

    vacancies.push(vacancy);
  }

  return vacancies;
}

/**
 * Extract listings from div/card-based OLAS layouts.
 * OLAS sometimes renders job cards with class patterns like "job-listing", "posting", etc.
 */
function extractFromCards(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // Match divs/sections that look like job cards containing links
  const cardRegex =
    /<(?:div|article|section|li)[^>]*class="[^"]*(?:job|posting|listing|vacancy|result)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section|li)>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const parsed = parseCardHtml(cardMatch[1], baseUrl);
    if (parsed) vacancies.push(parsed);
  }

  // Fallback: match <div> or <li> elements containing <a> with job-like hrefs
  if (vacancies.length === 0) {
    const linkBlockRegex =
      /<(?:div|li)[^>]*>([\s\S]*?<a[^>]+href=["'][^"']*(?:job|posting|position|vacancy|detail|apply)[^"']*["'][^>]*>[\s\S]*?)<\/(?:div|li)>/gi;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = linkBlockRegex.exec(html)) !== null) {
      const parsed = parseCardHtml(blockMatch[1], baseUrl);
      if (parsed) vacancies.push(parsed);
    }
  }

  return vacancies;
}

/** Parse a single card's inner HTML into a RawVacancy, or null if not a valid listing. */
function parseCardHtml(cardHtml: string, baseUrl: string): RawVacancy | null {
  const linkMatch = cardHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!linkMatch) return null;

  const title = stripHtml(linkMatch[2]).trim();
  if (!title) return null;

  let sourceUrl: string | undefined;
  try {
    sourceUrl = new URL(linkMatch[1], baseUrl).toString();
  } catch {
    sourceUrl = linkMatch[1];
  }

  const vacancy: RawVacancy = { title, sourceUrl };

  // Try to extract date (all supported formats)
  const dateMatch = cardHtml.match(
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b|\b(\d{4}-\d{2}-\d{2})\b|\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b|\b(\d{2}-\d{2}-\d{4})\b/i
  );
  if (dateMatch) {
    vacancy.datePosted = (dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4]);
  }

  // Try to extract school name from common patterns
  const schoolMatch = cardHtml.match(
    /(?:school|location|building|site)\s*:?\s*<[^>]*>?\s*([^<]+)/i
  );
  if (schoolMatch) {
    vacancy.schoolName = stripHtml(schoolMatch[1]).trim() || undefined;
  }

  // Try to extract employer/district name from common label patterns
  const employerMatch = cardHtml.match(
    /(?:employer|district|organization|company)\s*:?\s*<[^>]*>?\s*([^<]+)/i
  );
  if (employerMatch) {
    vacancy.employerName = stripHtml(employerMatch[1]).trim() || undefined;
  }

  return vacancy;
}

function looksLikeSchoolName(text: string): boolean {
  return /\b(?:elementary|middle|high|school|academy|preparatory|magnet|montessori)\b/i.test(text);
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch: RegExpExecArray | null;
  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    cells.push(cellMatch[1]);
  }
  return cells;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeaderText(text: string): boolean {
  const lc = text.toLowerCase();
  return (
    lc === "position" ||
    lc === "title" ||
    lc === "job title" ||
    lc === "category" ||
    lc === "location" ||
    lc === "date" ||
    lc === "date posted"
  );
}
