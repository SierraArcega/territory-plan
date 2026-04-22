/** Dice-Sørensen bigram coefficient, 0-1. Used for fuzzy name matching.
 *  Mirrors the algorithm in src/features/vacancies/lib/school-matcher.ts. */

function bigrams(str: string): Set<string> {
  const out = new Set<string>();
  const n = str.length;
  for (let i = 0; i < n - 1; i++) out.add(str.slice(i, i + 2));
  return out;
}

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const g of A) if (B.has(g)) overlap++;
  return (2 * overlap) / (A.size + B.size);
}

const NOISE_WORDS = [
  "public",
  "schools",
  "school",
  "district",
  "unified",
  "community",
  "central",
  "county",
  "consolidated",
  "independent",
  "area",
  "regional",
  "cooperative",
];

export function normalizeName(name: string): string {
  let s = name.toLowerCase();
  s = s.replace(/[.,'"()&\-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const parts = s.split(" ").filter((p) => p && !NOISE_WORDS.includes(p));
  return parts.join(" ").trim();
}
