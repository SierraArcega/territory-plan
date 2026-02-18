import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { StatusFilter, FiscalYear, MetricType } from "./store";
import type { ActivityType, ActivityCategory, ActivityStatus } from "./activityTypes";
import type { TaskStatus, TaskPriority } from "./taskTypes";

// Types
export interface District {
  leaid: string;
  name: string;
  stateAbbrev: string;
  stateFips: string;
  enrollment: number | null;
  lograde: string | null;
  higrade: string | null;
  // Contact info
  phone: string | null;
  streetLocation: string | null;
  cityLocation: string | null;
  stateLocation: string | null;
  zipLocation: string | null;
  // Geographic context
  countyName: string | null;
  urbanCentricLocale: number | null;
  // Additional characteristics
  numberOfSchools: number | null;
  specEdStudents: number | null;
  ellStudents: number | null;
  // External links
  websiteUrl: string | null;
  jobBoardUrl: string | null;
  // Centroid for tether line
  centroidLat: number | null;
  centroidLng: number | null;
  // Account type (district, cmo, esa_boces, etc.)
  accountType: string;
}

export interface FullmindData {
  leaid: string;
  accountName: string | null;
  salesExecutive: string | null;
  lmsid: string | null;
  // FY25 Sessions
  fy25SessionsRevenue: number;
  fy25SessionsTake: number;
  fy25SessionsCount: number;
  // FY26 Sessions
  fy26SessionsRevenue: number;
  fy26SessionsTake: number;
  fy26SessionsCount: number;
  // FY25 Bookings
  fy25ClosedWonOppCount: number;
  fy25ClosedWonNetBooking: number;
  fy25NetInvoicing: number;
  // FY26 Bookings
  fy26ClosedWonOppCount: number;
  fy26ClosedWonNetBooking: number;
  fy26NetInvoicing: number;
  // FY26 Pipeline
  fy26OpenPipelineOppCount: number;
  fy26OpenPipeline: number;
  fy26OpenPipelineWeighted: number;
  // FY27 Pipeline
  fy27OpenPipelineOppCount: number;
  fy27OpenPipeline: number;
  fy27OpenPipelineWeighted: number;
  // Computed
  isCustomer: boolean;
  hasOpenPipeline: boolean;
}

export interface DistrictEdits {
  leaid: string;
  notes: string | null;
  owner: string | null;
  updatedAt: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Service {
  id: number;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
}

export interface Contact {
  id: number;
  leaid: string;
  salutation: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  linkedinUrl: string | null;
  persona: string | null;
  seniorityLevel: string | null;
  createdAt: string;
  lastEnrichedAt: string | null;
}

export interface DistrictEducationData {
  leaid: string;
  // Finance data
  totalRevenue: number | null;
  federalRevenue: number | null;
  stateRevenue: number | null;
  localRevenue: number | null;
  totalExpenditure: number | null;
  expenditurePerPupil: number | null;
  financeDataYear: number | null;
  // Poverty data
  childrenPovertyCount: number | null;
  childrenPovertyPercent: number | null;
  medianHouseholdIncome: number | null;
  saipeDataYear: number | null;
  // Graduation data
  graduationRateTotal: number | null;
  graduationDataYear: number | null;
  // Staffing & Salaries
  salariesTotal: number | null;
  salariesInstruction: number | null;
  salariesTeachersRegular: number | null;
  salariesTeachersSpecialEd: number | null;
  salariesTeachersVocational: number | null;
  salariesTeachersOther: number | null;
  salariesSupportAdmin: number | null;
  salariesSupportInstructional: number | null;
  benefitsTotal: number | null;
  // Staff counts (FTE)
  teachersFte: number | null;
  teachersElementaryFte: number | null;
  teachersSecondaryFte: number | null;
  adminFte: number | null;
  guidanceCounselorsFte: number | null;
  instructionalAidesFte: number | null;
  supportStaffFte: number | null;
  staffTotalFte: number | null;
  staffDataYear: number | null;
  // Chronic absenteeism (aggregated from school-level CRDC)
  chronicAbsenteeismCount: number | null;
  chronicAbsenteeismRate: number | null;
  absenteeismDataYear: number | null;
}

export interface DistrictEnrollmentDemographics {
  leaid: string;
  enrollmentWhite: number | null;
  enrollmentBlack: number | null;
  enrollmentHispanic: number | null;
  enrollmentAsian: number | null;
  enrollmentAmericanIndian: number | null;
  enrollmentPacificIslander: number | null;
  enrollmentTwoOrMore: number | null;
  totalEnrollment: number | null;
  demographicsDataYear: number | null;
}

export interface DistrictTrends {
  // Derived percentages
  swdPct: number | null;
  ellPct: number | null;
  // Staffing ratios
  studentTeacherRatio: number | null;
  studentStaffRatio: number | null;
  spedStudentTeacherRatio: number | null;
  // 3-year trends
  enrollmentTrend3yr: number | null;
  staffingTrend3yr: number | null;
  vacancyPressureSignal: number | null;
  swdTrend3yr: number | null;
  ellTrend3yr: number | null;
  absenteeismTrend3yr: number | null;
  graduationTrend3yr: number | null;
  studentTeacherRatioTrend3yr: number | null;
  mathProficiencyTrend3yr: number | null;
  readProficiencyTrend3yr: number | null;
  expenditurePpTrend3yr: number | null;
  // State comparison deltas (positive = above state avg)
  absenteeismVsState: number | null;
  graduationVsState: number | null;
  studentTeacherRatioVsState: number | null;
  swdPctVsState: number | null;
  ellPctVsState: number | null;
  mathProficiencyVsState: number | null;
  readProficiencyVsState: number | null;
  expenditurePpVsState: number | null;
  // National comparison deltas
  absenteeismVsNational: number | null;
  graduationVsNational: number | null;
  studentTeacherRatioVsNational: number | null;
  swdPctVsNational: number | null;
  ellPctVsNational: number | null;
  mathProficiencyVsNational: number | null;
  readProficiencyVsNational: number | null;
  expenditurePpVsNational: number | null;
  // Quartile flags within state
  absenteeismQuartileState: string | null;
  graduationQuartileState: string | null;
  studentTeacherRatioQuartileState: string | null;
  swdPctQuartileState: string | null;
  ellPctQuartileState: string | null;
  mathProficiencyQuartileState: string | null;
  readProficiencyQuartileState: string | null;
  expenditurePpQuartileState: string | null;
}

export interface DistrictDetail {
  district: District;
  fullmindData: FullmindData | null;
  edits: DistrictEdits | null;
  tags: Tag[];
  contacts: Contact[];
  territoryPlanIds: string[];
  educationData: DistrictEducationData | null;
  enrollmentDemographics: DistrictEnrollmentDemographics | null;
  trends: DistrictTrends | null;
}

export interface DistrictListItem {
  leaid: string;
  name: string;
  stateAbbrev: string;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  metricValue: number;
}

export interface UnmatchedAccount {
  id: number;
  accountName: string;
  salesExecutive: string | null;
  stateAbbrev: string;
  lmsid: string | null;
  leaidRaw: string | null;
  matchFailureReason: string;
  fy25NetInvoicing: number;
  fy26NetInvoicing: number;
  fy26OpenPipeline: number;
  fy27OpenPipeline: number;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
}

export interface StateSummary {
  stateAbbrev: string;
  unmatchedCount: number;
  totalPipeline: number;
  totalInvoicing: number;
}

export interface Quantiles {
  breaks: number[];
  colors: string[];
  min: number;
  max: number;
  count: number;
}

// Territory Plan types

export interface PlanOwner {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface PlanState {
  fips: string;
  abbrev: string;
  name: string;
}

export interface PlanCollaborator {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface TerritoryPlan {
  id: string;
  name: string;
  description: string | null;
  owner: PlanOwner | null;
  color: string;
  status: "planning" | "working" | "stale" | "archived";
  fiscalYear: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  districtCount: number;
  totalEnrollment: number;
  stateCount: number;
  states: PlanState[];
  collaborators: PlanCollaborator[];
  taskCount: number;
  completedTaskCount: number;
}

export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  notes: string | null;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
  tags: Array<{ id: number; name: string; color: string }>;
}

export interface TerritoryPlanDetail extends Omit<TerritoryPlan, "districtCount"> {
  districts: TerritoryPlanDistrict[];
}

// API Functions
const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    // Try to read the error body for more context
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || JSON.stringify(body);
    } catch {
      // Response body isn't JSON (e.g., HTML from a redirect)
      if (res.redirected) {
        detail = "Session expired - please refresh the page";
      }
    }
    throw new Error(
      detail
        ? `${res.status}: ${detail}`
        : `API Error: ${res.status} ${res.statusText}`
    );
  }
  // Verify we actually got JSON (not HTML from a redirect)
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    throw new Error("Session expired - please refresh the page");
  }
  return res.json();
}

// District queries
export function useDistricts(params: {
  state?: string | null;
  status?: StatusFilter;
  salesExecutive?: string | null;
  search?: string;
  metric?: MetricType;
  year?: FiscalYear;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.state) searchParams.set("state", params.state);
  if (params.status && params.status !== "all")
    searchParams.set("status", params.status);
  if (params.salesExecutive) searchParams.set("salesExec", params.salesExecutive);
  if (params.search) searchParams.set("search", params.search);
  if (params.metric) searchParams.set("metric", params.metric);
  if (params.year) searchParams.set("year", params.year);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());

  return useQuery({
    queryKey: ["districts", params],
    queryFn: () =>
      fetchJson<{ districts: DistrictListItem[]; total: number }>(
        `${API_BASE}/districts?${searchParams}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes - district lists don't change often
  });
}

export function useDistrictDetail(leaid: string | null) {
  return useQuery({
    queryKey: ["district", leaid],
    queryFn: () => fetchJson<DistrictDetail>(`${API_BASE}/districts/${leaid}`),
    enabled: !!leaid,
    staleTime: 10 * 60 * 1000, // 10 minutes - district details rarely change
  });
}

// District edits mutations
export function useUpdateDistrictEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaid,
      notes,
      owner,
    }: {
      leaid: string;
      notes?: string;
      owner?: string;
    }) =>
      fetchJson<DistrictEdits>(`${API_BASE}/districts/${leaid}/edits`, {
        method: "PUT",
        body: JSON.stringify({ notes, owner }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
    },
  });
}

// Batch operations
interface BatchEditParams {
  leaids?: string[];
  filters?: { column: string; op: string; value?: unknown }[];
  owner?: string;
  notes?: string;
}

export function useBatchEditDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaids, filters, owner, notes }: BatchEditParams) =>
      fetchJson<{ updated: number }>(`${API_BASE}/districts/batch-edits`, {
        method: "POST",
        body: JSON.stringify({ leaids, filters, owner, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

interface BatchTagParams {
  leaids?: string[];
  filters?: { column: string; op: string; value?: unknown }[];
  action: "add" | "remove";
  tagId: number;
}

export function useBatchTagDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaids, filters, action, tagId }: BatchTagParams) =>
      fetchJson<{ updated: number }>(`${API_BASE}/districts/batch-tags`, {
        method: "POST",
        body: JSON.stringify({ leaids, filters, action, tagId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}

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
    },
  });
}

// Contacts

export interface ContactListItem {
  id: number;
  leaid: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  districtName: string | null;
}

export interface ContactsResponse {
  contacts: ContactListItem[];
  total: number;
}

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
export interface ClayLookupResponse {
  success: boolean;
  message: string;
  district?: {
    leaid: string;
    name: string;
    state: string | null;
  };
  error?: string;
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
      // Invalidate district query to refetch contacts once Clay responds
      // Note: Contacts will appear after Clay processes and calls our webhook
      queryClient.invalidateQueries({ queryKey: ["district", leaid] });
    },
  });
}

// Unmatched accounts
export function useUnmatchedByState(stateAbbrev: string | null) {
  return useQuery({
    queryKey: ["unmatched", stateAbbrev],
    queryFn: () =>
      fetchJson<UnmatchedAccount[]>(
        `${API_BASE}/unmatched?state=${stateAbbrev}`
      ),
    enabled: !!stateAbbrev,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStateSummaries() {
  return useQuery({
    queryKey: ["unmatched", "summaries"],
    queryFn: () => fetchJson<StateSummary[]>(`${API_BASE}/unmatched/by-state`),
    staleTime: 5 * 60 * 1000, // 5 minutes
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

// Territory Plans
export function useTerritoryPlans(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["territoryPlans"],
    queryFn: () => fetchJson<TerritoryPlan[]>(`${API_BASE}/territory-plans`),
    staleTime: 2 * 60 * 1000, // 2 minutes - plans may change during session
    enabled: options?.enabled,
  });
}

export interface UserSummary {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string;
  jobTitle: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<UserSummary[]>(`${API_BASE}/users`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useTerritoryPlan(planId: string | null) {
  return useQuery({
    queryKey: ["territoryPlan", planId],
    queryFn: () =>
      fetchJson<TerritoryPlanDetail>(`${API_BASE}/territory-plans/${planId}`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePlanContacts(planId: string | null) {
  return useQuery({
    queryKey: ["planContacts", planId],
    queryFn: () =>
      fetchJson<Contact[]>(`${API_BASE}/territory-plans/${planId}/contacts`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCreateTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: {
      name: string;
      description?: string;
      ownerId?: string;
      color?: string;
      status?: "planning" | "working" | "stale" | "archived";
      fiscalYear: number;
      startDate?: string;
      endDate?: string;
      stateFips?: string[];
      collaboratorIds?: string[];
    }) =>
      fetchJson<TerritoryPlan>(`${API_BASE}/territory-plans`, {
        method: "POST",
        body: JSON.stringify(plan),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
    },
  });
}

export function useUpdateTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      ownerId?: string | null;
      color?: string;
      status?: "planning" | "working" | "stale" | "archived";
      fiscalYear?: number;
      startDate?: string;
      endDate?: string;
      stateFips?: string[];
      collaboratorIds?: string[];
    }) =>
      fetchJson<TerritoryPlan>(`${API_BASE}/territory-plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.id] });
    },
  });
}

export function useDeleteTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/territory-plans/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
    },
  });
}

export function useAddDistrictsToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      leaids,
      filters,
    }: {
      planId: string;
      leaids?: string | string[];
      filters?: { column: string; op: string; value?: unknown }[];
    }) =>
      fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids, filters }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
    },
  });
}

export function useRemoveDistrictFromPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, leaid }: { planId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
    },
  });
}

// Similar districts types
export type SimilarMetricKey =
  | "enrollment"
  | "locale"
  | "medianIncome"
  | "expenditurePerPupil"
  | "avgSalary"
  | "ellPercent"
  | "swdPercent"
  | "pocRate";

export type SimilarityTolerance = "tight" | "medium" | "loose";

export interface SimilarDistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  distanceScore: number;
  metrics: Record<string, { value: number | string | null; sourceValue: number | string | null }>;
  territoryPlanIds: string[];
}

export interface SimilarDistrictsResponse {
  results: SimilarDistrictResult[];
  sourceMetrics: Record<string, number | null>;
  total: number;
}

// Similar districts hook
export function useSimilarDistricts(params: {
  leaid: string | null;
  metrics: SimilarMetricKey[];
  tolerance: SimilarityTolerance;
  enabled?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.leaid) searchParams.set("leaid", params.leaid);
  if (params.metrics.length > 0) searchParams.set("metrics", params.metrics.join(","));
  searchParams.set("tolerance", params.tolerance);

  return useQuery({
    queryKey: ["similarDistricts", params],
    queryFn: () =>
      fetchJson<SimilarDistrictsResponse>(
        `${API_BASE}/districts/similar?${searchParams}`
      ),
    enabled: params.enabled !== false && !!params.leaid && params.metrics.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes - expensive calculation
  });
}

// Customer dots for national view
export type DotCategory = "multi_year" | "new" | "lapsed" | "pipeline" | "target";

export interface CustomerDotFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    leaid: string;
    name: string;
    stateAbbrev: string;
    category: DotCategory;
  };
}

export interface CustomerDotsGeoJSON {
  type: "FeatureCollection";
  features: CustomerDotFeature[];
}

export function useCustomerDots() {
  return useQuery({
    queryKey: ["customerDots"],
    queryFn: () => fetchJson<CustomerDotsGeoJSON>(`${API_BASE}/customer-dots`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// State detail types
export interface StateAggregates {
  totalDistricts: number;
  totalEnrollment: number | null;
  totalSchools: number | null;
  totalCustomers: number;
  totalWithPipeline: number;
  totalPipelineValue: number | null;
  avgExpenditurePerPupil: number | null;
  avgGraduationRate: number | null;
  avgPovertyRate: number | null;
}

export interface StateTerritoryPlan {
  id: string;
  name: string;
  owner: string | null;
  color: string;
  status: string;
  districtCount: number;
}

export interface StateDetail {
  code: string;
  fips: string | null;
  name: string;
  aggregates: StateAggregates;
  territoryOwner: string | null;
  notes: string | null;
  territoryPlans: StateTerritoryPlan[];
}

export interface StateDistrictListItem {
  leaid: string;
  name: string;
  enrollment: number | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  salesExecutive: string | null;
  fy26NetInvoicing: number;
  fy26OpenPipeline: number;
  fy27OpenPipeline: number;
  tags: Array<{ id: number; name: string; color: string }>;
}

export interface StateDistrictsResponse {
  districts: StateDistrictListItem[];
  total: number;
  limit: number;
  offset: number;
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

export interface ActivityPlanLink {
  planId: string;
  planName: string;
  planColor: string;
}

export interface ActivityDistrictLink {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  warningDismissed: boolean;
  isInPlan: boolean; // computed: is this district in any of the activity's linked plans?
}

export interface ActivityContactLink {
  id: number;
  name: string;
  title: string | null;
}

export interface ActivityStateLink {
  fips: string;
  abbrev: string;
  name: string;
  isExplicit: boolean;
}

export interface Activity {
  id: string;
  type: ActivityType;
  category: ActivityCategory; // computed from type
  title: string;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ActivityStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  // Calendar sync fields
  googleEventId: string | null;
  source: "manual" | "calendar_sync";
  // Outcome tracking fields
  outcome: string | null;
  outcomeType: string | null;
  // Computed flags
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
  // Relations
  plans: ActivityPlanLink[];
  districts: ActivityDistrictLink[];
  contacts: ActivityContactLink[];
  states: ActivityStateLink[];
}

export interface ActivityListItem {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: ActivityStatus;
  source: "manual" | "calendar_sync";
  outcomeType: string | null;
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
  planCount: number;
  districtCount: number;
  stateAbbrevs: string[];
}

export interface ActivitiesResponse {
  activities: ActivityListItem[];
  total: number;
}

// Activities API params type
export interface ActivitiesParams {
  planId?: string;
  districtLeaid?: string;
  stateCode?: string;
  type?: ActivityType;
  category?: ActivityCategory;
  status?: ActivityStatus;
  startDateFrom?: string;
  startDateTo?: string;
  unscheduled?: boolean;
  needsPlanAssociation?: boolean;
  hasUnlinkedDistricts?: boolean;
  limit?: number;
  offset?: number;
}

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

// User goal with targets and calculated actuals for progress tracking
export interface UserGoal {
  id: number;
  fiscalYear: number;
  // User inputs
  earningsTarget: number | null;
  takeRatePercent: number | null;
  newDistrictsTarget: number | null;
  // Calculated targets (from earnings + take rate)
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  takeTarget: number | null;
  // Calculated actuals from territory plan districts
  revenueActual: number;
  takeActual: number;
  pipelineActual: number;
  newDistrictsActual: number;
}

// User profile synced from Supabase Auth
export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
  phone: string | null;
  slackUrl: string | null;
  bio: string | null;
  hasCompletedSetup: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  goals: UserGoal[];
}

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

// ===== District Targets =====

export interface PlanDistrictDetail {
  planId: string;
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  notes: string | null;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
}

export function usePlanDistrictDetail(planId: string | null, leaid: string | null) {
  return useQuery({
    queryKey: ["planDistrict", planId, leaid],
    queryFn: () =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`
      ),
    enabled: !!planId && !!leaid,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUpdateDistrictTargets() {
  const queryClient = useQueryClient();

  type UpdateVars = {
    planId: string;
    leaid: string;
    renewalTarget?: number | null;
    winbackTarget?: number | null;
    expansionTarget?: number | null;
    newBusinessTarget?: number | null;
    notes?: string | null;
    returnServiceIds?: number[];
    newServiceIds?: number[];
  };

  return useMutation({
    mutationFn: ({ planId, leaid, ...data }: UpdateVars) =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    onMutate: async (variables) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["territoryPlan", variables.planId] });

      const planKey = ["territoryPlan", variables.planId] as const;
      const previousPlan = queryClient.getQueryData<TerritoryPlanDetail>(planKey);

      if (previousPlan) {
        // Optimistically update the specific district in the cached plan
        const allServices = queryClient.getQueryData<Service[]>(["services"]) || [];

        queryClient.setQueryData<TerritoryPlanDetail>(planKey, {
          ...previousPlan,
          districts: previousPlan.districts.map((d) => {
            if (d.leaid !== variables.leaid) return d;
            const updated = { ...d };

            // Patch target fields that were sent
            if (variables.renewalTarget !== undefined) updated.renewalTarget = variables.renewalTarget;
            if (variables.winbackTarget !== undefined) updated.winbackTarget = variables.winbackTarget;
            if (variables.expansionTarget !== undefined) updated.expansionTarget = variables.expansionTarget;
            if (variables.newBusinessTarget !== undefined) updated.newBusinessTarget = variables.newBusinessTarget;
            if (variables.notes !== undefined) updated.notes = variables.notes;

            // Patch services if sent
            if (variables.returnServiceIds !== undefined) {
              updated.returnServices = variables.returnServiceIds
                .map((id) => allServices.find((s) => s.id === id))
                .filter((s): s is Service => !!s)
                .map((s) => ({ id: s.id, name: s.name, slug: s.slug, color: s.color }));
            }
            if (variables.newServiceIds !== undefined) {
              updated.newServices = variables.newServiceIds
                .map((id) => allServices.find((s) => s.id === id))
                .filter((s): s is Service => !!s)
                .map((s) => ({ id: s.id, name: s.name, slug: s.slug, color: s.color }));
            }

            return updated;
          }),
        });
      }

      return { previousPlan };
    },
    onError: (_err, variables, context) => {
      // Roll back to previous state on error
      if (context?.previousPlan) {
        queryClient.setQueryData(["territoryPlan", variables.planId], context.previousPlan);
      }
    },
    onSettled: (_, _err, variables) => {
      // Background-refresh the single district detail (lightweight)
      queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
      // Debounce the dashboard refresh — it's not urgent
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
    },
  });
}

// ===== Goal Dashboard =====

export interface GoalDashboard {
  fiscalYear: number;
  goals: {
    earningsTarget: number | null;
    takeRatePercent: number | null;
    renewalTarget: number | null;
    winbackTarget: number | null;
    expansionTarget: number | null;
    newBusinessTarget: number | null;
    takeTarget: number | null;
    newDistrictsTarget: number | null;
  } | null;
  planTotals: {
    renewalTarget: number;
    winbackTarget: number;
    expansionTarget: number;
    newBusinessTarget: number;
    totalTarget: number;
    districtCount: number;
    planCount: number;
  };
  actuals: {
    earnings: number;
    revenue: number;
    take: number;
    pipeline: number;
    newDistricts: number;
  };
  plans: Array<{
    id: string;
    name: string;
    color: string;
    status: string;
    districtCount: number;
    renewalTarget: number;
    winbackTarget: number;
    expansionTarget: number;
    newBusinessTarget: number;
    totalTarget: number;
  }>;
}

export function useGoalDashboard(fiscalYear: number | null) {
  return useQuery({
    queryKey: ["goalDashboard", fiscalYear],
    queryFn: () =>
      fetchJson<GoalDashboard>(`${API_BASE}/profile/goals/${fiscalYear}/dashboard`),
    enabled: !!fiscalYear,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ===== Data Reconciliation (FastAPI) =====

export interface ReconciliationUnmatchedAccount {
  account_id: string;
  account_name: string;
  state: string | null;
  sales_exec: string | null;
  total_revenue: number;
  opportunity_count: number;
}

export interface ReconciliationAccountVariant {
  name: string;
  source: "districts" | "opportunities";
  count: number;
}

export interface ReconciliationFragmentedDistrict {
  nces_id: string;
  district_name: string | null;
  state: string | null;
  account_variants: ReconciliationAccountVariant[];
  similarity_score: number;
}

export interface ReconciliationFilters {
  state?: string;
  salesExec?: string;
  limit?: number;
}

// Reconciliation hooks (fetch from FastAPI via proxy)
export function useReconciliationUnmatched(filters: ReconciliationFilters = {}) {
  const params = new URLSearchParams();
  params.set("type", "unmatched");
  if (filters.state) params.set("state", filters.state);
  if (filters.salesExec) params.set("salesExec", filters.salesExec);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "unmatched", filters],
    queryFn: () =>
      fetchJson<ReconciliationUnmatchedAccount[]>(
        `${API_BASE}/data/reconciliation?${params}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useReconciliationFragmented(filters: ReconciliationFilters = {}) {
  const params = new URLSearchParams();
  params.set("type", "fragmented");
  if (filters.state) params.set("state", filters.state);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "fragmented", filters],
    queryFn: () =>
      fetchJson<ReconciliationFragmentedDistrict[]>(
        `${API_BASE}/data/reconciliation?${params}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ===== District Profiles (FastAPI) =====

export interface DistrictProfileOpportunities {
  count: number;
  revenue: number;
  account_names_used: string[];
}

export interface DistrictProfileSchools {
  count: number;
  sample_names: string[];
}

export interface DistrictProfileSessions {
  count: number;
  revenue: number;
  schools_in_sessions: string[];
}

export interface DistrictProfileCourses {
  count: number;
}

export interface DistrictProfileTotals {
  entity_count: number;
  total_revenue: number;
}

export interface DistrictProfileDataQuality {
  has_nces: boolean;
  has_state: boolean;
  is_orphaned: boolean;
  has_opps: boolean;
  has_schools: boolean;
  has_sessions: boolean;
}

export interface DistrictProfile {
  district_id: string;
  district_name: string;
  state: string | null;
  state_sources: [string, string][];
  nces_id: string | null;
  exists_in_index: boolean;
  referenced_by: string[];
  opportunities: DistrictProfileOpportunities;
  schools: DistrictProfileSchools;
  sessions: DistrictProfileSessions;
  courses: DistrictProfileCourses;
  totals: DistrictProfileTotals;
  data_quality: DistrictProfileDataQuality;
}

export interface DistrictProfileFilters {
  include_orphaned?: boolean;
  min_total_entities?: number;
  state?: string;
  limit?: number;
}

export interface NcesLookupResult {
  match: { leaid: string; name: string; state: string | null } | null;
  confidence: "exact" | "partial" | "none";
}

export function useNcesLookup(name: string | null, state: string | null, enabled: boolean) {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (state) params.set("state", state);

  return useQuery({
    queryKey: ["nces-lookup", name, state],
    queryFn: () =>
      fetchJson<NcesLookupResult>(`${API_BASE}/districts/nces-lookup?${params}`),
    enabled: enabled && !!name,
    staleTime: 30 * 60 * 1000, // 30 minutes — NCES data doesn't change often
  });
}

export interface SnapshotMetadata {
  mode: "live" | "static";
  lastRefreshed?: string | null;
  counts?: Record<string, number>;
}

export function useSnapshotMetadata() {
  return useQuery({
    queryKey: ["snapshot-metadata"],
    queryFn: () => fetchJson<SnapshotMetadata>(`${API_BASE}/data/snapshot-metadata`),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useDistrictProfiles(filters: DistrictProfileFilters = {}) {
  const params = new URLSearchParams();
  if (filters.include_orphaned !== undefined)
    params.set("include_orphaned", String(filters.include_orphaned));
  if (filters.min_total_entities)
    params.set("min_total_entities", filters.min_total_entities.toString());
  if (filters.state) params.set("state", filters.state);
  if (filters.limit) params.set("limit", filters.limit.toString());

  return useQuery({
    queryKey: ["reconciliation", "district-profiles", filters],
    queryFn: () =>
      fetchJson<DistrictProfile[]>(
        `${API_BASE}/data/district-profiles?${params}`
      ),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ===== Tasks =====

// Linked entity types for tasks (used in list and detail views)
export interface TaskPlanLink {
  planId: string;
  planName: string;
  planColor: string;
}

export interface TaskDistrictLink {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
}

export interface TaskActivityLink {
  activityId: string;
  title: string;
  type: string;
}

export interface TaskContactLink {
  contactId: number;
  name: string;
  title: string | null;
}

// Full task object returned by GET /api/tasks and GET /api/tasks/[id]
export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  plans: TaskPlanLink[];
  districts: TaskDistrictLink[];
  activities: TaskActivityLink[];
  contacts: TaskContactLink[];
}

export interface TasksResponse {
  tasks: TaskItem[];
  totalCount: number;
}

// Filter parameters for the tasks list endpoint
export interface TasksParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  planId?: string;
  activityId?: string;
  leaid?: string;
  contactId?: string;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
}

// List tasks with filtering
export function useTasks(params: TasksParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.planId) searchParams.set("planId", params.planId);
  if (params.activityId) searchParams.set("activityId", params.activityId);
  if (params.leaid) searchParams.set("leaid", params.leaid);
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.search) searchParams.set("search", params.search);
  if (params.dueBefore) searchParams.set("dueBefore", params.dueBefore);
  if (params.dueAfter) searchParams.set("dueAfter", params.dueAfter);

  const queryString = searchParams.toString();
  const url = `${API_BASE}/tasks${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => fetchJson<TasksResponse>(url),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single task detail
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => fetchJson<TaskItem>(`${API_BASE}/tasks/${taskId}`),
    enabled: !!taskId,
    staleTime: 2 * 60 * 1000,
  });
}

// Create task
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      position?: number;
      planIds?: string[];
      activityIds?: string[];
      leaids?: string[];
      contactIds?: number[];
    }) =>
      fetchJson<TaskItem>(`${API_BASE}/tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Update task fields
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      ...data
    }: {
      taskId: string;
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      position?: number;
    }) =>
      fetchJson<TaskItem>(`${API_BASE}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Delete task
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Reorder tasks (batch update status + position for drag-and-drop)
// Uses optimistic updates so the kanban board feels instant
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { taskId: string; status: string; position: number }[]) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/tasks/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      }),
    // Optimistic update: immediately reflect the new order in the cache
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Snapshot current cache for rollback
      const previousQueries = queryClient.getQueriesData({ queryKey: ["tasks"] });

      // Update all matching task caches optimistically
      queryClient.setQueriesData<TasksResponse>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          const updateMap = new Map(updates.map((u) => [u.taskId, u]));
          return {
            ...old,
            tasks: old.tasks.map((task) => {
              const update = updateMap.get(task.id);
              if (update) {
                return { ...task, status: update.status as TaskStatus, position: update.position };
              }
              return task;
            }),
          };
        }
      );

      return { previousQueries };
    },
    // On error, roll back to the snapshot
    onError: (_err, _updates, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    // Always refetch after settle to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Link plans to a task
export function useLinkTaskPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, planIds }: { taskId: string; planIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/plans`, {
        method: "POST",
        body: JSON.stringify({ planIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a plan from a task
export function useUnlinkTaskPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, planId }: { taskId: string; planId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/plans/${planId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link districts to a task
export function useLinkTaskDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, leaids }: { taskId: string; leaids: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/districts`, {
        method: "POST",
        body: JSON.stringify({ leaids }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a district from a task
export function useUnlinkTaskDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, leaid }: { taskId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/districts/${leaid}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link activities to a task
export function useLinkTaskActivities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, activityIds }: { taskId: string; activityIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/activities`, {
        method: "POST",
        body: JSON.stringify({ activityIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink an activity from a task
export function useUnlinkTaskActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, activityId }: { taskId: string; activityId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/activities/${activityId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link contacts to a task
export function useLinkTaskContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, contactIds }: { taskId: string; contactIds: number[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contactIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a contact from a task
export function useUnlinkTaskContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, contactId }: { taskId: string; contactId: number }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/contacts/${contactId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// ===== Accounts (non-district) =====

// Create a new non-district account
export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      accountType: string;
      stateAbbrev?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      salesExecutive?: string;
      phone?: string;
      websiteUrl?: string;
    }) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
    },
  });
}

// Check for duplicate accounts by name (non-blocking warning)
export function useDuplicateCheck(name: string, state?: string) {
  return useQuery({
    queryKey: ["account-duplicates", name, state],
    queryFn: async () => {
      const params = new URLSearchParams({ name });
      if (state) params.set("state", state);
      const res = await fetch(`/api/accounts?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: name.length >= 3,
    staleTime: 5000,
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
// Types and hooks for calendar connection, event inbox, sync, and confirm/dismiss actions

// Calendar connection status returned by /api/calendar/status
export interface CalendarConnection {
  id: string;
  googleAccountEmail: string;
  companyDomain: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  status: "connected" | "disconnected" | "error";
  createdAt: string;
}

export interface CalendarStatusResponse {
  connected: boolean;
  connection: CalendarConnection | null;
  pendingCount: number;
}

// Calendar event attendee (stored as JSON in the CalendarEvent table)
export interface CalendarEventAttendee {
  email: string;
  name: string | null;
  responseStatus: string;
}

// Calendar event returned by /api/calendar/events (enriched with suggestion names)
export interface CalendarEvent {
  id: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  attendees: CalendarEventAttendee[];
  status: "pending" | "confirmed" | "dismissed" | "cancelled";
  suggestedActivityType: ActivityType | null;
  suggestedDistrictId: string | null;
  suggestedDistrictName: string | null;
  suggestedDistrictState: string | null;
  suggestedContactIds: number[] | null;
  suggestedContacts: Array<{ id: number; name: string; title: string | null; email: string | null }>;
  suggestedPlanId: string | null;
  suggestedPlanName: string | null;
  suggestedPlanColor: string | null;
  matchConfidence: "high" | "medium" | "low" | "none";
  activityId: string | null;
  lastSyncedAt: string;
}

export interface CalendarInboxResponse {
  events: CalendarEvent[];
  total: number;
  pendingCount: number;
}

// Sync result returned by POST /api/calendar/sync
export interface CalendarSyncResult {
  eventsProcessed: number;
  newEvents: number;
  updatedEvents: number;
  cancelledEvents: number;
  errors: string[];
}

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

// ===== Schools =====

export interface School {
  ncessch: string;
  leaid: string;
  schoolName: string;
  charter: number;
  schoolLevel: number | null;
  lograde: string | null;
  higrade: string | null;
  enrollment: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  stateAbbrev: string | null;
  phone: string | null;
  owner: string | null;
  notes: string | null;
  schoolStatus: number | null;
}

export interface SchoolDetail extends School {
  enrollmentHistory: { year: number; enrollment: number | null }[];
  tags: Tag[];
  contacts: Contact[];
  district: { leaid: string; name: string };
  streetAddress: string | null;
  zip: string | null;
  countyName: string | null;
  urbanCentricLocale: number | null;
  schoolType: number | null;
  directoryDataYear: number | null;
  notesUpdatedAt: string | null;
}

export interface SchoolListItem {
  ncessch: string;
  leaid: string;
  schoolName: string;
  charter: number;
  schoolLevel: number | null;
  enrollment: number | null;
  lograde: string | null;
  higrade: string | null;
  schoolStatus: number | null;
  enrollmentHistory?: { year: number; enrollment: number | null }[];
}

// Schools by district (for district detail panel)
export function useSchoolsByDistrict(leaid: string | null) {
  return useQuery({
    queryKey: ["schoolsByDistrict", leaid],
    queryFn: () =>
      fetchJson<{ schools: SchoolListItem[]; total: number }>(
        `${API_BASE}/schools/by-district/${leaid}`
      ),
    enabled: !!leaid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// School detail
export function useSchoolDetail(ncessch: string | null) {
  return useQuery({
    queryKey: ["school", ncessch],
    queryFn: () =>
      fetchJson<SchoolDetail>(`${API_BASE}/schools/${ncessch}`),
    enabled: !!ncessch,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ------ Explore Data ------

export interface ExploreResponse<T = Record<string, unknown>> {
  data: T[];
  aggregates: Record<string, number>;
  pagination: { page: number; pageSize: number; total: number };
}

export function useExploreData<T = Record<string, unknown>>(
  entity: string,
  params: {
    filters?: { id: string; column: string; op: string; value: unknown }[];
    sort?: { column: string; direction: "asc" | "desc" } | null;
    page?: number;
    pageSize?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (params.filters && params.filters.length > 0) {
    searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.sort) {
    searchParams.set("sort", params.sort.column);
    searchParams.set("order", params.sort.direction);
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

// Update school CRM fields
export function useUpdateSchoolEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ncessch,
      notes,
      owner,
    }: {
      ncessch: string;
      notes?: string;
      owner?: string;
    }) =>
      fetchJson<{ ncessch: string; notes: string | null; owner: string | null; updatedAt: string }>(
        `${API_BASE}/schools/${ncessch}/edits`,
        {
          method: "PATCH",
          body: JSON.stringify({ notes, owner }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school", variables.ncessch] });
      queryClient.invalidateQueries({ queryKey: ["schoolsByDistrict"] });
    },
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

// ─── Progress Dashboard Types & Hooks ────────────────────────────────

export type ProgressPeriod = "month" | "quarter" | "fiscal_year";

export interface ActivityMetrics {
  period: { start: string; end: string };
  totalActivities: number;
  byCategory: { events: number; outreach: number; meetings: number };
  bySource: { manual: number; calendar_sync: number };
  byStatus: { planned: number; completed: number; cancelled: number };
  byPlan: Array<{ planId: string; planName: string; planColor: string; count: number }>;
  trend: { current: number; previous: number; changePercent: number };
  planCoveragePercent: number;
}

export interface OutcomeMetrics {
  totalWithOutcome: number;
  totalCompleted: number;
  outcomeRate: number;
  byOutcomeType: Record<string, number>;
  funnel: {
    discoveryCallsCompleted: number;
    demosCompleted: number;
    proposalsReviewed: number;
    positiveOutcomes: number;
  };
  districtsEngaged: number;
  totalDistrictsInPlans: number;
}

export interface PlanEngagement {
  planId: string;
  planName: string;
  planColor: string;
  totalDistricts: number;
  districtsWithActivity: number;
  lastActivityDate: string | null;
  activityCount: number;
}

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
