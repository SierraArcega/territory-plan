import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StatusFilter, FiscalYear, MetricType } from "./store";
import type { ActivityType, ActivityCategory, ActivityStatus } from "./activityTypes";

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
  fiscalYear: number;
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
  revenueTarget: number | null;
  pipelineTarget: number | null;
  notes: string | null;
  targetServices: Array<{ id: number; name: string; slug: string; color: string }>;
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
      owner?: string;
      color?: string;
      status?: "draft" | "active" | "archived";
      fiscalYear: number;
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
      fiscalYear?: number;
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
  revenueTarget: number | null;
  takeTarget: number | null;
  pipelineTarget: number | null;
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
    mutationFn: (data: { fullName?: string; hasCompletedSetup?: boolean }) =>
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
      revenueTarget?: number | null;
      takeTarget?: number | null;
      pipelineTarget?: number | null;
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
  revenueTarget: number | null;
  pipelineTarget: number | null;
  notes: string | null;
  targetServices: Array<{ id: number; name: string; slug: string; color: string }>;
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

  return useMutation({
    mutationFn: ({
      planId,
      leaid,
      ...data
    }: {
      planId: string;
      leaid: string;
      revenueTarget?: number | null;
      pipelineTarget?: number | null;
      notes?: string | null;
      serviceIds?: number[];
    }) =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
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
    revenueTarget: number | null;
    takeTarget: number | null;
    pipelineTarget: number | null;
    newDistrictsTarget: number | null;
  } | null;
  planTotals: {
    revenueTarget: number;
    pipelineTarget: number;
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
    revenueTarget: number;
    pipelineTarget: number;
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
