import type Anthropic from "@anthropic-ai/sdk";
import { handleListTables } from "@/features/reports/lib/tools/list-tables";
import { handleDescribeTable } from "@/features/reports/lib/tools/describe-table";
import { handleSearchMetadata } from "@/features/reports/lib/tools/search-metadata";
import { handleGetColumnValues } from "@/features/reports/lib/tools/get-column-values";
import { handleCountRows } from "@/features/reports/lib/tools/count-rows";
import { handleSampleRows } from "@/features/reports/lib/tools/sample-rows";
import { handleRunSql, type RunSqlResult } from "@/features/reports/lib/tools/run-sql";
import {
  handleSearchSavedReports,
  handleGetSavedReport,
} from "@/features/reports/lib/tools/saved-reports";
import { AGENT_TOOLS, RUN_SQL_TOOL_NAME } from "./tool-definitions";
import { buildSystemPrompt } from "./system-prompt";
import type { PriorTurn } from "./conversation";
import {
  MAX_EXPLORATORY_CALLS_PER_TURN,
  MAX_GHOST_REPORT_RETRIES,
  MAX_SQL_RETRIES,
  ZERO_USAGE,
  addUsage,
  type QuerySummary,
  type TokenUsage,
  type TurnEvent,
} from "./types";

/**
 * Agent variant — controls which terminal tool(s) the loop expects and which
 * result variant the loop produces. The default 'reports' preserves the
 * original behavior; 'list-builder' is used by the saved-views AI list
 * builder route; 'copilot' is the write-capable cross-app assistant, which is
 * the one variant with TWO terminal tools — `run_sql` (answer-a-question turns,
 * reused verbatim from reports) and a custom `propose_actions` terminal (write
 * proposals). The loop picks the path by the called tool's name, not by variant.
 */
export type AgentVariant = "reports" | "list-builder" | "copilot";

/**
 * Generic terminal-tool config. When passed to runAgentLoop, the loop
 * substitutes this tool for the default `run_sql`. The handler returns a
 * structured payload (kind 'ok' = terminate; 'error' / 'validation_error'
 * = retry within the SQL-retry budget).
 */
export interface TerminalToolConfig<TInput, TOk> {
  /** Tool name — must match the name the model will call. */
  name: string;
  /**
   * Handler invoked when the model calls the terminal tool. Returns a
   * RunSqlResult-shaped value; the loop interprets `kind === 'ok'` as
   * "stream `ok.result` back as a final result event and exit".
   */
  handle: (input: TInput, userMessage: string) => Promise<TerminalToolResult<TOk>>;
}

export type TerminalToolResult<TOk> =
  | { kind: "ok"; result: TOk }
  | { kind: "error"; message: string }
  | { kind: "validation_error"; errors: string[] };

export interface AgentTelemetry {
  events: TurnEvent[];
  usage: TokenUsage;
}

export type AgentResult<TTerminal = unknown> = AgentTelemetry &
  (
    | {
        kind: "result";
        sql: string;
        summary: QuerySummary;
        columns: string[];
        rows: Array<Record<string, unknown>>;
        rowCount: number;
        executionTimeMs: number;
        assistantText: string;
      }
    | {
        /**
         * Terminal-tool result for the 'list-builder' variant (and any future
         * variant whose terminal tool is not `run_sql`). The shape of
         * `terminalResult` is whatever the terminal-tool handler returned.
         */
        kind: "terminal_result";
        terminalResult: TTerminal;
        assistantText: string;
      }
    | { kind: "clarifying"; text: string }
    | { kind: "surrender"; text: string }
  );

interface RunAgentLoopArgs<TTerminal = unknown> {
  anthropic: Anthropic;
  userMessage: string;
  priorTurns: PriorTurn[];
  userId: string;
  conversationId?: string;
  /**
   * Optional streaming callback. Invoked once per `TurnEvent` as the loop
   * produces it, in the same order they appear in the final
   * `result.events` array. Streaming callers (the SSE chat route) use this
   * to push events to the client in real time. Non-streaming callers can
   * ignore it — the synchronous return shape is unchanged.
   */
  onEvent?: (event: TurnEvent) => void;
  /**
   * Agent variant — controls system prompt selection and the terminal-tool
   * shape. Defaults to 'reports' for backwards compatibility.
   */
  agentVariant?: AgentVariant;
  /**
   * Optional override for the system prompt. When omitted, the reports
   * variant builds the standard prompt; list-builder must supply one.
   */
  systemPrompt?: string;
  /**
   * Optional override for the tool set. When omitted, the reports variant
   * uses AGENT_TOOLS; list-builder must supply its own (read-only schema
   * introspection + emit_list_spec). The copilot passes BetaToolUnion[] so
   * the agent loop accepts the wider union; callers using the beta messages
   * path cast accordingly at the call site.
   */
  tools?: Anthropic.Tool[] | Anthropic.Beta.BetaToolUnion[];
  /**
   * Optional terminal-tool config. When provided, the loop substitutes the
   * default `run_sql` terminal for this one. The 'reports' variant ignores
   * this and keeps `run_sql`; 'list-builder' requires it.
   */
  terminalTool?: TerminalToolConfig<unknown, TTerminal>;
  /**
   * Optional handler for exploratory (non-terminal) tools. When omitted,
   * the loop uses the built-in reports dispatcher (list_tables /
   * describe_table / search_metadata / etc.). List-builder supplies its own
   * read-only dispatcher (describe_entity / sample_values).
   */
  exploratoryToolHandler?: (
    toolUse: Anthropic.ToolUseBlock,
    userId: string,
  ) => Promise<string>;
  /**
   * Optional `output_config.effort` (Opus 4.7). Omitted → the model's default
   * (`high`). The copilot passes `medium`: its turns are id lookups + a
   * propose, or a single run_sql — rarely reasoning-bound — so lower effort
   * cuts per-iteration latency. Reports/list-builder leave it unset so their
   * reasoning depth is unchanged.
   */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

// Set AGENT_LOOP_DIAG=1 in the deployment env to capture full system-prompt +
// messages + per-iteration responses every time the loop returns a non-result
// outcome (clarifying / surrender). Used to root-cause the rare bug where the
// agent answers a normal data question with a fabricated "the database is
// down" message and zero tool_use blocks. Disabled by default — output is
// large and only useful when investigating live failures.
const DIAG_ENABLED = process.env.AGENT_LOOP_DIAG === "1";

interface IterationDiag {
  stopReason: string | null;
  blocks: Array<{ type: string; name?: string; id?: string }>;
}

function extractUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
): TokenUsage {
  const u = raw ?? {};
  return {
    inputTokens: typeof u.input_tokens === "number" ? u.input_tokens : 0,
    outputTokens: typeof u.output_tokens === "number" ? u.output_tokens : 0,
    cacheCreationInputTokens:
      typeof u.cache_creation_input_tokens === "number"
        ? u.cache_creation_input_tokens
        : 0,
    cacheReadInputTokens:
      typeof u.cache_read_input_tokens === "number"
        ? u.cache_read_input_tokens
        : 0,
  };
}

// Detects a SQL code fence in assistant text — the signature of a "ghost
// report" turn where the model wrote SQL in prose instead of calling run_sql.
// Matches ```sql ... ``` (case-insensitive) and bare ``` ... ``` blocks
// containing SELECT/INSERT/UPDATE/DELETE/WITH at the start of a line.
function containsSqlFence(text: string): boolean {
  if (!text) return false;
  if (/```sql/i.test(text)) return true;
  // Bare fences with a SQL-looking opener
  const bareFence = /```\s*\n\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
  return bareFence.test(text);
}

// Places a single rolling prompt-cache breakpoint on the tail of the
// conversation prefix so each agent-loop iteration reads the prior
// tool_results (and replayed prior turns) from cache instead of reprocessing
// them at full input price. The large static prefix (tools + system) is cached
// separately via the system block's 1h breakpoint; this one moves forward each
// iteration as tool_results accumulate. Anchored on the last *array-content*
// message's final block — trailing string messages (the user question) are a
// tiny, uncacheable suffix. Clearing prior breakpoints first keeps the count at
// system(1) + conversation(1) = 2, within the 4-breakpoint cap.
function markConversationCacheBreakpoint(messages: Anthropic.MessageParam[]): void {
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block && typeof block === "object" && "cache_control" in block) {
        delete (block as { cache_control?: unknown }).cache_control;
      }
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content;
    if (Array.isArray(content) && content.length > 0) {
      const lastBlock = content[content.length - 1];
      if (lastBlock && typeof lastBlock === "object") {
        (lastBlock as { cache_control?: Anthropic.CacheControlEphemeral }).cache_control = {
          type: "ephemeral",
        };
      }
      return;
    }
  }
}

export async function runAgentLoop<TTerminal = unknown>(
  args: RunAgentLoopArgs<TTerminal>,
): Promise<AgentResult<TTerminal>> {
  const {
    anthropic,
    userMessage,
    priorTurns,
    userId,
    conversationId,
    onEvent,
    agentVariant = "reports",
    systemPrompt: systemPromptOverride,
    tools: toolsOverride,
    terminalTool,
    exploratoryToolHandler,
    effort,
  } = args;
  // Which tool name(s) terminate the loop. Reports keeps the historical
  // `run_sql`. List-builder uses whatever the caller passed in (typically
  // `emit_list_spec`). Copilot is the only variant with two terminals: the
  // reused `run_sql` (answers) AND the caller's `terminalTool` (propose_actions).
  const isTerminalTool = (name: string): boolean => {
    if (agentVariant === "copilot") {
      return name === RUN_SQL_TOOL_NAME || name === terminalTool?.name;
    }
    if (agentVariant === "list-builder") {
      return name === (terminalTool?.name ?? RUN_SQL_TOOL_NAME);
    }
    return name === RUN_SQL_TOOL_NAME;
  };

  // Replay prior turns as tool_use/tool_result pairs (not Markdown SQL blocks)
  // so the model sees structured execution it can't mimic in plain-text replies.
  // The old "SQL used (server-side only, not shown to user)" template was being
  // copied into user-facing chat text by the model.
  const history: Anthropic.MessageParam[] = [];
  for (const t of priorTurns) {
    history.push({ role: "user", content: t.question });
    if (t.sql) {
      const priorToolUseId = `prior_${t.createdAt.getTime()}`;
      const summaryForReplay: QuerySummary = t.summary ?? {
        source: t.question.slice(0, 200),
      };
      const assistantBlocks: Anthropic.ContentBlockParam[] = [];
      if (t.assistantText) {
        assistantBlocks.push({ type: "text", text: t.assistantText });
      }
      assistantBlocks.push({
        type: "tool_use",
        id: priorToolUseId,
        name: RUN_SQL_TOOL_NAME,
        input: { sql: t.sql, summary: summaryForReplay },
      });
      history.push({ role: "assistant", content: assistantBlocks });
      history.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: priorToolUseId,
            content: `run_sql ok — ${summaryForReplay.source}`,
          },
        ],
      });
    } else if (t.assistantText) {
      history.push({ role: "assistant", content: t.assistantText });
    }
  }
  history.push({ role: "user", content: userMessage });

  // System prompt: reports uses the default builder. List-builder must supply
  // a complete prompt (the entity-schema + filter-tree-shape rules differ
  // enough that reusing the SQL-flavored prompt would be misleading).
  const systemPrompt =
    systemPromptOverride ?? (await buildSystemPrompt(priorTurns));
  const toolSet = toolsOverride ?? AGENT_TOOLS;

  let sqlRetriesUsed = 0;
  let ghostReportRetriesUsed = 0;
  let exploratoryCalls = 0;
  let assistantText = "";
  let iteration = 0;
  const events: TurnEvent[] = [];
  // Push helper that also forwards to the streaming callback. Keeps the
  // collected `events` array and the SSE stream in lockstep — same payload,
  // same order — so the non-streaming return value matches what the client
  // already saw.
  const pushEvent = (e: TurnEvent): void => {
    events.push(e);
    onEvent?.(e);
  };
  let totalUsage: TokenUsage = { ...ZERO_USAGE };
  const messages: Anthropic.MessageParam[] = [...history];
  const iterations: IterationDiag[] = [];

  const logDiag = (
    reason: "no_tools" | "sql_retries_exhausted" | "exploration_cap",
    kind: AgentResult["kind"],
    finalText: string,
  ): void => {
    if (!DIAG_ENABLED) return;
    console.warn(
      "[AGENT-DIAG] " +
        JSON.stringify({
          ts: new Date().toISOString(),
          conversationId: conversationId ?? null,
          userId,
          kind,
          reason,
          sqlRetriesUsed,
          exploratoryCalls,
          finalAssistantText: finalText,
          iterations,
          systemPrompt,
          messagesSent: messages,
        }),
    );
  };

  while (true) {
    iteration++;
    markConversationCacheBreakpoint(messages);
    // Stream the call so assistant text reaches the client token-by-token
    // (the loop logic below is unchanged — `finalMessage()` yields the same
    // full Message that `create()` returned). `text_delta` events are emitted
    // before this iteration's terminal `model_call` event.
    const modelStream = anthropic.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      ...(effort ? { output_config: { effort } } : {}),
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } }],
      tools: toolSet as Anthropic.Tool[],
      messages,
    });
    modelStream.on("text", (delta) => {
      if (delta) pushEvent({ kind: "text_delta", iteration, delta });
    });
    const response = await modelStream.finalMessage();

    const callUsage = extractUsage((response as { usage?: unknown }).usage);
    totalUsage = addUsage(totalUsage, callUsage);

    if (DIAG_ENABLED) {
      iterations.push({
        stopReason: (response as { stop_reason?: string | null }).stop_reason ?? null,
        blocks: response.content.map((b) => {
          const entry: { type: string; name?: string; id?: string } = { type: b.type };
          if (b.type === "tool_use") {
            entry.name = b.name;
            entry.id = b.id;
          }
          return entry;
        }),
      });
    }

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const turnText = textBlocks.map((b) => b.text).join("\n");
    if (textBlocks.length > 0) {
      assistantText += (assistantText ? "\n" : "") + turnText;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    pushEvent({
      kind: "model_call",
      iteration,
      stopReason: (response as { stop_reason?: string | null }).stop_reason ?? null,
      usage: callUsage,
      assistantText: turnText || null,
      toolUses: toolUses.map((t) => ({ id: t.id, name: t.name, input: t.input })),
    });

    if (toolUses.length === 0) {
      const text = assistantText || "(no text)";

      // Ghost-report detection: model wrote SQL in text without calling
      // run_sql. Inject a corrective user-turn message and let the loop
      // continue — gives the model one chance to invoke the tool properly.
      // Only applicable to the reports variant; list-builder doesn't emit
      // SQL fences in practice.
      if (
        agentVariant === "reports" &&
        containsSqlFence(text) &&
        ghostReportRetriesUsed < MAX_GHOST_REPORT_RETRIES
      ) {
        ghostReportRetriesUsed++;
        // Reset assistantText so the ghost turn's SQL prose doesn't leak
        // into the user-visible output if the retry succeeds.
        assistantText = "";
        const corrective =
          "You wrote SQL in a text block but did not call `run_sql`. " +
          "The user cannot see SQL — the table only updates when you call " +
          "`run_sql`. Call `run_sql` now with the query you just described.";
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: corrective });
        pushEvent({
          kind: "tool_result",
          toolUseId: "ghost-report-retry",
          toolName: "ghost_report_retry",
          isError: true,
          content: corrective,
        });
        continue; // back to the top of while(true)
      }

      // After ghost-retry exhausted, classify as surrender (real failure)
      // rather than clarifying (chat-only response).
      if (ghostReportRetriesUsed > 0) {
        logDiag("no_tools", "surrender", text);
        return {
          kind: "surrender",
          text,
          events,
          usage: totalUsage,
        };
      }

      logDiag("no_tools", "clarifying", text);
      return {
        kind: "clarifying",
        text,
        events,
        usage: totalUsage,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    // Terminal tool detection — for `reports` variant we look for run_sql; for
    // `list-builder` (or any variant with a custom terminalTool) we look for
    // the configured tool name. Both branches share the same retry budget and
    // tool_result emission shape so SSE consumers can render either uniformly.
    const terminalUse = toolUses.find((t) => isTerminalTool(t.name));
    const terminalToolName = terminalUse?.name ?? RUN_SQL_TOOL_NAME;
    let terminalErrShape:
      | { kind: "error"; message: string }
      | { kind: "validation_error"; errors: string[] }
      | null = null;

    if (terminalUse) {
      // Dispatch by the called tool, not the variant: `run_sql` (reports always,
      // copilot when answering) runs the reused SQL terminal → `result`;
      // anything else (list-builder's emit_list_spec, copilot's propose_actions)
      // runs the custom `terminalTool.handle` → `terminal_result`.
      if (terminalUse.name === RUN_SQL_TOOL_NAME) {
        // Original run_sql path — preserved verbatim so existing behavior is
        // unchanged for the reports caller.
        const input = terminalUse.input as { sql: string; summary: QuerySummary };
        const runSqlResult: RunSqlResult = await handleRunSql(
          input.sql,
          input.summary,
          userMessage,
        );

        if (runSqlResult.kind === "ok") {
          pushEvent({
            kind: "tool_result",
            toolUseId: terminalUse.id,
            toolName: terminalUse.name,
            isError: false,
            content: `run_sql ok — ${runSqlResult.rowCount} row(s) in ${runSqlResult.executionTimeMs}ms`,
          });
          const replyText =
            assistantText ||
            `Found ${runSqlResult.rowCount} row${runSqlResult.rowCount === 1 ? "" : "s"}.`;
          return {
            kind: "result",
            sql: runSqlResult.sql,
            summary: runSqlResult.summary,
            columns: runSqlResult.columns,
            rows: runSqlResult.rows,
            rowCount: runSqlResult.rowCount,
            executionTimeMs: runSqlResult.executionTimeMs,
            assistantText: replyText,
            events,
            usage: totalUsage,
          };
        }

        console.error("[agent-loop] run_sql failed", {
          attempt: sqlRetriesUsed + 1,
          kind: runSqlResult.kind,
          errors:
            runSqlResult.kind === "validation_error"
              ? runSqlResult.errors
              : [runSqlResult.message],
          sql: input.sql,
          summary: input.summary,
        });

        if (sqlRetriesUsed >= MAX_SQL_RETRIES) {
          pushEvent({
            kind: "tool_result",
            toolUseId: terminalUse.id,
            toolName: terminalUse.name,
            isError: true,
            content:
              runSqlResult.kind === "error"
                ? `run_sql error: ${runSqlResult.message}`
                : `run_sql validation failed: ${runSqlResult.errors.join("; ")}`,
          });
          const text =
            assistantText ||
            "I tried a few times but couldn't run that query. Could you tell me more about what you're looking for?";
          logDiag("sql_retries_exhausted", "surrender", text);
          return {
            kind: "surrender",
            text,
            events,
            usage: totalUsage,
          };
        }
        sqlRetriesUsed++;
        terminalErrShape =
          runSqlResult.kind === "error"
            ? { kind: "error", message: runSqlResult.message }
            : { kind: "validation_error", errors: runSqlResult.errors };
      } else {
        // List-builder (or any future) variant — call the supplied terminal
        // handler. Same retry budget (MAX_SQL_RETRIES) — list-builder errors
        // are usually unknown-field / scope misconfig, which the model can
        // correct in one retry.
        if (!terminalTool) {
          throw new Error(
            `agentVariant '${agentVariant}' requires a terminalTool config.`,
          );
        }
        const terminalResult = await terminalTool.handle(
          terminalUse.input,
          userMessage,
        );

        if (terminalResult.kind === "ok") {
          pushEvent({
            kind: "tool_result",
            toolUseId: terminalUse.id,
            toolName: terminalUse.name,
            isError: false,
            content: `${terminalToolName} ok`,
          });
          const replyText = assistantText || "Done.";
          return {
            kind: "terminal_result",
            terminalResult: terminalResult.result,
            assistantText: replyText,
            events,
            usage: totalUsage,
          };
        }

        console.error(`[agent-loop] ${terminalToolName} failed`, {
          attempt: sqlRetriesUsed + 1,
          kind: terminalResult.kind,
          errors:
            terminalResult.kind === "validation_error"
              ? terminalResult.errors
              : [terminalResult.message],
        });

        if (sqlRetriesUsed >= MAX_SQL_RETRIES) {
          pushEvent({
            kind: "tool_result",
            toolUseId: terminalUse.id,
            toolName: terminalUse.name,
            isError: true,
            content:
              terminalResult.kind === "error"
                ? `${terminalToolName} error: ${terminalResult.message}`
                : `${terminalToolName} validation failed: ${terminalResult.errors.join("; ")}`,
          });
          const text =
            assistantText ||
            "I couldn't complete that after a couple of tries. Could you rephrase?";
          logDiag("sql_retries_exhausted", "surrender", text);
          return {
            kind: "surrender",
            text,
            events,
            usage: totalUsage,
          };
        }
        sqlRetriesUsed++;
        terminalErrShape = terminalResult;
      }
    }

    // Anthropic requires every tool_use in the assistant turn to have a matching
    // tool_result in the next user turn. Process all in one batch.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu === terminalUse && terminalErrShape) {
        const errorText =
          terminalErrShape.kind === "error"
            ? `${terminalToolName} failed: ${terminalErrShape.message}. Please correct and retry.`
            : `${terminalToolName} validation failed:\n${terminalErrShape.errors.join("\n")}\nAdjust and retry.`;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: errorText,
          is_error: true,
        });
        pushEvent({
          kind: "tool_result",
          toolUseId: tu.id,
          toolName: tu.name,
          isError: true,
          content: errorText,
        });
        continue;
      }

      exploratoryCalls++;
      if (exploratoryCalls > MAX_EXPLORATORY_CALLS_PER_TURN) {
        const text =
          "I'm having trouble narrowing this down. Could you give me more details about what you're looking for?";
        logDiag("exploration_cap", "surrender", text);
        return {
          kind: "surrender",
          text,
          events,
          usage: totalUsage,
        };
      }
      const toolResult = exploratoryToolHandler
        ? await exploratoryToolHandler(tu, userId)
        : await executeExploratoryTool(tu, userId);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: toolResult,
      });
      pushEvent({
        kind: "tool_result",
        toolUseId: tu.id,
        toolName: tu.name,
        isError: false,
        content: toolResult,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}

async function executeExploratoryTool(
  toolUse: Anthropic.ToolUseBlock,
  userId: string,
): Promise<string> {
  try {
    const input = toolUse.input as Record<string, unknown>;
    switch (toolUse.name) {
      case "list_tables":
        return await handleListTables();
      case "describe_table":
        return await handleDescribeTable(String(input.table));
      case "search_metadata":
        return await handleSearchMetadata(String(input.query));
      case "get_column_values":
        return await handleGetColumnValues(
          String(input.table),
          String(input.column),
          typeof input.limit === "number" ? input.limit : undefined,
        );
      case "count_rows":
        return await handleCountRows(
          String(input.from_sql),
          typeof input.where_sql === "string" ? input.where_sql : undefined,
        );
      case "sample_rows":
        return await handleSampleRows(String(input.sql));
      case "search_saved_reports":
        return await handleSearchSavedReports(String(input.query), userId);
      case "get_saved_report":
        return await handleGetSavedReport(Number(input.id), userId);
      default:
        return `Unknown tool: ${toolUse.name}`;
    }
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
