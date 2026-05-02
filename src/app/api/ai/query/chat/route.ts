import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { loadPriorTurns, saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";
import type { ChatRequest } from "@/features/reports/lib/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Sentinel for query_log.error when the agent surrendered without a recoverable
// SQL error (e.g. exploration cap, agent declined to attempt SQL). Distinguishes
// real failures from the agent giving up so dashboards can quantify both.
const SURRENDER_NO_SQL_SENTINEL = "agent_surrender_no_sql_error";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.message || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const conversationId = body.conversationId ?? randomUUID();
  const anthropic = getAnthropic();
  const priorTurns = await loadPriorTurns(conversationId, user.id);

  const result = await runAgentLoop({
    anthropic,
    userMessage: body.message,
    priorTurns,
    userId: user.id,
    conversationId,
  });

  if (result.kind === "result") {
    await saveTurn({
      userId: user.id,
      conversationId,
      question: body.message,
      sql: result.sql,
      summary: result.summary,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs,
    });
  } else {
    await saveTurn({
      userId: user.id,
      conversationId,
      question: body.message,
      error:
        result.kind === "surrender" ? SURRENDER_NO_SQL_SENTINEL : undefined,
    });
  }

  if (result.kind === "result") {
    return NextResponse.json({
      conversationId,
      assistantText: result.assistantText,
      result: {
        sql: result.sql,
        summary: result.summary,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
      },
    });
  }

  return NextResponse.json({
    conversationId,
    assistantText: result.text,
    result: null,
  });
}
