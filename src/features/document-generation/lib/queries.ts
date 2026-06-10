import { useQuery } from "@tanstack/react-query";
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

export interface GeneratedDocumentStatus {
  id: number;
  status: "processing" | "sent" | "viewed" | "signed" | "declined" | "canceled" | "error";
  errorMessage: string | null;
  recipientEmail: string;
  docUrl: string;
}

export const SEND_POLL_MS = 2000;
export const SEND_POLL_MAX_UPDATES = 30; // ~60s; after this the banner shows "awaiting confirmation"

/** Poll cadence for the send-status query: 2s while processing, stop when settled or after ~60s. */
export function sendPollInterval(status: string | undefined, dataUpdateCount: number): number | false {
  if (status && status !== "processing") return false;
  if (dataUpdateCount >= SEND_POLL_MAX_UPDATES) return false;
  return SEND_POLL_MS;
}

export function useGeneratedDocumentStatus(id: number | null) {
  return useQuery({
    queryKey: ["generated-document", id],
    queryFn: () => fetchJson<GeneratedDocumentStatus>(`${API_BASE}/document-generation/documents/${id}`),
    enabled: id != null,
    refetchInterval: (query) =>
      sendPollInterval(query.state.data?.status, query.state.dataUpdateCount),
  });
}
