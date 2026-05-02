import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuerySummary } from "./agent/types";

export interface ReportListItem {
  id: number;
  title: string;
  description: string | null;
  question: string;
  lastRunAt: string | null;
  runCount: number;
  rowCount: number | null;
  isTeamPinned: boolean;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface LibraryResponse {
  mine: ReportListItem[];
  starred: ReportListItem[];
  team: ReportListItem[];
}

const LIBRARY_KEY = ["reports", "library"] as const;

export function useReportsLibrary() {
  return useQuery<LibraryResponse>({
    queryKey: LIBRARY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: number; isTeamPinned: boolean }>({
    mutationFn: async ({ id, isTeamPinned }) => {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isTeamPinned }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Failed to update star");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export function useUpdateReportDetails() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { id: number; title?: string; description?: string | null }
  >({
    mutationFn: async ({ id, ...patch }) => {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export interface CreateReportInput {
  title: string;
  description?: string | null;
  question: string;
  sql: string;
  summary: QuerySummary;
  conversationId?: string;
}

export function useCreateSavedReport() {
  const qc = useQueryClient();
  return useMutation<{ report: ReportListItem }, Error, CreateReportInput>({
    mutationFn: async (body) => {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}

export function useUpdateReportSql() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { id: number; sql: string; summary: QuerySummary; question: string }
  >({
    mutationFn: async ({ id, ...patch }) => {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIBRARY_KEY }),
  });
}
