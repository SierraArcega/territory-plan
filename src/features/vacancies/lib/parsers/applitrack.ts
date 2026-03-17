import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";

/**
 * Parse job listings from an AppliTrack job board.
 *
 * AppliTrack's landing page (default.aspx) only shows categories — the actual
 * job listings are at `jobpostings/Output.asp?all=1`. Each listing is in a
 * table with class="title" containing the job title, JobID, location, date
 * posted, and position type.
 */
export async function parseApplitrack(url: string): Promise<RawVacancy[]> {
  const listingsUrl = buildListingsUrl(url);
  const html = await fetchPage(listingsUrl);
  return extractListings(html, listingsUrl);
}

/**
 * Convert any AppliTrack URL into the Output.asp listings URL.
 * e.g. https://www.applitrack.com/bryantschools/onlineapp/
 *   -> https://www.applitrack.com/bryantschools/onlineapp/jobpostings/Output.asp?all=1
 */
function buildListingsUrl(url: string): string {
  const parsed = new URL(url);
  // Strip to the base onlineapp path
  const basePath = parsed.pathname.replace(/\/(default\.aspx|jobpostings\/.*)?$/i, "");
  parsed.pathname = `${basePath}/jobpostings/Output.asp`;
  parsed.search = "?all=1";
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
 * Extract vacancy listings from AppliTrack Output.asp HTML.
 *
 * Each listing block looks like:
 *   <table class='title'>...<a>Job Title</a>...</table>
 *   <li>Date Posted: 3/17/2026</li>
 *   <li>Location: Hill Farm Elementary School</li>
 *   <li>Position Type: Academic Support/K-5 Building Learning Specialist</li>
 *
 * We split on the horizontal rule/divider between listings and parse each block.
 */
function extractListings(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // Split HTML into listing blocks — each separated by <hr> or divider pattern
  // Each block contains one job posting
  const blocks = html.split(/<hr[^>]*>/i);

  for (const block of blocks) {
    const vacancy = parseBlock(block, baseUrl);
    if (vacancy) {
      vacancies.push(vacancy);
    }
  }

  return vacancies;
}

function parseBlock(block: string, baseUrl: string): RawVacancy | null {
  // Extract job title from the title table/link
  const titleMatch = block.match(
    /<(?:table|div)[^>]*class=['"]?title['"]?[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
  );

  if (!titleMatch) {
    // Fallback: look for any prominent link with a job-like title
    const linkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=['"]?title['"]?[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) return null;
    // Use the fallback match
    return parseBlockWithTitle(block, stripHtml(linkMatch[2]).trim(), linkMatch[1], baseUrl);
  }

  const title = stripHtml(titleMatch[2]).trim();
  if (!title || title.length < 3) return null;

  return parseBlockWithTitle(block, title, titleMatch[1], baseUrl);
}

function parseBlockWithTitle(
  block: string,
  title: string,
  href: string,
  baseUrl: string
): RawVacancy | null {
  // Build source URL
  let sourceUrl: string | undefined;
  try {
    sourceUrl = new URL(href, baseUrl).toString();
  } catch {
    sourceUrl = href;
  }

  const vacancy: RawVacancy = { title, sourceUrl };

  // Extract structured fields from <li> elements
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liRegex.exec(block)) !== null) {
    const content = stripHtml(liMatch[1]).trim();

    // Date Posted: M/D/YYYY
    const dateMatch = content.match(/date\s*posted\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dateMatch) {
      vacancy.datePosted = dateMatch[1];
      continue;
    }

    // Location: School Name
    const locationMatch = content.match(/location\s*:\s*(.+)/i);
    if (locationMatch) {
      const location = locationMatch[1].trim();
      if (location && location.toLowerCase() !== "to be determined") {
        vacancy.schoolName = location;
      }
      continue;
    }

    // Start Date: ...
    const startMatch = content.match(/(?:start|begin)\s*date\s*:\s*(.+)/i);
    if (startMatch) {
      vacancy.startDate = startMatch[1].trim();
      continue;
    }

    // Contact info — email
    const emailMatch = content.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      vacancy.hiringEmail = emailMatch[0];
      // Try to extract name before the email
      const nameMatch = content.match(/contact\s*:\s*([^,\n]+)/i);
      if (nameMatch) {
        vacancy.hiringManager = nameMatch[1].trim();
      }
      continue;
    }
  }

  // Also check for Additional Information block as rawText
  const additionalMatch = block.match(/Additional\s*Information[\s\S]*?<(?:div|td)[^>]*>([\s\S]*?)(?:<\/(?:div|td)>|<hr)/i);
  if (additionalMatch) {
    vacancy.rawText = stripHtml(additionalMatch[1]).trim().slice(0, 2000);
  }

  return vacancy;
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
