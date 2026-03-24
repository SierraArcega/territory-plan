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

  // Preserve district-scoping params from shared AppliTrack instances.
  // Without these, every district on a shared board (e.g. wvde) fetches ALL listings.
  const clientId = parsed.searchParams.get("applitrackclient");
  const postingSearch = parsed.searchParams.get("AppliTrackPostingSearch");

  parsed.search = "";
  parsed.searchParams.set("all", "1");
  if (clientId) parsed.searchParams.set("applitrackclient", clientId);
  if (postingSearch) parsed.searchParams.set("AppliTrackPostingSearch", postingSearch);

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
 * We split on <table class='title'> since every listing starts with one.
 * Some instances also use <hr> between listings, but the title table is
 * the only consistent marker across AppliTrack variations.
 */
function extractListings(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // Normalize escaped quotes so our regex works consistently
  const normalized = html.replace(/\\'/g, "'").replace(/\\"/g, '"');

  // Split on <table class='title'> — each occurrence starts a new listing.
  // We keep the delimiter with the block that follows it.
  const parts = normalized.split(/(?=<table[^>]*class=['"]?title['"]?)/i);

  for (const block of parts) {
    // Skip blocks that don't contain a title table (e.g., page header)
    if (!/<table[^>]*class=['"]?title['"]?/i.test(block)) continue;

    const vacancy = parseBlock(block, baseUrl);
    if (vacancy) {
      vacancies.push(vacancy);
    }
  }

  return vacancies;
}

/**
 * Extract the best source URL for a job listing block.
 *
 * Priority:
 * 1. Direct <a href> link in the title table pointing to a detail page
 * 2. Construct from AppliTrackJobId / JobID found in the block
 * 3. Fall back to the generic board landing page
 */
function extractSourceUrl(block: string, baseUrl: string): string {
  const genericUrl = baseUrl.replace(/\/jobpostings\/Output\.asp.*$/i, "/");
  const detailBase = baseUrl.replace(/\/jobpostings\/Output\.asp.*$/i, "/default.aspx");

  // 1. Look for an <a href> in the title table that links to a detail page
  const titleTableHtml = block.match(
    /<table[^>]*class=['"]?title['"]?[^>]*>([\s\S]*?)<\/table>/i
  );
  if (titleTableHtml) {
    const hrefMatch = titleTableHtml[1].match(/<a[^>]+href=['"]([^'"]+)['"]/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      // If it's an absolute URL, use it directly; otherwise resolve relative to base
      if (/^https?:\/\//i.test(href)) return href;
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        // invalid URL, continue to next strategy
      }
    }
  }

  // 2. Extract JobID from the title table's second <td> or anywhere in the block
  const jobIdMatch =
    block.match(/(?:AppliTrackJobId|JobID)\s*[:=]\s*(\d+)/i) ||
    block.match(/JobID\s*[:=]?\s*(\d+)/i);
  if (jobIdMatch) {
    const jobId = jobIdMatch[1];
    // Preserve scoping params from shared AppliTrack instances
    const parsed = new URL(detailBase);
    const origUrl = new URL(baseUrl);
    const clientId = origUrl.searchParams.get("applitrackclient");
    if (clientId) parsed.searchParams.set("applitrackclient", clientId);
    parsed.searchParams.set("AppliTrackJobId", jobId);
    parsed.searchParams.set("AppliTrackLayoutMode", "detail");
    parsed.searchParams.set("AppliTrackViewPosting", "1");
    return parsed.toString();
  }

  // 3. Fall back to generic board URL
  return genericUrl;
}

function parseBlock(block: string, baseUrl: string): RawVacancy | null {
  // Extract job title from the title table — the title text is in a <td>
  // Structure: <table class='title'><tr><td>Job Title Here</td><td>...JobID...</td></tr></table>
  const titleTableMatch = block.match(
    /<table[^>]*class=['"]?title['"]?[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i
  );

  if (!titleTableMatch) return null;

  let title = stripHtml(titleTableMatch[1]).trim();
  // Clean up JavaScript artifacts that sometimes leak into titles
  title = title.replace(/['"]\);?\s*document\.write\s*\(['"].*/i, "").trim();
  if (!title || title.length < 3) return null;

  // Build a detail URL for this specific job posting
  const sourceUrl = extractSourceUrl(block, baseUrl);

  return parseBlockWithTitle(block, title, sourceUrl, baseUrl);
}

function parseBlockWithTitle(
  block: string,
  title: string,
  sourceUrl: string | undefined,
  _baseUrl: string
): RawVacancy | null {
  const vacancy: RawVacancy = { title, sourceUrl };

  // The full block text for field extraction
  const blockText = stripHtml(block);

  // Date Posted: M/D/YYYY
  const dateMatch = blockText.match(/Date\s*Posted\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dateMatch) {
    vacancy.datePosted = dateMatch[1];
  }

  // Location: School Name — try multiple patterns for resilience
  const locationValue = extractField(block, blockText, "Location");
  if (locationValue && locationValue.toLowerCase() !== "to be determined" && !locationValue.match(/viewing all/i) && !locationValue.includes("/")) {
    vacancy.schoolName = locationValue;
  }

  // District/Employer — shared AppliTrack instances include this per listing
  const districtValue = extractField(block, blockText, "District");
  if (districtValue) {
    vacancy.employerName = districtValue;
  }

  // Start Date
  const startMatch = blockText.match(/(?:Start|Begin)\s*Date\s*:?\s*(.+?)(?:\s{2,}|\n|$)/i);
  if (startMatch) {
    vacancy.startDate = startMatch[1].trim();
  }

  // Contact info — email
  const emailMatch = blockText.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) {
    vacancy.hiringEmail = emailMatch[0];
    // Extract contact name — look for "Contact: Name" pattern, limit to reasonable length
    const nameMatch = blockText.match(/[Cc]ontact\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (nameMatch) {
      vacancy.hiringManager = nameMatch[1].trim();
    }
  }

  // Store the full block as rawText for relevance matching
  vacancy.rawText = blockText.slice(0, 2000);

  // Truncate fields to DB column limits
  if (vacancy.title && vacancy.title.length > 500) vacancy.title = vacancy.title.slice(0, 500);
  if (vacancy.schoolName && vacancy.schoolName.length > 255) vacancy.schoolName = vacancy.schoolName.slice(0, 255);
  if (vacancy.hiringManager && vacancy.hiringManager.length > 255) vacancy.hiringManager = vacancy.hiringManager.slice(0, 255);
  if (vacancy.hiringEmail && vacancy.hiringEmail.length > 255) vacancy.hiringEmail = vacancy.hiringEmail.slice(0, 255);
  if (vacancy.startDate && vacancy.startDate.length > 50) vacancy.startDate = vacancy.startDate.slice(0, 50);
  if (vacancy.sourceUrl && vacancy.sourceUrl.length > 1000) vacancy.sourceUrl = vacancy.sourceUrl.slice(0, 1000);

  return vacancy;
}

/**
 * Extract a labeled field value from a listing block using multiple strategies.
 *
 * Tries (in order):
 * 1. Original AppliTrack pattern: `Label:</span>...class="normal"...>Value</`
 * 2. Label followed by text in any sibling element: `Label:</span>...>Value</`
 * 3. `<li>Label: Value</li>` pattern
 * 4. Plain text pattern from stripped HTML: `Label: Value`
 */
function extractField(block: string, blockText: string, label: string): string | null {
  // 1. Original: Label:</span> ... class='normal' ... >Value</
  const original = block.match(
    new RegExp(`${label}:?<\\/span>[\\s\\S]*?class=.?normal.?[^>]*>([\\s\\S]*?)<\\/`, "i")
  );
  if (original) {
    const val = stripHtml(original[1]).trim();
    if (val) return val;
  }

  // 2. Label:</span> followed by text in the next element
  const sibling = block.match(
    new RegExp(`${label}:?<\\/span>[\\s\\S]*?<[^>]+>([^<]+)<\\/`, "i")
  );
  if (sibling) {
    const val = stripHtml(sibling[1]).trim();
    if (val) return val;
  }

  // 3. <li>Label: Value</li>
  const liMatch = block.match(
    new RegExp(`<li[^>]*>\\s*${label}\\s*:\\s*([^<]+)<\\/li>`, "i")
  );
  if (liMatch) {
    const val = stripHtml(liMatch[1]).trim();
    if (val) return val;
  }

  // 4. Plain text fallback from stripped block
  const textMatch = blockText.match(
    new RegExp(`${label}\\s*:\\s*(.+?)(?:\\s{2,}|\\n|$)`, "i")
  );
  if (textMatch) {
    const val = textMatch[1].trim();
    if (val) return val;
  }

  return null;
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
