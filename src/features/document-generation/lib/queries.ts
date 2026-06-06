import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ContactsResponse } from "@/features/shared/types/api-types";

export function districtContactsUrl(leaid: string): string {
  return `${API_BASE}/contacts?leaid=${encodeURIComponent(leaid)}`;
}

export function useDistrictContacts(leaid: string | null) {
  return useQuery({
    queryKey: ["contacts", { leaid }],
    queryFn: () => fetchJson<ContactsResponse>(districtContactsUrl(leaid as string)),
    enabled: !!leaid,
    staleTime: 2 * 60 * 1000,
  });
}
