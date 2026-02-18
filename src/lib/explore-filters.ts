// Shared filter types and builder used by explore + batch endpoints

export type FilterOp =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_true"
  | "is_false"
  | "is_empty"
  | "is_not_empty";

export interface FilterDef {
  column: string;
  op: FilterOp;
  value?: unknown;
}

// External column key → Prisma field name (also serves as allow-list)
export const DISTRICT_FIELD_MAP: Record<string, string> = {
  // Core
  leaid: "leaid",
  name: "name",
  state: "stateAbbrev",
  enrollment: "enrollment",
  urbanicity: "urbanCentricLocale",
  accountType: "accountType",
  owner: "owner",
  notes: "notes",
  // Location
  countyName: "countyName",
  numberOfSchools: "numberOfSchools",
  lograde: "lograde",
  higrade: "higrade",
  phone: "phone",
  // CRM / Revenue
  isCustomer: "isCustomer",
  hasOpenPipeline: "hasOpenPipeline",
  salesExecutive: "salesExecutive",
  // FY25 Revenue
  fy25_closed_won_net_booking: "fy25ClosedWonNetBooking",
  fy25_net_invoicing: "fy25NetInvoicing",
  fy25_closed_won_opp_count: "fy25ClosedWonOppCount",
  fy25_sessions_revenue: "fy25SessionsRevenue",
  fy25_sessions_take: "fy25SessionsTake",
  fy25_sessions_count: "fy25SessionsCount",
  // FY26 Revenue
  fy26_open_pipeline_value: "fy26OpenPipeline",
  fy26_open_pipeline_weighted: "fy26OpenPipelineWeighted",
  fy26_closed_won_net_booking: "fy26ClosedWonNetBooking",
  fy26_net_invoicing: "fy26NetInvoicing",
  fy26_closed_won_opp_count: "fy26ClosedWonOppCount",
  fy26_sessions_revenue: "fy26SessionsRevenue",
  fy26_sessions_take: "fy26SessionsTake",
  fy26_sessions_count: "fy26SessionsCount",
  // FY27 Pipeline
  fy27_open_pipeline_value: "fy27OpenPipeline",
  fy27_open_pipeline_weighted: "fy27OpenPipelineWeighted",
  // Education
  graduationRate: "graduationRateTotal",
  mathProficiency: "mathProficiencyPct",
  readProficiency: "readProficiencyPct",
  chronicAbsenteeismRate: "chronicAbsenteeismRate",
  // Demographics
  sped_percent: "swdPct",
  ell_percent: "ellPct",
  free_lunch_percent: "childrenPovertyPercent",
  medianHouseholdIncome: "medianHouseholdIncome",
  enrollmentWhite: "enrollmentWhite",
  enrollmentBlack: "enrollmentBlack",
  enrollmentHispanic: "enrollmentHispanic",
  enrollmentAsian: "enrollmentAsian",
  enrollmentAmericanIndian: "enrollmentAmericanIndian",
  enrollmentTwoOrMore: "enrollmentTwoOrMore",
  charterSchoolCount: "charterSchoolCount",
  charterEnrollment: "charterEnrollment",
  // Finance
  totalRevenue: "totalRevenue",
  federalRevenue: "federalRevenue",
  stateRevenue: "stateRevenue",
  localRevenue: "localRevenue",
  totalExpenditure: "totalExpenditure",
  expenditurePerPupil: "expenditurePerPupil",
  techSpending: "techSpending",
  capitalOutlayTotal: "capitalOutlayTotal",
  debtOutstanding: "debtOutstanding",
  // Staffing
  teachersFte: "teachersFte",
  adminFte: "adminFte",
  guidanceCounselorsFte: "guidanceCounselorsFte",
  instructionalAidesFte: "instructionalAidesFte",
  staffTotalFte: "staffTotalFte",
  studentTeacherRatio: "studentTeacherRatio",
  studentStaffRatio: "studentStaffRatio",
  spedStudentTeacherRatio: "spedStudentTeacherRatio",
  // SPED Finance
  spedExpenditureTotal: "spedExpenditureTotal",
  spedExpenditurePerStudent: "spedExpenditurePerStudent",
  // ESSER
  esserFundingTotal: "esserFundingTotal",
  esserSpendingTotal: "esserSpendingTotal",
  // Trends
  enrollmentTrend3yr: "enrollmentTrend3yr",
  staffingTrend3yr: "staffingTrend3yr",
  swdTrend3yr: "swdTrend3yr",
  ellTrend3yr: "ellTrend3yr",
  absenteeismTrend3yr: "absenteeismTrend3yr",
  graduationTrend3yr: "graduationTrend3yr",
  studentTeacherRatioTrend3yr: "studentTeacherRatioTrend3yr",
  mathProficiencyTrend3yr: "mathProficiencyTrend3yr",
  readProficiencyTrend3yr: "readProficiencyTrend3yr",
  expenditurePpTrend3yr: "expenditurePpTrend3yr",
  vacancyPressureSignal: "vacancyPressureSignal",
  // vs State
  absenteeismVsState: "absenteeismVsState",
  graduationVsState: "graduationVsState",
  studentTeacherRatioVsState: "studentTeacherRatioVsState",
  swdPctVsState: "swdPctVsState",
  ellPctVsState: "ellPctVsState",
  mathProficiencyVsState: "mathProficiencyVsState",
  readProficiencyVsState: "readProficiencyVsState",
  expenditurePpVsState: "expenditurePpVsState",
  // vs National
  absenteeismVsNational: "absenteeismVsNational",
  graduationVsNational: "graduationVsNational",
  studentTeacherRatioVsNational: "studentTeacherRatioVsNational",
  swdPctVsNational: "swdPctVsNational",
  ellPctVsNational: "ellPctVsNational",
  mathProficiencyVsNational: "mathProficiencyVsNational",
  readProficiencyVsNational: "readProficiencyVsNational",
  expenditurePpVsNational: "expenditurePpVsNational",
  // Quartiles
  absenteeismQuartileState: "absenteeismQuartileState",
  graduationQuartileState: "graduationQuartileState",
  studentTeacherRatioQuartileState: "studentTeacherRatioQuartileState",
  swdPctQuartileState: "swdPctQuartileState",
  ellPctQuartileState: "ellPctQuartileState",
  mathProficiencyQuartileState: "mathProficiencyQuartileState",
  readProficiencyQuartileState: "readProficiencyQuartileState",
  expenditurePpQuartileState: "expenditurePpQuartileState",
  // Links
  websiteUrl: "websiteUrl",
  jobBoardUrl: "jobBoardUrl",
};

export function buildWhereClause(
  filters: FilterDef[],
  fieldMap?: Record<string, string>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const f of filters) {
    const prismaField = fieldMap ? fieldMap[f.column] : f.column;
    if (!prismaField) continue; // skip unknown columns

    switch (f.op) {
      case "eq":
        where[prismaField] = f.value;
        break;
      case "neq":
        where[prismaField] = { not: f.value };
        break;
      case "in":
        where[prismaField] = { in: f.value };
        break;
      case "contains":
        where[prismaField] = {
          contains: f.value as string,
          mode: "insensitive",
        };
        break;
      case "gt":
        where[prismaField] = { gt: f.value };
        break;
      case "gte":
        where[prismaField] = { gte: f.value };
        break;
      case "lt":
        where[prismaField] = { lt: f.value };
        break;
      case "lte":
        where[prismaField] = { lte: f.value };
        break;
      case "between": {
        const [min, max] = f.value as [unknown, unknown];
        where[prismaField] = { gte: min, lte: max };
        break;
      }
      case "is_true":
        where[prismaField] = true;
        break;
      case "is_false":
        where[prismaField] = false;
        break;
      case "is_empty":
        where[prismaField] = null;
        break;
      case "is_not_empty":
        where[prismaField] = { not: null };
        break;
    }
  }

  return where;
}

// External column key → Prisma field name for plans
export const PLANS_FIELD_MAP: Record<string, string> = {
  name: "name",
  status: "status",
  fiscalYear: "fiscalYear",
  description: "description",
  color: "color",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};
