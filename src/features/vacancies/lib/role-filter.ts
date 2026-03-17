import prisma from "@/lib/prisma";
import type { RawVacancy } from "./parsers/types";

/**
 * Filters out non-instructional roles by matching vacancy titles
 * against exclusion keywords stored in VacancyKeywordConfig.
 */
export async function filterExcludedRoles(
  vacancies: RawVacancy[]
): Promise<RawVacancy[]> {
  const configs = await prisma.vacancyKeywordConfig.findMany({
    where: { type: "exclusion" },
    select: { keywords: true },
  });

  const exclusionKeywords = configs.flatMap((c) => c.keywords);

  if (exclusionKeywords.length === 0) {
    return vacancies;
  }

  const lowerKeywords = exclusionKeywords.map((k) => k.toLowerCase());

  return vacancies.filter((vacancy) => {
    const titleLower = vacancy.title.toLowerCase();
    return !lowerKeywords.some((keyword) => titleLower.includes(keyword));
  });
}
