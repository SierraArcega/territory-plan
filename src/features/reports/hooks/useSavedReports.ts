import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuerySummary } from "../lib/agent/types";

export interface SavedReportListItem {
  id: number;
  title: string;
  question: string;
  summary: QuerySummary | null;
  updatedAt: string;
  runCount: number;
  lastRunAt: string | null;
  isTeamPinned: boolean;
}

export function useSavedReports() {
  return useQuery<{ reports: SavedReportListItem[] }>({
    queryKey: ["saved-reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
  });
}

export function useCreateSavedReport() {
  const qc = useQueryClient();
  return useMutation<
    { report: SavedReportListItem },
    Error,
    { title: string; question: string; sql: string; summary: QuerySummary; conversationId?: string }
  >({
    mutationFn: async (body) => {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-reports"] }),
  });
}

export function useRunSavedReport() {
  return useMutation<
    {
      summary: QuerySummary;
      columns: string[];
      rows: Array<Record<string, unknown>>;
      rowCount: number;
      executionTimeMs: number;
    },
    Error,
    number
  >({
    mutationFn: async (id) => {
      const res = await fetch(`/api/reports/${id}/run`, { method: "POST" });
      if (!res.ok) throw new Error("Run failed");
      return res.json();
    },
  });
}
