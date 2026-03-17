import { createHash } from "crypto";

/**
 * Generates a deduplication fingerprint for a vacancy.
 *
 * Normalizes inputs (lowercase, trim, collapse whitespace),
 * concatenates them, and produces a SHA-256 hex digest.
 */
export function generateFingerprint(
  leaid: string,
  title: string,
  schoolName?: string
): string {
  const parts = [leaid, title, schoolName ?? ""]
    .map((s) => s.toLowerCase().trim().replace(/\s+/g, " "))
    .join("|");

  return createHash("sha256").update(parts).digest("hex");
}
