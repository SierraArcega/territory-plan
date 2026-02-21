import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { StatusFilter, FiscalYear, MetricType } from "./store";
import type { ActivityType, ActivityCategory, ActivityStatus } from "@/features/activities/types";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  Tag,
  Contact,
  ContactsResponse,
  ClayLookupResponse,
  Quantiles,
  UserSummary,
  UserProfile,
  UserGoal,
  Service,
  GoalDashboard,
  CustomerDotsGeoJSON,
  StateDetail,
  StateDistrictsResponse,
  ActivitiesParams,
  ActivitiesResponse,
  Activity,
  CalendarConnection,
  CalendarStatusResponse,
  CalendarSyncResult,
  CalendarInboxResponse,
  ExploreResponse,
  FocusModeData,
  ProgressPeriod,
  ActivityMetrics,
  OutcomeMetrics,
  PlanEngagement,
} from "@/features/shared/types/api-types";

// Re-export shared types and api-client for consumers
export { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
export type * from "@/features/shared/types/api-types";

// Re-export feature queries
export * from "@/features/districts/lib/queries";
export * from "@/features/plans/lib/queries";
export * from "@/features/tasks/lib/queries";

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

// Quantiles for legend
export function useQuantiles(metric: MetricType, year: FiscalYear) {
  return useQuery({
    queryKey: ["quantiles", metric, year],
    queryFn: () =>
      fetchJson<Quantiles>(
        `${API_BASE}/metrics/quantiles?metric=${metric}&year=${year}`
      ),
    staleTime: 10 * 60 * 1000, // 10 minutes - quantiles rarely change
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

// States list
export function useStates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["states"],
    queryFn: () =>
      fetchJson<{ fips: string; abbrev: string; name: string }[]>(`${API_BASE}/states`),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - states are static
    enabled: options?.enabled,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<UserSummary[]>(`${API_BASE}/users`),
    staleTime: 10 * 60 * 1000,
  });
}

// Customer dots for national view
export function useCustomerDots() {
  return useQuery({
    queryKey: ["customerDots"],
    queryFn: () => fetchJson<CustomerDotsGeoJSON>(`${API_BASE}/customer-dots`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// State detail hook
export function useStateDetail(stateCode: string | null) {
  return useQuery({
    queryKey: ["stateDetail", stateCode],
    queryFn: () => fetchJson<StateDetail>(`${API_BASE}/states/${stateCode}`),
    enabled: !!stateCode,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// State districts hook with search and filter support
export function useStateDistricts(params: {
  stateCode: string | null;
  search?: string;
  status?: "all" | "customer" | "pipeline" | "customer_pipeline";
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  const queryString = searchParams.toString();
  const url = `${API_BASE}/states/${params.stateCode}/districts${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["stateDistricts", params],
    queryFn: () => fetchJson<StateDistrictsResponse>(url),
    enabled: !!params.stateCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Update state notes/owner mutation
export function useUpdateState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stateCode,
      notes,
      territoryOwner,
    }: {
      stateCode: string;
      notes?: string;
      territoryOwner?: string;
    }) =>
      fetchJson<{ code: string; notes: string | null; territoryOwner: string | null }>(
        `${API_BASE}/states/${stateCode}`,
        {
          method: "PUT",
          body: JSON.stringify({ notes, territoryOwner }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stateDetail", variables.stateCode] });
    },
  });
}

// ===== Activities =====

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
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
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

// ===== User Profile & Goals =====

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

// Create or update a user goal (upserts by fiscalYear)
export function useUpsertUserGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      fiscalYear: number;
      earningsTarget?: number | null;
      takeRatePercent?: number | null;
      renewalTarget?: number | null;
      winbackTarget?: number | null;
      expansionTarget?: number | null;
      newBusinessTarget?: number | null;
      takeTarget?: number | null;
      newDistrictsTarget?: number | null;
    }) =>
      fetchJson<UserGoal>(`${API_BASE}/profile/goals`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
    },
  });
}

// Delete a user goal
export function useDeleteUserGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fiscalYear: number) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/profile/goals/${fiscalYear}`, {
        method: "DELETE",
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

// ===== Goal Dashboard =====

export function useGoalDashboard(fiscalYear: number | null) {
  return useQuery({
    queryKey: ["goalDashboard", fiscalYear],
    queryFn: () =>
      fetchJson<GoalDashboard>(`${API_BASE}/profile/goals/${fiscalYear}/dashboard`),
    enabled: !!fiscalYear,
    staleTime: 2 * 60 * 1000, // 2 minutes
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

// ===== Google Calendar Sync =====

// --- Calendar Connection Hooks ---

// Check if the user has a Google Calendar connection and get its status
export function useCalendarConnection() {
  return useQuery({
    queryKey: ["calendarConnection"],
    queryFn: () => fetchJson<CalendarStatusResponse>(`${API_BASE}/calendar/status`),
    staleTime: 5 * 60 * 1000, // 5 minutes — connection status doesn't change often
  });
}

// Disconnect Google Calendar
export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/calendar/disconnect`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

// Update calendar connection settings (sync toggle, company domain)
export function useUpdateCalendarSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { syncEnabled?: boolean; companyDomain?: string }) =>
      fetchJson<{ connection: CalendarConnection }>(
        `${API_BASE}/calendar/status`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// --- Calendar Sync Hooks ---

// Trigger a calendar sync — pulls events from Google Calendar and stages them
export function useTriggerCalendarSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<CalendarSyncResult>(`${API_BASE}/calendar/sync`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Refresh inbox and connection status after sync
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// --- Calendar Inbox Hooks ---

// List calendar events (defaults to pending = the inbox)
export function useCalendarInbox(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);

  return useQuery({
    queryKey: ["calendarEvents", status || "pending"],
    queryFn: () =>
      fetchJson<CalendarInboxResponse>(
        `${API_BASE}/calendar/events?${params.toString()}`
      ),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get just the pending count (for badge display on nav tabs)
// Uses the same endpoint as useCalendarConnection which returns pendingCount
export function useCalendarInboxCount() {
  return useQuery({
    queryKey: ["calendarConnection"],
    queryFn: () => fetchJson<CalendarStatusResponse>(`${API_BASE}/calendar/status`),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.pendingCount,
  });
}

// Confirm a calendar event → creates an Activity
export function useConfirmCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      ...overrides
    }: {
      eventId: string;
      activityType?: string;
      title?: string;
      planIds?: string[];
      districtLeaids?: string[];
      contactIds?: number[];
      notes?: string;
    }) =>
      fetchJson<{ activityId: string }>(
        `${API_BASE}/calendar/events/${eventId}`,
        { method: "POST", body: JSON.stringify(overrides) }
      ),
    onSuccess: () => {
      // Refresh inbox, activities, and connection (pending count changes)
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Dismiss a calendar event (hide from inbox)
export function useDismissCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/calendar/events/${eventId}`,
        { method: "PATCH" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// Batch confirm all high-confidence pending events
export function useBatchConfirmCalendarEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ confirmed: number; activityIds: string[] }>(
        `${API_BASE}/calendar/events/batch-confirm`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
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

// ─── Focus Mode Types & Hook ─────────────────────────────────────────

export function useFocusModeData(planId: string | null) {
  return useQuery({
    queryKey: ["focusMode", planId],
    queryFn: () => fetchJson<FocusModeData>(`${API_BASE}/focus-mode/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Progress Dashboard Types & Hooks ────────────────────────────────

// Activity metrics — counts by category, source, status, plan, with trends
export function useActivityMetrics(period: ProgressPeriod = "month") {
  return useQuery({
    queryKey: ["progress", "activities", period],
    queryFn: () =>
      fetchJson<ActivityMetrics>(`${API_BASE}/progress/activities?period=${period}`),
    staleTime: 5 * 60 * 1000, // 5 minutes — dashboard data doesn't need to be real-time
  });
}

// Outcome metrics — distribution, funnel, district engagement
export function useOutcomeMetrics(period: ProgressPeriod = "month") {
  return useQuery({
    queryKey: ["progress", "outcomes", period],
    queryFn: () =>
      fetchJson<OutcomeMetrics>(`${API_BASE}/progress/outcomes?period=${period}`),
    staleTime: 5 * 60 * 1000,
  });
}

// Plan engagement — per-plan district coverage and activity recency
export function usePlanEngagement() {
  return useQuery({
    queryKey: ["progress", "plans"],
    queryFn: () => fetchJson<PlanEngagement[]>(`${API_BASE}/progress/plans`),
    staleTime: 5 * 60 * 1000,
  });
}
