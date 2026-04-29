import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { loadPriorTurns, saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";
import { editActionToMessage } from "@/features/reports/lib/edit-action-to-message";
import type { EditRequest } from "@/features/reports/lib/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: EditRequest;
  try {
    body = (await request.json()) as EditRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }
  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const message = editActionToMessage(body.action);
  const anthropic = getAnthropic();
  const priorTurns = await loadPriorTurns(body.conversationId, user.id);

  const result = await runAgentLoop({
    anthropic,
    userMessage: message,
    priorTurns,
    userId: user.id,
  });

  if (result.kind === "result") {
    await saveTurn({
      userId: user.id,
      conversationId: body.conversationId,
      question: message,
      sql: result.sql,
      summary: result.summary,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs,
    });
    return NextResponse.json({
      conversationId: body.conversationId,
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

  await saveTurn({
    userId: user.id,
    conversationId: body.conversationId,
    question: message,
    error: result.text,
  });
  return NextResponse.json({
    conversationId: body.conversationId,
    assistantText: result.text,
    result: null,
  });
}
