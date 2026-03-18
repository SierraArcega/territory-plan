import type { RawVacancy } from "./types";

const USER_AGENT = "TerritoryPlanBuilder/1.0 (vacancy-scanner)";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

/** Maximum characters of page text to send to Claude (to stay within context limits) */
const MAX_TEXT_LENGTH = 80_000;

/** Minimum content length to consider a page as having real content (not a JS shell) */
const MIN_CONTENT_LENGTH = 200;

/**
 * Fallback parser that uses Claude to extract job vacancies from unknown
 * or self-hosted school district job board pages.
 *
 * 1. Fetches the page — tries plain fetch first, falls back to Playwright for JS-rendered sites
 * 2. Strips it to text content
 * 3. Sends the text to Claude with a tool_use schema matching RawVacancy[]
 * 4. Returns the extracted vacancies
 */
export async function parseWithClaude(url: string): Promise<RawVacancy[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for Claude fallback parsing"
    );
  }

  // Try plain fetch first (fast path for server-rendered pages)
  let html = await fetchPageSimple(url);
  let text = htmlToText(html);

  // If content is too short, the page is likely JS-rendered — use Playwright
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    console.log(`[claude-fallback] Plain fetch returned minimal content for ${url}, trying Playwright...`);
    html = await fetchPageWithPlaywright(url);
    text = htmlToText(html);
  }

  if (!text || text.length < 50) {
    console.log(`[claude-fallback] No content found for ${url} even with Playwright`);
    return [];
  }

  const truncatedText =
    text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  return callClaude(apiKey, truncatedText, url);
}

/** Fast path: plain fetch for server-rendered pages */
async function fetchPageSimple(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch page for Claude parsing: ${res.status} ${res.statusText}`
    );
  }

  return res.text();
}

/** Slow path: Playwright headless browser for JS-rendered pages */
async function fetchPageWithPlaywright(url: string): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: USER_AGENT,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Wait a bit for any remaining JS rendering
    await page.waitForTimeout(2000);
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

/**
 * Strip HTML to plain text content.
 * Removes script/style tags entirely, strips remaining HTML tags,
 * decodes common entities, and collapses whitespace.
 */
function htmlToText(html: string): string {
  return (
    html
      // Remove script and style blocks entirely
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Replace block-level tags with newlines for readability
      .replace(/<\/(?:div|p|tr|li|h[1-6]|section|article|header|footer)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#\d+;/g, "")
      .replace(/&\w+;/g, "")
      // Collapse whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim()
  );
}

/** Tool definition for Claude to extract vacancies as structured data */
const VACANCY_TOOL = {
  name: "extract_vacancies",
  description:
    "Extract job vacancy listings found on the page. Call this tool with all the job postings you can identify.",
  input_schema: {
    type: "object" as const,
    properties: {
      vacancies: {
        type: "array" as const,
        description: "List of job vacancy postings found on the page",
        items: {
          type: "object" as const,
          properties: {
            title: {
              type: "string" as const,
              description: "Job title / position name",
            },
            schoolName: {
              type: "string" as const,
              description: "School or building name, if listed",
            },
            hiringManager: {
              type: "string" as const,
              description: "Name of the hiring manager or contact person",
            },
            hiringEmail: {
              type: "string" as const,
              description: "Email address for the hiring contact",
            },
            startDate: {
              type: "string" as const,
              description: "Position start date",
            },
            datePosted: {
              type: "string" as const,
              description: "Date the job was posted",
            },
            sourceUrl: {
              type: "string" as const,
              description: "URL to the job detail page, if available",
            },
          },
          required: ["title"] as const,
        },
      },
    },
    required: ["vacancies"] as const,
  },
};

interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
  stop_reason: string;
}

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

type ClaudeContentBlock = ClaudeTextBlock | ClaudeToolUseBlock;

interface ExtractedVacanciesInput {
  vacancies: Array<{
    title: string;
    schoolName?: string;
    hiringManager?: string;
    hiringEmail?: string;
    startDate?: string;
    datePosted?: string;
    sourceUrl?: string;
  }>;
}

async function callClaude(
  apiKey: string,
  pageText: string,
  pageUrl: string
): Promise<RawVacancy[]> {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system:
      "You are extracting job vacancy listings from a school district job board page. Extract all job postings you can find. Use the extract_vacancies tool to return the structured data.",
    messages: [
      {
        role: "user" as const,
        content: `Extract all job vacancy postings from this school district job board page.\n\nPage URL: ${pageUrl}\n\nPage content:\n${pageText}`,
      },
    ],
    tools: [VACANCY_TOOL],
    tool_choice: { type: "tool" as const, name: "extract_vacancies" },
  };

  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `Claude API error: ${res.status} ${res.statusText}${errorBody ? ` - ${errorBody}` : ""}`
    );
  }

  const response: ClaudeApiResponse = await res.json();

  // Find the tool_use block in the response
  const toolBlock = response.content.find(
    (block): block is ClaudeToolUseBlock =>
      block.type === "tool_use" && block.name === "extract_vacancies"
  );

  if (!toolBlock) {
    return [];
  }

  const input = toolBlock.input as unknown as ExtractedVacanciesInput;
  if (!input.vacancies || !Array.isArray(input.vacancies)) {
    return [];
  }

  return input.vacancies.map((v) => ({
    title: v.title,
    schoolName: v.schoolName || undefined,
    hiringManager: v.hiringManager || undefined,
    hiringEmail: v.hiringEmail || undefined,
    startDate: v.startDate || undefined,
    datePosted: v.datePosted || undefined,
    sourceUrl: v.sourceUrl || undefined,
    rawText: undefined,
  }));
}
