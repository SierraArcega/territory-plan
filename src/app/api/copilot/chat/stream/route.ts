import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import {
  runAgentLoop,
  type TerminalToolResult,
} from "@/features/reports/lib/agent/agent-loop";
import { COPILOT_TOOLS, PROPOSE_ACTIONS_TOOL_NAME } from "@/features/copilot/lib/tools";
import { buildCopilotSystemPrompt } from "@/features/copilot/lib/system-prompt";
import {
  loadCopilotPriorTurns,
  saveCopilotTurn,
} from "@/features/copilot/lib/conversation";
import { getAction } from "@/features/copilot/lib/action-registry";
import { withPageContext } from "@/features/copilot/lib/page-context";
import type {
  CopilotChatRequest,
  ProposedAction,
  ProposedActionsResult,
} from "@/features/copilot/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function encodeSse(event: string, data: unknown): Uint8Array {
  const payload = JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

/**
 * POST /api/copilot/chat/stream (SSE)
 *
 * One copilot turn. Streams agent-loop trace events, then a terminal `result`
 * that is either an `answer` (run_sql rows), `actions` (proposed cards for the
 * rep to confirm), or `clarifying`. Nothing is written here — writes happen via
 * /api/copilot/actions/execute after the rep confirms.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: CopilotChatRequest;
  try {
    body = (await request.json()) as CopilotChatRequest;
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
  const userId = user.id;
  const question = body.message;
  const priorTurns = await loadCopilotPriorTurns(conversationId, userId);
  const userMessage = withPageContext(question, body.pageContext);
  const systemPrompt = await buildCopilotSystemPrompt({ id: userId, email: user.email });

  // propose_actions terminal: validate each proposed action against the registry
  // and build confirm cards. Validation errors come back as a structured retry
  // so the model can self-correct within the loop's retry budget.
  const proposeHandle = async (
    input: unknown,
  ): Promise<TerminalToolResult<ProposedActionsResult>> => {
    const raw = (input ?? {}) as { actions?: unknown };
    if (!Array.isArray(raw.actions) || raw.actions.length === 0) {
      return { kind: "validation_error", errors: ["Provide a non-empty `actions` array."] };
    }
    const proposedActions: ProposedAction[] = [];
    const errors: string[] = [];
    for (let i = 0; i < raw.actions.length; i++) {
      const a = (raw.actions[i] ?? {}) as {
        objectType?: string;
        operation?: string;
        targetId?: string | number | null;
        summary?: string;
        fields?: unknown;
      };
      const action = getAction(a.objectType ?? "", a.operation ?? "");
      if (!action) {
        errors.push(`actions[${i}]: unknown action "${a.objectType}.${a.operation}".`);
        continue;
      }
      const hasTarget = a.targetId !== undefined && a.targetId !== null && a.targetId !== "";
      if (action.needsTarget && !hasTarget) {
        errors.push(
          `actions[${i}]: ${action.objectType}.${action.operation} requires a targetId.`,
        );
        continue;
      }
      const parsed = action.parse(a.fields ?? {});
      if (!parsed.ok) {
        errors.push(...parsed.errors.map((e) => `actions[${i}].${e}`));
        continue;
      }
      // Propose-time existence checks (e.g. district leaids actually exist) so a
      // doomed card never reaches the rep — the model self-corrects on the error.
      if (action.validate) {
        const vErrors = await action.validate(parsed.fields, { userId, db: prisma });
        if (vErrors.length > 0) {
          errors.push(...vErrors.map((e) => `actions[${i}]: ${e}`));
          continue;
        }
      }
      proposedActions.push({
        id: randomUUID(),
        objectType: action.objectType,
        operation: action.operation,
        targetId: hasTarget ? (a.targetId as string | number) : null,
        fields: parsed.fields as Record<string, unknown>,
        preview: action.buildPreview(parsed.fields, {
          targetId: a.targetId ?? null,
          summary: a.summary,
        }),
        clientAction: action.clientAction,
      });
    }
    if (errors.length > 0) {
      return { kind: "validation_error", errors };
    }
    return { kind: "ok", result: { proposedActions } };
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        try {
          controller.enqueue(encodeSse(event, data));
        } catch {
          // Stream closed.
        }
      };
      try {
        controller.enqueue(new TextEncoder().encode(": stream-open\n\n"));
      } catch {
        // Closed before first byte.
      }

      try {
        const result = await runAgentLoop<ProposedActionsResult>({
          anthropic,
          userMessage,
          priorTurns,
          userId,
          conversationId,
          onEvent: (e) => send("turn_event", e),
          agentVariant: "copilot",
          systemPrompt,
          tools: COPILOT_TOOLS,
          terminalTool: { name: PROPOSE_ACTIONS_TOOL_NAME, handle: proposeHandle },
        });

        // Persist the turn — failures must not block the terminal SSE event.
        try {
          if (result.kind === "result") {
            await saveCopilotTurn({
              userId,
              conversationId,
              question,
              assistantText: result.assistantText,
              sql: result.sql,
              summary: result.summary,
              events: result.events,
              usage: result.usage,
            });
          } else if (result.kind === "terminal_result") {
            await saveCopilotTurn({
              userId,
              conversationId,
              question,
              assistantText: result.assistantText,
              proposedActions: result.terminalResult.proposedActions,
              events: result.events,
              usage: result.usage,
            });
          } else {
            await saveCopilotTurn({
              userId,
              conversationId,
              question,
              assistantText: result.text,
              events: result.events,
              usage: result.usage,
              error: result.kind === "surrender" ? result.text : undefined,
            });
          }
        } catch (err) {
          console.error("[copilot/chat/stream] saveCopilotTurn failed", err);
        }

        if (result.kind === "result") {
          send("result", {
            kind: "answer",
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
        } else if (result.kind === "terminal_result") {
          send("result", {
            kind: "actions",
            conversationId,
            assistantText: result.assistantText,
            proposedActions: result.terminalResult.proposedActions,
          });
        } else {
          send("result", {
            kind: "clarifying",
            conversationId,
            assistantText: result.text,
          });
        }
      } catch (err) {
        console.error("[copilot/chat/stream] agent loop failed", err);
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
      "x-accel-buffering": "no",
    },
  });
}
