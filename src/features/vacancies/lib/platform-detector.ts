/**
 * Detects the job board platform from a URL's domain.
 * Returns a platform identifier string used to route to the correct parser.
 */
export function detectPlatform(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  if (hostname.endsWith(".applitrack.com")) return "applitrack";
  if (hostname.endsWith(".olasjobs.org")) return "olas";
  if (hostname.endsWith(".schoolspring.com")) return "schoolspring";
  // TalentEd K12 (tedk12.com) was acquired by SchoolSpring — these domains
  // now redirect to *.schoolspring.com, so route them to the same parser.
  if (hostname.endsWith(".tedk12.com")) return "schoolspring";

  return "unknown";
}

/**
 * Returns true if the platform hosts listings from multiple districts
 * (state-wide boards or regional consortiums) rather than a single district.
 *
 * For OLAS and SchoolSpring, always true (they're inherently multi-district).
 * For AppliTrack, true when the URL belongs to a shared/regional instance
 * (multiple districts share the same AppliTrack subdirectory).
 */
export function isStatewideBoard(platform: string, url?: string): boolean {
  if (platform === "olas" || platform === "schoolspring") return true;

  // AppliTrack shared instances: the URL path segment after /applitrack.com/
  // is the instance name. If it appears in our known shared list, it's regional.
  if (platform === "applitrack" && url) {
    return isSharedAppliTrack(url);
  }

  return false;
}

/**
 * Async version of isStatewideBoard that guarantees the shared AppliTrack
 * instance cache is loaded before checking. Use this in async contexts
 * (scan-runner, cron route) for reliable detection.
 */
export async function isStatewideBoardAsync(platform: string, url?: string): Promise<boolean> {
  if (platform === "olas" || platform === "schoolspring") return true;

  if (platform === "applitrack" && url) {
    await loadSharedAppliTrackInstances();
    return isSharedAppliTrack(url);
  }

  return false;
}

/**
 * Extract the AppliTrack instance name from a URL.
 * AppliTrack URLs look like: https://www.applitrack.com/{instance}/onlineapp/...
 */
export function getAppliTrackInstance(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/^\/([^/]+)\//);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Cache of shared AppliTrack instances (loaded from DB on first use)
let sharedInstancesCache: Set<string> | null = null;
let sharedInstancesCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load shared AppliTrack instances from DB — instances where 2+ districts
 * share the same base path. Cached for 1 hour.
 */
export async function loadSharedAppliTrackInstances(): Promise<Set<string>> {
  const now = Date.now();
  if (sharedInstancesCache && now - sharedInstancesCacheTime < CACHE_TTL_MS) {
    return sharedInstancesCache;
  }

  // Dynamic import to avoid circular deps
  const prisma = (await import("@/lib/prisma")).default;

  const results: { instance: string }[] = await prisma.$queryRaw`
    SELECT LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)')) as instance
    FROM districts
    WHERE job_board_url LIKE '%applitrack.com%'
    GROUP BY LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)'))
    HAVING COUNT(*) > 1
  `;

  sharedInstancesCache = new Set(results.map((r) => r.instance).filter(Boolean));
  sharedInstancesCacheTime = now;
  return sharedInstancesCache;
}

function isSharedAppliTrack(url: string): boolean {
  // Synchronous check against cache — if cache isn't loaded yet, return false
  // (the async loadSharedAppliTrackInstances should be called at scan startup)
  const instance = getAppliTrackInstance(url);
  if (!instance || !sharedInstancesCache) return false;
  return sharedInstancesCache.has(instance);
}
