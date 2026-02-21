import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  Tag,
  Contact,
  ContactsResponse,
  ClayLookupResponse,
  UserSummary,
  UserProfile,
  Service,
  ExploreResponse,
} from "@/features/shared/types/api-types";

// Re-export shared types and api-client for consumers
export { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
export type * from "@/features/shared/types/api-types";

// Re-export feature queries
export * from "@/features/districts/lib/queries";
export * from "@/features/plans/lib/queries";
export * from "@/features/tasks/lib/queries";
export * from "@/features/activities/lib/queries";
export * from "@/features/calendar/lib/queries";
export * from "@/features/goals/lib/queries";
export * from "@/features/progress/lib/queries";
export * from "@/features/map/lib/queries";

// Tags
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

// Contacts

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

// Clay contact lookup - triggers Clay webhook to find and enrich contacts
export function useTriggerClayLookup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaid: string) =>
      fetchJson<ClayLookupResponse>(`${API_BASE}/contacts/clay-lookup`, {
        method: "POST",
        body: JSON.stringify({ leaid }),
      }),
    onSuccess: (_, leaid) => {
      // Invalidate district query to refetch contacts once Clay responds
      // Note: Contacts will appear after Clay processes and calls our webhook
      queryClient.invalidateQueries({ queryKey: ["district", leaid] });
    },
  });
}

// Sales executives list
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

// ===== User Profile =====

// Get user profile - also upserts profile on first call
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJson<UserProfile>(`${API_BASE}/profile`),
    staleTime: 2 * 60 * 1000, // 2 minutes - profile may change during session
  });
}

// Update user profile (fullName, hasCompletedSetup)
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

// Logout user
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/auth/logout`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
}

// ------ Explore Data ------

export function useExploreData<T = Record<string, unknown>>(
  entity: string,
  params: {
    filters?: { id: string; column: string; op: string; value: unknown }[];
    sorts?: { column: string; direction: "asc" | "desc" }[];
    page?: number;
    pageSize?: number;
    columns?: string[];
  }
) {
  const searchParams = new URLSearchParams();
  if (params.filters && params.filters.length > 0) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.sorts && params.sorts.length > 0) {
    searchParams.set("sorts", JSON.stringify(params.sorts));
  }
  if (params.columns && params.columns.length > 0) {
    searchParams.set("columns", params.columns.join(","));
  }
  searchParams.set("page", String(params.page || 1));
  searchParams.set("pageSize", String(params.pageSize || 50));

  return useQuery({
    queryKey: ["explore", entity, params],
    queryFn: () =>
      fetchJson<ExploreResponse<T>>(
        `${API_BASE}/explore/${entity}?${searchParams}`
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// Add tag to school
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

// Remove tag from school
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
