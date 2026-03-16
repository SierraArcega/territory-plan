"use client";

import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  unmatched: { total: number; newThisWeek: number };
  users: { total: number; activeToday: number };
  integrations: { total: number; errors: number };
  sync: { status: string; recentErrors: number; lastSyncAt: string | null };
}

async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) throw new Error("Failed to fetch admin stats");
  return res.json();
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 60_000, // Refresh every minute
  });
}
