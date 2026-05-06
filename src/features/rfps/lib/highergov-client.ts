import { HigherGovListResponseSchema, type HigherGovOpportunity } from "./types";

const BASE_URL = "https://www.highergov.com/api-external/opportunity/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export interface FetchOpportunitiesArgs {
  since: Date;
  postedSince?: Date;
  pageSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchWithRetry(
  url: string,
  maxRetries: number,
  retryDelayMs: number,
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status >= 500 || res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const wait = retryAfter ? Number(retryAfter) * 1000 : retryDelayMs * Math.pow(2, attempt);
      lastErr = new Error(`HigherGov ${res.status} on ${url}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    }
    throw new Error(`HigherGov ${res.status} on ${url}: ${await res.text().catch(() => "")}`.slice(0, 500));
  }
  throw lastErr ?? new Error("HigherGov: exhausted retries");
}

const DEFAULT_NAICS = "611110"; // Elementary and Secondary Schools

/**
 * Async generator over HigherGov opportunities with captured_date >= `since`.
 *
 * Filter strategy:
 *   - When HIGHERGOV_K12_SEARCH_ID is set, the saved search is the SOLE scope
 *     filter. The hardcoded source_type/naics_code params are skipped — the
 *     saved search owns the breadth (multiple NAICS, custom keywords, state
 *     restrictions, etc.).
 *   - When HIGHERGOV_K12_SEARCH_ID is unset, fall back to direct API params
 *     (source_type=sled + naics_code=611110 by default) for a NAICS-only K-12 net.
 *
 * Follows HigherGov `links.next` pagination.
 */
export async function* fetchOpportunities(
  args: FetchOpportunitiesArgs,
): AsyncGenerator<HigherGovOpportunity, void, unknown> {
  const apiKey = requireEnv("HIGHERGOV_API_KEY");
  const searchId = process.env.HIGHERGOV_K12_SEARCH_ID;
  const naics = process.env.HIGHERGOV_K12_NAICS || DEFAULT_NAICS;
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRetries = args.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = args.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const initial = new URL(BASE_URL);
  initial.searchParams.set("api_key", apiKey);
  if (searchId) {
    initial.searchParams.set("search_id", searchId);
  } else {
    initial.searchParams.set("source_type", "sled");
    initial.searchParams.set("naics_code", naics);
  }
  initial.searchParams.set("captured_date__gte", isoDate(args.since));
  if (args.postedSince) initial.searchParams.set("posted_date__gte", isoDate(args.postedSince));
  initial.searchParams.set("ordering", "-captured_date");
  initial.searchParams.set("page_size", String(pageSize));

  let nextUrl: string | null = initial.toString();
  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl, maxRetries, retryDelayMs);
    const json = await res.json();
    const parsed = HigherGovListResponseSchema.parse(json);
    for (const r of parsed.results) yield r;
    // HigherGov uses links.next; fall back to top-level next for forward compat.
    nextUrl = parsed.links?.next ?? parsed.next ?? null;
  }
}
