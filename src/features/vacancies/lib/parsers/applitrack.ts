import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";

/**
 * Parse job listings from an AppliTrack job board page.
 *
 * AppliTrack listing pages (e.g. `https://www.applitrack.com/districtname/onlineapp/default.aspx?all=1`)
 * contain an HTML table with rows for each posting. Each row typically includes:
 * title, category, location (school), posting date, and a link to the detail page.
 */
export async function parseApplitrack(url: string): Promise<RawVacancy[]> {
  // Ensure we're requesting the "all listings" view
  const listingUrl = ensureAllListings(url);
  const html = await fetchPage(listingUrl);
  return extractListings(html, listingUrl);
}

function ensureAllListings(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("all")) {
    parsed.searchParams.set("all", "1");
  }
  return parsed.toString();
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch AppliTrack page: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/**
 * Extract vacancy listings from AppliTrack HTML.
 *
 * AppliTrack tables use <tr> rows inside the main listing table.
 * Each row contains <td> cells with: position title (often a link),
 * category, location/school, and date posted.
 */
function extractListings(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // AppliTrack uses table rows for job listings.
  // Match rows that contain job data — they typically have multiple <td> cells
  // and a link to the job detail page.
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract all table cell contents
    const cells = extractCells(rowHtml);
    if (cells.length < 2) continue;

    // Look for a link to a detail page (indicates this is a job row, not a header)
    const linkMatch = rowHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const title = stripHtml(linkMatch[2]).trim();
    if (!title || isHeaderRow(title)) continue;

    // Build the detail URL
    let sourceUrl: string | undefined;
    try {
      sourceUrl = new URL(linkMatch[1], baseUrl).toString();
    } catch {
      sourceUrl = linkMatch[1];
    }

    // Heuristic: cells typically are [title, category, location, date]
    // but order varies. We use the link text as title and try to identify the date.
    const vacancy: RawVacancy = { title, sourceUrl };

    // Try to find a date in the cells (MM/DD/YYYY or similar pattern)
    for (const cell of cells) {
      const dateMatch = cell.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
      if (dateMatch) {
        vacancy.datePosted = dateMatch[1];
        break;
      }
    }

    // Try to find a school/location — usually a cell that isn't the title or date
    const nonTitleCells = cells
      .map((c) => stripHtml(c).trim())
      .filter((c) => c && c !== title && !c.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/));
    if (nonTitleCells.length > 0) {
      // The last non-title, non-date cell is often the school/location
      vacancy.schoolName = nonTitleCells[nonTitleCells.length - 1] || undefined;
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

function isHeaderRow(text: string): boolean {
  const lc = text.toLowerCase();
  return (
    lc === "position" ||
    lc === "title" ||
    lc === "job title" ||
    lc === "category" ||
    lc === "location" ||
    lc === "date posted" ||
    lc === "date" ||
    lc === "school"
  );
}
