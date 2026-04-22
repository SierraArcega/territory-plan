import { useMutation } from "@tanstack/react-query";
import type { EditRequest } from "../lib/agent/types";
import type { ChatTurnResult } from "./useChatTurn";

export function useChipEdit() {
  return useMutation<ChatTurnResult, Error, EditRequest>({
    mutationFn: async (body) => {
      const res = await fetch("/api/ai/query/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Edit failed");
      return res.json();
    },
  });
}
