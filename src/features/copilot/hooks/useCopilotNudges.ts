import { useQuery } from "@tanstack/react-query";
import type { CopilotNudge } from "../lib/nudge-types";

async function fetchNudges(): Promise<CopilotNudge[]> {
  const r = await fetch("/api/copilot/nudges");
  if (!r.ok) return [];
  const data = (await r.json()) as { nudges?: CopilotNudge[] };
  return data.nudges ?? [];
}

/** Proactive home-state nudges. `enabled` lets the panel fetch only when open. */
export function useCopilotNudges(enabled: boolean) {
  return useQuery({
    queryKey: ["copilot", "nudges"],
    queryFn: fetchNudges,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
