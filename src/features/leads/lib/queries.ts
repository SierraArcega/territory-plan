"use client";

// TanStack Query hooks for the Leads surface.
//
// Filtering strategy: we fetch by SCOPE only (mine vs team — the server's
// owner-scoping) and apply search / FilterBuilder predicates / sort
// comparators CLIENT-SIDE, matching the prototype. Lead volumes are small
// (a BDR works tens of leads, the team low hundreds), the board needs every
// stage in memory anyway for column counts, and client-side evaluation keeps
// filter/sort changes instant with zero refetches. Rendering is still
// paginated at 50 per CLAUDE.md (see RENDER_PAGE_SIZE). If volumes ever
// exceed the fetch cap, `total` exposes the overflow so the UI can hint.
//
// Query keys are serialized primitives only ("leads", "list", scope).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import { useToast } from "@/features/shared/components/Toast";
import type { Lead, LeadsResponse, LeadStatus } from "./types";

/** Server page cap (MAX_PAGE_SIZE in /api/leads). */
export const LEADS_FETCH_LIMIT = 200;
/** Render pagination: show 50 at a time with "Show more" (CLAUDE.md rule). */
export const RENDER_PAGE_SIZE = 50;

export type LeadScope = "mine" | "team";

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => ["leads", "list"] as const,
  list: (scope: LeadScope) => ["leads", "list", scope] as const,
};

export function useLeadsQuery(scope: LeadScope) {
  return useQuery({
    queryKey: leadKeys.list(scope),
    queryFn: () =>
      fetchJson<LeadsResponse>(
        // No ownerId param = the server defaults to the current user ("mine").
        `${API_BASE}/leads?limit=${LEADS_FETCH_LIMIT}${scope === "team" ? "&ownerId=all" : ""}`,
      ),
    staleTime: 30 * 1000,
  });
}

// ---- Create -----------------------------------------------------------------

export interface CreateLeadInput {
  leaid?: string;
  schoolNcessch?: string | null;
  contactId?: number;
  contactName?: string;
  contactTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  leadType?: string | null;
  sequence?: string | null;
  marketingOwner?: string | null;
  assignedBdrId?: string | null;
  score?: number;
}

export function useCreateLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) =>
      fetchJson<Lead>(`${API_BASE}/leads`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

// ---- Update (field edits + lifecycle transitions) ---------------------------

export interface UpdateLeadInput {
  id: string;
  status?: LeadStatus;
  /** Required when transitioning to unqualified. */
  reason?: string | null;
  leadType?: string | null;
  sequence?: string | null;
  marketingOwner?: string | null;
  assignedBdrId?: string | null;
  schoolNcessch?: string | null;
  score?: number;
}

interface UpdateContext {
  snapshots: Array<[readonly unknown[], LeadsResponse | undefined]>;
}

/**
 * PATCH a lead. Status changes (drag-to-restage, panel actions) are applied
 * optimistically to every cached leads list and rolled back on error; an
 * illegal transition (server 422) surfaces as an alert toast.
 */
export function useUpdateLeadMutation() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation<Lead, Error, UpdateLeadInput, UpdateContext>({
    mutationFn: ({ id, ...patch }) =>
      fetchJson<Lead>(`${API_BASE}/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async (input) => {
      if (input.status === undefined) return { snapshots: [] };
      await queryClient.cancelQueries({ queryKey: leadKeys.lists() });
      const snapshots = queryClient.getQueriesData<LeadsResponse>({
        queryKey: leadKeys.lists(),
      });
      queryClient.setQueriesData<LeadsResponse>(
        { queryKey: leadKeys.lists() },
        (old) =>
          old
            ? {
                ...old,
                leads: old.leads.map((l) =>
                  l.id === input.id
                    ? {
                        ...l,
                        status: input.status!,
                        unqualifiedReason:
                          input.status === "unqualified"
                            ? (input.reason ?? l.unqualifiedReason)
                            : l.unqualifiedReason,
                      }
                    : l,
                ),
              }
            : old,
      );
      return { snapshots };
    },
    onError: (error, _input, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      // fetchJson errors look like "422: Cannot transition lead from new to
      // sales_qualified" — strip the status prefix for the toast.
      const message = error.message.replace(/^\d{3}:\s*/, "");
      showToast(message || "Failed to update lead", { tone: "alert" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
