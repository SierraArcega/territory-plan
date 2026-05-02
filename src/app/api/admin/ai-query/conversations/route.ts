import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import {
  parseScope,
  scopeToSinceDate,
  turnCost,
} from "@/features/admin/lib/ai-query-cost";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope"));
  const since = scopeToSinceDate(scope);
  const search = (searchParams.get("search") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("page_size") ?? "25", 10)),
  );

  // Pull turns in scope, group by conversation, then paginate by conversation cost.
  const turns = await prisma.queryLog.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(search
        ? { question: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      conversationId: true,
      userId: true,
      question: true,
      sql: true,
      rowCount: true,
      inputTokens: true,
      outputTokens: true,
      cacheCreationInputTokens: true,
      cacheReadInputTokens: true,
      error: true,
      createdAt: true,
    },
  });

  // Group by conversation
  type Convo = {
    conversationId: string;
    userId: string;
    turnCount: number;
    totalCost: number;
    hasError: boolean;
    firstQuestion: string;
    lastActivity: Date;
    firstActivity: Date;
  };
  const map = new Map<string, Convo>();
  for (const t of turns) {
    const id = t.conversationId;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        conversationId: id,
        userId: t.userId,
        turnCount: 1,
        totalCost: turnCost(t),
        hasError: !!t.error,
        firstQuestion: t.question,
        lastActivity: t.createdAt,
        firstActivity: t.createdAt,
      });
    } else {
      existing.turnCount++;
      existing.totalCost += turnCost(t);
      if (t.error) existing.hasError = true;
      if (t.createdAt > existing.lastActivity) existing.lastActivity = t.createdAt;
      if (t.createdAt < existing.firstActivity) {
        existing.firstActivity = t.createdAt;
        existing.firstQuestion = t.question;
      }
    }
  }

  const allConvos = [...map.values()].sort(
    (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
  );

  // Resolve user emails / names in one query
  const userIds = [...new Set(allConvos.map((c) => c.userId))];
  const profiles = userIds.length
    ? await prisma.userProfile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, fullName: true },
      })
    : [];
  const userMap = new Map(profiles.map((p) => [p.id, p]));

  const total = allConvos.length;
  const start = (page - 1) * pageSize;
  const slice = allConvos.slice(start, start + pageSize);

  const rows = slice.map((c) => {
    const u = userMap.get(c.userId);
    return {
      conversationId: c.conversationId,
      userId: c.userId,
      userEmail: u?.email ?? null,
      userName: u?.fullName ?? null,
      turnCount: c.turnCount,
      totalCost: c.totalCost,
      hasError: c.hasError,
      firstQuestion: c.firstQuestion.slice(0, 240),
      lastActivity: c.lastActivity.toISOString(),
    };
  });

  return NextResponse.json({ rows, page, pageSize, total, scope });
}
