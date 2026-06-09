import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Dropbox Sign callback's event_hash:
 *   event_hash = HMAC-SHA256(key=API_KEY, msg=event_time + event_type)  (hex)
 * Constant-time compare; returns false (never throws) on malformed input.
 */
export function verifyEventHash(
  apiKey: string,
  eventTime: string,
  eventType: string,
  eventHash: string,
): boolean {
  if (!apiKey || !eventHash) return false;
  const expected = createHmac("sha256", apiKey).update(eventTime + eventType).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(eventHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
