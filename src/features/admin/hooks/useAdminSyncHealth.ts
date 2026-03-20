import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface SyncHealth {
  lastSyncAt: string | null;
  health: "green" | "yellow" | "red";
  hoursAgo: number | null;
  opportunities: { lastSynced: string | null; total: number };
  sessions: { lastSynced: string | null; total: number };
  unmatched: { lastSynced: string | null; total: number };
}

export function useAdminSyncHealth() {
  return useQuery({
    queryKey: ["admin", "sync", "health"],
    queryFn: () => fetchJson<SyncHealth>(`${API_BASE}/admin/sync/health`),
    refetchInterval: 60_000,
  });
}
