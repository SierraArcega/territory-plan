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

Articles arrive as headlines (sometimes with a 1-sentence description). The audience is a Fullmind sales rep working a K-12 territory. An article is useful if it (a) gives the rep something to act on, (b) gives them something to talk about with a contact, or (c) gives context that changes how they think about the district.

You must return:
1. categories: zero or more topic tags from the fixed list
2. fullmindRelevance: how useful for the rep, on a 4-tier scale

CATEGORIES (pick all that apply; empty array is valid):
  • budget_funding         — bonds, levies, grants, cuts, ESSER, state/federal funding
  • leadership_change      — superintendent, CFO, board, director-level transitions
  • vacancies_staffing     — open positions, hiring freezes, RIFs, layoffs, "can't fill" stories
  • academic_performance   — test scores, accountability ratings, learning loss
  • enrollment_trends      — growth, decline, demographic shifts
  • labor_contract         — strikes, unions, contract negotiations
  • curriculum_adoption    — vendor selection, textbook decisions
  • technology_edtech      — digital learning, AI, devices
  • school_choice          — vouchers, charters, open enrollment, virtual schools, choice competition
  • procurement_rfp        — RFP/RFI announcements, vendor selection, contract awards (any subject)
  • policy_regulation      — state/federal mandates, new laws
  • facility_operations    — closings, openings, construction, infrastructure
  • student_services       — SPED, SEL, mental health, counseling
  • tutoring_intervention  — tutoring, intervention, learning-recovery programs (Fullmind's or competitors')
  • homeschool             — homeschool growth, hybrid homeschool programs, district homeschool support
  • scandal_incident       — investigations, legal, safety, misconduct

FULLMIND RELEVANCE — sales-rep lens:

  HIGH — direct prompt for action this week:
    • Leadership change: new sup, CFO, director of intervention/curriculum/SPED, flagship principal
    • Money moving: any budget news (approval, cut, deficit, surplus), bond/levy/referendum result, grant award, ESSER reallocation, settlement, new funding stream
    • Vacancies & staffing: open positions (esp. teacher, SPED, math, ELL), staff reductions, layoffs, RIFs, hiring freezes, "can't fill" stories
    • Competitive / structural shifts: open enrollment changes, school choice / voucher activity, charter expansion, homeschool growth or hybrid homeschool programs, virtual school launch or expansion, new online learning program
    • Procurement & vendor signals: RFP, contract award, vendor selection (any subject)
    • Problem statements: accountability rating drop, state takeover threat, IEP non-compliance, special-ed lawsuit, learning-loss data release, achievement-gap report
    • Programmatic announcements: tutoring program (theirs or a competitor's), intervention program rollout
    • Labor disruption: strike, union action, major labor news

  MEDIUM — useful context, not urgent:
    • Curriculum adoption outside tutoring/intervention
    • Mental health / SEL expansion
    • Test score release without crisis framing
    • Routine board / governance changes below director level
    • Major facility news (school opens / closes) — district trajectory signal
    • Routine enrollment trend reports without choice/competition framing

  LOW — skippable K-12 news from the district:
    • Sports, musicals, individual student achievements
    • Routine state policy updates without district-level effect
    • Building maintenance, busing, schedule, weather closures
    • Social justice / DEI articles (commentary, programs, controversy)
    • Crime, student investigations, staff investigations
      (Edge case: if an investigation drives a leadership departure, that's HIGH leadership_change — judge accordingly)

  NONE — drop from the feed:
    • Higher-ed, private school, edtech industry without district application
    • Articles where the district is mentioned only in passing (one-off byline, list of districts)

Default tendency: lean MEDIUM over LOW when uncertain. Reps prefer skimming 5 medium articles to missing 1 real signal.

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
