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
  // AppliTrack HTML uses backslash-escaped quotes: class=\'title\'
  // Normalize them before parsing
  const normalized = block.replace(/\\'/g, "'").replace(/\\"/g, '"');

  // Extract job title from the title table — the title text is in a <td>
  // Structure: <table class='title'><tr><td>Job Title Here</td><td>...JobID...</td></tr></table>
  const titleTableMatch = normalized.match(
    /<table[^>]*class=['"]?title['"]?[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i
  );

  if (!titleTableMatch) return null;

  let title = stripHtml(titleTableMatch[1]).trim();
  // Clean up JavaScript artifacts that sometimes leak into titles
  title = title.replace(/['"]\);?\s*document\.write\s*\(['"].*/i, "").trim();
  if (!title || title.length < 3) return null;

  // Link back to the district's main job board page
  const sourceUrl = baseUrl.replace(/\/jobpostings\/Output\.asp.*$/i, "/");

  return parseBlockWithTitle(normalized, title, sourceUrl, baseUrl);
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

  // Location: School Name — extract from <span class='normal'> after Location label
  const locationMatch = block.match(/Location:?<\/span>[\s\S]*?class=.?normal.?[^>]*>([\s\S]*?)<\//i);
  if (locationMatch) {
    const location = stripHtml(locationMatch[1]).trim();
    if (location && location.toLowerCase() !== "to be determined" && !location.match(/viewing all/i) && !location.includes("/")) {
      vacancy.schoolName = location;
    }
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
