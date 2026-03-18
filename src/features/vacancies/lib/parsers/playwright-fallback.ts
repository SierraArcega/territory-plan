import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";

/**
 * Fallback parser that uses Playwright to render JS-heavy pages
 * and extracts vacancies using regex/heuristics — no Claude API needed.
 *
 * Works for SchoolSpring, TalentEd, and other modern JS-rendered job boards.
 */
export async function parseWithPlaywright(url: string): Promise<RawVacancy[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Wait for JS rendering
    await page.waitForTimeout(3000);

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);

    // Try to extract structured listings from the rendered HTML
    const fromHtml = extractFromHtml(html, url);
    if (fromHtml.length > 0) return fromHtml;

    // Fall back to extracting from plain text
    return extractFromText(text, url);
  } finally {
    await browser.close();
  }
}

/**
 * Extract vacancies from rendered HTML — looks for common job listing patterns:
 * - Tables with job titles and dates
 * - Card/div patterns with job info
 * - Lists with links to job detail pages
 */
function extractFromHtml(html: string, baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];

  // Pattern 1: Look for links that contain job-like text near dates
  // Many job boards render as: <a href="...">Job Title</a> ... date ... location
  const jobLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{10,120})<\/a>/gi;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = jobLinkRegex.exec(html)) !== null) {
    const href = match[1];
    const title = stripHtml(match[2]).trim();

    // Skip navigation, footer, generic links
    if (isNavigationLink(title, href)) continue;
    if (seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());

    // Check if this looks like a job title
    if (looksLikeJobTitle(title)) {
      let sourceUrl: string | undefined;
      try {
        sourceUrl = new URL(href, baseUrl).toString();
      } catch {
        sourceUrl = href;
      }

      // Look for date near this match (within 500 chars after)
      const context = html.substring(match.index, match.index + 500);
      const dateMatch = context.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      const dateMatch2 = context.match(/(\w+ \d{1,2},?\s*\d{4})/);

      // Look for location/school
      const locationMatch = context.match(/(?:location|school|building|site)\s*:?\s*([^<,\n]{3,60})/i);

      vacancies.push({
        title,
        sourceUrl,
        datePosted: dateMatch?.[1] ?? dateMatch2?.[1],
        schoolName: locationMatch ? stripHtml(locationMatch[1]).trim() : undefined,
      });
    }
  }

  return vacancies;
}

/**
 * Extract vacancies from plain text — last resort.
 * Splits text into lines and looks for job-title-like patterns.
 */
function extractFromText(text: string, _baseUrl: string): RawVacancy[] {
  const vacancies: RawVacancy[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 5);
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 120 || line.length < 8) continue;
    if (seen.has(line.toLowerCase())) continue;

    if (looksLikeJobTitle(line)) {
      seen.add(line.toLowerCase());

      // Look at surrounding lines for date/location
      const context = lines.slice(i, i + 5).join(" ");
      const dateMatch = context.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      const dateMatch2 = context.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{4})/i);

      vacancies.push({
        title: line,
        datePosted: dateMatch?.[1] ?? dateMatch2?.[1],
      });
    }
  }

  return vacancies;
}

const JOB_KEYWORDS = [
  "teacher", "specialist", "director", "coordinator", "principal",
  "counselor", "psychologist", "therapist", "pathologist",
  "interventionist", "instructor", "librarian", "media",
  "superintendent", "assistant", "aide", "tutor",
  "coach", "nurse", "custodian", "driver", "secretary",
  "paraprofessional", "substitute", "dean",
];

function looksLikeJobTitle(text: string): boolean {
  const lower = text.toLowerCase();
  // Must contain at least one job-related keyword
  if (!JOB_KEYWORDS.some(kw => lower.includes(kw))) return false;
  // Shouldn't be too short or look like a menu item
  if (text.length < 8) return false;
  // Shouldn't start with common nav words
  if (/^(home|about|contact|login|sign|search|menu|navigation|privacy|terms)/i.test(text)) return false;
  return true;
}

function isNavigationLink(title: string, href: string): boolean {
  const lower = title.toLowerCase();
  const hrefLower = href.toLowerCase();
  return (
    lower.includes("log in") ||
    lower.includes("sign up") ||
    lower.includes("register") ||
    lower.includes("home") ||
    lower.includes("about us") ||
    lower.includes("privacy") ||
    lower.includes("contact us") ||
    hrefLower.includes("login") ||
    hrefLower.includes("signup") ||
    hrefLower.includes("javascript:") ||
    hrefLower === "#"
  );
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
