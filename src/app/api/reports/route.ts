import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.savedReport.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      question: true,
      summary: true,
      updatedAt: true,
      runCount: true,
      lastRunAt: true,
      isTeamPinned: true,
    },
  });
  return NextResponse.json({ reports });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    title: string;
    question: string;
    sql: string;
    summary: unknown;
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
      conversationId: body.conversationId ?? null,
    },
  });
  return NextResponse.json({ report }, { status: 201 });
}
