// src/features/reports/lib/agent/types.ts

/** Rep-friendly description of the query shown above the results table. */
export interface QuerySummary {
  /** One-line description, e.g. "Open-pipeline opportunities stuck > 90 days in current stage". */
  source: string;
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
