import type { QuerySummary, TurnEvent } from "../../lib/agent/types";

/**
 * One completed result inside a builder session — produced by a successful
 * run_sql tool call. Versions are 1-indexed in display (v1, v2, ...) and
 * always selected by index in the in-memory `versions` array.
 */
export interface BuilderVersion {
  n: number;
  summary: QuerySummary;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  sql: string;
  executionTimeMs: number;
  createdAt: number;
}

/**
 * One conversational turn rendered as a TurnBlock. Each turn always has the
 * user's message; the assistant's reply is optional (still streaming, or the
 * agent surrendered). The version is set when the turn produced a run_sql
 * result; clarifying turns leave it null.
 */
export interface BuilderTurn {
  id: string;
  userMessage: string;
  assistantText: string | null;
  version: BuilderVersion | null;
  inFlight: boolean;
  error: string | null;
  /**
   * Streaming agent events captured during the turn. Populated incrementally
   * while `inFlight` is true (one event per `turn_event` SSE message), and
   * preserved on the completed turn so the LiveTrace toggle can render the
   * full step list when expanded.
   */
  events?: TurnEvent[];
  /** Wall-clock duration once completed — used in the `N steps · X.Xs` label. */
  durationMs?: number;
}
