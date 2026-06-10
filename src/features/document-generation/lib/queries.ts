import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ContactsResponse } from "@/features/shared/types/api-types";

export function districtContactsUrl(leaid: string): string {
  return `${API_BASE}/contacts?leaid=${encodeURIComponent(leaid)}`;
}

export function useDistrictContacts(leaid: string | null) {
  return useQuery({
    queryKey: ["contacts", "district", leaid],
    queryFn: () => fetchJson<ContactsResponse>(districtContactsUrl(leaid as string)),
    enabled: !!leaid,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Generated-document status polling
// ---------------------------------------------------------------------------

// Statuses visible to the SEND polling flow. Deliberately excludes "rendered"
// (BOCES rows are written at render time and never polled).
export interface GeneratedDocumentStatus {
  id: number;
  status: "processing" | "sent" | "viewed" | "signed" | "declined" | "canceled" | "error";
  errorMessage: string | null;
  recipientEmail: string;
  docUrl: string;
}

export const SEND_POLL_MS = 2000;
export const SEND_POLL_MAX_UPDATES = 30; // ~60s; after this the banner shows "awaiting confirmation"
export const SEND_POLL_MAX_ERRORS = 5; // stop hammering a failing endpoint within ~10s

/** Poll cadence for the send-status query: 2s while processing, stop when settled or after ~60s. */
export function sendPollInterval(
  status: string | undefined,
  dataUpdateCount: number,
  errorUpdateCount: number,
): number | false {
  if (status && status !== "processing") return false;
  if (dataUpdateCount >= SEND_POLL_MAX_UPDATES) return false;
  if (errorUpdateCount >= SEND_POLL_MAX_ERRORS) return false;
  return SEND_POLL_MS;
}

export function useGeneratedDocumentStatus(id: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["generated-document", id],
    queryFn: () => fetchJson<GeneratedDocumentStatus>(`${API_BASE}/document-generation/documents/${id}`),
    enabled: id != null,
    refetchInterval: (q) =>
      sendPollInterval(q.state.data?.status, q.state.dataUpdateCount, q.state.errorUpdateCount),
  });
  // dataUpdateCount lives on the internal QueryState, not the observer result —
  // read it from the cache so the banner's timeout matches the poll's stop condition.
  const dataUpdateCount =
    (id != null ? queryClient.getQueryState(["generated-document", id])?.dataUpdateCount : 0) ?? 0;
  const pollTimedOut =
    dataUpdateCount >= SEND_POLL_MAX_UPDATES || query.errorUpdateCount >= SEND_POLL_MAX_ERRORS;
  return { ...query, pollTimedOut };
}
