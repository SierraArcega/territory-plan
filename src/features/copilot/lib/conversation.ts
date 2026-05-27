import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { PriorTurn } from "@/features/reports/lib/agent/conversation";
import type { QuerySummary, TokenUsage, TurnEvent } from "@/features/reports/lib/agent/types";
import type { ProposedAction } from "./types";

/**
 * Load prior copilot turns in the agent loop's `PriorTurn` shape so they replay
 * for free — answer-turns (with sql) replay as run_sql tool pairs, and
 * proposal-turns replay as assistant text with a compact bracketed note of what
 * was proposed, giving the model action continuity without any loop changes.
 */
export async function loadCopilotPriorTurns(
  conversationId: string | undefined,
  userId: string,
): Promise<PriorTurn[]> {
  if (!conversationId) return [];

  const rows = await prisma.copilotTurn.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      question: true,
      sql: true,
      summary: true,
      assistantText: true,
      proposedActions: true,
      createdAt: true,
    },
  });

  return rows.map((r) => {
    let assistantText = r.assistantText;
    const proposed = Array.isArray(r.proposedActions)
      ? (r.proposedActions as unknown as ProposedAction[])
      : null;
    if (proposed && proposed.length > 0) {
      const note = proposed
        .map((p) => `${p.operation} ${p.objectType}: ${p.preview.summary}`)
        .join("; ");
      assistantText = `${assistantText ? `${assistantText}\n` : ""}[Proposed for confirmation — ${note}]`;
    }
    return {
      question: r.question,
      sql: r.sql,
      summary: (r.summary as QuerySummary | null) ?? null,
      assistantText: assistantText ?? null,
      createdAt: r.createdAt,
    };
  });
}

export async function saveCopilotTurn(args: {
  userId: string;
  conversationId: string;
  question: string;
  assistantText?: string;
  sql?: string;
  summary?: QuerySummary;
  proposedActions?: ProposedAction[];
  events?: TurnEvent[];
  usage?: TokenUsage;
  error?: string;
}): Promise<void> {
  const {
    userId,
    conversationId,
    question,
    assistantText,
    sql,
    summary,
    proposedActions,
    events,
    usage,
    error,
  } = args;

  await prisma.copilotTurn.create({
    data: {
      conversationId,
      userId,
      question,
      assistantText: assistantText ?? null,
      sql: sql ?? null,
      summary: summary ? (summary as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      proposedActions:
        proposedActions && proposedActions.length > 0
          ? (proposedActions as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      toolTrace:
        events && events.length > 0
          ? (events as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      cacheCreationInputTokens: usage?.cacheCreationInputTokens ?? null,
      cacheReadInputTokens: usage?.cacheReadInputTokens ?? null,
      error: error ?? null,
    },
  });
}
