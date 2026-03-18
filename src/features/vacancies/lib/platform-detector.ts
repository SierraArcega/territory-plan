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
