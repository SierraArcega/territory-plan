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
  MAX_SQL_RETRIES,
  ZERO_USAGE,
  addUsage,
  type QuerySummary,
  type TokenUsage,
  type TurnEvent,
} from "./types";

export interface AgentTelemetry {
  events: TurnEvent[];
  usage: TokenUsage;
}

export type AgentResult = AgentTelemetry &
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
    | { kind: "clarifying"; text: string }
    | { kind: "surrender"; text: string }
  );

interface RunAgentLoopArgs {
  anthropic: Anthropic;
  userMessage: string;
  priorTurns: PriorTurn[];
  userId: string;
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

export async function runAgentLoop(args: RunAgentLoopArgs): Promise<AgentResult> {
  const { anthropic, userMessage, priorTurns, userId } = args;

  const history: Anthropic.MessageParam[] = [];
  for (const t of priorTurns) {
    history.push({ role: "user", content: t.question });
    const blocks: string[] = [];
    if (t.summary?.source) blocks.push(`Source: ${t.summary.source}`);
    if (t.sql) blocks.push(`SQL used (server-side only, not shown to user):\n\`\`\`sql\n${t.sql}\n\`\`\``);
    if (t.assistantText) blocks.push(t.assistantText);
    if (blocks.length > 0) {
      history.push({ role: "assistant", content: blocks.join("\n\n") });
    }
  }
  history.push({ role: "user", content: userMessage });

  const systemPrompt = await buildSystemPrompt(priorTurns);

  let sqlRetriesUsed = 0;
  let exploratoryCalls = 0;
  let assistantText = "";
  let iteration = 0;
  const events: TurnEvent[] = [];
  let totalUsage: TokenUsage = { ...ZERO_USAGE };
  const messages: Anthropic.MessageParam[] = [...history];

  while (true) {
    iteration++;
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: AGENT_TOOLS,
      messages,
    });

    const callUsage = extractUsage((response as { usage?: unknown }).usage);
    totalUsage = addUsage(totalUsage, callUsage);

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

    events.push({
      kind: "model_call",
      iteration,
      stopReason: (response as { stop_reason?: string | null }).stop_reason ?? null,
      usage: callUsage,
      assistantText: turnText || null,
      toolUses: toolUses.map((t) => ({ id: t.id, name: t.name, input: t.input })),
    });

    if (toolUses.length === 0) {
      return {
        kind: "clarifying",
        text: assistantText || "(no text)",
        events,
        usage: totalUsage,
      };
    }

    messages.push({ role: "assistant", content: response.content });

    const runSqlUse = toolUses.find((t) => t.name === RUN_SQL_TOOL_NAME);
    let runSqlResult: RunSqlResult | null = null;
    if (runSqlUse) {
      const input = runSqlUse.input as { sql: string; summary: QuerySummary };
      runSqlResult = await handleRunSql(input.sql, input.summary);

      if (runSqlResult.kind === "ok") {
        events.push({
          kind: "tool_result",
          toolUseId: runSqlUse.id,
          toolName: runSqlUse.name,
          isError: false,
          content: `run_sql ok — ${runSqlResult.rowCount} row(s) in ${runSqlResult.executionTimeMs}ms`,
        });
        return {
          kind: "result",
          sql: runSqlResult.sql,
          summary: runSqlResult.summary,
          columns: runSqlResult.columns,
          rows: runSqlResult.rows,
          rowCount: runSqlResult.rowCount,
          executionTimeMs: runSqlResult.executionTimeMs,
          assistantText,
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
        events.push({
          kind: "tool_result",
          toolUseId: runSqlUse.id,
          toolName: runSqlUse.name,
          isError: true,
          content:
            runSqlResult.kind === "error"
              ? `run_sql error: ${runSqlResult.message}`
              : `run_sql validation failed: ${runSqlResult.errors.join("; ")}`,
        });
        return {
          kind: "surrender",
          text:
            assistantText ||
            "I tried a few times but couldn't run that query. Could you tell me more about what you're looking for?",
          events,
          usage: totalUsage,
        };
      }
      sqlRetriesUsed++;
    }

    // Anthropic requires every tool_use in the assistant turn to have a matching
    // tool_result in the next user turn. Process all in one batch.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu === runSqlUse && runSqlResult) {
        const errorText =
          runSqlResult.kind === "error"
            ? `run_sql failed: ${runSqlResult.message}. Please correct the query and retry.`
            : `run_sql validation failed:\n${runSqlResult.errors.join("\n")}\nAdjust and retry.`;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: errorText,
          is_error: true,
        });
        events.push({
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
        return {
          kind: "surrender",
          text:
            "I'm having trouble narrowing this down. Could you give me more details about what you're looking for?",
          events,
          usage: totalUsage,
        };
      }
      const toolResult = await executeExploratoryTool(tu, userId);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: toolResult,
      });
      events.push({
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
