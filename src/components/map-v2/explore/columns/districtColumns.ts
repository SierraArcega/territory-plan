// Column definitions for the Districts entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/districts.

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags" | "relation";
  enumValues?: string[];
  relationSource?: "tags" | "plans";
  editable?: boolean;
}

export interface DistrictRow {
  leaid: string;
  name: string;
  state: string;
  enrollment: number | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  fy26_open_pipeline_value: number | null;
  fy26_open_pipeline_weighted: number | null;
  fy26_closed_won_net_booking: number | null;
  fy26_net_invoicing: number | null;
  fy26_closed_won_opp_count: number | null;
  fy25_closed_won_net_booking: number | null;
  fy25_net_invoicing: number | null;
  fy25_closed_won_opp_count: number | null;
  fy27_open_pipeline_value: number | null;
  fy27_open_pipeline_weighted: number | null;
  fy25_sessions_revenue: number | null;
  fy25_sessions_take: number | null;
  fy25_sessions_count: number | null;
  fy26_sessions_revenue: number | null;
  fy26_sessions_take: number | null;
  fy26_sessions_count: number | null;
  salesExecutive: string | null;
  urbanicity: string | null;
  countyName: string | null;
  numberOfSchools: number | null;
  lograde: string | null;
  higrade: string | null;
  phone: string | null;
  graduationRate: number | null;
  mathProficiency: number | null;
  readProficiency: number | null;
  chronicAbsenteeismRate: number | null;
  sped_percent: number | null;
  ell_percent: number | null;
  free_lunch_percent: number | null;
  medianHouseholdIncome: number | null;
  totalRevenue: number | null;
  federalRevenue: number | null;
  stateRevenue: number | null;
  localRevenue: number | null;
  totalExpenditure: number | null;
  expenditurePerPupil: number | null;
  techSpending: number | null;
  capitalOutlayTotal: number | null;
  debtOutstanding: number | null;
  teachersFte: number | null;
  adminFte: number | null;
  staffTotalFte: number | null;
  guidanceCounselorsFte: number | null;
  instructionalAidesFte: number | null;
  studentTeacherRatio: number | null;
  studentStaffRatio: number | null;
  spedStudentTeacherRatio: number | null;
  spedExpenditureTotal: number | null;
  spedExpenditurePerStudent: number | null;
  esserFundingTotal: number | null;
  esserSpendingTotal: number | null;
  enrollmentWhite: number | null;
  enrollmentBlack: number | null;
  enrollmentHispanic: number | null;
  enrollmentAsian: number | null;
  enrollmentAmericanIndian: number | null;
  enrollmentTwoOrMore: number | null;
  charterSchoolCount: number | null;
  charterEnrollment: number | null;
  enrollmentTrend3yr: number | null;
  staffingTrend3yr: number | null;
  swdTrend3yr: number | null;
  ellTrend3yr: number | null;
  absenteeismTrend3yr: number | null;
  graduationTrend3yr: number | null;
  studentTeacherRatioTrend3yr: number | null;
  mathProficiencyTrend3yr: number | null;
  readProficiencyTrend3yr: number | null;
  expenditurePpTrend3yr: number | null;
  vacancyPressureSignal: number | null;
  absenteeismVsState: number | null;
  graduationVsState: number | null;
  studentTeacherRatioVsState: number | null;
  swdPctVsState: number | null;
  ellPctVsState: number | null;
  mathProficiencyVsState: number | null;
  readProficiencyVsState: number | null;
  expenditurePpVsState: number | null;
  absenteeismVsNational: number | null;
  graduationVsNational: number | null;
  studentTeacherRatioVsNational: number | null;
  swdPctVsNational: number | null;
  ellPctVsNational: number | null;
  mathProficiencyVsNational: number | null;
  readProficiencyVsNational: number | null;
  expenditurePpVsNational: number | null;
  absenteeismQuartileState: string | null;
  graduationQuartileState: string | null;
  studentTeacherRatioQuartileState: string | null;
  swdPctQuartileState: string | null;
  ellPctQuartileState: string | null;
  mathProficiencyQuartileState: string | null;
  readProficiencyQuartileState: string | null;
  expenditurePpQuartileState: string | null;
  websiteUrl: string | null;
  jobBoardUrl: string | null;
  accountType: string | null;
  notes: string | null;
  owner: string | null;
  tags: { id: string; name: string; color: string }[];
  planNames: { id: string; name: string; color: string }[];
  lastActivity: string | null;
  ltv: number | null;
}

const QUARTILE_VALUES = ["well_above", "above", "below", "well_below"];

export const districtColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "name",
    label: "District Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "state",
    label: "State",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "leaid",
    label: "LEA ID",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "enrollment",
    label: "Enrollment",
    group: "Core",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "urbanicity",
    label: "Urbanicity",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "accountType",
    label: "Account Type",
    group: "Core",
    isDefault: false,
    filterType: "enum",
    enumValues: ["district", "charter", "esc", "other"],
  },
  {
    key: "owner",
    label: "Owner",
    group: "Core",
    isDefault: true,
    filterType: "text",
    editable: true,
  },
  {
    key: "notes",
    label: "Notes",
    group: "Core",
    isDefault: true,
    filterType: "text",
    editable: true,
  },

  // ---- Location ----
  {
    key: "countyName",
    label: "County",
    group: "Location",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "numberOfSchools",
    label: "# Schools",
    group: "Location",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "lograde",
    label: "Low Grade",
    group: "Location",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "higrade",
    label: "High Grade",
    group: "Location",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "phone",
    label: "Phone",
    group: "Location",
    isDefault: false,
    filterType: "text",
  },

  // ---- CRM / Revenue ----
  {
    key: "isCustomer",
    label: "Customer",
    group: "CRM / Revenue",
    isDefault: true,
    filterType: "boolean",
  },
  {
    key: "hasOpenPipeline",
    label: "Open Pipeline",
    group: "CRM / Revenue",
    isDefault: false,
    filterType: "boolean",
  },
  {
    key: "salesExecutive",
    label: "Sales Executive",
    group: "CRM / Revenue",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "ltv",
    label: "LTV ($)",
    group: "CRM / Revenue",
    isDefault: false,
    filterType: "number",
  },

  // ---- FY25 Revenue ----
  {
    key: "fy25_closed_won_net_booking",
    label: "FY25 Closed Won ($)",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy25_net_invoicing",
    label: "FY25 Net Invoicing ($)",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy25_closed_won_opp_count",
    label: "FY25 Closed Won Opps",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy25_sessions_revenue",
    label: "FY25 Sessions Revenue ($)",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy25_sessions_take",
    label: "FY25 Sessions Take ($)",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy25_sessions_count",
    label: "FY25 Sessions Count",
    group: "FY25 Revenue",
    isDefault: false,
    filterType: "number",
  },

  // ---- FY26 Revenue ----
  {
    key: "fy26_open_pipeline_value",
    label: "FY26 Open Pipeline ($)",
    group: "FY26 Revenue",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "fy26_open_pipeline_weighted",
    label: "FY26 Pipeline Weighted ($)",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy26_closed_won_net_booking",
    label: "FY26 Closed Won ($)",
    group: "FY26 Revenue",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "fy26_net_invoicing",
    label: "FY26 Net Invoicing ($)",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy26_closed_won_opp_count",
    label: "FY26 Closed Won Opps",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy26_sessions_revenue",
    label: "FY26 Sessions Revenue ($)",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy26_sessions_take",
    label: "FY26 Sessions Take ($)",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy26_sessions_count",
    label: "FY26 Sessions Count",
    group: "FY26 Revenue",
    isDefault: false,
    filterType: "number",
  },

  // ---- FY27 Pipeline ----
  {
    key: "fy27_open_pipeline_value",
    label: "FY27 Open Pipeline ($)",
    group: "FY27 Pipeline",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "fy27_open_pipeline_weighted",
    label: "FY27 Pipeline Weighted ($)",
    group: "FY27 Pipeline",
    isDefault: false,
    filterType: "number",
  },

  // ---- Education ----
  {
    key: "graduationRate",
    label: "Graduation Rate",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "mathProficiency",
    label: "Math Proficiency %",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "readProficiency",
    label: "Reading Proficiency %",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "chronicAbsenteeismRate",
    label: "Chronic Absenteeism %",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },

  // ---- Demographics ----
  {
    key: "sped_percent",
    label: "SPED %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "ell_percent",
    label: "ELL %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "free_lunch_percent",
    label: "Poverty %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "medianHouseholdIncome",
    label: "Median Household Income ($)",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentWhite",
    label: "Enrollment White",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentBlack",
    label: "Enrollment Black",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentHispanic",
    label: "Enrollment Hispanic",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentAsian",
    label: "Enrollment Asian",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentAmericanIndian",
    label: "Enrollment Am. Indian",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "enrollmentTwoOrMore",
    label: "Enrollment Two+",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "charterSchoolCount",
    label: "Charter Schools",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "charterEnrollment",
    label: "Charter Enrollment",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },

  // ---- Finance ----
  {
    key: "totalRevenue",
    label: "Total Revenue ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "federalRevenue",
    label: "Federal Revenue ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "stateRevenue",
    label: "State Revenue ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "localRevenue",
    label: "Local Revenue ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "totalExpenditure",
    label: "Total Expenditure ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "expenditurePerPupil",
    label: "Expenditure / Pupil ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "techSpending",
    label: "Tech Spending ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "capitalOutlayTotal",
    label: "Capital Outlay ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "debtOutstanding",
    label: "Debt Outstanding ($)",
    group: "Finance",
    isDefault: false,
    filterType: "number",
  },

  // ---- Staffing ----
  {
    key: "teachersFte",
    label: "Teachers FTE",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "adminFte",
    label: "Admin FTE",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "guidanceCounselorsFte",
    label: "Counselors FTE",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "instructionalAidesFte",
    label: "Instructional Aides FTE",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "staffTotalFte",
    label: "Total Staff FTE",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "studentTeacherRatio",
    label: "Student:Teacher Ratio",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "studentStaffRatio",
    label: "Student:Staff Ratio",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "spedStudentTeacherRatio",
    label: "SPED Student:Teacher",
    group: "Staffing",
    isDefault: false,
    filterType: "number",
  },

  // ---- SPED Finance ----
  {
    key: "spedExpenditureTotal",
    label: "SPED Expenditure ($)",
    group: "SPED Finance",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "spedExpenditurePerStudent",
    label: "SPED Exp / Student ($)",
    group: "SPED Finance",
    isDefault: false,
    filterType: "number",
  },

  // ---- ESSER Funding ----
  {
    key: "esserFundingTotal",
    label: "ESSER Funding ($)",
    group: "ESSER Funding",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "esserSpendingTotal",
    label: "ESSER Spending ($)",
    group: "ESSER Funding",
    isDefault: false,
    filterType: "number",
  },

  // ---- Trends (3yr) ----
  {
    key: "enrollmentTrend3yr",
    label: "Enrollment Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "staffingTrend3yr",
    label: "Staffing Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "swdTrend3yr",
    label: "SWD Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "ellTrend3yr",
    label: "ELL Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "absenteeismTrend3yr",
    label: "Absenteeism Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "graduationTrend3yr",
    label: "Graduation Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "studentTeacherRatioTrend3yr",
    label: "S:T Ratio Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "mathProficiencyTrend3yr",
    label: "Math Prof Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "readProficiencyTrend3yr",
    label: "Read Prof Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "expenditurePpTrend3yr",
    label: "Exp/Pupil Trend (3yr)",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "vacancyPressureSignal",
    label: "Vacancy Pressure",
    group: "Trends",
    isDefault: false,
    filterType: "number",
  },

  // ---- vs State ----
  {
    key: "absenteeismVsState",
    label: "Absenteeism vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "graduationVsState",
    label: "Graduation vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "studentTeacherRatioVsState",
    label: "S:T Ratio vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "swdPctVsState",
    label: "SWD % vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "ellPctVsState",
    label: "ELL % vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "mathProficiencyVsState",
    label: "Math Prof vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "readProficiencyVsState",
    label: "Read Prof vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "expenditurePpVsState",
    label: "Exp/Pupil vs State",
    group: "vs State",
    isDefault: false,
    filterType: "number",
  },

  // ---- vs National ----
  {
    key: "absenteeismVsNational",
    label: "Absenteeism vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "graduationVsNational",
    label: "Graduation vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "studentTeacherRatioVsNational",
    label: "S:T Ratio vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "swdPctVsNational",
    label: "SWD % vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "ellPctVsNational",
    label: "ELL % vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "mathProficiencyVsNational",
    label: "Math Prof vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "readProficiencyVsNational",
    label: "Read Prof vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "expenditurePpVsNational",
    label: "Exp/Pupil vs National",
    group: "vs National",
    isDefault: false,
    filterType: "number",
  },

  // ---- Quartile (State) ----
  {
    key: "absenteeismQuartileState",
    label: "Absenteeism Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "graduationQuartileState",
    label: "Graduation Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "studentTeacherRatioQuartileState",
    label: "S:T Ratio Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "swdPctQuartileState",
    label: "SWD % Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "ellPctQuartileState",
    label: "ELL % Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "mathProficiencyQuartileState",
    label: "Math Prof Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "readProficiencyQuartileState",
    label: "Read Prof Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },
  {
    key: "expenditurePpQuartileState",
    label: "Exp/Pupil Quartile",
    group: "Quartiles",
    isDefault: false,
    filterType: "enum",
    enumValues: QUARTILE_VALUES,
  },

  // ---- Links ----
  {
    key: "websiteUrl",
    label: "Website",
    group: "Links",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "jobBoardUrl",
    label: "Job Board",
    group: "Links",
    isDefault: false,
    filterType: "text",
  },

  // ---- Signals ----
  {
    key: "planNames",
    label: "Plans",
    group: "Signals",
    isDefault: true,
    filterType: "relation",
    relationSource: "plans",
  },

  // ---- Engagement ----
  {
    key: "lastActivity",
    label: "Last Activity",
    group: "Engagement",
    isDefault: true,
    filterType: "date",
  },
  {
    key: "tags",
    label: "Tags",
    group: "Engagement",
    isDefault: true,
    filterType: "relation",
    relationSource: "tags",
  },
];

// ---- Competitor spend (dynamic columns) ----

export const COMPETITORS = [
  { name: "Proximity Learning", slug: "proximity_learning", color: "#6EA3BE" },
  { name: "Elevate K12", slug: "elevate_k12", color: "#E07A5F" },
  { name: "Tutored By Teachers", slug: "tutored_by_teachers", color: "#7C3AED" },
] as const;

/**
 * Generate competitor spend columns for a set of fiscal years.
 * Returns columns in FY-descending order (newest first), grouped under "Competitor Spend".
 */
export function getCompetitorColumns(fiscalYears: string[]): ColumnDef[] {
  const sortedFYs = [...fiscalYears].sort().reverse();
  const cols: ColumnDef[] = [];

  for (const fy of sortedFYs) {
    const fyLabel = fy.toUpperCase();
    for (const comp of COMPETITORS) {
      cols.push({
        key: `comp_${comp.slug}_${fy}`,
        label: `${comp.name} ${fyLabel} ($)`,
        group: "Competitor Spend",
        isDefault: false,
        filterType: "number",
      });
    }
  }

  return cols;
}

/**
 * Parse a competitor column key like "comp_proximity_learning_fy26"
 * into { competitor: "Proximity Learning", fiscalYear: "fy26" } or null.
 */
export function parseCompetitorColumnKey(key: string): { competitor: string; fiscalYear: string } | null {
  if (!key.startsWith("comp_")) return null;
  for (const comp of COMPETITORS) {
    const prefix = `comp_${comp.slug}_`;
    if (key.startsWith(prefix)) {
      const fy = key.slice(prefix.length);
      return { competitor: comp.name, fiscalYear: fy };
    }
  }
  return null;
}
