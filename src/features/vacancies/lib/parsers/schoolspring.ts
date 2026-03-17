import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";

/**
 * Parse job listings from a SchoolSpring job board page.
 *
 * SchoolSpring pages list positions with titles, schools, dates,
 * and links to detail pages. Layouts vary between table-based and
 * card/div-based formats.
 */
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  const html = await fetchPage(url);
  return extractListings(html, url);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch SchoolSpring page: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/**
 * Extract listings from SchoolSpring HTML.
 * Tries table extraction first, then card-based extraction.
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

    // Look for date patterns
    for (const cell of cleanCells) {
      const dateMatch = cell.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
      if (dateMatch) {
        vacancy.datePosted = dateMatch[1];
        break;
      }
    }

    // Look for school/location
    const otherCells = cleanCells.filter(
      (c) => c !== title && !c.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)
    );
    if (otherCells.length > 0) {
      vacancy.schoolName = otherCells[0] || undefined;
    }

    vacancies.push(vacancy);
  }

  return vacancies;
}

/**
 * Extract listings from card/div-based SchoolSpring layouts.
 * SchoolSpring uses various class names for job cards.
 */
function extractFromCards(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // Match job card containers
  const cardRegex =
    /<(?:div|article|section|li)[^>]*class="[^"]*(?:job|posting|listing|vacancy|result|search-result)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section|li)>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardHtml = cardMatch[1];

    // Title is usually in a heading or link
    const headingMatch = cardHtml.match(
      /<(?:h[1-6]|a)[^>]*>([\s\S]*?)<\/(?:h[1-6]|a)>/i
    );
    if (!headingMatch) continue;

    const title = stripHtml(headingMatch[1]).trim();
    if (!title) continue;

    const vacancy: RawVacancy = { title };

    // Try to get the detail URL
    const linkMatch = cardHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
    if (linkMatch) {
      try {
        vacancy.sourceUrl = new URL(linkMatch[1], baseUrl).toString();
      } catch {
        vacancy.sourceUrl = linkMatch[1];
      }
    }

    // Try to extract date
    const dateMatch = cardHtml.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    if (dateMatch) {
      vacancy.datePosted = dateMatch[1];
    }

    // Try to extract school name
    const schoolMatch = cardHtml.match(
      /(?:school|location|building|organization|employer)\s*:?\s*<[^>]*>?\s*([^<]+)/i
    );
    if (schoolMatch) {
      vacancy.schoolName = stripHtml(schoolMatch[1]).trim() || undefined;
    }

    vacancies.push(vacancy);
  }

  return vacancies;
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
    lc === "date posted" ||
    lc === "school"
  );
}
