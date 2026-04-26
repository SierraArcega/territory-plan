"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { UnifiedIngestRow } from "../lib/ingest-log-normalizer";

export interface AdminSyncResponse {
  items: UnifiedIngestRow[];
  pagination: { page: number; pageSize: number; total: number };
  sources: string[];
}

export interface UseAdminSyncParams {
  page?: number;
  pageSize?: number;
  source?: string;
  status?: string;
}

export function useAdminSync(params: UseAdminSyncParams = {}) {
  const { page = 1, pageSize = 20, source = "", status = "" } = params;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("page_size", String(pageSize));
  if (source) searchParams.set("source", source);
  if (status) searchParams.set("status", status);

  return useQuery({
    queryKey: ["admin", "sync", page, pageSize, source, status],
    queryFn: () =>
      fetchJson<AdminSyncResponse>(`${API_BASE}/admin/sync?${searchParams}`),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
