import { parseLocalDate } from "./date-utils";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}(T.+)?$/;

function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  if (!ISO_REGEX.test(input)) {
    throw new Error(
      `Invalid date format: "${input}". Expected ISO 8601 or YYYY-MM-DD.`,
    );
  }
  // YYYY-MM-DD without time → use parseLocalDate to avoid timezone shift
  if (!input.includes("T")) return parseLocalDate(input);
  return new Date(input);
}

/**
 * Format a past date as relative time.
 * Returns: "just now", "5m ago", "3h ago", "yesterday", "5 days ago", or "Mar 11"
 */
export function timeAgo(date: Date | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return "1m ago"; // 30-59 seconds
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return `${diffDays} days ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a future date as relative time.
 * Returns: "just now", "in 10m", "in 3h", "tomorrow", "in 5 days", or "Mar 25"
 */
export function timeUntil(date: Date | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 30) return "just now";
  if (diffSec < 60) return "in 1m"; // 30-59 seconds
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHr < 24) return `in ${diffHr}h`;
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
