import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { PriorTurn } from "@/features/reports/lib/agent/conversation";
import type { QuerySummary, TokenUsage, TurnEvent } from "@/features/reports/lib/agent/types";
import type { ProposedAction, CopilotHistoryMessage } from "./types";

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

/**
 * Load a conversation as read-only messages for the panel to replay on reopen.
 * Result rows are not persisted, so an answer-turn becomes its assistant text
 * plus a "returned a table" note, and a proposal-turn carries a count note
 * rather than re-mounting live (and now-stale) confirm cards.
 */
export async function loadCopilotHistory(
  conversationId: string | undefined,
  userId: string,
): Promise<CopilotHistoryMessage[]> {
  if (!conversationId) return [];

  const rows = await prisma.copilotTurn.findMany({
    where: { conversationId, userId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { question: true, assistantText: true, sql: true, proposedActions: true },
  });

  const messages: CopilotHistoryMessage[] = [];
  for (const r of rows) {
    messages.push({ role: "user", text: r.question });
    const proposed = Array.isArray(r.proposedActions)
      ? (r.proposedActions as unknown[])
      : null;
    let note: string | undefined;
    if (proposed && proposed.length > 0) {
      note = `Proposed ${proposed.length} action${proposed.length === 1 ? "" : "s"} (confirm again if still needed)`;
    } else if (r.sql) {
      note = "Returned a table earlier (not re-shown)";
    }
    const text = r.assistantText || (r.sql ? "Returned results." : "");
    messages.push({ role: "assistant", text, ...(note ? { note } : {}) });
  }
  return messages;
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
