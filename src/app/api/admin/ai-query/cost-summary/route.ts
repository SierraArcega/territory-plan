import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import {
  parseScope,
  scopeToSinceDate,
  turnCost,
} from "@/features/admin/lib/ai-query-cost";

export const dynamic = "force-dynamic";

interface ByPositionAccum {
  count: number;
  cost: number;
  inp: number;
  out: number;
  cw: number;
  cr: number;
}

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get("scope"));
  const since = scopeToSinceDate(scope);

  const turns = await prisma.queryLog.findMany({
    where: {
      OR: [{ inputTokens: { not: null } }, { outputTokens: { not: null } }],
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      userId: true,
      question: true,
      sql: true,
      params: true,
      rowCount: true,
      inputTokens: true,
      outputTokens: true,
      cacheCreationInputTokens: true,
      cacheReadInputTokens: true,
      error: true,
      createdAt: true,
    },
  });

  const totalTurns = turns.length;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheWrite = 0;
  let totalCacheRead = 0;
  let totalCost = 0;
  let wastedCost = 0;
  let wastedTurns = 0;

  for (const t of turns) {
    totalInput += t.inputTokens ?? 0;
    totalOutput += t.outputTokens ?? 0;
    totalCacheWrite += t.cacheCreationInputTokens ?? 0;
    totalCacheRead += t.cacheReadInputTokens ?? 0;
    const c = turnCost(t);
    totalCost += c;
    const isFailed = !!t.error || (!t.sql && t.rowCount == null);
    if (isFailed) {
      wastedCost += c;
      wastedTurns++;
    }
  }

  const cacheHitDenom = totalInput + totalCacheRead;
  const cacheHitPct = cacheHitDenom > 0 ? (totalCacheRead / cacheHitDenom) * 100 : 0;

  // By turn position in conversation
  const byConvo = new Map<string, typeof turns>();
  for (const t of turns) {
    const key = t.conversationId ?? `solo-${t.id}`;
    if (!byConvo.has(key)) byConvo.set(key, []);
    byConvo.get(key)!.push(t);
  }
  const byPosition = new Map<number, ByPositionAccum>();
  for (const arr of byConvo.values()) {
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    arr.forEach((t, i) => {
      const pos = i + 1;
      if (pos > 10) return;
      const b = byPosition.get(pos) ?? { count: 0, cost: 0, inp: 0, out: 0, cw: 0, cr: 0 };
      b.count++;
      b.cost += turnCost(t);
      b.inp += t.inputTokens ?? 0;
      b.out += t.outputTokens ?? 0;
      b.cw += t.cacheCreationInputTokens ?? 0;
      b.cr += t.cacheReadInputTokens ?? 0;
      byPosition.set(pos, b);
    });
  }
  const positionRows = [...byPosition.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, b]) => ({
      position,
      n: b.count,
      avgCost: b.cost / b.count,
      avgInput: Math.round(b.inp / b.count),
      avgOutput: Math.round(b.out / b.count),
      avgCacheWrite: Math.round(b.cw / b.count),
      avgCacheRead: Math.round(b.cr / b.count),
    }));

  // Top 10 expensive turns
  const topTurns = [...turns]
    .map((t) => ({ t, c: turnCost(t) }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10)
    .map(({ t, c }) => {
      const params = (t.params as { events?: unknown[] } | null) ?? null;
      const events = Array.isArray(params?.events) ? params.events : [];
      return {
        id: t.id,
        conversationId: t.conversationId,
        question: t.question.slice(0, 200),
        cost: c,
        events: events.length,
        rowCount: t.rowCount,
        hasError: !!t.error,
        createdAt: t.createdAt.toISOString(),
      };
    });

  // Top 10 expensive conversations
  const convoRows: Array<{
    conversationId: string;
    turns: number;
    cost: number;
    firstQuestion: string;
    lastActivity: string;
  }> = [];
  for (const [id, arr] of byConvo.entries()) {
    const c = arr.reduce((s, t) => s + turnCost(t), 0);
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    convoRows.push({
      conversationId: id,
      turns: arr.length,
      cost: c,
      firstQuestion: arr[0].question.slice(0, 200),
      lastActivity: arr[arr.length - 1].createdAt.toISOString(),
    });
  }
  convoRows.sort((a, b) => b.cost - a.cost);
  const topConversations = convoRows.slice(0, 10);

  return NextResponse.json({
    scope,
    totalTurns,
    totalCost,
    avgCostPerTurn: totalTurns > 0 ? totalCost / totalTurns : 0,
    totalInput,
    totalOutput,
    totalCacheWrite,
    totalCacheRead,
    cacheHitPct,
    wastedCost,
    wastedTurns,
    wastedPct: totalCost > 0 ? (wastedCost / totalCost) * 100 : 0,
    byPosition: positionRows,
    topExpensiveTurns: topTurns,
    topExpensiveConversations: topConversations,
  });
}
