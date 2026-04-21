import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { ActivityType, ActivityStatus } from "@/features/activities/types";
import type {
  ActivitiesParams,
  ActivitiesResponse,
  Activity,
} from "@/features/shared/types/api-types";
import type { OpportunityResult, CalendarAttendee } from "@/features/activities/lib/outcome-types-api";

// List activities with filtering
export function useActivities(params: ActivitiesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.planId) searchParams.set("planId", params.planId);
  if (params.districtLeaid) searchParams.set("districtLeaid", params.districtLeaid);
  if (params.stateCode) searchParams.set("stateCode", params.stateCode);
  if (params.type) searchParams.set("type", params.type);
  if (params.category) searchParams.set("category", params.category);
  if (params.status) searchParams.set("status", params.status);
  if (params.startDateFrom) searchParams.set("startDateFrom", params.startDateFrom);
  if (params.startDateTo) searchParams.set("startDateTo", params.startDateTo);
  if (params.unscheduled) searchParams.set("unscheduled", "true");
  if (params.needsPlanAssociation !== undefined)
    searchParams.set("needsPlanAssociation", params.needsPlanAssociation.toString());
  if (params.hasUnlinkedDistricts !== undefined)
    searchParams.set("hasUnlinkedDistricts", params.hasUnlinkedDistricts.toString());
  if (params.source) searchParams.set("source", params.source);
  if (params.ownerId) searchParams.set("ownerId", params.ownerId);
  if (params.search) searchParams.set("search", params.search);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE}/activities${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["activities", params],
    queryFn: () => fetchJson<ActivitiesResponse>(url),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single activity
export function useActivity(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchJson<Activity>(`${API_BASE}/activities/${activityId}`),
    enabled: !!activityId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
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
      rating?: number;
      opportunityIds?: string[];
      metadata?: Record<string, unknown> | null;
      attendeeUserIds?: string[];
      expenses?: { description: string; amount: number }[];
      districts?: { leaid: string; visitDate?: string | null; visitEndDate?: string | null; position?: number; notes?: string | null }[];
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
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

