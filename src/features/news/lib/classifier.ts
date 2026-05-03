import PQueue from "p-queue";
import { callClaude, findToolUse, HAIKU_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

// Fixed category list — keep in sync with `lib/config.ts` if we ever need
// the UI side to know them. Enum-style, one string per category.
export const NEWS_CATEGORIES = [
  "budget_funding",
  "leadership_change",
  "vacancies_staffing",
  "academic_performance",
  "enrollment_trends",
  "labor_contract",
  "curriculum_adoption",
  "technology_edtech",
  "school_choice",
  "procurement_rfp",
  "policy_regulation",
  "facility_operations",
  "student_services",
  "tutoring_intervention",
  "homeschool",
  "scandal_incident",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const RELEVANCE_TIERS = ["high", "medium", "low", "none"] as const;
export type Relevance = (typeof RELEVANCE_TIERS)[number];

export interface ClassificationResult {
  categories: NewsCategory[];
  fullmindRelevance: Relevance;
}

/** Pure parser for the classify_article tool's input — pulled out of
 *  classifyOne so it can be unit-tested without mocking the LLM. */
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const out = raw as {
    categories?: string[];
    fullmindRelevance?: string;
  };
  const fullmindRelevance = (RELEVANCE_TIERS as readonly string[]).includes(
    out.fullmindRelevance ?? ""
  )
    ? (out.fullmindRelevance as Relevance)
    : "none";
  const categories = (out.categories ?? []).filter((c): c is NewsCategory =>
    (NEWS_CATEGORIES as readonly string[]).includes(c)
  );
  return { categories, fullmindRelevance };
}

export interface ClassifyStats {
  processed: number;
  classified: number;
  errors: number;
  llmCalls: number;
}

const CLASSIFY_TOOL = {
  name: "classify_article",
  description:
    "Classify a K-12 news article for Fullmind's sales team: topic categories and sales relevance.",
  input_schema: {
    type: "object" as const,
    properties: {
      categories: {
        type: "array" as const,
        description: "Zero or more topic tags. Pick all that substantively apply.",
        items: { type: "string" as const, enum: NEWS_CATEGORIES as unknown as string[] },
      },
      fullmindRelevance: {
        type: "string" as const,
        enum: RELEVANCE_TIERS as unknown as string[],
        description:
          "How actionable is this article for Fullmind's K-12 tutoring sales team? Use the rubric in the system prompt.",
      },
    },
    required: ["categories", "fullmindRelevance"] as const,
  },
};

const SYSTEM_PROMPT = `You classify K-12 news articles for Fullmind Learning — a company that sells on-demand online tutoring, virtual teachers, and intervention services to public school districts.

Articles arrive as headlines (sometimes with a 1-sentence description). You must return:
1. sentiment: positive | neutral | negative (overall tone toward the subject)
2. categories: zero or more topic tags from the fixed list
3. fullmindRelevance: how useful for Fullmind's sales prospecting

SENTIMENT — subject's perspective:
  • positive: awards, new programs, funding wins, improvements
  • neutral: routine/informational coverage, policy changes without clear valence
  • negative: scandals, investigations, budget cuts, crisis, declines

CATEGORIES (pick all that apply; empty array is valid):
  • budget_funding        — bonds, levies, state/federal funding, cuts, grants
  • leadership_change     — superintendent, CFO, board transitions
  • academic_performance  — test scores, graduation rates, accountability, learning loss
  • enrollment_trends     — declines, growth, demographic shifts
  • labor_contract        — strikes, union, teacher pay, contract negotiations
  • curriculum_adoption   — vendor selection, new programs, textbook decisions
  • technology_edtech     — digital learning, platform adoption, AI, devices
  • policy_regulation     — state/federal mandates, new laws
  • facility_operations   — closings, openings, construction, infrastructure
  • student_services      — special ed, SEL, mental health, counseling, tutoring, intervention
  • scandal_incident      — investigations, legal issues, safety, misconduct

FULLMIND RELEVANCE — tutoring sales lens:
  • high   — direct signal of a sales opportunity: tutoring RFPs/contracts, Title I funds, academic-performance crisis driving intervention budget, learning loss concerns, new leadership prioritizing interventions, ESSER spending decisions
  • medium — affects district priorities but isn't a direct selling moment: general budget news, curriculum adoption (including non-tutoring), enrollment trends, mental-health/SEL expansion
  • low    — K-12 news but not sales-actionable for a tutoring vendor: facility ops, scheduling, general state policy not about services, sports
  • none   — not K-12 education, not about districts, or clearly off-topic

Err on the side of "medium" over "high" — high should be truly actionable.

Call the classify_article tool with your decision.`;

async function classifyOne(article: {
  id: string;
  title: string;
  description: string | null;
}): Promise<ClassificationResult | null> {
  if (process.env.NEWS_LLM_ENABLED === "false") return null;

  const userMessage = [
    `Title: ${article.title}`,
    article.description && article.description !== article.title
      ? `Description: ${article.description.slice(0, 500)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const content = await callClaude({
    model: HAIKU_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: [CLASSIFY_TOOL],
    toolChoice: { type: "tool", name: "classify_article" },
    maxTokens: 512,
  });

  const tool = findToolUse(content, "classify_article");
  if (!tool) return null;

  return parseClassificationResult(tool.input);
}

/** Run the classifier over a specific article list. Used right after ingest
 *  so newly-landed articles get categories/relevance immediately. */
export async function classifyArticles(
  articleIds: string[],
  concurrency = 4,
  timeBudgetMs = 45_000
): Promise<ClassifyStats> {
  const stats: ClassifyStats = { processed: 0, classified: 0, errors: 0, llmCalls: 0 };
  if (process.env.NEWS_LLM_ENABLED === "false" || articleIds.length === 0) return stats;

  const articles = await prisma.newsArticle.findMany({
    where: { id: { in: articleIds }, classifiedAt: null },
    select: { id: true, title: true, description: true },
  });
  return classifyMany(articles, concurrency, timeBudgetMs, stats);
}

/**
 * Classify any articles with `classifiedAt IS NULL`.
 * Respects a time budget and a max-articles cap.
 */
export async function classifyUnclassified(
  limit = 200,
  concurrency = 8,
  timeBudgetMs = 60_000
): Promise<ClassifyStats> {
  const stats: ClassifyStats = { processed: 0, classified: 0, errors: 0, llmCalls: 0 };
  if (process.env.NEWS_LLM_ENABLED === "false") return stats;

  const articles = await prisma.newsArticle.findMany({
    where: { classifiedAt: null },
    select: { id: true, title: true, description: true },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });
  return classifyMany(articles, concurrency, timeBudgetMs, stats);
}

async function classifyMany(
  articles: Array<{ id: string; title: string; description: string | null }>,
  concurrency: number,
  timeBudgetMs: number,
  stats: ClassifyStats
): Promise<ClassifyStats> {
  const deadline = Date.now() + timeBudgetMs;

  const queue = new PQueue({ concurrency });
  for (const a of articles) {
    queue.add(async () => {
      if (Date.now() > deadline) return;
      stats.processed++;
      try {
        const result = await classifyOne(a);
        stats.llmCalls++;
        if (!result) return;
        await prisma.newsArticle.update({
          where: { id: a.id },
          data: {
            categories: result.categories,
            fullmindRelevance: result.fullmindRelevance,
            classifiedAt: new Date(),
          },
        });
        stats.classified++;
      } catch (err) {
        stats.errors++;
        console.error(`[classifier] ${a.id}: ${String(err)}`);
      }
    });
  }
  await queue.onIdle();
  return stats;
}
