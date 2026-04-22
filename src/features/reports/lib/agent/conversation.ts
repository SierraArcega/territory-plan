import prisma from "@/lib/prisma";
import type { QuerySummary } from "./types";

export interface PriorTurn {
  question: string;
  sql: string | null;
  summary: QuerySummary | null;
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

  return rows.map((r) => ({
    question: r.question,
    sql: r.sql,
    summary:
      r.params && typeof r.params === "object" && "summary" in r.params
        ? (r.params as { summary: QuerySummary }).summary
        : null,
    createdAt: r.createdAt,
  }));
}

export async function saveTurn(args: {
  userId: string;
  conversationId: string;
  question: string;
  sql?: string;
  summary?: QuerySummary;
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;
}): Promise<number> {
  const { userId, conversationId, question, sql, summary, rowCount, executionTimeMs, error } = args;
  const row = await prisma.queryLog.create({
    data: {
      userId,
      conversationId,
      question,
      sql: sql ?? null,
      params: summary ? { summary } : undefined,
      rowCount: rowCount ?? null,
      executionTimeMs: executionTimeMs ?? null,
      error: error ?? null,
    },
  });
  return row.id;
}
