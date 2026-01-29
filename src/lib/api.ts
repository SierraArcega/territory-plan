import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StatusFilter, FiscalYear, MetricType } from "./store";

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

export interface Contact {
  id: number;
  leaid: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
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
  graduationRateMale: number | null;
  graduationRateFemale: number | null;
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

export interface DistrictDetail {
  district: District;
  fullmindData: FullmindData | null;
  edits: DistrictEdits | null;
  tags: Tag[];
  contacts: Contact[];
  territoryPlanIds: string[];
  educationData: DistrictEducationData | null;
  enrollmentDemographics: DistrictEnrollmentDemographics | null;
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
export interface TerritoryPlan {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  color: string;
  status: "draft" | "active" | "archived";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  districtCount: number;
}

export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
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
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
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
  });
}

export function useDistrictDetail(leaid: string | null) {
  return useQuery({
    queryKey: ["district", leaid],
    queryFn: () => fetchJson<DistrictDetail>(`${API_BASE}/districts/${leaid}`),
    enabled: !!leaid,
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

// Tags
export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => fetchJson<Tag[]>(`${API_BASE}/tags`),
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
    },
  });
}

// Contacts
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contact: Omit<Contact, "id">) =>
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
    mutationFn: ({ id, ...data }: Contact) =>
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
  });
}

export function useStateSummaries() {
  return useQuery({
    queryKey: ["unmatched", "summaries"],
    queryFn: () => fetchJson<StateSummary[]>(`${API_BASE}/unmatched/by-state`),
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
  });
}

// Sales executives list
export function useSalesExecutives() {
  return useQuery({
    queryKey: ["salesExecutives"],
    queryFn: () => fetchJson<string[]>(`${API_BASE}/sales-executives`),
  });
}

// States list
export function useStates() {
  return useQuery({
    queryKey: ["states"],
    queryFn: () =>
      fetchJson<{ abbrev: string; name: string }[]>(`${API_BASE}/states`),
  });
}

// Territory Plans
export function useTerritoryPlans() {
  return useQuery({
    queryKey: ["territoryPlans"],
    queryFn: () => fetchJson<TerritoryPlan[]>(`${API_BASE}/territory-plans`),
  });
}

export function useTerritoryPlan(planId: string | null) {
  return useQuery({
    queryKey: ["territoryPlan", planId],
    queryFn: () =>
      fetchJson<TerritoryPlanDetail>(`${API_BASE}/territory-plans/${planId}`),
    enabled: !!planId,
  });
}

export function useCreateTerritoryPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: {
      name: string;
      description?: string;
      owner?: string;
      color?: string;
      status?: "draft" | "active" | "archived";
      startDate?: string;
      endDate?: string;
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
      owner?: string;
      color?: string;
      status?: "draft" | "active" | "archived";
      startDate?: string;
      endDate?: string;
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
    mutationFn: ({ planId, leaids }: { planId: string; leaids: string | string[] }) =>
      fetchJson<{ added: number; planId: string }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids }),
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
