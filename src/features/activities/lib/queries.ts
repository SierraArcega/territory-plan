import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ActivityType, ActivityStatus } from "@/features/activities/types";
import type {
  ActivitiesParams,
  ActivitiesResponse,
  Activity,
  OppEventsResponse,
  OpenDealsResponse,
} from "@/features/shared/types/api-types";
import type { OpportunityResult, CalendarAttendee } from "@/features/activities/lib/outcome-types-api";

// Normalize a string|string[] filter into a single CSV string. Returns null
// when the value is empty/missing so callers can skip the param entirely.
function csvParam(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => v.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(",") : null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Build a query string from ActivitiesParams. Returned in stable, sorted
// form so it doubles as a TanStack Query key — matching CLAUDE.md's "stable
// query keys must use serialized primitives, never raw objects" rule.
export function buildActivitiesQueryString(params: ActivitiesParams): string {
  const sp = new URLSearchParams();
  if (params.planId) sp.set("planId", params.planId);
  if (params.districtLeaid) sp.set("districtLeaid", params.districtLeaid);

  const state = csvParam(params.state);
  if (state) sp.set("state", state);
  const type = csvParam(params.type);
  if (type) sp.set("type", type);
  const category = csvParam(params.category);
  if (category) sp.set("category", category);
  const status = csvParam(params.status);
  if (status) sp.set("status", status);
  const owner = csvParam(params.owner);
  if (owner) sp.set("owner", owner);
  const territory = csvParam(params.territory);
  if (territory) sp.set("territory", territory);
  const tags = csvParam(params.tags);
  if (tags) sp.set("tags", tags);
  const dealKinds = csvParam(params.dealKinds);
  if (dealKinds) sp.set("dealKinds", dealKinds);
  const districtLeaids = csvParam(params.districtLeaids);
  if (districtLeaids) sp.set("districtLeaids", districtLeaids);
  const attendeeIds = csvParam(params.attendeeIds);
  if (attendeeIds) sp.set("attendeeIds", attendeeIds);
  const contactIds = csvParam(
    params.contactIds == null
      ? undefined
      : Array.isArray(params.contactIds)
        ? params.contactIds.map((v) => String(v))
        : String(params.contactIds)
  );
  if (contactIds) sp.set("contactIds", contactIds);
  const inPerson = csvParam(params.inPerson);
  if (inPerson) sp.set("inPerson", inPerson);

  if (params.startDateFrom) sp.set("startDateFrom", params.startDateFrom);
  if (params.startDateTo) sp.set("startDateTo", params.startDateTo);
  if (params.unscheduled) sp.set("unscheduled", "true");
  if (params.needsPlanAssociation !== undefined)
    sp.set("needsPlanAssociation", params.needsPlanAssociation.toString());
  if (params.hasUnlinkedDistricts !== undefined)
    sp.set("hasUnlinkedDistricts", params.hasUnlinkedDistricts.toString());
  if (params.source) sp.set("source", params.source);
  if (params.ownerId) sp.set("ownerId", params.ownerId);
  if (params.search) sp.set("search", params.search);
  if (params.limit) sp.set("limit", params.limit.toString());
  if (params.offset) sp.set("offset", params.offset.toString());
  if (params.sortBy) sp.set("sortBy", params.sortBy);
  if (params.sortDir) sp.set("sortDir", params.sortDir);

  // Sort entries so e.g. {a,b} and {b,a} produce the same string and the
  // same TanStack key. URLSearchParams preserves insertion order otherwise.
  const sorted = [...sp.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

// List activities with filtering
export function useActivities(params: ActivitiesParams = {}, options?: { enabled?: boolean }) {
  const queryString = buildActivitiesQueryString(params);
  const url = `${API_BASE}/activities${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    // Serialized primitive key — keep stable across raw-object spreads in callers.
    queryKey: ["activities", queryString],
    queryFn: () => fetchJson<ActivitiesResponse>(url),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled,
    // Keep the prior result visible while a new filter/sort/page request
    // is in flight. Without this, the Table view flashes to a skeleton on
    // every checkbox toggle, which feels unresponsive even though the
    // request itself is fast (~800ms).
    placeholderData: keepPreviousData,
  });
}

// Fetch single activity
// placeholderData keeps the previously-shown activity visible while a new one
// loads after a prev/next nav inside the drawer — without it, the panel would
// unmount its chrome and flash a "Loading…" state for ~200ms per click.
export function useActivity(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchJson<Activity>(`${API_BASE}/activities/${activityId}`),
    enabled: !!activityId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: keepPreviousData,
  });
}

// Returns a prefetcher for activity detail. Used to warm the cache for the
// drawer's prev/next neighbors so chevron clicks feel instant. The returned
// function is memoized so it's safe to use as a useEffect dependency.
export function usePrefetchActivity() {
  const queryClient = useQueryClient();
  return useCallback(
    (activityId: string) => {
      queryClient.prefetchQuery({
        queryKey: ["activity", activityId],
        queryFn: () => fetchJson<Activity>(`${API_BASE}/activities/${activityId}`),
        staleTime: 2 * 60 * 1000,
      });
    },
    [queryClient]
  );
}

// Create activity mutation
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: ActivityType;
      title: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: ActivityStatus;
      notes?: string | null;
      planIds?: string[];
      districtLeaids?: string[];
      contactIds?: number[];
      stateFips?: string[];
      metadata?: Record<string, unknown> | null;
      address?: string | null;
      addressLat?: number | null;
      addressLng?: number | null;
      inPerson?: boolean | null;
      attendeeUserIds?: string[];
      expenses?: { description: string; amount: number }[];
      districts?: { leaid: string; visitDate?: string; visitEndDate?: string; position?: number; notes?: string }[];
      relatedActivityIds?: { activityId: string; relationType: string }[];
      outcome?: string | null;
      outcomeType?: string | null;
      rating?: number | null;
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// Update activity mutation
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      ...data
    }: {
      activityId: string;
      type?: ActivityType;
      title?: string;
      startDate?: string | null;
      endDate?: string | null;
      status?: ActivityStatus;
      notes?: string | null;
      outcome?: string | null;
      outcomeType?: string | null;
      // Wave 1 outcome fields — see VALID_* constants in activities/types.ts
      sentiment?: "positive" | "neutral" | "negative" | null;
      nextStep?: string | null;
      followUpDate?: string | null;
      dealImpact?: "none" | "progressed" | "won" | "lost";
      outcomeDisposition?: "completed" | "no_show" | "rescheduled" | "cancelled" | null;
      rating?: number;
      opportunityIds?: string[];
      address?: string | null;
      addressLat?: number | null;
      addressLng?: number | null;
      inPerson?: boolean | null;
      metadata?: Record<string, unknown> | null;
      attendeeUserIds?: string[];
      contactIds?: number[];
      expenses?: { description: string; amount: number }[];
      districts?: { leaid: string; visitDate?: string | null; visitEndDate?: string | null; position?: number; notes?: string | null }[];
      createdByUserId?: string;
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    // Optimistic update: write scalar field changes into the cache before the
    // network round-trip, so toggle/select-style edits feel instant. Relation
    // edits (contactIds/attendeeUserIds/expenses/districts) need the server's
    // joined data to render meaningfully, so we let those wait for the
    // invalidate in onSettled.
    onMutate: async ({ activityId, ...patch }) => {
      const queryKey = ["activity", activityId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Activity>(queryKey);
      if (previous) {
        queryClient.setQueryData<Activity>(queryKey, {
          ...previous,
          ...(patch.type !== undefined && { type: patch.type }),
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.startDate !== undefined && { startDate: patch.startDate }),
          ...(patch.endDate !== undefined && { endDate: patch.endDate }),
          ...(patch.notes !== undefined && { notes: patch.notes }),
          ...(patch.outcome !== undefined && { outcome: patch.outcome }),
          ...(patch.outcomeType !== undefined && { outcomeType: patch.outcomeType }),
          ...(patch.sentiment !== undefined && { sentiment: patch.sentiment }),
          ...(patch.nextStep !== undefined && { nextStep: patch.nextStep }),
          ...(patch.followUpDate !== undefined && { followUpDate: patch.followUpDate }),
          ...(patch.dealImpact !== undefined && { dealImpact: patch.dealImpact }),
          ...(patch.outcomeDisposition !== undefined && {
            outcomeDisposition: patch.outcomeDisposition,
          }),
          ...(patch.address !== undefined && { address: patch.address }),
          ...(patch.addressLat !== undefined && { addressLat: patch.addressLat }),
          ...(patch.addressLng !== undefined && { addressLng: patch.addressLng }),
          ...(patch.inPerson !== undefined && { inPerson: patch.inPerson }),
          ...(patch.rating !== undefined && { rating: patch.rating }),
          ...(patch.metadata !== undefined && { metadata: patch.metadata }),
          ...(patch.createdByUserId !== undefined && { createdByUserId: patch.createdByUserId }),
        });
      }
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Bulk-update mutation for the Table view's selection bar. Optimistically
// patches every selected activity's cache entry, rolls back on error, then
// invalidates so the server's authoritative shape replaces the local guess.
//
// Note that the server returns per-row results — `succeeded` and `failed` —
// rather than 4xx for partial failures. Callers should check `failed.length`
// and surface a toast when non-empty so reps know which rows didn't apply.
export function useBulkUpdateActivities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: { ownerId?: string; status?: ActivityStatus };
    }) =>
      fetchJson<{
        succeeded: string[];
        failed: { id: string; reason: "not_found" | "forbidden" | "system_skip" }[];
      }>(`${API_BASE}/activities/bulk`, {
        method: "PATCH",
        body: JSON.stringify({ ids, updates }),
      }),
    onMutate: async ({ ids, updates }) => {
      // Snapshot all the entries we're about to touch so we can roll back.
      const snapshots = new Map<string, Activity | undefined>();
      for (const id of ids) {
        const key = ["activity", id] as const;
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Activity>(key);
        snapshots.set(id, previous);
        if (previous) {
          queryClient.setQueryData<Activity>(key, {
            ...previous,
            ...(updates.ownerId !== undefined && { createdByUserId: updates.ownerId }),
            ...(updates.status !== undefined && { status: updates.status }),
          });
        }
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (!context?.snapshots) return;
      for (const [id, snapshot] of context.snapshots.entries()) {
        if (snapshot) {
          queryClient.setQueryData(["activity", id], snapshot);
        }
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      for (const id of variables.ids) {
        queryClient.invalidateQueries({ queryKey: ["activity", id] });
      }
    },
  });
}

// Delete activity mutation
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/activities/${activityId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Link plans to activity mutation
export function useLinkActivityPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planIds }: { activityId: string; planIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/activities/${activityId}/plans`, {
        method: "POST",
        body: JSON.stringify({ planIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Unlink plan from activity mutation
export function useUnlinkActivityPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planId }: { activityId: string; planId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/plans/${planId}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Link districts to activity mutation
export function useLinkActivityDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaids }: { activityId: string; leaids: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/activities/${activityId}/districts`, {
        method: "POST",
        body: JSON.stringify({ leaids }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Fetch unlinked activities (synced but not matched to any district)
export function useUnlinkedActivities() {
  return useQuery<{ activities: any[]; count: number }>({
    queryKey: ["activities", "unlinked"],
    queryFn: () => fetchJson("/api/activities/unlinked"),
    staleTime: 2 * 60_000,
  });
}

// Search opportunities by name or ID
export function useOpportunitySearch(query: string) {
  return useQuery({
    queryKey: ["opportunities", "search", query],
    queryFn: () =>
      fetchJson<{ opportunities: OpportunityResult[] }>(
        `${API_BASE}/opportunities?search=${encodeURIComponent(query)}&limit=10`
      ).then((res) => res.opportunities),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Fetch calendar attendees for an activity
export function useCalendarAttendees(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId, "calendar-attendees"],
    queryFn: () =>
      fetchJson<{ attendees: CalendarAttendee[] }>(
        `${API_BASE}/activities/${activityId}/calendar-attendees`
      ).then((res) => res.attendees),
    enabled: !!activityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Unlink district from activity mutation
export function useUnlinkActivityDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaid }: { activityId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/districts/${leaid}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Search contacts (external district personnel)
interface ContactSearchResult {
  id: number;
  leaid: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  districtName: string | null;
}

export function useSearchContacts(search: string, leaid?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (leaid) params.set("leaid", leaid);
  params.set("limit", "20");

  return useQuery({
    queryKey: ["contacts", "search", search, leaid],
    queryFn: () =>
      fetchJson<{ contacts: ContactSearchResult[]; total: number }>(
        `${API_BASE}/contacts?${params}`
      ),
    enabled: search.length >= 1 || !!leaid,
    staleTime: 30 * 1000,
  });
}

// ===== Drawer: Notes (threaded log) =====

export interface ActivityNoteEntry {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export function useActivityNotes(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId, "notes"],
    queryFn: () =>
      fetchJson<{ notes: ActivityNoteEntry[] }>(
        `${API_BASE}/activities/${activityId}/notes`
      ).then((res) => res.notes),
    enabled: !!activityId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateActivityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, body }: { activityId: string; body: string }) =>
      fetchJson<ActivityNoteEntry>(`${API_BASE}/activities/${activityId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["activity", vars.activityId, "notes"] });
    },
  });
}

export function useDeleteActivityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, noteId }: { activityId: string; noteId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/notes/${noteId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["activity", vars.activityId, "notes"] });
    },
  });
}

// ===== Drawer: Attachments (files + photos) =====

export interface ActivityAttachmentMeta {
  id: string;
  kind: "photo" | "file";
  name: string;
  sizeBytes: number;
  mime: string;
  uploadedAt: string;
  uploader: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export function useActivityAttachments(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId, "attachments"],
    queryFn: () =>
      fetchJson<{ attachments: ActivityAttachmentMeta[] }>(
        `${API_BASE}/activities/${activityId}/attachments`
      ).then((res) => res.attachments),
    enabled: !!activityId,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useUploadActivityAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, file }: { activityId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/activities/${activityId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "upload_failed");
      }
      return (await res.json()) as ActivityAttachmentMeta;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["activity", vars.activityId, "attachments"],
      });
    },
  });
}

export function useDeleteActivityAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, attachmentId }: { activityId: string; attachmentId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/attachments/${attachmentId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["activity", vars.activityId, "attachments"],
      });
    },
  });
}

// Resolve a short-lived signed URL for one attachment (used to render <img>/anchor src).
export function useActivityAttachmentUrl(
  activityId: string | null,
  attachmentId: string | null
) {
  return useQuery({
    queryKey: ["activity", activityId, "attachment-url", attachmentId],
    queryFn: () =>
      fetchJson<{ url: string }>(
        `${API_BASE}/activities/${activityId}/attachments/${attachmentId}/url`
      ).then((res) => res.url),
    enabled: !!activityId && !!attachmentId,
    staleTime: 50 * 60 * 1000, // refresh just before the 60-min signed URL TTL
  });
}

// ===== Drawer / page: Expense mutations (Wave 1) =====

export interface ActivityExpenseInput {
  category: string;
  description: string;
  amount: number;
  incurredOn: string;
  receiptStoragePath?: string | null;
}

export function useCreateActivityExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, expense }: { activityId: string; expense: ActivityExpenseInput }) =>
      fetchJson<{
        id: string;
        description: string;
        amount: number;
        amountCents: number;
        category: string;
        incurredOn: string;
        receiptStoragePath: string | null;
        createdById: string | null;
      }>(`${API_BASE}/activities/${activityId}/expenses`, {
        method: "POST",
        body: JSON.stringify(expense),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["activity", vars.activityId] });
    },
  });
}

export function useDeleteActivityExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, expenseId }: { activityId: string; expenseId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/expenses/${expenseId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["activity", vars.activityId] });
    },
  });
}

// ===== Deal layer (Wave 1) =====

export interface DealEventsParams {
  from: string; // ISO datetime
  to: string;   // ISO datetime
  ownerId?: string;
  state?: string | string[];
}

export interface OpenDealsParams {
  ownerId?: string;
  state?: string | string[];
  limit?: number;
}

function buildDealEventsQuery(params: DealEventsParams): string {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.ownerId) sp.set("ownerId", params.ownerId);
  const state = csvParam(params.state);
  if (state) sp.set("state", state);
  const sorted = [...sp.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

function buildOpenDealsQuery(params: OpenDealsParams): string {
  const sp = new URLSearchParams();
  if (params.ownerId) sp.set("ownerId", params.ownerId);
  const state = csvParam(params.state);
  if (state) sp.set("state", state);
  if (params.limit) sp.set("limit", params.limit.toString());
  const sorted = [...sp.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

export function useDealEvents(params: DealEventsParams, options?: { enabled?: boolean }) {
  const queryString = buildDealEventsQuery(params);
  return useQuery({
    queryKey: ["deals", "events", queryString],
    queryFn: () => fetchJson<OppEventsResponse>(`${API_BASE}/deals/events?${queryString}`),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? (!!params.from && !!params.to),
  });
}

export function useOpenDeals(params: OpenDealsParams = {}, options?: { enabled?: boolean }) {
  const queryString = buildOpenDealsQuery(params);
  return useQuery({
    queryKey: ["deals", "open", queryString],
    queryFn: () =>
      fetchJson<OpenDealsResponse>(
        `${API_BASE}/deals/open${queryString ? `?${queryString}` : ""}`
      ),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled,
  });
}

