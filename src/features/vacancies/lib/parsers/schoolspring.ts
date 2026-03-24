import type { RawVacancy } from "./types";

const SCHOOLSPRING_API = "https://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch";
const PAGE_SIZE = 50;

interface SchoolSpringJob {
  jobId: number;
  employer: string;
  title: string;
  location: string;
  displayDate: string;
  // The API may return a direct URL — prefer it over constructed URLs
  url?: string;
  jobUrl?: string;
  detailUrl?: string;
  link?: string;
}

interface SchoolSpringResponse {
  success: boolean;
  value: {
    page: number;
    size: number;
    jobsList: SchoolSpringJob[];
  };
}

/**
 * Resolve the SchoolSpring hostname from a URL.
 *
 * If the URL is already on *.schoolspring.com, returns the hostname directly.
 * Otherwise (e.g. *.tedk12.com), follows the redirect to discover the
 * actual SchoolSpring subdomain used by the API's domainName parameter.
 */
async function resolveSchoolSpringHostname(url: string): Promise<string | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Already a SchoolSpring domain — use directly
  if (hostname.endsWith(".schoolspring.com")) {
    return hostname;
  }

  // For alias domains (e.g. tedk12.com), follow the redirect to get the
  // actual *.schoolspring.com hostname that the API requires.
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)" },
      signal: AbortSignal.timeout(10_000),
    });

    const location = res.headers.get("location");
    if (location) {
      const redirectHostname = new URL(location).hostname.toLowerCase();
      if (redirectHostname.endsWith(".schoolspring.com")) {
        console.log(`[schoolspring] Resolved ${hostname} → ${redirectHostname}`);
        return redirectHostname;
      }
    }
  } catch (err) {
    console.error(`[schoolspring] Failed to resolve redirect for ${url}:`, err);
  }

  // Fallback: can't determine the SchoolSpring subdomain
  console.error(`[schoolspring] Could not resolve SchoolSpring hostname from ${url}`);
  return null;
}

/**
 * Parse job listings from a SchoolSpring job board using their public JSON API.
 *
 * SchoolSpring URLs look like: https://{subdomain}.schoolspring.com/
 * Alias domains (e.g. *.tedk12.com) are resolved via redirect.
 * The API scopes results by domainName query param (full hostname).
 */
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  const hostname = await resolveSchoolSpringHostname(url);
  if (!hostname) {
    console.error(`[schoolspring] Invalid or unresolvable URL: ${url}`);
    return [];
  }

  const allJobs: SchoolSpringJob[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const apiUrl = `${SCHOOLSPRING_API}?domainName=${encodeURIComponent(hostname)}&keyword=&location=&category=&gradelevel=&jobtype=&organization=&swLat=&swLon=&neLat=&neLon=&page=${page}&size=${PAGE_SIZE}&sortDateAscending=false`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`[schoolspring] API error: ${res.status} ${res.statusText}`);
      break;
    }

    const data: SchoolSpringResponse = await res.json();

    if (!data.success || !data.value?.jobsList?.length) {
      break;
    }

    allJobs.push(...data.value.jobsList);

    // If we got fewer than PAGE_SIZE, we've reached the end
    if (data.value.jobsList.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[schoolspring] Fetched ${allJobs.length} jobs from API for ${hostname}`);

  return allJobs.map((job) => {
    // Prefer any API-provided URL over a constructed one
    const apiProvidedUrl =
      job.url || job.jobUrl || job.detailUrl || job.link || null;
    const sourceUrl =
      apiProvidedUrl || `https://${hostname}/job/${job.jobId}`;

    return {
      title: job.title,
      employerName: job.employer || undefined,
      schoolName: job.location || undefined,
      datePosted: job.displayDate
        ? new Date(job.displayDate).toLocaleDateString("en-US")
        : undefined,
      sourceUrl,
    };
  });
}
