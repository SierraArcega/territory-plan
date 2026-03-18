import prisma from "@/lib/prisma";

/** Common suffixes to strip when normalizing school names */
const COMMON_SUFFIXES = [
  "school",
  "elementary",
  "middle",
  "high",
  "es",
  "ms",
  "hs",
  "academy",
  "center",
];

/**
 * Normalizes a school name for comparison:
 * lowercase, trim, remove common suffixes, collapse whitespace.
 */
function normalize(name: string): string {
  let normalized = name.toLowerCase().trim();

  for (const suffix of COMMON_SUFFIXES) {
    // Remove suffix as a whole word (at word boundary)
    const pattern = new RegExp(`\\b${suffix}\\b`, "gi");
    normalized = normalized.replace(pattern, "");
  }

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Generates character bigrams from a string.
 */
function bigrams(str: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    result.add(str.substring(i, i + 2));
  }
  return result;
}

/**
 * Computes the Dice coefficient between two strings.
 * Dice = (2 * |intersection|) / (|A| + |B|)
 */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  let intersectionSize = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) {
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (bigramsA.size + bigramsB.size);
}

const DICE_THRESHOLD = 0.8;

/**
 * Fuzzy matches a school name from a vacancy against schools in the database
 * for a given district (leaid).
 *
 * Returns the ncessch (school ID) if matched, null otherwise.
 */
export async function matchSchool(
  schoolName: string,
  leaid: string
): Promise<string | null> {
  const schools = await prisma.school.findMany({
    where: { leaid },
    select: { ncessch: true, schoolName: true },
  });

  if (schools.length === 0) {
    return null;
  }

  const normalizedInput = normalize(schoolName);

  // Pass 1: Exact match on normalized names
  for (const school of schools) {
    if (normalize(school.schoolName) === normalizedInput) {
      return school.ncessch;
    }
  }

  // Pass 2: Fuzzy match using Dice coefficient
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const school of schools) {
    const score = diceCoefficient(normalize(school.schoolName), normalizedInput);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = school.ncessch;
    }
  }

  if (bestScore >= DICE_THRESHOLD && bestMatch) {
    return bestMatch;
  }

  return null;
}
