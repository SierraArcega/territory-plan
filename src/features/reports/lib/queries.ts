import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type { QueryParams, QueryResult } from "./types";
import type {
  DraftRecord,
  ReportCardData,
  SavedReportDetails,
} from "./ui-types";

/**
 * TanStack Query hooks for the Reports tab. All query keys are arrays of
 * primitives (CLAUDE.md convention). Mutations invalidate only the specific
 * keys they affect.
 */

// ---------------------------------------------------------------------------
// draft
// ---------------------------------------------------------------------------

const DRAFT_URL = `${API_BASE}/ai/query/draft`;

export function useDraftQuery() {
  return useQuery<DraftRecord | null>({
    queryKey: ["reports", "draft"],
    staleTime: 10_000,
    queryFn: async () => {
      const res = await fetch(DRAFT_URL, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Draft fetch failed: ${res.status}`);
      }
      return res.json();
    },
  });
}

interface DraftUpsertVars {
  params: QueryParams;
  conversationId?: string | null;
  chatHistory?: unknown;
}

export function useUpsertDraftMutation() {
  const qc = useQueryClient();
  return useMutation<DraftRecord, Error, DraftUpsertVars>({
    mutationFn: (body) =>
      fetchJson<DraftRecord>(DRAFT_URL, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (draft) => {
      qc.setQueryData(["reports", "draft"], draft);
    },
  });
}

export function useDiscardDraftMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await fetch(DRAFT_URL, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Discard draft failed: ${res.status}`);
      }
    },
    onSuccess: () => {
      qc.setQueryData(["reports", "draft"], null);
    },
  });
}

// ---------------------------------------------------------------------------
// saved reports
// ---------------------------------------------------------------------------

const REPORTS_URL = `${API_BASE}/ai/query/reports`;

export type ReportsTab = "all" | "mine" | "team" | "pinned";
export type ReportsSort = "recent" | "name";

interface ReportsListResponse {
  reports: ReportCardData[];
}

export function useSavedReportsQuery(opts: {
  tab: ReportsTab;
  search: string;
  sort: ReportsSort;
}) {
  const { tab, search, sort } = opts;
  return useQuery<ReportsListResponse>({
    queryKey: ["reports", "list", tab, search, sort],
    staleTime: 30_000,
    queryFn: () => {
      const qs = new URLSearchParams({ tab, sort });
      if (search) qs.set("search", search);
      return fetchJson<ReportsListResponse>(`${REPORTS_URL}?${qs.toString()}`);
    },
  });
}

export function useSavedReportQuery(id: number | null) {
  return useQuery<SavedReportDetails>({
    queryKey: ["reports", "byId", id ?? 0],
    enabled: id !== null && id > 0,
    staleTime: 60_000,
    queryFn: () => fetchJson<SavedReportDetails>(`${REPORTS_URL}/${id}`),
  });
}

interface SaveReportVars {
  title: string;
  description?: string;
  params: QueryParams;
  question?: string;
  conversationId?: string;
}

export function useSaveReportMutation() {
  const qc = useQueryClient();
  return useMutation<SavedReportDetails, Error, SaveReportVars>({
    mutationFn: (body) =>
      fetchJson<SavedReportDetails>(REPORTS_URL, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
    },
  });
}

interface UpdateReportVars {
  id: number;
  title?: string;
  description?: string;
  params?: QueryParams;
  isTeamPinned?: boolean;
}

export function useUpdateReportMutation() {
  const qc = useQueryClient();
  return useMutation<SavedReportDetails, Error, UpdateReportVars>({
    mutationFn: ({ id, ...rest }) =>
      fetchJson<SavedReportDetails>(`${REPORTS_URL}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
      qc.invalidateQueries({ queryKey: ["reports", "byId", vars.id] });
    },
  });
}

export function useDeleteReportMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: number }>({
    mutationFn: async ({ id }) => {
      const res = await fetch(`${REPORTS_URL}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed: ${res.status}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
    },
  });
}

export function useRunReportMutation() {
  const qc = useQueryClient();
  return useMutation<QueryResult, Error, { id: number }>({
    mutationFn: ({ id }) =>
      fetchJson<QueryResult>(`${REPORTS_URL}/${id}/run`, { method: "POST" }),
    onSuccess: (_data, vars) => {
      // List shows runCount/lastRunAt, so invalidate.
      qc.invalidateQueries({ queryKey: ["reports", "list"] });
      qc.invalidateQueries({ queryKey: ["reports", "byId", vars.id] });
    },
  });
}

// ---------------------------------------------------------------------------
// draft-params run + suggest
// ---------------------------------------------------------------------------

interface RunQueryVars {
  params: QueryParams;
  conversationId?: string;
  question?: string;
}

export function useRunQueryMutation() {
  return useMutation<QueryResult, Error, RunQueryVars>({
    mutationFn: (body) =>
      fetchJson<QueryResult>(`${API_BASE}/ai/query/run`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

interface SuggestVars {
  question: string;
  currentParams?: QueryParams;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
}

export type SuggestResponse =
  | { kind: "params"; params: QueryParams; explanation: string }
  | { kind: "clarify"; question: string };

export function useSuggestMutation() {
  return useMutation<SuggestResponse, Error, SuggestVars>({
    mutationFn: (body) =>
      fetchJson<SuggestResponse>(`${API_BASE}/ai/query/suggest`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
