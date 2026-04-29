import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { loadPriorTurns, saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";
import type { ChatRequest } from "@/features/reports/lib/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
      await saveTurn({
        userId: user.id,
        conversationId,
        question: body.message,
        assistantText: result.text,
        events: result.events,
        usage: result.usage,
        error: result.text,
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
