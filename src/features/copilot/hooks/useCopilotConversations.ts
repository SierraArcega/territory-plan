import { useQuery } from "@tanstack/react-query";
import type { RecentConversation } from "../lib/recent-conversations";

async function fetchConversations(): Promise<RecentConversation[]> {
  const r = await fetch("/api/copilot/conversations");
  if (!r.ok) return [];
  const data = (await r.json()) as { conversations?: RecentConversation[] };
  return data.conversations ?? [];
}

export function useCopilotConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["copilot", "conversations"],
    queryFn: fetchConversations,
    enabled,
    staleTime: 60 * 1000,
  });
}
