import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { QuerySummary, TokenUsage, TurnEvent } from "./types";

export interface PriorTurn {
  question: string;
  sql: string | null;
  summary: QuerySummary | null;
  assistantText: string | null;
  createdAt: Date;
}

export async function loadPriorTurns(
  conversationId: string | undefined,
  userId: string,
): Promise<PriorTurn[]> {
  if (!conversationId) return [];

  const rows = await prisma.queryLog.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { question: true, sql: true, params: true, createdAt: true },
  });

  return rows.map((r) => {
    const p =
      r.params && typeof r.params === "object" && !Array.isArray(r.params)
        ? (r.params as Record<string, unknown>)
        : null;
    return {
      question: r.question,
      sql: r.sql,
      summary:
        p && "summary" in p ? (p.summary as QuerySummary) : null,
      assistantText:
        p && "assistantText" in p && typeof p.assistantText === "string"
          ? p.assistantText
          : null,
      createdAt: r.createdAt,
    };
  });
}

export async function saveTurn(args: {
  userId: string;
  conversationId: string;
  question: string;
  sql?: string;
  summary?: QuerySummary;
  assistantText?: string;
  events?: TurnEvent[];
  usage?: TokenUsage;
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;
}): Promise<number> {
  const {
    userId,
    conversationId,
    question,
    sql,
    summary,
    assistantText,
    events,
    usage,
    rowCount,
    executionTimeMs,
    error,
  } = args;
  const params: Record<string, unknown> = {};
  if (summary) params.summary = summary;
  if (assistantText) params.assistantText = assistantText;
  if (events && events.length > 0) params.events = events;
  const row = await prisma.queryLog.create({
    data: {
      userId,
      conversationId,
      question,
      sql: sql ?? null,
      params:
        Object.keys(params).length > 0
          ? (params as Prisma.InputJsonValue)
          : undefined,
      rowCount: rowCount ?? null,
      executionTimeMs: executionTimeMs ?? null,
      error: error ?? null,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      cacheCreationInputTokens: usage?.cacheCreationInputTokens ?? null,
      cacheReadInputTokens: usage?.cacheReadInputTokens ?? null,
    },
  });
  return row.id;
}
