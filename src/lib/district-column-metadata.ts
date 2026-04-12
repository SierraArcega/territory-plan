/**
 * Column metadata registry for the districts table.
 * Used by MCP tools, query builder, and explore grid to understand column semantics.
 */

export type ColumnDomain =
  | "core"
  | "crm"
  | "finance"
  | "poverty"
  | "graduation"
  | "staffing"
  | "demographics"
  | "absenteeism"
  | "assessment"
  | "sped"
  | "esser"
  | "tech_capital"
  | "outsourcing"
  | "trends"
  | "benchmarks"
  | "icp"
  | "links"
  | "user_edits";

export type DataFormat =
  | "text"
  | "integer"
  | "decimal"
  | "currency"
  | "percentage"
  | "ratio"
  | "boolean"
  | "date"
  | "year"
  | "quartile";

export type DataSource =
  | "nces"
  | "urban_institute"
  | "fullmind_crm"
  | "computed"
  | "user"
  | "govspend"
  | "etl_link";

export interface ColumnMetadata {
  /** Prisma camelCase field name */
  field: string;
  /** Snake_case DB column name */
  column: string;
  /** Human-readable label for UI */
  label: string;
  /** One-line description for MCP tool context */
  description: string;
  /** Semantic domain grouping */
  domain: ColumnDomain;
  /** How to format/interpret the value */
  format: DataFormat;
  /** Where this data comes from */
  source: DataSource;
  /** Whether this column is useful for filtering/sorting in queries */
  queryable: boolean;
  /** The data_year column that tracks this field's freshness (if any) */
  yearColumn?: string;
}

export const DISTRICT_COLUMNS: ColumnMetadata[] = [
  // ===== Core District Info =====
  {
    field: "leaid",
    column: "leaid",
    label: "LEA ID",
    description: "NCES Local Education Agency identifier (primary key, 7 chars)",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "name",
    column: "name",
    label: "District Name",
    description: "Official district name from NCES",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "stateAbbrev",
    column: "state_abbrev",
    label: "State",
    description: "Two-letter state abbreviation (e.g., CA, TX)",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "stateFips",
    column: "state_fips",
    label: "State FIPS",
    description: "Two-digit state FIPS code (e.g., 06 for California)",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "enrollment",
    column: "enrollment",
    label: "Enrollment",
    description: "Total student enrollment from CCD directory",
    domain: "core",
    format: "integer",
    source: "nces",
    queryable: true,
  },
  {
    field: "lograde",
    column: "lograde",
    label: "Lowest Grade",
    description: "Lowest grade served (PK, KG, 01-12)",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "higrade",
    column: "higrade",
    label: "Highest Grade",
    description: "Highest grade served (01-12)",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "numberOfSchools",
    column: "number_of_schools",
    label: "Number of Schools",
    description: "Count of schools in the district",
    domain: "core",
    format: "integer",
    source: "nces",
    queryable: true,
  },
  {
    field: "urbanCentricLocale",
    column: "urban_centric_locale",
    label: "Locale Code",
    description: "NCES urban-centric locale (11=Large City, 43=Remote Rural)",
    domain: "core",
    format: "integer",
    source: "nces",
    queryable: true,
  },
  {
    field: "countyName",
    column: "county_name",
    label: "County",
    description: "County name",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "cityLocation",
    column: "city_location",
    label: "City",
    description: "City of district office",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "zipLocation",
    column: "zip_location",
    label: "ZIP Code",
    description: "ZIP code of district office",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: true,
  },
  {
    field: "phone",
    column: "phone",
    label: "Phone",
    description: "District main phone number",
    domain: "core",
    format: "text",
    source: "nces",
    queryable: false,
  },
  {
    field: "accountType",
    column: "account_type",
    label: "Account Type",
    description: "Entity type: district, cmo, esa, etc.",
    domain: "core",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "specEdStudents",
    column: "spec_ed_students",
    label: "Special Ed Students",
    description: "Count of students with disabilities (SWD)",
    domain: "core",
    format: "integer",
    source: "nces",
    queryable: true,
  },
  {
    field: "ellStudents",
    column: "ell_students",
    label: "ELL Students",
    description: "Count of English Language Learners",
    domain: "core",
    format: "integer",
    source: "nces",
    queryable: true,
  },

  // ===== Fullmind CRM =====
  {
    field: "accountName",
    column: "account_name",
    label: "Account Name",
    description: "CRM account name (may differ from NCES name)",
    domain: "crm",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "salesExecutiveId",
    column: "sales_executive_id",
    label: "Sales Executive",
    description: "Assigned sales rep (FK to user_profiles.id) — join to UserProfile for name/email",
    domain: "crm",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "isCustomer",
    column: "is_customer",
    label: "Is Customer",
    description: "Has current or past Fullmind revenue",
    domain: "crm",
    format: "boolean",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "hasOpenPipeline",
    column: "has_open_pipeline",
    label: "Has Pipeline",
    description: "Has open pipeline opportunities",
    domain: "crm",
    format: "boolean",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "ownerId",
    column: "owner_id",
    label: "Owner",
    description: "Assigned territory owner (FK to user_profiles.id) — join to UserProfile for name/email",
    domain: "crm",
    format: "text",
    source: "user",
    queryable: true,
  },

  // ===== Finance =====
  {
    field: "totalRevenue",
    column: "total_revenue",
    label: "Total Revenue",
    description: "Total district revenue (federal + state + local)",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "federalRevenue",
    column: "federal_revenue",
    label: "Federal Revenue",
    description: "Revenue from federal sources",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "stateRevenue",
    column: "state_revenue",
    label: "State Revenue",
    description: "Revenue from state sources",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "localRevenue",
    column: "local_revenue",
    label: "Local Revenue",
    description: "Revenue from local sources (property tax, etc.)",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "totalExpenditure",
    column: "total_expenditure",
    label: "Total Expenditure",
    description: "Total district spending",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "expenditurePerPupil",
    column: "expenditure_per_pupil",
    label: "Per-Pupil Expenditure",
    description: "Total expenditure divided by enrollment",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "titleIRevenue",
    column: "title_i_revenue",
    label: "Title I Revenue",
    description: "Federal Title I funding received",
    domain: "finance",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },

  // ===== Poverty =====
  {
    field: "childrenPovertyCount",
    column: "children_poverty_count",
    label: "Children in Poverty",
    description: "Number of children in poverty (SAIPE)",
    domain: "poverty",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "saipeDataYear",
  },
  {
    field: "childrenPovertyPercent",
    column: "children_poverty_percent",
    label: "Poverty Rate",
    description: "Percentage of children in poverty",
    domain: "poverty",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
    yearColumn: "saipeDataYear",
  },
  {
    field: "medianHouseholdIncome",
    column: "median_household_income",
    label: "Median Household Income",
    description: "Area median household income",
    domain: "poverty",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "saipeDataYear",
  },
  {
    field: "frplRate",
    column: "frpl_rate",
    label: "FRPL Rate",
    description: "Free/reduced price lunch rate (proxy for poverty)",
    domain: "poverty",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
  },

  // ===== Graduation =====
  {
    field: "graduationRateTotal",
    column: "graduation_rate",
    label: "Graduation Rate",
    description: "Overall 4-year graduation rate",
    domain: "graduation",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
    yearColumn: "graduationDataYear",
  },

  // ===== Staffing =====
  {
    field: "teachersFte",
    column: "teachers_fte",
    label: "Teachers FTE",
    description: "Full-time equivalent teacher count",
    domain: "staffing",
    format: "decimal",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "adminFte",
    column: "admin_fte",
    label: "Admin FTE",
    description: "Full-time equivalent administrator count",
    domain: "staffing",
    format: "decimal",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "guidanceCounselorsFte",
    column: "guidance_counselors_fte",
    label: "Counselors FTE",
    description: "Full-time equivalent guidance counselor count",
    domain: "staffing",
    format: "decimal",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "staffTotalFte",
    column: "staff_total_fte",
    label: "Total Staff FTE",
    description: "Total full-time equivalent staff count",
    domain: "staffing",
    format: "decimal",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "salariesTotal",
    column: "salaries_total",
    label: "Total Salaries",
    description: "Total salary expenditure across all staff",
    domain: "staffing",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "salariesInstruction",
    column: "salaries_instruction",
    label: "Instructional Salaries",
    description: "Salary expenditure for instructional staff",
    domain: "staffing",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "staffDataYear",
  },
  {
    field: "studentTeacherRatio",
    column: "student_teacher_ratio",
    label: "Student:Teacher Ratio",
    description: "Enrollment / teachers FTE — higher = more understaffed",
    domain: "staffing",
    format: "ratio",
    source: "computed",
    queryable: true,
  },
  {
    field: "studentStaffRatio",
    column: "student_staff_ratio",
    label: "Student:Staff Ratio",
    description: "Enrollment / total staff FTE",
    domain: "staffing",
    format: "ratio",
    source: "computed",
    queryable: true,
  },
  {
    field: "spedStudentTeacherRatio",
    column: "sped_student_teacher_ratio",
    label: "SpEd Student:Teacher Ratio",
    description: "Special ed students / teachers FTE",
    domain: "staffing",
    format: "ratio",
    source: "computed",
    queryable: true,
  },

  // ===== Absenteeism =====
  {
    field: "chronicAbsenteeismCount",
    column: "chronic_absenteeism_count",
    label: "Chronic Absentees",
    description: "Count of chronically absent students",
    domain: "absenteeism",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "absenteeismDataYear",
  },
  {
    field: "chronicAbsenteeismRate",
    column: "chronic_absenteeism_rate",
    label: "Chronic Absenteeism Rate",
    description: "Percentage of students chronically absent",
    domain: "absenteeism",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
    yearColumn: "absenteeismDataYear",
  },

  // ===== Demographics =====
  {
    field: "enrollmentWhite",
    column: "enrollment_white",
    label: "White Enrollment",
    description: "White student enrollment",
    domain: "demographics",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "demographicsDataYear",
  },
  {
    field: "enrollmentBlack",
    column: "enrollment_black",
    label: "Black Enrollment",
    description: "Black student enrollment",
    domain: "demographics",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "demographicsDataYear",
  },
  {
    field: "enrollmentHispanic",
    column: "enrollment_hispanic",
    label: "Hispanic Enrollment",
    description: "Hispanic student enrollment",
    domain: "demographics",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "demographicsDataYear",
  },
  {
    field: "enrollmentAsian",
    column: "enrollment_asian",
    label: "Asian Enrollment",
    description: "Asian student enrollment",
    domain: "demographics",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "demographicsDataYear",
  },
  {
    field: "totalEnrollment",
    column: "total_enrollment",
    label: "Total Demographic Enrollment",
    description: "Sum of all race/ethnicity enrollment (may differ from CCD enrollment)",
    domain: "demographics",
    format: "integer",
    source: "urban_institute",
    queryable: true,
    yearColumn: "demographicsDataYear",
  },
  {
    field: "swdPct",
    column: "swd_pct",
    label: "SWD %",
    description: "Students with disabilities as percentage of enrollment",
    domain: "demographics",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "ellPct",
    column: "ell_pct",
    label: "ELL %",
    description: "English Language Learners as percentage of enrollment",
    domain: "demographics",
    format: "percentage",
    source: "computed",
    queryable: true,
  },

  // ===== Assessments =====
  {
    field: "mathProficiencyPct",
    column: "math_proficiency_pct",
    label: "Math Proficiency",
    description: "Percentage of students proficient in math",
    domain: "assessment",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
    yearColumn: "assessmentDataYear",
  },
  {
    field: "readProficiencyPct",
    column: "read_proficiency_pct",
    label: "Reading Proficiency",
    description: "Percentage of students proficient in reading",
    domain: "assessment",
    format: "percentage",
    source: "urban_institute",
    queryable: true,
    yearColumn: "assessmentDataYear",
  },

  // ===== Special Education Finance =====
  {
    field: "spedExpenditureTotal",
    column: "sped_expenditure_total",
    label: "SpEd Total Expenditure",
    description: "Total special education current expenditure",
    domain: "sped",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "spedExpenditureInstruction",
    column: "sped_expenditure_instruction",
    label: "SpEd Instructional Spend",
    description: "Special education instruction spending",
    domain: "sped",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "spedExpenditurePerStudent",
    column: "sped_expenditure_per_student",
    label: "SpEd Per-Student Spend",
    description: "Special ed expenditure / special ed student count",
    domain: "sped",
    format: "currency",
    source: "computed",
    queryable: true,
  },

  // ===== ESSER / COVID =====
  {
    field: "esserFundingTotal",
    column: "esser_funding_total",
    label: "ESSER Funding",
    description: "Total ESSER COVID relief funding received",
    domain: "esser",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "esserSpendingTotal",
    column: "esser_spending_total",
    label: "ESSER Spending",
    description: "Total ESSER COVID relief spending",
    domain: "esser",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },

  // ===== Tech & Capital =====
  {
    field: "techSpending",
    column: "tech_spending",
    label: "Tech Spending",
    description: "Technology supplies/services + equipment spending",
    domain: "tech_capital",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "capitalOutlayTotal",
    column: "capital_outlay_total",
    label: "Capital Outlay",
    description: "Total capital outlay expenditure",
    domain: "tech_capital",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "debtOutstanding",
    column: "debt_outstanding",
    label: "Debt Outstanding",
    description: "Long-term debt outstanding at end of fiscal year",
    domain: "tech_capital",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },

  // ===== Outsourcing Signals =====
  {
    field: "paymentsToCharterSchools",
    column: "payments_to_charter_schools",
    label: "Charter Payments",
    description: "Payments to charter schools — proven outsourcing buyer signal",
    domain: "outsourcing",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "paymentsToPrivateSchools",
    column: "payments_to_private_schools",
    label: "Private School Payments",
    description: "Payments to private schools for services",
    domain: "outsourcing",
    format: "currency",
    source: "urban_institute",
    queryable: true,
    yearColumn: "financeDataYear",
  },
  {
    field: "charterSchoolCount",
    column: "charter_school_count",
    label: "Charter School Count",
    description: "Number of charter schools in district boundaries",
    domain: "outsourcing",
    format: "integer",
    source: "computed",
    queryable: true,
  },

  // ===== Trend Signals =====
  {
    field: "enrollmentTrend3yr",
    column: "enrollment_trend_3yr",
    label: "Enrollment Trend (3yr)",
    description: "Percent change in enrollment over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "staffingTrend3yr",
    column: "staffing_trend_3yr",
    label: "Staffing Trend (3yr)",
    description: "Percent change in teacher FTE over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "vacancyPressureSignal",
    column: "vacancy_pressure_signal",
    label: "Vacancy Pressure",
    description: "Enrollment trend minus staffing trend — positive = growing gap",
    domain: "trends",
    format: "ratio",
    source: "computed",
    queryable: true,
  },
  {
    field: "swdTrend3yr",
    column: "swd_trend_3yr",
    label: "SWD Trend (3yr)",
    description: "Percent change in special ed students over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "ellTrend3yr",
    column: "ell_trend_3yr",
    label: "ELL Trend (3yr)",
    description: "Percent change in ELL students over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "graduationTrend3yr",
    column: "graduation_trend_3yr",
    label: "Graduation Trend (3yr)",
    description: "Percent change in graduation rate over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "absenteeismTrend3yr",
    column: "absenteeism_trend_3yr",
    label: "Absenteeism Trend (3yr)",
    description: "Percent change in chronic absenteeism over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "expenditurePpTrend3yr",
    column: "expenditure_pp_trend_3yr",
    label: "Per-Pupil Spend Trend (3yr)",
    description: "Percent change in per-pupil expenditure over 3 years",
    domain: "trends",
    format: "percentage",
    source: "computed",
    queryable: true,
  },

  // ===== State Benchmarks =====
  {
    field: "absenteeismVsState",
    column: "absenteeism_vs_state",
    label: "Absenteeism vs State Avg",
    description: "District absenteeism rate minus state average (positive = worse)",
    domain: "benchmarks",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "graduationVsState",
    column: "graduation_vs_state",
    label: "Graduation vs State Avg",
    description: "District graduation rate minus state average (positive = better)",
    domain: "benchmarks",
    format: "percentage",
    source: "computed",
    queryable: true,
  },
  {
    field: "studentTeacherRatioVsState",
    column: "student_teacher_ratio_vs_state",
    label: "ST Ratio vs State Avg",
    description: "District student:teacher ratio minus state average (positive = more understaffed)",
    domain: "benchmarks",
    format: "ratio",
    source: "computed",
    queryable: true,
  },
  {
    field: "expenditurePpVsState",
    column: "expenditure_pp_vs_state",
    label: "Per-Pupil Spend vs State Avg",
    description: "District per-pupil expenditure minus state average",
    domain: "benchmarks",
    format: "currency",
    source: "computed",
    queryable: true,
  },

  // ===== Quartile Flags =====
  {
    field: "absenteeismQuartileState",
    column: "absenteeism_quartile_state",
    label: "Absenteeism Quartile",
    description: "Within-state quartile: well_above, above, below, well_below",
    domain: "benchmarks",
    format: "quartile",
    source: "computed",
    queryable: true,
  },
  {
    field: "graduationQuartileState",
    column: "graduation_quartile_state",
    label: "Graduation Quartile",
    description: "Within-state quartile: well_above, above, below, well_below",
    domain: "benchmarks",
    format: "quartile",
    source: "computed",
    queryable: true,
  },
  {
    field: "studentTeacherRatioQuartileState",
    column: "student_teacher_ratio_quartile_state",
    label: "ST Ratio Quartile",
    description: "Within-state quartile: well_above, above, below, well_below",
    domain: "benchmarks",
    format: "quartile",
    source: "computed",
    queryable: true,
  },
  {
    field: "expenditurePpQuartileState",
    column: "expenditure_pp_quartile_state",
    label: "Per-Pupil Spend Quartile",
    description: "Within-state quartile: well_above, above, below, well_below",
    domain: "benchmarks",
    format: "quartile",
    source: "computed",
    queryable: true,
  },

  // ===== ICP Scoring =====
  {
    field: "icpCompositeScore",
    column: "icp_composite_score",
    label: "ICP Score",
    description: "Composite Ideal Customer Profile score (0-100)",
    domain: "icp",
    format: "integer",
    source: "computed",
    queryable: true,
  },
  {
    field: "icpTier",
    column: "icp_tier",
    label: "ICP Tier",
    description: "ICP tier classification: T1, T2, T3, T4",
    domain: "icp",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "icpFitScore",
    column: "icp_fit_score",
    label: "ICP Fit Score",
    description: "How well district profile matches ideal customer",
    domain: "icp",
    format: "integer",
    source: "computed",
    queryable: true,
  },
  {
    field: "icpValueScore",
    column: "icp_value_score",
    label: "ICP Value Score",
    description: "Estimated revenue potential",
    domain: "icp",
    format: "integer",
    source: "computed",
    queryable: true,
  },
  {
    field: "icpReadinessScore",
    column: "icp_readiness_score",
    label: "ICP Readiness Score",
    description: "Signals of buying readiness (outsourcing, budget, etc.)",
    domain: "icp",
    format: "integer",
    source: "computed",
    queryable: true,
  },

  // ===== Links =====
  {
    field: "websiteUrl",
    column: "website_url",
    label: "Website",
    description: "District website URL",
    domain: "links",
    format: "text",
    source: "etl_link",
    queryable: false,
  },
  {
    field: "jobBoardUrl",
    column: "job_board_url",
    label: "Job Board URL",
    description: "District job board URL for vacancy scanning",
    domain: "links",
    format: "text",
    source: "etl_link",
    queryable: false,
  },

  // ===== Title I =====
  {
    field: "titleISchoolCount",
    column: "title_i_school_count",
    label: "Title I Schools",
    description: "Number of Title I eligible schools",
    domain: "finance",
    format: "integer",
    source: "urban_institute",
    queryable: true,
  },
  {
    field: "titleISchoolwideCount",
    column: "title_i_schoolwide_count",
    label: "Title I Schoolwide",
    description: "Number of Title I schoolwide program schools",
    domain: "finance",
    format: "integer",
    source: "urban_institute",
    queryable: true,
  },

  // ===== User Edits =====
  {
    field: "notes",
    column: "notes",
    label: "Notes",
    description: "Free-form notes from sales team",
    domain: "user_edits",
    format: "text",
    source: "user",
    queryable: false,
  },
];

/** Lookup helpers */
export const COLUMN_BY_FIELD = new Map(
  DISTRICT_COLUMNS.map((c) => [c.field, c])
);
export const COLUMN_BY_DB_NAME = new Map(
  DISTRICT_COLUMNS.map((c) => [c.column, c])
);
export const COLUMNS_BY_DOMAIN = DISTRICT_COLUMNS.reduce(
  (acc, col) => {
    (acc[col.domain] ??= []).push(col);
    return acc;
  },
  {} as Record<ColumnDomain, ColumnMetadata[]>
);
export const QUERYABLE_COLUMNS = DISTRICT_COLUMNS.filter((c) => c.queryable);

// ============================================================================
// district_financials registry
// ============================================================================
//
// Normalized financial metrics across all vendors (Fullmind + competitors).
// One row per (leaid, vendor, fiscal_year). Vendor is one of: 'fullmind',
// 'elevate', 'proximity', 'tbt'.
//
// IMPORTANT: fiscal_year is stored as 'FY26', 'FY27' (with the 'FY' prefix),
// NOT bare '26'/'27'. MCP tools and queries must use the prefixed format.

export const DISTRICT_FINANCIALS_COLUMNS: ColumnMetadata[] = [
  {
    field: "leaid",
    column: "leaid",
    label: "LEA ID",
    description: "FK to districts.leaid (nullable for unmatched accounts)",
    domain: "core",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "vendor",
    column: "vendor",
    label: "Vendor",
    description: "Vendor identifier — one of: fullmind, elevate, proximity, tbt",
    domain: "crm",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "fiscalYear",
    column: "fiscal_year",
    label: "Fiscal Year",
    description: "Fiscal year stored with 'FY' prefix (e.g. 'FY26', 'FY27')",
    domain: "crm",
    format: "text",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "openPipeline",
    column: "open_pipeline",
    label: "Open Pipeline",
    description: "Total value of open opportunities not yet closed",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "weightedPipeline",
    column: "weighted_pipeline",
    label: "Weighted Pipeline",
    description: "Pipeline value weighted by stage probability",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "openPipelineOppCount",
    column: "open_pipeline_opp_count",
    label: "Open Pipeline Opp Count",
    description: "Number of open opportunities",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "closedWonBookings",
    column: "closed_won_bookings",
    label: "Closed Won Bookings",
    description: "Total value of closed-won opportunities (net booking)",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "closedWonOppCount",
    column: "closed_won_opp_count",
    label: "Closed Won Opp Count",
    description: "Number of closed-won opportunities",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "invoicing",
    column: "invoicing",
    label: "Net Invoicing",
    description: "Total invoiced amount (net of credits)",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "scheduledRevenue",
    column: "scheduled_revenue",
    label: "Scheduled Revenue",
    description: "Revenue from scheduled but not yet completed sessions",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "completedRevenue",
    column: "completed_revenue",
    label: "Completed Revenue",
    description: "Revenue from completed (delivered) sessions",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "deferredRevenue",
    column: "deferred_revenue",
    label: "Deferred Revenue",
    description: "Revenue invoiced but not yet recognized",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "totalRevenue",
    column: "total_revenue",
    label: "Total Revenue",
    description: "Sum of completed + scheduled + deferred revenue",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "scheduledTake",
    column: "scheduled_take",
    label: "Scheduled Take",
    description: "Fullmind margin on scheduled sessions",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "completedTake",
    column: "completed_take",
    label: "Completed Take",
    description: "Fullmind margin on completed sessions",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "totalTake",
    column: "total_take",
    label: "Total Take",
    description: "Sum of completed + scheduled take (Fullmind margin)",
    domain: "crm",
    format: "currency",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "sessionCount",
    column: "session_count",
    label: "Session Count",
    description: "Total number of sessions delivered",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "poCount",
    column: "po_count",
    label: "PO Count",
    description: "Number of purchase orders (used for competitor vendors via GovSpend data)",
    domain: "outsourcing",
    format: "integer",
    source: "govspend",
    queryable: true,
  },
  {
    field: "unmatchedAccountId",
    column: "unmatched_account_id",
    label: "Unmatched Account ID",
    description: "FK to unmatched_accounts for financial data not tied to a district",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: false,
  },
];

export const FINANCIALS_COLUMN_BY_FIELD = new Map(
  DISTRICT_FINANCIALS_COLUMNS.map((c) => [c.field, c])
);
export const FINANCIALS_COLUMN_BY_DB_NAME = new Map(
  DISTRICT_FINANCIALS_COLUMNS.map((c) => [c.column, c])
);
export const FINANCIALS_QUERYABLE_COLUMNS = DISTRICT_FINANCIALS_COLUMNS.filter(
  (c) => c.queryable
);

/** Known vendor identifiers in district_financials.vendor */
export const KNOWN_VENDORS = ["fullmind", "elevate", "proximity", "tbt"] as const;
export type KnownVendor = (typeof KNOWN_VENDORS)[number];

/** Format fiscal year string for queries — vendor_financials uses 'FY' prefix */
export function formatFiscalYear(year: number | string): string {
  const numStr = String(year).replace(/^FY/, "");
  return `FY${numStr.padStart(2, "0")}`;
}
