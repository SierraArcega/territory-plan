export type VacancyCategory =
  | "SPED"
  | "ELL"
  | "General Ed"
  | "Admin"
  | "Specialist"
  | "Counseling"
  | "Related Services"
  | "Other";

interface CategoryRule {
  category: VacancyCategory;
  keywords: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "SPED",
    keywords: [
      "special education",
      "sped",
      "resource room",
      "self-contained",
      "inclusion",
    ],
  },
  {
    category: "ELL",
    keywords: [
      "ell",
      "esl",
      "bilingual",
      "dual language",
      "english learner",
    ],
  },
  {
    category: "Admin",
    keywords: [
      "principal",
      "assistant principal",
      "superintendent",
      "director",
      "coordinator",
      "dean",
    ],
  },
  {
    category: "Specialist",
    keywords: [
      "reading specialist",
      "math specialist",
      "interventionist",
      "instructional coach",
    ],
  },
  {
    category: "Counseling",
    keywords: [
      "counselor",
      "psychologist",
      "social worker",
      "mental health",
    ],
  },
  {
    category: "Related Services",
    keywords: [
      "speech",
      "slp",
      "occupational therapist",
      "physical therapist",
    ],
  },
];

/**
 * Assigns a category to a vacancy based on title keyword matching.
 * Checks specific categories first, falls back to "General Ed" if "teacher"
 * is found, and "Other" if nothing matches.
 */
export function categorize(title: string): VacancyCategory {
  const titleLower = title.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => titleLower.includes(keyword))) {
      return rule.category;
    }
  }

  if (titleLower.includes("teacher")) {
    return "General Ed";
  }

  return "Other";
}
