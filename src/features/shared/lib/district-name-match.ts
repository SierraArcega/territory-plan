// Tiered org-name matching for districts and schools — extracted from
// src/features/rfps/lib/district-resolver.ts so the RFP agency resolver and
// the leads bulk importer share one implementation. Tiers: exact
// (case-insensitive) → stop-word-normalized → optional Dice-bigram fuzzy
// (>= 0.85, unique top score). Pure — callers supply the candidate list
// (usually one state's districts/schools).

const STOP_WORDS = new Set([
  // Base suffixes for K-12 entities
  "public", "schools", "school", "district", "isd", "usd", "unified",
  "independent", "consolidated", "cooperative", "borough", "township",
  "central", "county", "the", "of",
  // Added for state-agency / SEA / CMO / non-LEA name shapes — the District
  // table already includes these via accountType, but their canonical names
  // use words our base list didn't strip.
  "board", "education", "department", "elementary", "secondary",
  "system", "state", "academy", "government", "agency",
  // Connectives
  "and",
  // Ordinal/number-word suffixes ("School District Five", "Florence School District One")
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
]);

export function normalizeOrgName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    m.set(bg, (m.get(bg) ?? 0) + 1);
  }
  return m;
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const [bg, ca] of ba) intersection += Math.min(ca, bb.get(bg) ?? 0);
  const totalA = [...ba.values()].reduce((s, n) => s + n, 0);
  const totalB = [...bb.values()].reduce((s, n) => s + n, 0);
  return (2 * intersection) / (totalA + totalB);
}

export type NameMatchResult<T> =
  | { kind: "match"; candidate: T }
  | { kind: "ambiguous" }
  | { kind: "none" };

/**
 * Match a free-text org name against candidates. "ambiguous" = multiple
 * candidates tie at the matched tier — callers must never auto-pick one.
 * Pass `fuzzy: false` to disable the Dice tier (e.g. school-name matching,
 * where only exact/normalized hits are trustworthy).
 */
export function matchByName<T extends { name: string }>(
  query: string,
  candidates: T[],
  opts: { fuzzy?: boolean } = {},
): NameMatchResult<T> {
  const lcQuery = query.toLowerCase().trim();
  if (!lcQuery || candidates.length === 0) return { kind: "none" };

  const tier1 = candidates.filter((c) => c.name.toLowerCase().trim() === lcQuery);
  if (tier1.length === 1) return { kind: "match", candidate: tier1[0] };
  if (tier1.length > 1) return { kind: "ambiguous" };

  const normQuery = normalizeOrgName(query);
  if (!normQuery) return { kind: "none" };
  const tier2 = candidates.filter((c) => normalizeOrgName(c.name) === normQuery);
  if (tier2.length === 1) return { kind: "match", candidate: tier2[0] };
  if (tier2.length > 1) return { kind: "ambiguous" };

  if (opts.fuzzy === false) return { kind: "none" };
  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: diceCoefficient(lcQuery, c.name.toLowerCase().trim()),
    }))
    .filter((s) => s.score >= 0.85)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { kind: "none" };
  if (scored.length > 1 && scored[0].score === scored[1].score) return { kind: "ambiguous" };
  return { kind: "match", candidate: scored[0].candidate };
}
