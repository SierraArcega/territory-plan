import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import {
  runAgentLoop,
  type TerminalToolResult,
} from "@/features/reports/lib/agent/agent-loop";
import {
  EMIT_LIST_SPEC_TOOL_NAME,
  LIST_BUILDER_TOOLS,
  type EmitListSpecInput,
} from "@/features/views/lib/ai-list-builder/tools";
import { buildListBuilderSystemPrompt } from "@/features/views/lib/ai-list-builder/system-prompt";
import { listBuilderExploratoryHandler } from "@/features/views/lib/ai-list-builder/handlers";
import { listSpecSchema } from "@/lib/saved-views/schema";
import { FILTER_TREE_SCHEMA_VERSION } from "@/lib/saved-views/filter-tree";
import { validateFilterTree } from "@/lib/saved-views/sql-compiler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function encodeSse(event: string, data: unknown): Uint8Array {
  const payload = JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

interface AiBuildRequestBody {
  prompt: string;
}

/**
 * POST /api/lists/ai-build  (SSE)
 *
 * Streams trace events from the list-builder agent variant, terminating with
 * a final `result` event containing the structured ListSpec produced by the
 * model's `emit_list_spec` call.
 *
 * Body: { prompt: string }
 *
 * Events:
 *   - `turn_event` — agent-loop TurnEvents (model_call, tool_result)
 *   - `result`     — { listSpec, name } on success, or { error } on failure
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: AiBuildRequestBody;
  try {
    body = (await request.json()) as AiBuildRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!body?.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const anthropic = getAnthropic();
  const systemPrompt = buildListBuilderSystemPrompt();
  const userId = user.id;
  const prompt = body.prompt;

  // Terminal-tool handler: validates the model's emit_list_spec input against
  // our Zod schema + field allowlist. On success, returns the structured spec
  // for the route to stream to the client.
  const terminalHandle = async (
    input: unknown,
  ): Promise<TerminalToolResult<{ source: string; filterTree: unknown; scope: unknown; name: string }>> => {
    const raw = (input ?? {}) as Partial<EmitListSpecInput>;
    if (typeof raw.source !== "string" || raw.source.length === 0) {
      return {
        kind: "validation_error",
        errors: ["source is required and must be one of the six list sources."],
      };
    }
    if (typeof raw.name !== "string" || raw.name.length === 0) {
      return { kind: "validation_error", errors: ["name is required."] };
    }
    // Validate the spec shape (schemaVersion is added here — the model
    // doesn't need to know about the wire-level version field).
    const parsed = listSpecSchema.safeParse({
      schemaVersion: FILTER_TREE_SCHEMA_VERSION,
      source: raw.source,
      filterTree: raw.filterTree,
      scope: raw.scope,
    });
    if (!parsed.success) {
      return {
        kind: "validation_error",
        errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }
    // Allowlist field/op check — same as the preview endpoint, surfaces a
    // structured error so the model can retry within the SQL-retry budget.
    const fieldErr = validateFilterTree(parsed.data.source, parsed.data.filterTree);
    if (fieldErr) {
      return { kind: "validation_error", errors: [fieldErr] };
    }
    if (parsed.data.scope.mode === "rules") {
      const scopeErr = validateFilterTree("districts", parsed.data.scope.filterTree);
      if (scopeErr) {
        return { kind: "validation_error", errors: [`Scope: ${scopeErr}`] };
      }
    }
    return {
      kind: "ok",
      result: {
        source: parsed.data.source,
        filterTree: parsed.data.filterTree,
        scope: parsed.data.scope,
        name: raw.name.trim().slice(0, 200),
      },
    };
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
        const result = await runAgentLoop({
          anthropic,
          userMessage: prompt,
          priorTurns: [],
          userId,
          onEvent: (e) => send("turn_event", e),
          agentVariant: "list-builder",
          systemPrompt,
          tools: LIST_BUILDER_TOOLS,
          terminalTool: {
            name: EMIT_LIST_SPEC_TOOL_NAME,
            handle: terminalHandle,
          },
          exploratoryToolHandler: (toolUse) => listBuilderExploratoryHandler(toolUse),
        });

        if (result.kind === "terminal_result") {
          send("result", {
            kind: "ok",
            listSpec: {
              schemaVersion: FILTER_TREE_SCHEMA_VERSION,
              source: result.terminalResult.source,
              filterTree: result.terminalResult.filterTree,
              scope: result.terminalResult.scope,
            },
            name: result.terminalResult.name,
            assistantText: result.assistantText,
          });
        } else if (result.kind === "clarifying") {
          send("result", {
            kind: "clarifying",
            text: result.text,
          });
        } else if (result.kind === "surrender") {
          send("result", {
            kind: "error",
            error: result.text,
          });
        } else {
          // result.kind === "result" — unreachable; list-builder doesn't use
          // run_sql, but guarded for completeness.
          send("error", { error: "Unexpected result kind from list-builder agent." });
        }
      } catch (err) {
        console.error("[lists/ai-build] agent loop failed", err);
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
