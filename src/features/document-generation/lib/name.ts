/** Split a full name into first + (space-joined) last. Empty/blank → both "". */
export function splitFullName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}
