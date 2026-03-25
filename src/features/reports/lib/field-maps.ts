// Report Builder field maps — extends the explore pattern to cover all queryable entities.
// Each map serves as both a column registry and an allowlist for filter/sort fields.

import {
  DISTRICT_FIELD_MAP,
  PLANS_FIELD_MAP,
} from "@/features/explore/lib/filters";

// ---------------------------------------------------------------------------
// Column metadata — provides type information for each column
// ---------------------------------------------------------------------------

export interface ColumnMeta {
  prismaField: string;
  type: "string" | "number" | "boolean" | "date";
}

// ---------------------------------------------------------------------------
// Entity field maps — client key → Prisma field name
// ---------------------------------------------------------------------------

export const OPPORTUNITIES_FIELD_MAP: Record<string, string> = {
  id: "id",
  name: "name",
  schoolYr: "schoolYr",
  contractType: "contractType",
  state: "state",
  salesRepName: "salesRepName",
  salesRepEmail: "salesRepEmail",
  districtName: "districtName",
  districtLeaId: "districtLeaId",
  stage: "stage",
  netBookingAmount: "netBookingAmount",
  createdAt: "createdAt",
  closeDate: "closeDate",
  brandAmbassador: "brandAmbassador",
  leadSource: "leadSource",
  invoiced: "invoiced",
  credited: "credited",
  completedRevenue: "completedRevenue",
  completedTake: "completedTake",
  scheduledSessions: "scheduledSessions",
  scheduledRevenue: "scheduledRevenue",
  scheduledTake: "scheduledTake",
  totalRevenue: "totalRevenue",
  totalTake: "totalTake",
  averageTakeRate: "averageTakeRate",
  paymentType: "paymentType",
  contractThrough: "contractThrough",
  fundingThrough: "fundingThrough",
};

export const ACTIVITIES_FIELD_MAP: Record<string, string> = {
  id: "id",
  type: "type",
  title: "title",
  notes: "notes",
  startDate: "startDate",
  endDate: "endDate",
  status: "status",
  createdByUserId: "createdByUserId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  outcome: "outcome",
  outcomeType: "outcomeType",
  rating: "rating",
  source: "source",
};

export const CONTACTS_FIELD_MAP: Record<string, string> = {
  id: "id",
  leaid: "leaid",
  name: "name",
  title: "title",
  email: "email",
  phone: "phone",
  isPrimary: "isPrimary",
  persona: "persona",
  seniorityLevel: "seniorityLevel",
  createdAt: "createdAt",
  linkedinUrl: "linkedinUrl",
};

export const SCHOOLS_FIELD_MAP: Record<string, string> = {
  ncessch: "ncessch",
  leaid: "leaid",
  schoolName: "schoolName",
  charter: "charter",
  schoolLevel: "schoolLevel",
  schoolType: "schoolType",
  lograde: "lograde",
  higrade: "higrade",
  schoolStatus: "schoolStatus",
  stateAbbrev: "stateAbbrev",
  city: "city",
  zip: "zip",
  countyName: "countyName",
  phone: "phone",
  enrollment: "enrollment",
  titleIStatus: "titleIStatus",
  titleIEligible: "titleIEligible",
  titleISchoolwide: "titleISchoolwide",
  freeLunch: "freeLunch",
  reducedPriceLunch: "reducedPriceLunch",
  frplTotal: "frplTotal",
};

export const TASKS_FIELD_MAP: Record<string, string> = {
  id: "id",
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  dueDate: "dueDate",
  createdByUserId: "createdByUserId",
  assignedToUserId: "assignedToUserId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

export const STATES_FIELD_MAP: Record<string, string> = {
  fips: "fips",
  abbrev: "abbrev",
  name: "name",
  totalDistricts: "totalDistricts",
  totalEnrollment: "totalEnrollment",
  totalSchools: "totalSchools",
  totalCustomers: "totalCustomers",
  totalWithPipeline: "totalWithPipeline",
  totalPipelineValue: "totalPipelineValue",
  avgExpenditurePerPupil: "avgExpenditurePerPupil",
  avgGraduationRate: "avgGraduationRate",
  avgPovertyRate: "avgPovertyRate",
  avgChronicAbsenteeismRate: "avgChronicAbsenteeismRate",
  avgStudentTeacherRatio: "avgStudentTeacherRatio",
  avgSwdPct: "avgSwdPct",
  avgEllPct: "avgEllPct",
  avgEnrollment: "avgEnrollment",
  territoryOwner: "territoryOwner",
  notes: "notes",
};

export const VENDOR_FINANCIALS_FIELD_MAP: Record<string, string> = {
  id: "id",
  leaid: "leaid",
  vendor: "vendor",
  fiscalYear: "fiscalYear",
  openPipeline: "openPipeline",
  closedWonBookings: "closedWonBookings",
  invoicing: "invoicing",
  scheduledRevenue: "scheduledRevenue",
  deliveredRevenue: "deliveredRevenue",
  deferredRevenue: "deferredRevenue",
  totalRevenue: "totalRevenue",
  deliveredTake: "deliveredTake",
  scheduledTake: "scheduledTake",
  allTake: "allTake",
  lastUpdated: "lastUpdated",
};

export const SESSIONS_FIELD_MAP: Record<string, string> = {
  id: "id",
  opportunityId: "opportunityId",
  serviceType: "serviceType",
  sessionPrice: "sessionPrice",
  educatorPrice: "educatorPrice",
  educatorApprovedPrice: "educatorApprovedPrice",
  startTime: "startTime",
};

// ---------------------------------------------------------------------------
// Entity field maps registry
// ---------------------------------------------------------------------------

/** Maps entity name → field map (client key → Prisma field name) */
export const ENTITY_FIELD_MAPS: Record<string, Record<string, string>> = {
  districts: DISTRICT_FIELD_MAP,
  plans: PLANS_FIELD_MAP,
  opportunities: OPPORTUNITIES_FIELD_MAP,
  activities: ACTIVITIES_FIELD_MAP,
  contacts: CONTACTS_FIELD_MAP,
  schools: SCHOOLS_FIELD_MAP,
  tasks: TASKS_FIELD_MAP,
  states: STATES_FIELD_MAP,
  vendorFinancials: VENDOR_FINANCIALS_FIELD_MAP,
  sessions: SESSIONS_FIELD_MAP,
};

/** Display names for each entity */
export const ENTITY_LABELS: Record<string, string> = {
  districts: "Districts",
  plans: "Territory Plans",
  opportunities: "Opportunities",
  activities: "Activities",
  contacts: "Contacts",
  schools: "Schools",
  tasks: "Tasks",
  states: "States",
  vendorFinancials: "Vendor Financials",
  sessions: "Sessions",
};

/** Prisma model names (used for prisma[modelName] access) */
export const ENTITY_PRISMA_MODEL: Record<string, string> = {
  districts: "district",
  plans: "territoryPlan",
  opportunities: "opportunity",
  activities: "activity",
  contacts: "contact",
  schools: "school",
  tasks: "task",
  states: "state",
  vendorFinancials: "vendorFinancials",
  sessions: "session",
};

// ---------------------------------------------------------------------------
// Column metadata per entity — provides type hints for filter UI
// ---------------------------------------------------------------------------

function buildColumnMeta(
  fieldMap: Record<string, string>,
  typeOverrides: Record<string, "string" | "number" | "boolean" | "date">
): Record<string, ColumnMeta> {
  const meta: Record<string, ColumnMeta> = {};
  for (const [key, prismaField] of Object.entries(fieldMap)) {
    meta[key] = {
      prismaField,
      type: typeOverrides[key] ?? "string",
    };
  }
  return meta;
}

const DISTRICT_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  enrollment: "number",
  numberOfSchools: "number",
  isCustomer: "boolean",
  hasOpenPipeline: "boolean",
  // FY25 Revenue
  fy25_closed_won_net_booking: "number",
  fy25_net_invoicing: "number",
  fy25_closed_won_opp_count: "number",
  fy25_sessions_revenue: "number",
  fy25_sessions_take: "number",
  fy25_sessions_count: "number",
  // FY26 Revenue
  fy26_open_pipeline_value: "number",
  fy26_open_pipeline_weighted: "number",
  fy26_closed_won_net_booking: "number",
  fy26_net_invoicing: "number",
  fy26_closed_won_opp_count: "number",
  fy26_sessions_revenue: "number",
  fy26_sessions_take: "number",
  fy26_sessions_count: "number",
  // FY27
  fy27_open_pipeline_value: "number",
  fy27_open_pipeline_weighted: "number",
  // Education
  graduationRate: "number",
  mathProficiency: "number",
  readProficiency: "number",
  chronicAbsenteeismRate: "number",
  // Demographics
  sped_percent: "number",
  ell_percent: "number",
  free_lunch_percent: "number",
  medianHouseholdIncome: "number",
  enrollmentWhite: "number",
  enrollmentBlack: "number",
  enrollmentHispanic: "number",
  enrollmentAsian: "number",
  enrollmentAmericanIndian: "number",
  enrollmentTwoOrMore: "number",
  charterSchoolCount: "number",
  charterEnrollment: "number",
  // Title I
  titleISchoolCount: "number",
  titleISchoolwideCount: "number",
  totalSchoolCount: "number",
  frplRate: "number",
  titleIRevenue: "number",
  // Finance
  totalRevenue: "number",
  federalRevenue: "number",
  stateRevenue: "number",
  localRevenue: "number",
  totalExpenditure: "number",
  expenditurePerPupil: "number",
  techSpending: "number",
  capitalOutlayTotal: "number",
  debtOutstanding: "number",
  // Staffing
  teachersFte: "number",
  adminFte: "number",
  guidanceCounselorsFte: "number",
  instructionalAidesFte: "number",
  staffTotalFte: "number",
  studentTeacherRatio: "number",
  studentStaffRatio: "number",
  spedStudentTeacherRatio: "number",
  // SPED Finance
  spedExpenditureTotal: "number",
  spedExpenditurePerStudent: "number",
  // ESSER
  esserFundingTotal: "number",
  esserSpendingTotal: "number",
  // Trends
  enrollmentTrend3yr: "number",
  staffingTrend3yr: "number",
  swdTrend3yr: "number",
  ellTrend3yr: "number",
  absenteeismTrend3yr: "number",
  graduationTrend3yr: "number",
  studentTeacherRatioTrend3yr: "number",
  mathProficiencyTrend3yr: "number",
  readProficiencyTrend3yr: "number",
  expenditurePpTrend3yr: "number",
  // vs State
  absenteeismVsState: "number",
  graduationVsState: "number",
  studentTeacherRatioVsState: "number",
  swdPctVsState: "number",
  ellPctVsState: "number",
  mathProficiencyVsState: "number",
  readProficiencyVsState: "number",
  expenditurePpVsState: "number",
  // vs National
  absenteeismVsNational: "number",
  graduationVsNational: "number",
  studentTeacherRatioVsNational: "number",
  swdPctVsNational: "number",
  ellPctVsNational: "number",
  mathProficiencyVsNational: "number",
  readProficiencyVsNational: "number",
  expenditurePpVsNational: "number",
  // Quartiles
  absenteeismQuartileState: "number",
  graduationQuartileState: "number",
  studentTeacherRatioQuartileState: "number",
  swdPctQuartileState: "number",
  ellPctQuartileState: "number",
  mathProficiencyQuartileState: "number",
  readProficiencyQuartileState: "number",
  expenditurePpQuartileState: "number",
};

const OPPORTUNITIES_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  netBookingAmount: "number",
  invoiced: "number",
  credited: "number",
  completedRevenue: "number",
  completedTake: "number",
  scheduledSessions: "number",
  scheduledRevenue: "number",
  scheduledTake: "number",
  totalRevenue: "number",
  totalTake: "number",
  averageTakeRate: "number",
  createdAt: "date",
  closeDate: "date",
};

const ACTIVITIES_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  startDate: "date",
  endDate: "date",
  createdAt: "date",
  updatedAt: "date",
  rating: "number",
};

const CONTACTS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  id: "number",
  isPrimary: "boolean",
  createdAt: "date",
};

const SCHOOLS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  charter: "number",
  schoolLevel: "number",
  schoolType: "number",
  schoolStatus: "number",
  enrollment: "number",
  titleIStatus: "number",
  titleIEligible: "number",
  titleISchoolwide: "number",
  freeLunch: "number",
  reducedPriceLunch: "number",
  frplTotal: "number",
};

const TASKS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  dueDate: "date",
  createdAt: "date",
  updatedAt: "date",
};

const PLANS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  createdAt: "date",
  updatedAt: "date",
  districtCount: "number",
  stateCount: "number",
  renewalRollup: "number",
  expansionRollup: "number",
  winbackRollup: "number",
  newBusinessRollup: "number",
};

const STATES_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  totalDistricts: "number",
  totalEnrollment: "number",
  totalSchools: "number",
  totalCustomers: "number",
  totalWithPipeline: "number",
  totalPipelineValue: "number",
  avgExpenditurePerPupil: "number",
  avgGraduationRate: "number",
  avgPovertyRate: "number",
  avgChronicAbsenteeismRate: "number",
  avgStudentTeacherRatio: "number",
  avgSwdPct: "number",
  avgEllPct: "number",
  avgEnrollment: "number",
};

const VENDOR_FINANCIALS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  id: "number",
  openPipeline: "number",
  closedWonBookings: "number",
  invoicing: "number",
  scheduledRevenue: "number",
  deliveredRevenue: "number",
  deferredRevenue: "number",
  totalRevenue: "number",
  deliveredTake: "number",
  scheduledTake: "number",
  allTake: "number",
  lastUpdated: "date",
};

const SESSIONS_TYPE_OVERRIDES: Record<string, "string" | "number" | "boolean" | "date"> = {
  sessionPrice: "number",
  educatorPrice: "number",
  educatorApprovedPrice: "number",
  startTime: "date",
};

/** Maps entity name → column key → ColumnMeta */
export const ENTITY_COLUMN_META: Record<string, Record<string, ColumnMeta>> = {
  districts: buildColumnMeta(DISTRICT_FIELD_MAP, DISTRICT_TYPE_OVERRIDES),
  plans: buildColumnMeta(PLANS_FIELD_MAP, PLANS_TYPE_OVERRIDES),
  opportunities: buildColumnMeta(OPPORTUNITIES_FIELD_MAP, OPPORTUNITIES_TYPE_OVERRIDES),
  activities: buildColumnMeta(ACTIVITIES_FIELD_MAP, ACTIVITIES_TYPE_OVERRIDES),
  contacts: buildColumnMeta(CONTACTS_FIELD_MAP, CONTACTS_TYPE_OVERRIDES),
  schools: buildColumnMeta(SCHOOLS_FIELD_MAP, SCHOOLS_TYPE_OVERRIDES),
  tasks: buildColumnMeta(TASKS_FIELD_MAP, TASKS_TYPE_OVERRIDES),
  states: buildColumnMeta(STATES_FIELD_MAP, STATES_TYPE_OVERRIDES),
  vendorFinancials: buildColumnMeta(VENDOR_FINANCIALS_FIELD_MAP, VENDOR_FINANCIALS_TYPE_OVERRIDES),
  sessions: buildColumnMeta(SESSIONS_FIELD_MAP, SESSIONS_TYPE_OVERRIDES),
};

/** Helper to get a field map for a given entity, or undefined if not found */
export function getEntityFieldMap(entity: string): Record<string, string> | undefined {
  return ENTITY_FIELD_MAPS[entity];
}

/** Human-readable label for a column key (converts camelCase/snake_case to Title Case) */
export function columnKeyToLabel(key: string): string {
  return key
    // Insert space before uppercase letters (camelCase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Replace underscores with spaces
    .replace(/_/g, " ")
    // Capitalize first letter of each word
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
