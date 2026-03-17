import prisma from "@/lib/prisma";

interface RelevanceInput {
  title: string;
  rawText?: string;
}

interface RelevanceResult {
  fullmindRelevant: boolean;
  relevanceReason: string | null;
}

/**
 * Flags vacancies relevant to Fullmind's service lines by matching
 * title and rawText against relevance keywords from VacancyKeywordConfig.
 */
export async function flagRelevance(
  vacancy: RelevanceInput
): Promise<RelevanceResult> {
  const configs = await prisma.vacancyKeywordConfig.findMany({
    where: { type: "relevance" },
    select: { label: true, keywords: true, serviceLine: true },
  });

  if (configs.length === 0) {
    return { fullmindRelevant: false, relevanceReason: null };
  }

  const textToSearch = [
    vacancy.title,
    vacancy.rawText ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const config of configs) {
    for (const keyword of config.keywords) {
      if (textToSearch.includes(keyword.toLowerCase())) {
        const reason = config.serviceLine
          ? `${config.label} (${config.serviceLine})`
          : config.label;
        return { fullmindRelevant: true, relevanceReason: reason };
      }
    }
  }

  return { fullmindRelevant: false, relevanceReason: null };
}
