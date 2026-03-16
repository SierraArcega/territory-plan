import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface SyncLogItem {
  id: string;
  dataSource: string;
  status: string;
  recordsUpdated: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface AdminSyncResponse {
  items: SyncLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  sources: string[];
}

interface UseAdminSyncParams {
  page?: number;
  pageSize?: number;
  source?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}

export function useAdminSync(params: UseAdminSyncParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    source = "",
    status = "",
    sortBy = "",
    sortDir = "",
  } = params;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("page_size", String(pageSize));
  if (source) searchParams.set("source", source);
  if (status) searchParams.set("status", status);
  if (sortBy) searchParams.set("sort_by", sortBy);
  if (sortDir) searchParams.set("sort_dir", sortDir);

  return useQuery({
    queryKey: ["admin", "sync", { page, pageSize, source, status, sortBy, sortDir }],
    queryFn: () =>
      fetchJson<AdminSyncResponse>(
        `${API_BASE}/admin/sync?${searchParams}`
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
