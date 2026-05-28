import type { TurnEvent } from "@/features/reports/lib/agent/types";
import type { QuerySummary } from "@/features/reports/lib/agent/types";

/** Object types the copilot can write. Districts ("accounts") are read-only;
 *  they're touched only via `district_note`. */
export type CopilotObjectType =
  | "task"
  | "activity"
  | "contact"
  | "plan"
  | "district_note";

export type CopilotOperation =
  | "create"
  | "update"
  | "add_districts"
  | "remove_districts"
  | "add_activities"
  | "remove_activities";

export interface ActionPreviewRow {
  label: string;
  value: string;
}

/** Human-readable confirm-card contents, built server-side from validated fields. */
export interface ActionPreview {
  /** e.g. "Create task". */
  title: string;
  /** One-line, rep-friendly description (model-authored when available). */
  summary: string;
  rows: ActionPreviewRow[];
  /** True for removals/unlinks (e.g. plan.remove_districts) so the confirm card
   *  can warn; false for create/update. */
  destructive: boolean;
}

/** A validated, previewable action the rep can confirm. Built server-side by
 *  the `propose_actions` terminal handler; nothing is written yet. */
export interface ProposedAction {
  /** Client-side card id (generated server-side). */
  id: string;
  objectType: CopilotObjectType;
  operation: CopilotOperation;
  /** Required for updates — the id of the record to change. */
  targetId?: string | number | null;
  /** Validated field values, sent back verbatim to the execute endpoint. */
  fields: Record<string, unknown>;
  preview: ActionPreview;
}

/** Terminal result payload of the `propose_actions` tool. */
export interface ProposedActionsResult {
  proposedActions: ProposedAction[];
}

/** What the panel sends each turn so the model can resolve "here"/"this". */
export interface CopilotPageContext {
  tab?: string;
  route?: string;
  openDistrict?: { leaid: string; name?: string } | null;
  openPlanId?: string | number | null;
  openEntity?: { type: string; id: string | number; label?: string } | null;
  /** Multi-selected district leaids (map shift-select / list checkboxes), so the
   *  copilot can act on "these districts" / "each of these". */
  selectedLeaids?: string[];
  /** Capped (≤20) snapshot of the rows currently visible to the rep. */
  visibleRows?: Array<Record<string, unknown>>;
  /** What the visible rows are (e.g. "Low-hanging-fruit list"). */
  visibleRowsLabel?: string;
  /** Human-readable active filter labels. */
  activeFilters?: string[];
}

/** Chat request body for the copilot stream route. */
export interface CopilotChatRequest {
  message: string;
  conversationId?: string;
  pageContext?: CopilotPageContext;
}

/** One past message rendered when a prior conversation is replayed read-only.
 *  Result rows aren't persisted, so answer-turns carry a `note` instead of a
 *  table, and proposal-turns carry a `note` rather than live (stale) cards. */
export interface CopilotHistoryMessage {
  role: "user" | "assistant";
  text: string;
  note?: string;
}

/** Wire shape for one confirmed action sent to the execute endpoint. */
export interface ExecuteActionRequest {
  objectType: CopilotObjectType;
  operation: CopilotOperation;
  targetId?: string | number | null;
  fields: Record<string, unknown>;
  conversationId?: string;
}

/** Terminal `result` SSE payload the copilot stream emits. */
export type CopilotTurnResult =
  | {
      kind: "answer";
      conversationId: string;
      assistantText: string;
      result: {
        sql: string;
        summary: QuerySummary;
        columns: string[];
        rows: Array<Record<string, unknown>>;
        rowCount: number;
        executionTimeMs: number;
      };
    }
  | {
      kind: "actions";
      conversationId: string;
      assistantText: string;
      proposedActions: ProposedAction[];
    }
  | {
      kind: "clarifying";
      conversationId: string;
      assistantText: string;
    };

export type { TurnEvent };
