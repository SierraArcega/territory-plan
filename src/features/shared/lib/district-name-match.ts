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

/**
 * Pairwise org-name similarity for cross-VALIDATION (not candidate selection):
 * 1.0 on exact or stop-word-normalized equality, else the best Dice-bigram
 * score across the raw-lowercase and normalized forms. Normalizing first
 * matters for short K-12 names — "A P Solis Middle School" vs
 * "A P SOLIS MIDDLE" is identical once "school" is stripped, but raw Dice
 * scores it ~0.81. Callers pick their own threshold: `matchByName`'s 0.85 bar
 * guards auto-picking one of many candidates; validating a single known pair
 * tolerates a lower bar.
 */
export function orgNameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (!la || !lb) return 0;
  if (la === lb) return 1;
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (na && na === nb) return 1;
  return Math.max(diceCoefficient(la, lb), na && nb ? diceCoefficient(na, nb) : 0);
}

// ---- School-name canonicalization -------------------------------------------
//
// NCES school names abbreviate the school-type suffix ("MANVEL H S",
// "JOWELL EL", "SALYARDS MS") while marketing exports spell it out ("Manvel
// High School"). Abbreviations are EXPANDED to full words rather than
// stripped: the type token carries signal BETWEEN school types — "Jowell
// Elementary" and "Jowell Middle School" must stay distinguishable.
// Order matters: two-token forms ("h s", from "H.S." after punctuation
// stripping) must run before their fused single-token forms ("hs").
const SCHOOL_ABBREV_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bh s\b/g, "high school"],
  [/\bhs\b/g, "high school"],
  [/\bm s\b/g, "middle school"],
  [/\bms\b/g, "middle school"],
  [/\bj h\b/g, "junior high"],
  [/\bjh\b/g, "junior high"],
  [/\bjr\b/g, "junior"],
  [/\bsr\b/g, "senior"],
  [/\bes\b/g, "elementary school"],
  [/\belem\b/g, "elementary"],
  // Trailing-only: a LEADING "el" is Spanish ("El Paso H S"), a trailing
  // "EL" is the NCES elementary suffix ("JOWELL EL").
  [/(?<=\s)el$/, "elementary"],
  [/\bint\b/g, "intermediate"],
  [/\bacad\b/g, "academy"],
  [/\bsch\b/g, "school"],
];

/** Lowercase, strip punctuation, expand school-type abbreviations. */
export function canonicalizeSchoolName(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of SCHOOL_ABBREV_REPLACEMENTS) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

// Unlike the district STOP_WORDS, this keeps type words (elementary / middle /
// high / academy / intermediate) — only the generic "school" itself is noise.
const SCHOOL_STOP_WORDS = new Set(["school", "schools", "campus", "the", "of", "and"]);

/** Canonicalized school name minus generic filler — the school tier-2 form. */
export function normalizeSchoolName(s: string): string {
  return canonicalizeSchoolName(s)
    .split(" ")
    .filter((w) => w && !SCHOOL_STOP_WORDS.has(w))
    .join(" ");
}

/**
 * Pairwise SCHOOL-name similarity for cross-validation. Same contract as
 * `orgNameSimilarity` but abbreviation-aware: "Manvel High School" vs
 * "MANVEL H S" is 1.0 (identical once canonicalized), while different
 * schools sharing a type word ("Clear Creek Elementary" vs "KOSTORYZ EL")
 * still score low — expansion keeps the type token but Dice punishes the
 * differing proper-name part.
 */
export function schoolNameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (!la || !lb) return 0;
  if (la === lb) return 1;
  const na = normalizeSchoolName(a);
  const nb = normalizeSchoolName(b);
  if (na && na === nb) return 1;
  return Math.max(diceCoefficient(la, lb), na && nb ? diceCoefficient(na, nb) : 0);
}

export type NameMatchResult<T> =
  | { kind: "match"; candidate: T }
  | { kind: "ambiguous" }
  | { kind: "none" };

/**
 * Match a free-text org name against candidates. "ambiguous" = multiple
 * candidates tie at the matched tier — callers must never auto-pick one.
 * Pass `fuzzy: false` to disable the Dice tier (e.g. statewide school-name
 * matching, where only exact/normalized hits are trustworthy).
 * Pass `normalize` to swap the tier-2 normalizer (e.g. `normalizeSchoolName`
 * for abbreviation-aware school matching); when set, the fuzzy tier also
 * scores the normalized forms. Defaults preserve district behavior exactly.
 */
export function matchByName<T extends { name: string }>(
  query: string,
  candidates: T[],
  opts: { fuzzy?: boolean; normalize?: (s: string) => string } = {},
): NameMatchResult<T> {
  const lcQuery = query.toLowerCase().trim();
  if (!lcQuery || candidates.length === 0) return { kind: "none" };

  const tier1 = candidates.filter((c) => c.name.toLowerCase().trim() === lcQuery);
  if (tier1.length === 1) return { kind: "match", candidate: tier1[0] };
  if (tier1.length > 1) return { kind: "ambiguous" };

  const normalize = opts.normalize ?? normalizeOrgName;
  const normQuery = normalize(query);
  if (!normQuery) return { kind: "none" };
  const tier2 = candidates.filter((c) => normalize(c.name) === normQuery);
  if (tier2.length === 1) return { kind: "match", candidate: tier2[0] };
  if (tier2.length > 1) return { kind: "ambiguous" };

  if (opts.fuzzy === false) return { kind: "none" };
  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: Math.max(
        diceCoefficient(lcQuery, c.name.toLowerCase().trim()),
        // Custom-normalizer callers (schools) get abbreviation-aware fuzzy
        // too; the default path is untouched to keep rfps scoring stable.
        opts.normalize ? diceCoefficient(normQuery, normalize(c.name)) : 0,
      ),
    }))
    .filter((s) => s.score >= 0.85)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { kind: "none" };
  if (scored.length > 1 && scored[0].score === scored[1].score) return { kind: "ambiguous" };
  return { kind: "match", candidate: scored[0].candidate };
}
