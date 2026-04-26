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
 * Normalize a job board URL into a stable key for grouping and shared-board
 * detection. Returns lowercased `origin + pathname` with any trailing slash
 * stripped, or null if the URL is unparseable.
 *
 * Two districts whose URLs share the same normalized key point at the same
 * board page and should be treated as sharing that board.
 */
export function normalizeJobBoardKey(url: string): string | null {
  try {
    const u = new URL(url);
    const key = (u.origin + u.pathname).toLowerCase();
    return key.endsWith("/") && key.length > u.origin.length ? key.slice(0, -1) : key;
  } catch {
    return null;
  }
}

/**
 * Returns true when this URL's normalized key is shared by 2+ districts —
 * i.e. the URL represents a board that hosts listings from multiple districts.
 *
 * Sync check; returns false if the shared-boards cache has not been warmed.
 * Call `loadSharedJobBoardUrls()` first (the cron route does this at startup).
 * For contexts where you can await, prefer `isStatewideBoardAsync`.
 */
export function isStatewideBoard(_platform: string, url?: string): boolean {
  if (!url || !sharedBoardsCache) return false;
  const key = normalizeJobBoardKey(url);
  return key ? sharedBoardsCache.has(key) : false;
}

/**
 * Async version that guarantees the shared-boards cache is loaded before
 * checking. Use this in async contexts (scan-runner) for reliable detection.
 */
export async function isStatewideBoardAsync(_platform: string, url?: string): Promise<boolean> {
  if (!url) return false;
  await loadSharedJobBoardUrls();
  const key = normalizeJobBoardKey(url);
  return key && sharedBoardsCache ? sharedBoardsCache.has(key) : false;
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

// Cache of normalized job-board URL keys that are shared by 2+ districts.
// Loaded from DB on first use and refreshed after CACHE_TTL_MS.
let sharedBoardsCache: Set<string> | null = null;
let sharedBoardsCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load the set of normalized job-board URL keys that are shared across
 * multiple districts. Cached for 1 hour.
 */
export async function loadSharedJobBoardUrls(): Promise<Set<string>> {
  const now = Date.now();
  if (sharedBoardsCache && now - sharedBoardsCacheTime < CACHE_TTL_MS) {
    return sharedBoardsCache;
  }

  const prisma = (await import("@/lib/prisma")).default;
  const districts = await prisma.district.findMany({
    where: { jobBoardUrl: { not: null } },
    select: { jobBoardUrl: true },
  });

  const counts = new Map<string, number>();
  for (const d of districts) {
    if (!d.jobBoardUrl) continue;
    const key = normalizeJobBoardKey(d.jobBoardUrl);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const shared = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) shared.add(key);
  }

  sharedBoardsCache = shared;
  sharedBoardsCacheTime = now;
  return shared;
}

/** Test-only: clear the shared-boards cache so each test starts cold. */
export function __resetSharedBoardsCache(): void {
  sharedBoardsCache = null;
  sharedBoardsCacheTime = 0;
}
