import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  Tag,
  Contact,
  ContactsResponse,
  ClayLookupResponse,
  UserSummary,
  UserProfile,
  Service,
} from "@/features/shared/types/api-types";

// ===== Tags =====

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => fetchJson<Tag[]>(`${API_BASE}/tags`),
    staleTime: 60 * 60 * 1000, // 1 hour - tags rarely change
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tag: { name: string; color: string }) =>
      fetchJson<Tag>(`${API_BASE}/tags`, {
        method: "POST",
        body: JSON.stringify(tag),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useAddDistrictTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaid, tagId }: { leaid: string; tagId: number }) =>
      fetchJson<void>(`${API_BASE}/districts/${leaid}/tags`, {
        method: "POST",
        body: JSON.stringify({ tagId }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan"] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

export function useRemoveDistrictTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaid, tagId }: { leaid: string; tagId: number }) =>
      fetchJson<void>(`${API_BASE}/districts/${leaid}/tags/${tagId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan"] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

// ===== Contacts =====

export function useContacts(params: { search?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE}/contacts${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["contacts", params],
    queryFn: () => fetchJson<ContactsResponse>(url),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: { leaid: string; name: string } & Partial<Omit<Contact, "id" | "leaid" | "name" | "createdAt" | "lastEnrichedAt">>) =>
      fetchJson<Contact>(`${API_BASE}/contacts`, {
        method: "POST",
        body: JSON.stringify(contact),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, leaid, ...data }: { id: number; leaid: string } & Partial<Omit<Contact, "id" | "leaid">>) =>
      fetchJson<Contact>(`${API_BASE}/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, leaid }: { id: number; leaid: string }) =>
      fetchJson<void>(`${API_BASE}/contacts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
      queryClient.invalidateQueries({ queryKey: ["planContacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useTriggerClayLookup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaid: string) =>
      fetchJson<ClayLookupResponse>(`${API_BASE}/contacts/clay-lookup`, {
        method: "POST",
        body: JSON.stringify({ leaid }),
      }),
    onSuccess: (_, leaid) => {
      queryClient.invalidateQueries({ queryKey: ["district", leaid] });
    },
  });
}

// ===== Users & Profile =====

export function useSalesExecutives() {
  return useQuery({
    queryKey: ["salesExecutives"],
    queryFn: () => fetchJson<string[]>(`${API_BASE}/sales-executives`),
    staleTime: 60 * 60 * 1000, // 1 hour - sales execs rarely change
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<UserSummary[]>(`${API_BASE}/users`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJson<UserProfile>(`${API_BASE}/profile`),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { fullName?: string; hasCompletedSetup?: boolean; jobTitle?: string; location?: string; locationLat?: number | null; locationLng?: number | null; phone?: string; slackUrl?: string; bio?: string }) =>
      fetchJson<UserProfile>(`${API_BASE}/profile`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ===== Services =====

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => fetchJson<Service[]>(`${API_BASE}/services`),
    staleTime: 60 * 60 * 1000, // 1 hour - services rarely change
  });
}

// ===== Auth =====

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/auth/logout`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// ===== School Tags =====

export function useAddSchoolTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ncessch, tagId }: { ncessch: string; tagId: number }) =>
      fetchJson<void>(`${API_BASE}/schools/${ncessch}/tags`, {
        method: "POST",
        body: JSON.stringify({ tagId }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school", variables.ncessch] });
    },
  });
}

export function useRemoveSchoolTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ncessch, tagId }: { ncessch: string; tagId: number }) =>
      fetchJson<void>(`${API_BASE}/schools/${ncessch}/tags/${tagId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school", variables.ncessch] });
    },
  });
}
