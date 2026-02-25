// Shared types used across multiple features, extracted from api.ts

import type { ActivityType, ActivityCategory, ActivityStatus } from "@/features/activities/types";
import type { TaskStatus, TaskPriority } from "@/features/tasks/types";

// ===== District Types =====

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

// ===== Territory Plan Types =====

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
  renewalRollup: number;
  expansionRollup: number;
  winbackRollup: number;
  newBusinessRollup: number;
  pipelineTotal: number;
}

export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  owner: string | null;
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

// ===== Contact Types =====

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

// ===== User Types =====

export interface UserSummary {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string;
  jobTitle: string | null;
}

export interface UserGoal {
  id: number;
  fiscalYear: number;
  earningsTarget: number | null;
  takeRatePercent: number | null;
  newDistrictsTarget: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  takeTarget: number | null;
  revenueActual: number;
  takeActual: number;
  pipelineActual: number;
  newDistrictsActual: number;
}

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

// ===== Activity Types =====

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
  isInPlan: boolean;
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
  category: ActivityCategory;
  title: string;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ActivityStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  googleEventId: string | null;
  source: "manual" | "calendar_sync";
  outcome: string | null;
  outcomeType: string | null;
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
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

// ===== Task Types =====

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

// ===== Similar Districts Types =====

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

// ===== Map Types =====

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

// ===== School Types =====

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

// ===== Plan District Detail Types =====

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

// ===== Goal Dashboard Types =====

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

// ===== Calendar Types =====

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

export interface CalendarEventAttendee {
  email: string;
  name: string | null;
  responseStatus: string;
}

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

export interface CalendarSyncResult {
  eventsProcessed: number;
  newEvents: number;
  updatedEvents: number;
  cancelledEvents: number;
  errors: string[];
}

// ===== Focus Mode Types =====

export interface FocusModeStateData {
  abbrev: string;
  name: string;
  state: {
    totalDistricts: number;
    totalCustomers: number;
    totalWithPipeline: number;
    fy25ClosedWon: number;
    fy25Invoicing: number;
    fy26ClosedWon: number;
    fy26Invoicing: number;
    fy26Pipeline: number;
    fy27Pipeline: number;
  };
  plan: {
    districtCount: number;
    customerCount: number;
    fy25ClosedWon: number;
    fy25Invoicing: number;
    fy26ClosedWon: number;
    fy26Invoicing: number;
    fy26Pipeline: number;
    fy27Pipeline: number;
  };
  topDistricts: Array<{
    leaid: string;
    name: string;
    fy26Invoicing: number;
  }>;
}

export interface FocusModeData {
  planId: string;
  planName: string | null;
  fiscalYear: number;
  states: FocusModeStateData[];
}

// ===== Explore Types =====

export interface ExploreResponse<T = Record<string, unknown>> {
  data: T[];
  aggregates: Record<string, number>;
  pagination: { page: number; pageSize: number; total: number };
}

// ===== Progress Types =====

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
