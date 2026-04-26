/**
 * UI-only types for the Reports tab. Server-side shapes live in `types.ts`.
 */

import type { QueryParams } from "./types";
import type { ReceiptAction } from "./params-diff";

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessageReceipt {
  /** Structured per-change rows. Empty for clarify replies or no-op turns. */
  actions: ReceiptAction[];
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  receipt?: ChatMessageReceipt;
  error?: boolean;
}

export type ChipKind = "source" | "join" | "filter" | "columns" | "sort";

/** Compact shape the Library list hydrates with. */
export interface ReportCardData {
  id: number;
  userId: string;
  title: string;
  question: string;
  params: QueryParams | null;
  isTeamPinned: boolean;
  pinnedBy: string | null;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface SavedReportDetails extends ReportCardData {
  description?: string | null;
  sql?: string | null;
}

export interface DraftRecord {
  userId: string;
  params: QueryParams;
  conversationId: string | null;
  chatHistory: ChatMessage[] | null;
  lastTouchedAt: string;
  createdAt: string;
}
