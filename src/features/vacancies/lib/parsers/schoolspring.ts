import type { RawVacancy } from "./types";

const SCHOOLSPRING_API = "https://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch";
const PAGE_SIZE = 50;

export type ResolvedSchoolSpringSource = {
  hostname: string;
  organizationFilter?: string;
};

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
 * Resolve the SchoolSpring source (hostname + optional organization filter)
 * from a job board URL.
 *
 * - If the URL is on a per-employer subdomain (e.g. `brimfieldma.schoolspring.com`),
 *   returns that hostname directly.
 * - If the URL is on an alias domain (e.g. *.tedk12.com), follows the redirect
 *   to the per-employer subdomain.
 * - If the URL is on the unscoped main domain `www.schoolspring.com`, attempts
 *   recovery: HTML discovery probe first, then API organization-filter probe.
 *   Returns `null` if recovery fails (caller skips the district).
 */
export async function resolveSchoolSpringSource(
  url: string
): Promise<ResolvedSchoolSpringSource | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Per-employer subdomain — use directly.
  if (
    hostname.endsWith(".schoolspring.com") &&
    hostname !== "www.schoolspring.com"
  ) {
    return { hostname };
  }

  // Alias domain (e.g. *.tedk12.com) — follow redirect to discover the
  // per-employer subdomain.
  if (!hostname.endsWith(".schoolspring.com")) {
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
        if (
          redirectHostname.endsWith(".schoolspring.com") &&
          redirectHostname !== "www.schoolspring.com"
        ) {
          console.log(`[schoolspring] Resolved ${hostname} → ${redirectHostname}`);
          return { hostname: redirectHostname };
        }
      }
    } catch (err) {
      console.error(`[schoolspring] Failed to resolve redirect for ${url}:`, err);
    }
    console.error(`[schoolspring] Could not resolve SchoolSpring hostname from ${url}`);
    return null;
  }

  // Unscoped main domain — try recovery via discovery, then API org-filter probe.
  return await recoverFromUnscopedUrl(url);
}

const SCHOOLSPRING_SUBDOMAIN_RE = /https?:\/\/([a-z0-9-]+)\.schoolspring\.com/gi;

async function recoverFromUnscopedUrl(
  url: string
): Promise<ResolvedSchoolSpringSource | null> {
  const employer = (() => {
    try {
      return new URL(url).searchParams.get("employer");
    } catch {
      return null;
    }
  })();

  if (!employer) {
    console.warn(
      `[schoolspring] Unscoped www.schoolspring.com URL has no employer param — skipping: ${url}`
    );
    return null;
  }

  // Probe 1: HTML discovery — fetch the iframe URL and look for an embedded
  // per-employer subdomain.
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = await res.text();
      // Reset regex state — it's a global, so .exec() carries lastIndex.
      SCHOOLSPRING_SUBDOMAIN_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SCHOOLSPRING_SUBDOMAIN_RE.exec(body))) {
        const sub = match[1].toLowerCase();
        if (sub !== "www" && sub !== "api") {
          const discovered = `${sub}.schoolspring.com`;
          console.log(`[schoolspring] Discovery probe: ${url} → ${discovered}`);
          return { hostname: discovered };
        }
      }
    }
  } catch (err) {
    console.warn(`[schoolspring] Discovery probe failed for ${url}:`, err);
  }

  // Probe 2: API organization-filter — single-row sample call.
  try {
    const probeUrl = `${SCHOOLSPRING_API}?domainName=www.schoolspring.com&keyword=&location=&category=&gradelevel=&jobtype=&organization=${encodeURIComponent(employer)}&swLat=&swLon=&neLat=&neLon=&page=1&size=5&sortDateAscending=false`;
    const res = await fetch(probeUrl, {
      headers: {
        "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data: SchoolSpringResponse = await res.json();
      const jobs = data?.value?.jobsList ?? [];
      const distinctEmployers = new Set(
        jobs.map((j) => (j.employer ?? "").trim()).filter((s) => s.length > 0)
      );
      if (jobs.length > 0 && distinctEmployers.size === 1) {
        console.log(
          `[schoolspring] API filter probe honored organization=${employer} for ${url}`
        );
        return {
          hostname: "www.schoolspring.com",
          organizationFilter: employer,
        };
      }
    }
  } catch (err) {
    console.warn(`[schoolspring] API filter probe failed for ${url}:`, err);
  }

  console.warn(`[schoolspring] All recovery failed — skipping: ${url}`);
  return null;
}

/**
 * Parse job listings from a SchoolSpring job board using their public JSON API.
 *
 * SchoolSpring URLs look like: https://{subdomain}.schoolspring.com/
 * Alias domains (e.g. *.tedk12.com) are resolved via redirect.
 * Unscoped www.schoolspring.com URLs are recovered via discovery + API probes.
 * The API scopes results by domainName query param (full hostname).
 */
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  const source = await resolveSchoolSpringSource(url);
  if (!source) {
    console.error(`[schoolspring] Invalid or unresolvable URL: ${url}`);
    return [];
  }

  const { hostname, organizationFilter } = source;
  const orgParam = organizationFilter
    ? encodeURIComponent(organizationFilter)
    : "";

  const allJobs: SchoolSpringJob[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const apiUrl = `${SCHOOLSPRING_API}?domainName=${encodeURIComponent(hostname)}&keyword=&location=&category=&gradelevel=&jobtype=&organization=${orgParam}&swLat=&swLon=&neLat=&neLon=&page=${page}&size=${PAGE_SIZE}&sortDateAscending=false`;

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

    if (data.value.jobsList.length < PAGE_SIZE) break;
    page++;
  }

  console.log(
    `[schoolspring] Fetched ${allJobs.length} jobs from API for ${hostname}` +
      (organizationFilter ? ` (organization=${organizationFilter})` : "")
  );

  return allJobs.map((job) => {
    const apiProvidedUrl =
      job.url || job.jobUrl || job.detailUrl || job.link || null;
    const sourceUrl = apiProvidedUrl || `https://${hostname}/job/${job.jobId}`;

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
