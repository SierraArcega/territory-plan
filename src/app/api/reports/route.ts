import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ReportListItem {
  id: number;
  title: string;
  description: string | null;
  question: string;
  lastRunAt: string | null;
  runCount: number;
  rowCount: number | null;
  isTeamPinned: boolean;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
}

type LibraryResponse = {
  mine: ReportListItem[];
  starred: ReportListItem[];
  team: ReportListItem[];
};

export async function GET(): Promise<NextResponse<LibraryResponse | { error: string }>> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Single round-trip: fetch every report (read access is permissive) plus the
  // owning UserProfile so we can attach owner metadata to non-self entries.
  const reports = await prisma.savedReport.findMany({
    orderBy: [{ lastRunAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      question: true,
      lastRunAt: true,
      runCount: true,
      rowCount: true,
      isTeamPinned: true,
      updatedAt: true,
      userId: true,
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  const mine: ReportListItem[] = [];
  const starred: ReportListItem[] = [];
  const team: ReportListItem[] = [];

  for (const r of reports) {
    const isSelf = r.userId === user.id;
    const base: ReportListItem = {
      id: r.id,
      title: r.title,
      description: r.description,
      question: r.question,
      lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
      runCount: r.runCount,
      rowCount: r.rowCount,
      isTeamPinned: r.isTeamPinned,
      updatedAt: r.updatedAt.toISOString(),
      // Mine never carries an owner (always self). Other tabs do.
      owner: isSelf ? null : r.user ?? null,
    };
    if (isSelf) mine.push(base);
    if (r.isTeamPinned) starred.push(base);
    // Team excludes pinned reports (they live under Starred) to avoid double-listing.
    if (!isSelf && !r.isTeamPinned) team.push(base);
  }

  return NextResponse.json({ mine, starred, team });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    title: string;
    question: string;
    sql: string;
    summary: unknown;
    description?: string | null;
    conversationId?: string;
  };
  if (!body.title || !body.question || !body.sql || !body.summary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const report = await prisma.savedReport.create({
    data: {
      userId: user.id,
      title: body.title,
      question: body.question,
      sql: body.sql,
      summary: body.summary as object,
      description: body.description ?? null,
      conversationId: body.conversationId ?? null,
    },
  });
  return NextResponse.json({ report }, { status: 201 });
}
