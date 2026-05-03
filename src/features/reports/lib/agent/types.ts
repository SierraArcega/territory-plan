// src/features/reports/lib/agent/types.ts

/** Rep-friendly description of the query shown above the results table. */
export interface QuerySummary {
  /** One-line description, e.g. "Open-pipeline opportunities stuck > 90 days in current stage". */
  source: string;
  /**
   * Human-readable filter clauses applied, one per element. Used to render the
   * display-only chip strip beneath the result title. Each entry is a complete
   * label like "State: Texas" or "Days in stage > 90". Optional — older saved
   * reports persisted before this field existed will simply render no filter
   * chips.
   */
  filters?: string[];
  /**
   * Ordered list of result columns shown in the chip strip's "COLUMNS" group.
   * Match the order of the SELECT projection. Optional for backward compat.
   */
  columns?: string[];
  /**
   * Human-readable sort description, e.g. "Close date ↓". Null/undefined when
   * no ORDER BY is present.
   */
  sort?: string | null;
  /**
   * Short plain-English label for this run, e.g. "sorted by close date
   * descending". Rendered next to the version pill in the chat gutter and on
   * collapsed-rail tile hover tooltips. Optional — falls back to `v{n}` only.
   */
  versionLabel?: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export type TurnEvent =
  | {
      kind: "model_call";
      iteration: number;
      stopReason: string | null;
      usage: TokenUsage;
      assistantText: string | null;
      toolUses: Array<{ id: string; name: string; input: unknown }>;
    }
  | {
      kind: "tool_result";
      toolUseId: string;
      toolName: string;
      isError: boolean;
      content: string;
    };

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
  };
}

export const MAX_LIMIT = 500;
export const DEFAULT_LIMIT = 100;
export const MAX_EXPLORATORY_CALLS_PER_TURN = 20;
export const MAX_SQL_RETRIES = 2;
export const MAX_GHOST_REPORT_RETRIES = 1;
