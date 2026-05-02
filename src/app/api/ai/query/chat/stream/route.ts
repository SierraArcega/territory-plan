import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { loadPriorTurns, saveTurn } from "@/features/reports/lib/agent/conversation";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";
import type { ChatRequest, TurnEvent } from "@/features/reports/lib/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Sentinel mirrors the non-streaming route — keeps the query_log error column
// shape consistent so dashboards can quantify both kinds of agent surrender.
const SURRENDER_NO_SQL_SENTINEL = "agent_surrender_no_sql_error";

function lastFailedToolError(events: TurnEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "tool_result" && e.isError) return e.content;
  }
  return null;
}

// SSE encoding helper. Standard wire format: `event: <name>\ndata: <json>\n\n`.
// We intentionally keep this tiny — no keepalive ping, no chunk batching — the
// turn is short-lived (typically 5-30s) and Web Streams flush per write.
function encodeSse(event: string, data: unknown): Uint8Array {
  const payload = JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!body?.message || typeof body.message !== "string" || !body.message.trim()) {
    return new Response(JSON.stringify({ error: "Missing message" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const conversationId = body.conversationId ?? randomUUID();
  const anthropic = getAnthropic();
  const priorTurns = await loadPriorTurns(conversationId, user.id);
  const message = body.message;
  const userId = user.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          // Stream already closed (client disconnected) — best-effort.
        }
      };

      try {
        const result = await runAgentLoop({
          anthropic,
          userMessage: message,
          priorTurns,
          userId,
          conversationId,
          onEvent: (e) => send("turn_event", e),
        });

        // Persist the turn for history. saveTurn failures must NOT block the
        // terminal SSE event — log and continue. The client already has the
        // result it needs from the stream.
        try {
          if (result.kind === "result") {
            await saveTurn({
              userId,
              conversationId,
              question: message,
              sql: result.sql,
              summary: result.summary,
              assistantText: result.assistantText,
              events: result.events,
              usage: result.usage,
              rowCount: result.rowCount,
              executionTimeMs: result.executionTimeMs,
            });
          } else {
            const error =
              result.kind === "surrender"
                ? (lastFailedToolError(result.events) ?? SURRENDER_NO_SQL_SENTINEL)
                : undefined;
            await saveTurn({
              userId,
              conversationId,
              question: message,
              assistantText: result.text,
              events: result.events,
              usage: result.usage,
              error,
            });
          }
        } catch (err) {
          console.error("[chat stream route] saveTurn failed", err);
        }

        // Final terminal event — same shape as the non-streaming route's JSON
        // body so the client hook can reuse the existing `ChatTurnResult`.
        if (result.kind === "result") {
          send("result", {
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
        } else {
          send("result", {
            conversationId,
            assistantText: result.text,
            result: null,
          });
        }
      } catch (err) {
        console.error("[chat stream route] agent loop failed", err);
        send("error", {
          error: err instanceof Error ? err.message : "Internal error",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
