import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_CONFIDENCE_FILTER = ["high", "llm", "source"];

export interface NewsArticleDto {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  source: string;
  feedSource: string;
  publishedAt: string;
  sentiment: string | null;
  categories: string[];
  fullmindRelevance: string | null;
  confidence?: string;
  districtLeaid?: string;
  districtName?: string;
}

/**
 * GET /api/news
 *
 * Query params (mutually exclusive, pick one):
 *   ?leaid=           — articles matched to this district
 *   ?ncessch=         — articles matched to this school
 *   ?contactId=       — articles matched to this contact
 *   ?stateAbbrev=     — articles mentioning this US state (state-wide news)
 *   ?territoryPlanId= — articles matched to any district in a territory plan
 *   ?scope=my-territory — articles matched to districts in any plan the user
 *                         owns/collaborates on, plus state-wide articles for
 *                         any state covered by those plans
 *
 * Common params:
 *   ?since=ISO8601      — only articles published on/after this date
 *   ?limit=N            — cap results (default 10, max 100)
 *   ?minRelevance=TIER  — only articles with fullmindRelevance ≥ TIER
 *                         (high | medium | low), omitted = no filter
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leaid = searchParams.get("leaid");
  const ncessch = searchParams.get("ncessch");
  const contactIdRaw = searchParams.get("contactId");
  const contactId = contactIdRaw ? parseInt(contactIdRaw, 10) : null;
  const stateAbbrev = searchParams.get("stateAbbrev")?.toUpperCase();
  const territoryPlanId = searchParams.get("territoryPlanId");
  const scope = searchParams.get("scope");
  const since = searchParams.get("since");
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  const sinceDate = since ? new Date(since) : null;
  const minRelevance = searchParams.get("minRelevance") ?? null;
  const RELEVANCE_ORDER = ["high", "medium", "low"] as const;
  const relevanceIndex = minRelevance ? RELEVANCE_ORDER.indexOf(minRelevance as (typeof RELEVANCE_ORDER)[number]) : -1;
  const acceptedRelevance = relevanceIndex >= 0 ? RELEVANCE_ORDER.slice(0, relevanceIndex + 1) : null;

  const articleWhere: Prisma.NewsArticleWhereInput = {};
  if (sinceDate && !Number.isNaN(sinceDate.getTime())) {
    articleWhere.publishedAt = { gte: sinceDate };
  }
  if (acceptedRelevance) {
    articleWhere.fullmindRelevance = { in: [...acceptedRelevance] };
  }

  try {
    let articles: NewsArticleDto[] = [];

    if (leaid) {
      const matches = await prisma.newsArticleDistrict.findMany({
        where: {
          leaid,
          confidence: { in: DEFAULT_CONFIDENCE_FILTER },
          article: articleWhere,
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: limit,
        include: { article: true },
      });
      articles = matches.map((m) => toDto(m.article, m.confidence));
    } else if (ncessch) {
      const matches = await prisma.newsArticleSchool.findMany({
        where: {
          ncessch,
          confidence: { in: DEFAULT_CONFIDENCE_FILTER },
          article: articleWhere,
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: limit,
        include: { article: true },
      });
      articles = matches.map((m) => toDto(m.article, m.confidence));
    } else if (contactId !== null && !Number.isNaN(contactId)) {
      const matches = await prisma.newsArticleContact.findMany({
        where: {
          contactId,
          confidence: { in: DEFAULT_CONFIDENCE_FILTER },
          article: articleWhere,
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: limit,
        include: { article: true },
      });
      articles = matches.map((m) => toDto(m.article, m.confidence));
    } else if (stateAbbrev) {
      // State-wide news: any article that mentions this state (from Pass 1's
      // extractStates) but is not necessarily tied to a specific district.
      const stateArticles = await prisma.newsArticle.findMany({
        where: { ...articleWhere, stateAbbrevs: { has: stateAbbrev } },
        orderBy: { publishedAt: "desc" },
        take: limit,
      });
      articles = stateArticles.map((a) => toDto(a, "state"));
    } else if (territoryPlanId) {
      const matches = await prisma.newsArticleDistrict.findMany({
        where: {
          confidence: { in: DEFAULT_CONFIDENCE_FILTER },
          article: articleWhere,
          district: {
            territoryPlans: { some: { planId: territoryPlanId } },
          },
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: limit,
        include: { article: true, district: { select: { leaid: true, name: true } } },
      });
      articles = matches.map((m) =>
        toDto(m.article, m.confidence, m.district.leaid, m.district.name)
      );
    } else if (scope === "my-territory") {
      // Find the user's territory: both the districts they own/collab on AND
      // the states those districts sit in (for state-wide news).
      const territoryDistricts = await prisma.district.findMany({
        where: {
          territoryPlans: {
            some: {
              plan: {
                OR: [
                  { ownerId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            },
          },
        },
        select: { leaid: true, name: true, stateAbbrev: true },
      });
      const territoryLeaids = territoryDistricts.map((d) => d.leaid);
      const territoryStates = [
        ...new Set(
          territoryDistricts
            .map((d) => d.stateAbbrev)
            .filter((s): s is string => Boolean(s))
        ),
      ];

      // District-matched articles (over-fetch so the state-wide union can't
      // starve them out in the top-N).
      const districtMatches = await prisma.newsArticleDistrict.findMany({
        where: {
          confidence: { in: DEFAULT_CONFIDENCE_FILTER },
          article: articleWhere,
          leaid: { in: territoryLeaids.length > 0 ? territoryLeaids : [""] },
        },
        orderBy: { article: { publishedAt: "desc" } },
        take: limit * 2,
        include: { article: true, district: { select: { leaid: true, name: true } } },
      });

      // State-wide articles — only those NOT already surfaced by a district hit
      const districtMatchedArticleIds = new Set(districtMatches.map((m) => m.articleId));
      const stateArticles = territoryStates.length > 0
        ? await prisma.newsArticle.findMany({
            where: {
              ...articleWhere,
              stateAbbrevs: { hasSome: territoryStates },
              id: { notIn: [...districtMatchedArticleIds] },
            },
            orderBy: { publishedAt: "desc" },
            take: limit * 2,
          })
        : [];

      // Merge, sort, cap at limit
      const merged: Array<{ article: NewsArticleDto; publishedAt: Date }> = [
        ...districtMatches.map((m) => ({
          article: toDto(m.article, m.confidence, m.district.leaid, m.district.name),
          publishedAt: m.article.publishedAt,
        })),
        ...stateArticles.map((a) => ({
          article: toDto(a, "state"),
          publishedAt: a.publishedAt,
        })),
      ];
      merged.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      articles = merged.slice(0, limit).map((m) => m.article);
    } else {
      return NextResponse.json(
        { error: "One of leaid, ncessch, contactId, territoryPlanId, or scope is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news", detail: String(err) },
      { status: 500 }
    );
  }
}

function toDto(
  article: {
    id: string;
    url: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    author: string | null;
    source: string;
    feedSource: string;
    publishedAt: Date;
    sentiment: string | null;
    categories: string[];
    fullmindRelevance: string | null;
  },
  confidence: string,
  districtLeaid?: string,
  districtName?: string
): NewsArticleDto {
  return {
    id: article.id,
    url: article.url,
    title: article.title,
    description: article.description,
    imageUrl: article.imageUrl,
    author: article.author,
    source: article.source,
    feedSource: article.feedSource,
    publishedAt: article.publishedAt.toISOString(),
    sentiment: article.sentiment,
    categories: article.categories,
    fullmindRelevance: article.fullmindRelevance,
    confidence,
    districtLeaid,
    districtName,
  };
}
