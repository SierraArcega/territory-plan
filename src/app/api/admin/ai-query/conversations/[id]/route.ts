import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import { turnCost } from "@/features/admin/lib/ai-query-cost";

export const dynamic = "force-dynamic";

interface ConversationTurn {
  id: number;
  createdAt: string;
  question: string;
  assistantText: string | null;
  summarySource: string | null;
  sql: string | null;
  tools: string[];
  eventCount: number;
  rowCount: number | null;
  executionTimeMs: number | null;
  error: string | null;
  tokens: {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  };
  cost: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const rows = await prisma.queryLog.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      question: true,
      sql: true,
      params: true,
      rowCount: true,
      executionTimeMs: true,
      inputTokens: true,
      outputTokens: true,
      cacheCreationInputTokens: true,
      cacheReadInputTokens: true,
      error: true,
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const userId = rows[0].userId;
  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true },
  });

  const turns: ConversationTurn[] = rows.map((t) => {
    const params = (t.params as Record<string, unknown> | null) ?? null;
    const events = Array.isArray(params?.events) ? (params.events as unknown[]) : [];
    const tools = events
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const ev = e as { kind?: string; toolName?: string };
        return ev.kind === "tool_result" ? ev.toolName ?? null : null;
      })
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    const summary =
      params && typeof params.summary === "object" && params.summary !== null
        ? ((params.summary as { source?: unknown }).source ?? null)
        : null;
    const assistantText =
      params && typeof params.assistantText === "string"
        ? (params.assistantText as string)
        : null;

    return {
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      question: t.question,
      assistantText,
      summarySource: typeof summary === "string" ? summary : null,
      sql: t.sql,
      tools,
      eventCount: events.length,
      rowCount: t.rowCount,
      executionTimeMs: t.executionTimeMs,
      error: t.error,
      tokens: {
        input: t.inputTokens ?? 0,
        output: t.outputTokens ?? 0,
        cacheWrite: t.cacheCreationInputTokens ?? 0,
        cacheRead: t.cacheReadInputTokens ?? 0,
      },
      cost: turnCost(t),
    };
  });

  return NextResponse.json({
    conversationId: id,
    userId,
    userEmail: profile?.email ?? null,
    userName: profile?.fullName ?? null,
    turnCount: turns.length,
    totalCost: turns.reduce((s, t) => s + t.cost, 0),
    turns,
  });
}
