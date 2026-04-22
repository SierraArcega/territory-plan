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
  type QuerySummary,
} from "./types";

export type AgentResult =
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
  | { kind: "surrender"; text: string };

interface RunAgentLoopArgs {
  anthropic: Anthropic;
  userMessage: string;
  priorTurns: PriorTurn[];
  userId: string;
}

export async function runAgentLoop(args: RunAgentLoopArgs): Promise<AgentResult> {
  const { anthropic, userMessage, priorTurns, userId } = args;

  const history: Anthropic.MessageParam[] = [];
  for (const t of priorTurns) {
    history.push({ role: "user", content: t.question });
    if (t.summary) {
      history.push({
        role: "assistant",
        content: `[Previous turn result — ${t.summary.source}, ${t.summary.filters.length} filters, ${t.summary.columns.length} columns, limit ${t.summary.limit}]`,
      });
    }
  }
  history.push({ role: "user", content: userMessage });

  const systemPrompt = buildSystemPrompt();

  let sqlRetriesUsed = 0;
  let exploratoryCalls = 0;
  let assistantText = "";
  const messages: Anthropic.MessageParam[] = [...history];

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: AGENT_TOOLS,
      messages,
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (textBlocks.length > 0) {
      assistantText += (assistantText ? "\n" : "") + textBlocks.map((b) => b.text).join("\n");
    }

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUse) {
      return { kind: "clarifying", text: assistantText || "(no text)" };
    }

    messages.push({ role: "assistant", content: response.content });

    if (toolUse.name === RUN_SQL_TOOL_NAME) {
      const input = toolUse.input as { sql: string; summary: QuerySummary };
      const runResult: RunSqlResult = await handleRunSql(input.sql, input.summary);

      if (runResult.kind === "ok") {
        return {
          kind: "result",
          sql: runResult.sql,
          summary: runResult.summary,
          columns: runResult.columns,
          rows: runResult.rows,
          rowCount: runResult.rowCount,
          executionTimeMs: runResult.executionTimeMs,
          assistantText,
        };
      }

      if (sqlRetriesUsed >= MAX_SQL_RETRIES) {
        return {
          kind: "surrender",
          text:
            assistantText ||
            "I tried a few times but couldn't run that query. Could you tell me more about what you're looking for?",
        };
      }
      sqlRetriesUsed++;
      const errorText =
        runResult.kind === "error"
          ? `run_sql failed: ${runResult.message}. Please correct the query and retry.`
          : `run_sql validation failed:\n${runResult.errors.join("\n")}\nAdjust and retry.`;
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: errorText, is_error: true }],
      });
      continue;
    }

    exploratoryCalls++;
    if (exploratoryCalls > MAX_EXPLORATORY_CALLS_PER_TURN) {
      return {
        kind: "surrender",
        text:
          "I'm having trouble narrowing this down. Could you give me more details about what you're looking for?",
      };
    }

    const toolResult = await executeExploratoryTool(toolUse, userId);
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }],
    });
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
