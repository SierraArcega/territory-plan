// Report Builder TanStack Query hooks — follows the pattern in explore/lib/queries.ts

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  ReportSchema,
  ReportConfig,
  ReportQueryResponse,
  SavedReport,
  SavedReportListResponse,
  SavedReportResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Fetch available entities and their columns for the Report Builder */
export function useReportSchema() {
  return useQuery({
    queryKey: ["reportSchema"],
    queryFn: () => fetchJson<ReportSchema>(`${API_BASE}/reports/schema`),
    staleTime: 10 * 60 * 1000, // 10 min — schemas rarely change
  });
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** Execute a report query with the given config */
export function useReportQuery(config: ReportConfig) {
  const hasRequiredFields =
    config.source.length > 0 && config.columns.length > 0;

  return useQuery({
    queryKey: ["reportQuery", config],
    queryFn: () =>
      fetchJson<ReportQueryResponse>(`${API_BASE}/reports/query`, {
        method: "POST",
        body: JSON.stringify({
          source: config.source,
          columns: config.columns,
          filters: config.filters,
          sorts: config.sorts,
          page: config.page,
          pageSize: config.pageSize,
        }),
      }),
    enabled: hasRequiredFields,
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Saved Reports — List & Load
// ---------------------------------------------------------------------------

/** List all saved reports for the current user (owned + shared) */
export function useSavedReports() {
  return useQuery({
    queryKey: ["savedReports"],
    queryFn: () => fetchJson<SavedReportListResponse>(`${API_BASE}/reports`),
    staleTime: 30 * 1000, // 30 sec
    select: (data) => data.reports,
  });
}

/** Load a single saved report by ID */
export function useSavedReport(id: string | null) {
  return useQuery({
    queryKey: ["savedReport", id],
    queryFn: () =>
      fetchJson<SavedReportResponse>(`${API_BASE}/reports/${id}`),
    enabled: !!id,
    staleTime: 60 * 1000,
    select: (data) => data.report,
  });
}

// ---------------------------------------------------------------------------
// Mutations — Save, Delete, Share
// ---------------------------------------------------------------------------

/** Create or update a saved report */
export function useSaveReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      id?: string;
      name: string;
      source: string;
      config: SavedReport["config"];
    }) => {
      if (payload.id) {
        // Update existing
        return fetchJson<SavedReportResponse>(
          `${API_BASE}/reports/${payload.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: payload.name,
              source: payload.source,
              config: payload.config,
            }),
          }
        );
      }
      // Create new
      return fetchJson<SavedReportResponse>(`${API_BASE}/reports`, {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          source: payload.source,
          config: payload.config,
        }),
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["savedReports"] });
      if (vars.id) {
        queryClient.invalidateQueries({ queryKey: ["savedReport", vars.id] });
      }
    },
  });
}

/** Delete a saved report */
export function useDeleteReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/reports/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedReports"] });
    },
  });
}

/** Share a report with specific users */
export function useShareReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      sharedWith,
    }: {
      id: string;
      sharedWith: string[];
    }) =>
      fetchJson<SavedReportResponse>(`${API_BASE}/reports/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ sharedWith }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["savedReports"] });
      queryClient.invalidateQueries({ queryKey: ["savedReport", vars.id] });
    },
  });
}

/** Export a report as CSV — triggers a browser download */
export function useExportReport() {
  return useMutation({
    mutationFn: async (payload: {
      source: string;
      columns: string[];
      filters: ReportConfig["filters"];
      sorts: ReportConfig["sorts"];
      reportName?: string;
    }) => {
      const res = await fetch(`${API_BASE}/reports/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error ?? `Export failed: ${res.status} ${res.statusText}`
        );
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        (payload.reportName ?? "report").replace(/[^a-zA-Z0-9_-]/g, "_") +
        ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
