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
import type {
  ContactRecordResponse,
  DistrictRecordResponse,
  Lead,
  LeadsResponse,
  LeadStatus,
  LeadTimelineResponse,
  SchoolRecordResponse,
} from "./types";
import type {
  ActivityImportPlan,
  ActivityImportRowInput,
  ImportResult,
  LeadImportPlan,
  LeadImportRowInput,
} from "./import";

/** Server page cap (MAX_PAGE_SIZE in /api/leads). */
export const LEADS_FETCH_LIMIT = 200;
/** Render pagination: show 50 at a time with "Show more" (CLAUDE.md rule). */
export const RENDER_PAGE_SIZE = 50;

export type LeadScope = "mine" | "team";

export const leadKeys = {
  all: ["leads"] as const,
  lists: () => ["leads", "list"] as const,
  list: (scope: LeadScope) => ["leads", "list", scope] as const,
  timeline: (leadId: string) => ["leads", "timeline", leadId] as const,
  record: (type: "contact" | "school" | "district", id: string) =>
    ["leads", "record", type, id] as const,
  districtOpenOpps: (leaid: string) => ["leads", "district-open-opps", leaid] as const,
  oppSearch: (q: string) => ["leads", "opp-search", q] as const,
  districtSchools: (leaid: string) => ["leads", "district-schools", leaid] as const,
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

// ---- Timeline & record panels ------------------------------------------------

/** Merged lifecycle + engagement feed for the lead detail panel. */
export function useLeadTimelineQuery(leadId: string) {
  return useQuery({
    queryKey: leadKeys.timeline(leadId),
    queryFn: () =>
      fetchJson<LeadTimelineResponse>(`${API_BASE}/leads/${leadId}/timeline`),
    staleTime: 30 * 1000,
  });
}

export function useContactRecordQuery(contactId: number) {
  return useQuery({
    queryKey: leadKeys.record("contact", String(contactId)),
    queryFn: () =>
      fetchJson<ContactRecordResponse>(`${API_BASE}/leads/records/contact/${contactId}`),
    staleTime: 30 * 1000,
  });
}

export function useSchoolRecordQuery(ncessch: string) {
  return useQuery({
    queryKey: leadKeys.record("school", ncessch),
    queryFn: () =>
      fetchJson<SchoolRecordResponse>(`${API_BASE}/leads/records/school/${ncessch}`),
    staleTime: 30 * 1000,
  });
}

export function useDistrictRecordQuery(leaid: string) {
  return useQuery({
    queryKey: leadKeys.record("district", leaid),
    queryFn: () =>
      fetchJson<DistrictRecordResponse>(`${API_BASE}/leads/records/district/${leaid}`),
    staleTime: 30 * 1000,
  });
}

// ---- Modal lookups -----------------------------------------------------------

/** Stages that close an opportunity — excluded from the link-existing list. */
const CLOSED_OPP_STAGES = ["Closed Won", "Closed Lost"];

export interface DistrictOpenOpp {
  id: string;
  name: string | null;
  stage: string | null;
  netBookingAmount: number | null;
  districtName: string | null;
  districtLeaId: string | null;
  closeDate: string | null;
}

/**
 * Open opportunities in a lead's district, for the Link-existing flow.
 * Reuses GET /api/opportunities?leaids= (the Saved Views listing shape) and
 * drops closed stages client-side.
 */
export function useDistrictOpenOppsQuery(leaid: string) {
  return useQuery({
    queryKey: leadKeys.districtOpenOpps(leaid),
    queryFn: async () => {
      const res = await fetchJson<{ opportunities: DistrictOpenOpp[] }>(
        `${API_BASE}/opportunities?leaids=${encodeURIComponent(leaid)}&limit=50`,
      );
      return res.opportunities.filter(
        (o) => !o.stage || !CLOSED_OPP_STAGES.includes(o.stage),
      );
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Search open opportunities across the whole opportunities table by name/id
 * (Link-existing flow). Same listing endpoint and closed-stage drop as the
 * district list above; idle until the query is at least 2 characters.
 */
export function useOppSearchQuery(search: string) {
  const q = search.trim();
  return useQuery({
    queryKey: leadKeys.oppSearch(q),
    queryFn: async () => {
      const res = await fetchJson<{ opportunities: DistrictOpenOpp[] }>(
        `${API_BASE}/opportunities?search=${encodeURIComponent(q)}&limit=50`,
      );
      return res.opportunities.filter(
        (o) => !o.stage || !CLOSED_OPP_STAGES.includes(o.stage),
      );
    },
    enabled: q.length >= 2,
    staleTime: 30 * 1000,
  });
}

export interface DistrictSchoolOption {
  ncessch: string;
  schoolName: string | null;
  schoolLevel: string | null;
}

/** Schools in a district — the optional workplace select in the Add lead form. */
export function useDistrictSchoolsQuery(leaid: string | null) {
  return useQuery({
    queryKey: leadKeys.districtSchools(leaid ?? ""),
    queryFn: async () => {
      const res = await fetchJson<{ schools: DistrictSchoolOption[] }>(
        `${API_BASE}/schools/by-district/${leaid}`,
      );
      return res.schools.map((s) => ({
        ncessch: s.ncessch,
        schoolName: s.schoolName,
        schoolLevel: s.schoolLevel,
      }));
    },
    enabled: !!leaid,
    staleTime: 5 * 60 * 1000,
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
  /** Meeting date — rides along with a meeting_scheduled transition, or
   *  stands alone as a field edit (rescheduling in-stage). */
  meetingAt?: string | null;
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

// ---- Engagement (Outcome modal) ----------------------------------------------

export interface LogEngagementInput {
  leadId: string;
  /** App activity type (e.g. cold_call, email, discovery_call). */
  type: string;
  title: string;
  notes?: string | null;
  occurredAt?: string | null;
  points?: number;
  outcome?: string | null;
  outcomeType?: string | null;
  rating?: number | null;
  /** Optional lifecycle transition applied after logging (validated server-side). */
  resultingStatus?: LeadStatus | null;
  /** Required when resultingStatus is unqualified. */
  reason?: string | null;
}

export interface LogEngagementResponse {
  /** Activities are keyed by uuid strings. */
  activityId: string;
  lead: Lead;
}

/**
 * Log an engagement outcome: a real activities row on the shared store
 * (contact/district/school junctions — never the lead), a score increment,
 * and an optional status transition. Errors surface as alert toasts with the
 * server's message (422 illegal transition, 400 missing reason).
 */
export function useLogEngagementMutation() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ leadId, ...input }: LogEngagementInput) =>
      fetchJson<LogEngagementResponse>(`${API_BASE}/leads/${leadId}/engagement`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onError: (error: Error) => {
      const message = error.message.replace(/^\d{3}:\s*/, "");
      showToast(message || "Failed to log engagement", { tone: "alert" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

// ---- Link opportunity ----------------------------------------------------------

export interface LinkOpportunityMutationInput {
  leadId: string;
  /** Link an existing open opportunity; omit to create a fresh Stage 0 opp. */
  opportunityId?: string | null;
  name?: string | null;
  amount?: number | null;
  closeDate?: string | null;
}

// ---- Bulk import (L9) -----------------------------------------------------------

/** Dry-run the leads import — full resolution plan, nothing written. */
export function useLeadImportDryRun() {
  return useMutation({
    mutationFn: (rows: LeadImportRowInput[]) =>
      fetchJson<LeadImportPlan>(`${API_BASE}/leads/import?dryRun=1`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  });
}

/** Run the leads import (same resolution code path as the dry run). */
export function useLeadImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: LeadImportRowInput[]) =>
      fetchJson<ImportResult>(`${API_BASE}/leads/import`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/** Dry-run the activity/engagement import — per-row resolution plan. */
export function useActivityImportDryRun() {
  return useMutation({
    mutationFn: (rows: ActivityImportRowInput[]) =>
      fetchJson<ActivityImportPlan>(`${API_BASE}/leads/import/activities?dryRun=1`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  });
}

/** Run the activity/engagement import. */
export function useActivityImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: ActivityImportRowInput[]) =>
      fetchJson<ImportResult>(`${API_BASE}/leads/import/activities`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/** Link an existing open opp or create a Stage 0 opp for the lead. */
export function useLinkOpportunityMutation() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ leadId, ...input }: LinkOpportunityMutationInput) =>
      fetchJson<Lead>(`${API_BASE}/leads/${leadId}/opportunity`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onError: (error: Error) => {
      const message = error.message.replace(/^\d{3}:\s*/, "");
      showToast(message || "Failed to link opportunity", { tone: "alert" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
