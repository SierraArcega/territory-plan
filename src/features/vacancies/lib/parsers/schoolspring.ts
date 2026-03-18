import type { RawVacancy } from "./types";

const SCHOOLSPRING_API = "https://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch";
const PAGE_SIZE = 50;

interface SchoolSpringJob {
  jobId: number;
  employer: string;
  title: string;
  location: string;
  displayDate: string;
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
 * Parse job listings from a SchoolSpring job board using their public JSON API.
 *
 * SchoolSpring URLs look like: https://{subdomain}.schoolspring.com/
 * The API scopes results by domainName query param (full hostname).
 */
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    console.error(`[schoolspring] Invalid URL: ${url}`);
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

  return allJobs.map((job) => ({
    title: job.title,
    schoolName: job.employer || undefined,
    datePosted: job.displayDate
      ? new Date(job.displayDate).toLocaleDateString("en-US")
      : undefined,
    sourceUrl: `https://${hostname}/jobdetail/${job.jobId}`,
  }));
}
