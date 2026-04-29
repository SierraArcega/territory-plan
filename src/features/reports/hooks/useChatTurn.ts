import { useMutation } from "@tanstack/react-query";
import type { ChatRequest, QuerySummary } from "../lib/agent/types";

export interface ChatTurnResult {
  conversationId: string;
  assistantText: string;
  result: {
    sql: string;
    summary: QuerySummary;
    columns: string[];
    rows: Array<Record<string, unknown>>;
    rowCount: number;
    executionTimeMs: number;
  } | null;
}

export function useChatTurn() {
  return useMutation<ChatTurnResult, Error, ChatRequest>({
    mutationFn: async (body) => {
      const res = await fetch("/api/ai/query/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      return res.json();
    },
  });
}
