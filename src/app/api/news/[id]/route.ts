import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/news/[id]
 *
 * Detail-panel data for a single news article. Includes the full content
 * field (omitted from the list endpoint), all matched districts with
 * confidence levels, and matched contacts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const article = await prisma.newsArticle.findUnique({
    where: { id },
    include: {
      districts: {
        select: {
          confidence: true,
          district: {
            select: { leaid: true, name: true, stateAbbrev: true },
          },
        },
      },
      contacts: {
        select: {
          confidence: true,
          contact: {
            select: { id: true, name: true, title: true, leaid: true },
          },
        },
      },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: article.id,
    url: article.url,
    title: article.title,
    description: article.description,
    content: article.content,
    imageUrl: article.imageUrl,
    author: article.author,
    source: article.source,
    feedSource: article.feedSource,
    publishedAt: article.publishedAt.toISOString(),
    fetchedAt: article.fetchedAt.toISOString(),
    stateAbbrevs: article.stateAbbrevs,
    categories: article.categories,
    fullmindRelevance: article.fullmindRelevance,
    classifiedAt: article.classifiedAt?.toISOString() ?? null,
    matchedAt: article.matchedAt?.toISOString() ?? null,
    districts: article.districts.map((d) => ({
      confidence: d.confidence,
      leaid: d.district.leaid,
      name: d.district.name,
      stateAbbrev: d.district.stateAbbrev,
    })),
    contacts: article.contacts.map((c) => ({
      confidence: c.confidence,
      id: c.contact.id,
      name: c.contact.name,
      title: c.contact.title,
      leaid: c.contact.leaid,
    })),
  });
}
