"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ExecuteActionRequest,
  ProposedAction,
} from "@/features/copilot/lib/types";

/**
 * Maps a confirmed action to the TanStack query keys that should refetch after
 * it lands. Kept on the client (not the server registry) so the server never
 * needs to know about query keys. Reuses each feature's existing key roots.
 */
function invalidationKeysFor(action: ProposedAction): unknown[][] {
  switch (action.objectType) {
    case "task":
      return [["tasks"], ["task"]];
    case "activity":
      return [["activities"]];
    case "contact":
      return [["contacts"]];
    case "plan":
      return [["territory-plans"], ["plans"]];
    case "district_note": {
      const leaid =
        (action.fields.leaid as string | undefined) ??
        (typeof action.targetId === "string" ? action.targetId : undefined);
      return leaid ? [["districtNotes", leaid]] : [["districtNotes"]];
    }
    default:
      return [];
  }
}

export interface ExecuteCopilotActionResult {
  status: string;
  result: unknown;
}

export function useExecuteCopilotAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      action: ProposedAction;
      conversationId?: string;
    }): Promise<ExecuteCopilotActionResult> => {
      const { action, conversationId } = vars;
      const reqBody: ExecuteActionRequest = {
        objectType: action.objectType,
        operation: action.operation,
        targetId: action.targetId ?? undefined,
        fields: action.fields,
        conversationId,
      };
      const res = await fetch("/api/copilot/actions/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        result?: unknown;
      };
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to execute action");
      }
      return { status: json.status ?? "success", result: json.result };
    },
    onSuccess: (_data, vars) => {
      for (const key of invalidationKeysFor(vars.action)) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
