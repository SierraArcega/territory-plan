import prisma from "@/lib/prisma";
import { abbrevToFips } from "@/lib/states";

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

function normalizeName(s: string): string {
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

export async function resolveDistrict(
  agencyName: string,
  stateAbbrev: string,
): Promise<string | null> {
  const fips = abbrevToFips(stateAbbrev);
  if (!fips) return null;

  const districts = await prisma.district.findMany({
    where: { stateFips: fips },
    select: { leaid: true, name: true },
  });
  if (districts.length === 0) return null;

  const lcAgency = agencyName.toLowerCase().trim();
  const tier1 = districts.filter((d) => d.name.toLowerCase().trim() === lcAgency);
  if (tier1.length === 1) return tier1[0].leaid;

  const normAgency = normalizeName(agencyName);
  if (!normAgency) return null;
  const tier2 = districts.filter((d) => normalizeName(d.name) === normAgency);
  if (tier2.length === 1) return tier2[0].leaid;
  if (tier2.length > 1) return null;

  const scored = districts
    .map((d) => ({ leaid: d.leaid, score: diceCoefficient(lcAgency, d.name.toLowerCase().trim()) }))
    .filter((s) => s.score >= 0.85)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].leaid;
}
