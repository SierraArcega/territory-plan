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
  // SchoolSpring and TalentEd are JS-rendered SPAs — no parser yet, use Claude fallback
  // if (hostname.endsWith(".schoolspring.com")) return "schoolspring";
  // if (hostname.endsWith(".talented.com")) return "talentEd";

  return "unknown";
}
