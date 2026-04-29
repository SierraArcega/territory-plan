// src/features/reports/lib/agent/types.ts

/** The chip summary Claude returns alongside run_sql. Matches D6 in spec. */
export interface ChipFilter {
  /** Stable id assigned by Claude (used for chip-edit round-trips) */
  id: string;
  /** Human-readable label, e.g. "State" */
  label: string;
  /** Human-readable value, e.g. "Texas" */
  value: string;
  /** Optional operator for non-equality, e.g. ">" for "Bookings > $50K" */
  operator?: string;
}

export interface ChipColumn {
  id: string;
  /** Human-readable column label (from metadata when possible) */
  label: string;
}

export interface ChipSort {
  /** Column label (must match one of `columns[].label`) */
  column: string;
  direction: "asc" | "desc";
}

export interface QuerySummary {
  /** Rep-friendly description of the source, e.g. "Districts with closed-won contracts" */
  source: string;
  filters: ChipFilter[];
  columns: ChipColumn[];
  sort: ChipSort | null;
  limit: number;
}

/** Chat message visible in the chat rail. */
export type ChatMessage =
  | { role: "user"; content: string; turnId: string }
  | { role: "assistant"; content: string; turnId: string }
  | {
      role: "assistant";
      content: "";
      turnId: string;
      toolCall: { name: string; summary: string };
    }
  | {
      role: "result";
      turnId: string;
      sql: string; // only held on the server; UI strips before rendering
      summary: QuerySummary;
      rows: Array<Record<string, unknown>>;
      rowCount: number;
      executionTimeMs: number;
    }
  | { role: "error"; content: string; turnId: string };

/** Chip edit actions posted to /api/ai/query/edit. Matches D8 in spec. */
export type ChipEditAction =
  | { type: "remove_filter"; chipId: string; label: string }
  | { type: "change_filter"; chipId: string; label: string; from: string; to: string }
  | { type: "remove_column"; columnId: string; label: string }
  | { type: "add_column"; label: string }
  | { type: "change_sort"; column: string; direction: "asc" | "desc" }
  | { type: "remove_sort" }
  | { type: "change_limit"; from: number; to: number };

/** Request shapes for the chat and edit routes. */
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface EditRequest {
  action: ChipEditAction;
  conversationId: string;
}

export interface ChatResponse {
  conversationId: string;
  messages: ChatMessage[];
}

export const MAX_LIMIT = 500;
export const DEFAULT_LIMIT = 100;
export const MAX_EXPLORATORY_CALLS_PER_TURN = 20;
export const MAX_SQL_RETRIES = 2;
