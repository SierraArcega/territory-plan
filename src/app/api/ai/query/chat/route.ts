import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { loadPriorTurns, saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";
import type { ChatRequest, TurnEvent } from "@/features/reports/lib/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Sentinel for query_log.error when the agent surrendered without a recoverable
// SQL error (e.g. exploration cap, agent declined to attempt SQL). Distinguishes
// real failures from the agent giving up so dashboards can quantify both.
const SURRENDER_NO_SQL_SENTINEL = "agent_surrender_no_sql_error";

// Walk events backwards looking for the most recent failed tool_result. Lets
// surrenders surface the actual underlying SQL error in query_log.error
// instead of the opaque sentinel — better for triage.
function lastFailedToolError(events: TurnEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "tool_result" && e.isError) return e.content;
  }
  return null;
}

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

  // Persist the turn for history and observability. Never let a logging failure
  // cost the user their result — log and continue.
  try {
    if (result.kind === "result") {
      await saveTurn({
        userId: user.id,
        conversationId,
        question: body.message,
        sql: result.sql,
        summary: result.summary,
        assistantText: result.assistantText,
        events: result.events,
        usage: result.usage,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
      });
    } else {
      // clarifying turns leave error null. Surrenders prefer the real SQL
      // error from events; if none recoverable, fall back to the sentinel.
      const error =
        result.kind === "surrender"
          ? (lastFailedToolError(result.events) ?? SURRENDER_NO_SQL_SENTINEL)
          : undefined;
      await saveTurn({
        userId: user.id,
        conversationId,
        question: body.message,
        assistantText: result.text,
        events: result.events,
        usage: result.usage,
        error,
      });
    }
  } catch (err) {
    console.error("[chat route] saveTurn failed", err);
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
