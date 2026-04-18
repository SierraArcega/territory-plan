/**
 * Column metadata registry for the districts table.
 * Used by MCP tools, query builder, and explore grid to understand column semantics.
 */

export type ColumnDomain =
  // District-specific domains (existing)
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
  | "user_edits"
  // Cross-table domains (new for TABLE_REGISTRY)
  | "opportunity"
  | "session"
  | "subscription"
  | "activity"
  | "plan"
  | "contact"
  | "task"
  | "vacancy"
  | "school"
  | "state"
  | "history"
  | "unmatched"
  | "audit";

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
  | "etl_link"
  // New sources
  | "opensearch"        // opportunities, sessions (Railway scheduler sync)
  | "elevate_k12"       // subscriptions (Elevate import pipeline)
  | "scraper"           // vacancies, vacancy_scans
  | "query_tool";       // query_log, saved_reports

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

  // ===== Geo (PostGIS) =====
  // Managed outside Prisma — included here so the query tool can write
  // ST_DWithin / ST_Distance queries. The 'geometry' MultiPolygon column
  // is intentionally excluded (too large to ever return as a result).
  {
    field: "centroid",
    column: "centroid",
    label: "Centroid",
    description:
      "PostGIS Point (EPSG:4326) computed from the district polygon. Use for radius / distance queries. CRITICAL: 4326 is lon/lat in DEGREES, not meters — always cast to ::geography for distance math: ST_DWithin(d.centroid::geography, other_point::geography, meters). For maximum coverage when some districts lack a polygon, use COALESCE(d.centroid, d.point_location). Do NOT include in SELECT * — it's a binary geometry blob; if you need to return a location, wrap with ST_Y(centroid) AS lat, ST_X(centroid) AS lon.",
    domain: "core",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "pointLocation",
    column: "point_location",
    label: "Point Location",
    description:
      "PostGIS Point (EPSG:4326) — geocoded address point used as a fallback when the polygon-derived centroid is NULL. Same usage rules as centroid (cast to ::geography for meter-based distance). Prefer COALESCE(d.centroid, d.point_location) for radius queries to maximize coverage.",
    domain: "core",
    format: "text",
    source: "computed",
    queryable: true,
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
    description: "Total number of sessions delivered. Populated by refresh_fullmind_financials() from the sessions table joined to opportunities.",
    domain: "crm",
    format: "integer",
    source: "fullmind_crm",
    queryable: true,
  },
  {
    field: "subscriptionCount",
    column: "subscription_count",
    label: "Subscription Count",
    description: "Number of Elevate K12 subscription line items rolled into this district/FY. Populated by refresh_fullmind_financials() from the subscriptions table. Parallel to sessionCount.",
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

// ============================================================================
// district_opportunity_actuals (materialized view) registry
// ============================================================================

/** Known category values in district_opportunity_actuals.category */
export const KNOWN_DOA_CATEGORIES = [
  "new_business",
  "renewal",
  "winback",
  "expansion",
] as const;
export type KnownDoaCategory = (typeof KNOWN_DOA_CATEGORIES)[number];

/**
 * Column metadata for the district_opportunity_actuals materialized view.
 * Authoritative source for rep-scoped and category-scoped opportunity rollups
 * (same data as the leaderboard). Bakes in chain-deduplicated
 * min_purchase_bookings, text-stage closed-won detection, and EK12
 * subscription revenue fold-in that raw `opportunities` queries lack.
 */
export const DISTRICT_OPPORTUNITY_ACTUALS_COLUMNS: ColumnMetadata[] = [
  {
    field: "districtLeaId",
    column: "district_lea_id",
    label: "LEA ID",
    description:
      "FK to districts.leaid. NOT NULL in DOA — opps without a matched district are excluded from the matview entirely.",
    domain: "core",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "schoolYr",
    column: "school_yr",
    label: "School Year",
    description:
      "Salesforce school year string, e.g. '2025-26' (= FY26). Join key for FY-scoped questions; use fiscalYearToSchoolYear() in src/lib/opportunity-actuals.ts to convert a numeric FY.",
    domain: "crm",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "salesRepEmail",
    column: "sales_rep_email",
    label: "Sales Rep Email",
    description:
      "Opportunity owner email, sourced from Salesforce via OpenSearch sync. Can be NULL for orphan opps. A one-off migration reassigned mixed-rep 'Anurag' contract groups to the real rep, but the scheduler's hourly sync clobbers these — known fragile until fixed upstream.",
    domain: "crm",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "category",
    column: "category",
    label: "Category",
    description:
      "Contract category, case-insensitive regex-derived from opportunities.contract_type. Exactly one of: 'new_business' (default when contract_type is null or unmatched), 'renewal' (LIKE '%renewal%'), 'winback' (LIKE '%winback%' or '%win back%'), 'expansion' (LIKE '%expansion%'). Only source of category breakdown — raw opportunities has contract_type but not this normalized bucket.",
    domain: "opportunity",
    format: "text",
    source: "computed",
    queryable: true,
  },
  {
    field: "bookings",
    column: "bookings",
    label: "Bookings",
    description:
      "SUM(net_booking_amount) on closed-won opportunities. Closed-won detection handles BOTH numeric stage prefix ≥ 6 AND text stages ('closed won', 'active', 'position purchased', 'requisition received', 'return position pending'). Salesforce-native booking total. For contracted-floor view (preferred for in-progress years), use min_purchase_bookings.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "minPurchaseBookings",
    column: "min_purchase_bookings",
    label: "Min Purchase Bookings",
    description:
      "Closed-won CONTRACT FLOOR, sourced from opportunities.minimum_purchase_amount. Chain-deduplicated: Salesforce stores add-ons with cumulative minimum_purchase_amount values, so the matview clusters contract chains (by name after stripping 'Add-On'/'AddOn'/'Add On' suffixes and district-name prefixes), takes MAX per chain (the latest cumulative floor), then SUMs across chains. A naive SUM(opportunities.minimum_purchase_amount) would 3-4× overcount tier-1 contracts. Powers the leaderboard's 'Prior Year Bookings' column — preferred for in-progress years where session delivery lags signed contract value.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "openPipeline",
    column: "open_pipeline",
    label: "Open Pipeline",
    description:
      "SUM(net_booking_amount) for opportunities with numeric stage prefix 0-5 (stages awaiting close). Excludes closed-won (≥6) and closed-lost (-1).",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "weightedPipeline",
    column: "weighted_pipeline",
    label: "Weighted Pipeline",
    description:
      "Open pipeline × per-stage probability: stage 0 → 0.05, 1 → 0.10, 2 → 0.25, 3 → 0.50, 4 → 0.75, 5 → 0.90. Closed-won and closed-lost are excluded entirely (not weighted).",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "totalRevenue",
    column: "total_revenue",
    label: "Total Revenue",
    description:
      "Session-derived Fullmind revenue PLUS EK12 subscription revenue. Computed as SUM(opportunities.total_revenue) + SUM(subscriptions.net_total) for subscriptions linked to opps in scope. Preferred single-number revenue metric — covers both modalities. To disaggregate into session vs subscription, query the subscriptions table separately (see SEMANTIC_CONTEXT.conceptMappings.session_vs_subscription_revenue).",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "completedRevenue",
    column: "completed_revenue",
    label: "Completed Revenue",
    description:
      "Session-completed Fullmind revenue PLUS EK12 subscription revenue (same sub fold-in as total_revenue). Represents revenue already recognized/delivered.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "scheduledRevenue",
    column: "scheduled_revenue",
    label: "Scheduled Revenue",
    description:
      "Session-scheduled Fullmind revenue ONLY. Does NOT include EK12 subscriptions (EK12 has no 'scheduled' concept). Effectively 'future session-only revenue'.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "totalTake",
    column: "total_take",
    label: "Total Take",
    description:
      "Fullmind margin on session-derived revenue. Session-ONLY — there is no take rate concept for EK12 subscription revenue, so subscription revenue does NOT contribute to take columns. Take for a mixed-modality rep understates their total margin contribution if a lot of their revenue is EK12.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "completedTake",
    column: "completed_take",
    label: "Completed Take",
    description:
      "Session-completed portion of total_take. Same session-only caveat applies.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "scheduledTake",
    column: "scheduled_take",
    label: "Scheduled Take",
    description:
      "Session-scheduled (future) portion of total_take. Same session-only caveat applies.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "avgTakeRate",
    column: "avg_take_rate",
    label: "Avg Take Rate",
    description:
      "total_take / (SESSION-ONLY total_revenue). IMPORTANT: divides by the raw session-revenue base, NOT the output total_revenue column that folds in subscriptions. This keeps the rate meaningful as a session-margin metric instead of getting diluted to zero by EK12 subscription revenue. NULL when there is no session revenue.",
    domain: "opportunity",
    format: "ratio",
    source: "computed",
    queryable: true,
  },
  {
    field: "invoiced",
    column: "invoiced",
    label: "Invoiced",
    description:
      "SUM(opportunities.invoiced). Opp-only; EK12 subscription invoiced data is not rolled into this column.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "credited",
    column: "credited",
    label: "Credited",
    description:
      "SUM(opportunities.credited). Opp-only; EK12 subscription credits are reflected via signed net_total contributions to total_revenue but not broken out here.",
    domain: "opportunity",
    format: "currency",
    source: "computed",
    queryable: true,
  },
  {
    field: "oppCount",
    column: "opp_count",
    label: "Opp Count",
    description:
      "COUNT of opportunity rows in the (district, school_yr, rep, category) group. Includes all stages (open, closed-won, closed-lost).",
    domain: "opportunity",
    format: "integer",
    source: "computed",
    queryable: true,
  },
  {
    field: "subscriptionCount",
    column: "subscription_count",
    label: "Subscription Count",
    description:
      "COUNT of subscription line items from the subscriptions table linked via opportunity_id to opps in scope. Zero for purely-Fullmind groups. One opportunity can have many subscriptions, so this is a line-item count, not a distinct-opp count.",
    domain: "subscription",
    format: "integer",
    source: "computed",
    queryable: true,
  },
];

export const DOA_COLUMN_BY_FIELD = new Map(
  DISTRICT_OPPORTUNITY_ACTUALS_COLUMNS.map((c) => [c.field, c])
);
export const DOA_COLUMN_BY_DB_NAME = new Map(
  DISTRICT_OPPORTUNITY_ACTUALS_COLUMNS.map((c) => [c.column, c])
);
export const DOA_QUERYABLE_COLUMNS = DISTRICT_OPPORTUNITY_ACTUALS_COLUMNS.filter(
  (c) => c.queryable
);

// ============================================================================
// opportunities (raw table) registry
// ============================================================================

/**
 * Canonical stage values. Numeric stages are emitted by LMS for open pipeline
 * (0-5) and very rarely higher. "Closed Won" / "Closed Lost" are the only
 * meaningful text stages. Other text values ('Active', 'Position Purchased',
 * 'Requisition Received', 'Return Position Pending') are erroneous child/
 * auxiliary opportunity rows from Salesforce — DOA counts them as closed-won
 * (leaderboard behavior, intentional), but deal-level queries should filter
 * them out. Known data quality issue to be fixed upstream.
 */
export const ERRONEOUS_CHILD_OP_STAGES = [
  "Active",
  "Position Purchased",
  "Requisition Received",
  "Return Position Pending",
] as const;

/**
 * Column metadata for the opportunities raw table. Only safe for per-deal
 * queries (SELECT by id/name, list individual deals, filter by a specific
 * stage). For any aggregate — bookings, pipeline, revenue, take, category
 * breakdown — route to district_opportunity_actuals. See the mandatory
 * warnings in SEMANTIC_CONTEXT.
 */
export const OPPORTUNITY_COLUMNS: ColumnMetadata[] = [
  {
    field: "id",
    column: "id",
    label: "Opportunity ID",
    description: "Salesforce opportunity ID (primary key). Also referenced by subscriptions.opportunity_id and sessions.opportunity_id.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "name",
    column: "name",
    label: "Name",
    description: "Salesforce opportunity name. Add-on opportunities typically include 'Add-On' / 'AddOn' / 'Add On' in the name — DOA's min_purchase_bookings uses this pattern to cluster contract chains.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "schoolYr",
    column: "school_yr",
    label: "School Year",
    description: "Salesforce school year string, e.g. '2025-26' (= FY26). Same format as DOA.school_yr and different from district_financials.fiscal_year ('FY26'). Use fiscalYearToSchoolYear() to convert between.",
    domain: "crm",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "contractType",
    column: "contract_type",
    label: "Contract Type",
    description: "Free-text Salesforce field (no picklist). DOA.category regex-derives from this — matches '%renewal%' / '%winback%' / '%win back%' / '%expansion%' (case-insensitive); everything else → 'new_business'. For category rollups, always query DOA.category instead of this raw column.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "state",
    column: "state",
    label: "State",
    description: "State name as stored in Salesforce (may be full name or abbreviation).",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "stateFips",
    column: "state_fips",
    label: "State FIPS",
    description: "2-digit FIPS state code (e.g., '06' for California).",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "salesRepName",
    column: "sales_rep_name",
    label: "Sales Rep Name",
    description: "Opportunity owner display name from Salesforce.",
    domain: "crm",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "salesRepEmail",
    column: "sales_rep_email",
    label: "Sales Rep Email",
    description: "Opportunity owner email. Joined in DOA for rep-scoped aggregates. Can be NULL for orphan opps.",
    domain: "crm",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "salesRepId",
    column: "sales_rep_id",
    label: "Sales Rep User ID",
    description: "FK to user_profiles.id (UUID) when the rep has a matched profile; null otherwise.",
    domain: "crm",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtName",
    column: "district_name",
    label: "District Name",
    description: "District name as stored in Salesforce (may not exactly match districts.name).",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtLmsId",
    column: "district_lms_id",
    label: "District LMS ID",
    description: "Internal LMS district identifier from Salesforce.",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtNcesId",
    column: "district_nces_id",
    label: "District NCES ID",
    description: "NCES district identifier from Salesforce. Often matches but may differ from the canonical districts.leaid — prefer district_lea_id for joins.",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtLeaId",
    column: "district_lea_id",
    label: "LEA ID",
    description: "FK to districts.leaid (VARCHAR(7)). Can be NULL for opps that didn't match a district during ETL. DOA excludes NULL district_lea_id rows entirely.",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "createdAt",
    column: "created_at",
    label: "Created At",
    description: "Opportunity creation timestamp in Salesforce.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "closeDate",
    column: "close_date",
    label: "Close Date",
    description: "Projected or actual close date from Salesforce.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "brandAmbassador",
    column: "brand_ambassador",
    label: "Brand Ambassador",
    description: "Salesforce brand ambassador field (optional referral/partner attribution).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "stage",
    column: "stage",
    label: "Stage",
    description: "Deal stage. Canonical values are: numeric prefix stages (0-5 open pipeline, 6+ closed-won) and text 'Closed Won' / 'Closed Lost'. Other text values ('Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending') are ERRONEOUS child/auxiliary opportunity rows — filter them out in deal-level queries (WHERE stage NOT IN (...) using ERRONEOUS_CHILD_OP_STAGES). Note: DOA aggregates DO include these as closed-won (leaderboard behavior, intentional). For any closed-won/lost/open aggregate, use DOA, not this column.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "netBookingAmount",
    column: "net_booking_amount",
    label: "Net Booking Amount",
    description: "Salesforce net booking value. Safe to SUM per deal (add-ons add real incremental dollars). For CLOSED-WON aggregates across deals, use DOA.bookings — raw SUM here requires the full dual-stage closed-won CASE and will undercount if you use numeric-only logic.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "contractThrough",
    column: "contract_through",
    label: "Contract Through",
    description: "Free-text contract term end indicator from Salesforce.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "fundingThrough",
    column: "funding_through",
    label: "Funding Through",
    description: "Free-text funding source description from Salesforce.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "paymentType",
    column: "payment_type",
    label: "Payment Type",
    description: "Salesforce payment type (e.g., annual, monthly, per-session).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "paymentTerms",
    column: "payment_terms",
    label: "Payment Terms",
    description: "Salesforce payment terms (e.g., Net 30).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "leadSource",
    column: "lead_source",
    label: "Lead Source",
    description: "Where the opportunity originated (e.g., referral, inbound, conference).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "invoiced",
    column: "invoiced",
    label: "Invoiced",
    description: "Amount invoiced to date on this opportunity. Safe to SUM across deals for billing questions. Opp-only — EK12 subscription invoicing not represented.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "credited",
    column: "credited",
    label: "Credited",
    description: "Amount credited back on this opportunity. Safe to SUM across deals.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "completedRevenue",
    column: "completed_revenue",
    label: "Completed Revenue",
    description: "Session-completed revenue for this opp. SESSION-ONLY — does NOT include EK12 subscription revenue. For inclusive revenue aggregates use DOA.completed_revenue or district_financials.total_revenue (minus scheduled if needed).",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "completedTake",
    column: "completed_take",
    label: "Completed Take",
    description: "Session-completed Fullmind margin for this opp. Session-only (no subscription take concept).",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "scheduledSessions",
    column: "scheduled_sessions",
    label: "Scheduled Sessions",
    description: "Count of scheduled (future) sessions for this opp.",
    domain: "session",
    format: "integer",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "scheduledRevenue",
    column: "scheduled_revenue",
    label: "Scheduled Revenue",
    description: "Session-scheduled (future) revenue. Session-only — no subscription equivalent.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "scheduledTake",
    column: "scheduled_take",
    label: "Scheduled Take",
    description: "Session-scheduled (future) Fullmind margin.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "totalRevenue",
    column: "total_revenue",
    label: "Total Revenue (session-only)",
    description: "completed_revenue + scheduled_revenue. SESSION-ONLY — missing EK12 subscription revenue. For inclusive 'total revenue' questions use district_financials.total_revenue (rep-agnostic) or DOA.total_revenue (rep/category-scoped); both fold in EK12 subs.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "totalTake",
    column: "total_take",
    label: "Total Take",
    description: "completed_take + scheduled_take. Session-only margin — same caveat: no subscription take.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "averageTakeRate",
    column: "average_take_rate",
    label: "Average Take Rate",
    description: "Per-deal take / revenue ratio (session-only). NULL when there's no revenue. For rep/district-aggregated rates use DOA.avg_take_rate instead — it divides by aggregate session revenue.",
    domain: "opportunity",
    format: "ratio",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "serviceTypes",
    column: "service_types",
    label: "Service Types",
    description: "JSON array of service type codes (e.g., tutoring, enrichment). Stored as jsonb; use jsonb operators or `::text LIKE` for matching.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "minimumPurchaseAmount",
    column: "minimum_purchase_amount",
    label: "Minimum Purchase Amount",
    description: "Contracted spending floor. Per-deal use is safe. DO NOT SUM across deals — EK12 add-ons store CUMULATIVE values that compound with each add-on, producing 3-4× overcounts on tier-1 contracts. For closed-won aggregates use DOA.min_purchase_bookings (chain-deduplicated).",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "maximumBudget",
    column: "maximum_budget",
    label: "Maximum Budget",
    description: "Contracted spending ceiling. Per-deal use is safe. DO NOT SUM across deals (same EK12 add-on overcount as minimum_purchase_amount) and DO NOT use MAX across deals (which master vs add-on is unknowable). No safe aggregate alternative exists yet.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "detailsLink",
    column: "details_link",
    label: "Details Link",
    description: "URL to the deal in Salesforce (useful for user-facing result cards).",
    domain: "links",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "stageHistory",
    column: "stage_history",
    label: "Stage History",
    description: "JSON array of {stage, timestamp} entries capturing stage transitions over the deal's life. Useful for velocity/age questions (e.g., time in stage).",
    domain: "history",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "startDate",
    column: "start_date",
    label: "Start Date",
    description: "Contract start date.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "expiration",
    column: "expiration",
    label: "Expiration",
    description: "Contract expiration date.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "syncedAt",
    column: "synced_at",
    label: "Synced At",
    description: "Timestamp of the last scheduler sync that updated this row. Use to gauge freshness.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
];

export const OPPORTUNITY_COLUMN_BY_FIELD = new Map(
  OPPORTUNITY_COLUMNS.map((c) => [c.field, c])
);
export const OPPORTUNITY_COLUMN_BY_DB_NAME = new Map(
  OPPORTUNITY_COLUMNS.map((c) => [c.column, c])
);

// ============================================================================
// subscriptions (raw table — Elevate K12 line items) registry
// ============================================================================

/**
 * Column metadata for the subscriptions table. Each row is one EK12 line item
 * linked to a parent opportunity. Revenue here is signed (quantity and
 * net_total can be negative to represent credits/cancellations). For
 * aggregated EK12 revenue, district_financials.total_revenue (vendor='fullmind')
 * and DOA.total_revenue both already fold subscriptions in.
 */
export const SUBSCRIPTION_COLUMNS: ColumnMetadata[] = [
  {
    field: "id",
    column: "id",
    label: "Subscription ID",
    description: "Primary key, shape 'SUB-NNNNNNN' (from Elevate).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "opportunityId",
    column: "opportunity_id",
    label: "Opportunity ID",
    description: "FK to opportunities.id. Many subscriptions per opportunity.",
    domain: "opportunity",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "contractNumber",
    column: "contract_number",
    label: "Contract Number",
    description: "Elevate contract number grouping related line items.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "netPrice",
    column: "net_price",
    label: "Net Price",
    description: "Per-unit price. SUM is not usually meaningful — multiply by quantity or use net_total for totals.",
    domain: "subscription",
    format: "currency",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "quantity",
    column: "quantity",
    label: "Quantity",
    description: "Line-item quantity. Can be NEGATIVE to represent credits/cancellations.",
    domain: "subscription",
    format: "integer",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "netTotal",
    column: "net_total",
    label: "Net Total",
    description: "Signed line-item total (net_price × quantity). SUM across rows is the correct aggregate — negative credits offset positive revenue. DOA and district_financials both roll this column into their total_revenue.",
    domain: "subscription",
    format: "currency",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "product",
    column: "product",
    label: "Product",
    description: "Top-level product name (Elevate taxonomy).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "productType",
    column: "product_type",
    label: "Product Type",
    description: "Product category (Elevate taxonomy).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "subProduct",
    column: "sub_product",
    label: "Sub Product",
    description: "Sub-product detail (Elevate taxonomy).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "courseName",
    column: "course_name",
    label: "Course Name",
    description: "Specific course attached to this line item (e.g., 'Algebra 1').",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "curriculumProvider",
    column: "curriculum_provider",
    label: "Curriculum Provider",
    description: "Third-party curriculum partner for the course.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "schoolName",
    column: "school_name",
    label: "School Name",
    description: "Specific school within the district, if the line item is school-scoped.",
    domain: "school",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "grade",
    column: "grade",
    label: "Grade",
    description: "Grade level (free-text; values like 'K', '6', '9-12').",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "officeHours",
    column: "office_hours",
    label: "Office Hours",
    description: "Office hours allocation for the subscription (free-text).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "ccTeacherCollabMeetings",
    column: "cc_teacher_collab_meetings",
    label: "CC Teacher Collab Meetings",
    description: "Classroom-connection teacher collaboration meeting allocation (free-text).",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "startDate",
    column: "start_date",
    label: "Start Date",
    description: "Subscription delivery start date.",
    domain: "subscription",
    format: "date",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "deliveryEndDate",
    column: "delivery_end_date",
    label: "Delivery End Date",
    description: "Subscription delivery end date.",
    domain: "subscription",
    format: "date",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "subscriptionCreatedDate",
    column: "subscription_created_date",
    label: "Subscription Created Date",
    description: "When the subscription record was created in Elevate.",
    domain: "subscription",
    format: "date",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "contractCreatedDate",
    column: "contract_created_date",
    label: "Contract Created Date",
    description: "When the parent contract was created in Elevate.",
    domain: "subscription",
    format: "date",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "contractOwnerName",
    column: "contract_owner_name",
    label: "Contract Owner Name",
    description: "Owner name string from Elevate. Informational only — not a FK to user_profiles. For rep attribution, join through opportunities.sales_rep_email.",
    domain: "crm",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "syncedAt",
    column: "synced_at",
    label: "Synced At",
    description: "Timestamp of the last Elevate sync that updated this row.",
    domain: "subscription",
    format: "date",
    source: "elevate_k12",
    queryable: true,
  },
];

export const SUBSCRIPTION_COLUMN_BY_FIELD = new Map(
  SUBSCRIPTION_COLUMNS.map((c) => [c.field, c])
);
export const SUBSCRIPTION_COLUMN_BY_DB_NAME = new Map(
  SUBSCRIPTION_COLUMNS.map((c) => [c.column, c])
);

// ============================================================================
// Coverage registries — compact entries for 12 meaningful tables.
// Shorter descriptions than DOA/opps/subs; deepen any entry on demand.
// ============================================================================

/** contacts — district-level point-of-contact records (admins, principals, etc.) */
export const CONTACT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Contact ID", description: "PK (autoincrement).", domain: "contact", format: "integer", source: "fullmind_crm", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid.", domain: "core", format: "text", source: "fullmind_crm", queryable: true },
  { field: "salutation", column: "salutation", label: "Salutation", description: "Optional title prefix (Dr., Mr., etc.).", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "name", column: "name", label: "Name", description: "Full name.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Job title at the district.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "email", column: "email", label: "Email", description: "Contact email address.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "phone", column: "phone", label: "Phone", description: "Contact phone number.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "isPrimary", column: "is_primary", label: "Is Primary", description: "Primary POC flag for the district.", domain: "contact", format: "boolean", source: "fullmind_crm", queryable: true },
  { field: "linkedinUrl", column: "linkedin_url", label: "LinkedIn URL", description: "LinkedIn profile URL.", domain: "links", format: "text", source: "fullmind_crm", queryable: true },
  { field: "persona", column: "persona", label: "Persona", description: "Persona bucket (e.g., Superintendent, HR Director).", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "seniorityLevel", column: "seniority_level", label: "Seniority Level", description: "Seniority classification.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the record was created.", domain: "contact", format: "date", source: "fullmind_crm", queryable: true },
  { field: "lastEnrichedAt", column: "last_enriched_at", label: "Last Enriched At", description: "Last time Clay/enrichment refreshed this contact.", domain: "contact", format: "date", source: "etl_link", queryable: true },
];

/** unmatched_accounts — ETL accounts that couldn't match a district during import */
export const UNMATCHED_ACCOUNT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "PK (autoincrement). Referenced by district_financials.unmatched_account_id.", domain: "unmatched", format: "integer", source: "fullmind_crm", queryable: true },
  { field: "accountName", column: "account_name", label: "Account Name", description: "Salesforce account name as it arrived from import.", domain: "unmatched", format: "text", source: "fullmind_crm", queryable: true },
  { field: "salesExecutiveId", column: "sales_executive_id", label: "Sales Exec ID", description: "FK to user_profiles.id for the attributed rep.", domain: "crm", format: "text", source: "fullmind_crm", queryable: true },
  { field: "stateAbbrev", column: "state_abbrev", label: "State Abbrev", description: "State 2-letter abbreviation.", domain: "core", format: "text", source: "fullmind_crm", queryable: true },
  { field: "stateFips", column: "state_fips", label: "State FIPS", description: "State 2-digit FIPS code.", domain: "core", format: "text", source: "fullmind_crm", queryable: true },
  { field: "lmsid", column: "lmsid", label: "LMS ID", description: "LMS identifier if known.", domain: "unmatched", format: "text", source: "fullmind_crm", queryable: true },
  { field: "leaidRaw", column: "leaid_raw", label: "Raw LEA ID", description: "Raw LEA ID string from import that didn't match any district.", domain: "unmatched", format: "text", source: "fullmind_crm", queryable: true },
  { field: "matchFailureReason", column: "match_failure_reason", label: "Match Failure Reason", description: "Why the account didn't match (e.g., 'no_lea_id', 'lea_not_in_db').", domain: "unmatched", format: "text", source: "fullmind_crm", queryable: true },
  { field: "isCustomer", column: "is_customer", label: "Is Customer", description: "Denormalized customer flag (mirrors districts.is_customer).", domain: "crm", format: "boolean", source: "fullmind_crm", queryable: true },
  { field: "hasOpenPipeline", column: "has_open_pipeline", label: "Has Open Pipeline", description: "Denormalized open-pipeline flag.", domain: "crm", format: "boolean", source: "fullmind_crm", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "unmatched", format: "date", source: "fullmind_crm", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "unmatched", format: "date", source: "fullmind_crm", queryable: true },
];

/** states — state-level rollup table (one row per US state) with denormalized aggregates */
export const STATE_COLUMNS: ColumnMetadata[] = [
  { field: "fips", column: "fips", label: "FIPS", description: "PK. 2-digit FIPS code (e.g., '06' for CA).", domain: "state", format: "text", source: "nces", queryable: true },
  { field: "abbrev", column: "abbrev", label: "Abbrev", description: "2-letter state code (e.g., 'CA').", domain: "state", format: "text", source: "nces", queryable: true },
  { field: "name", column: "name", label: "Name", description: "State name (e.g., 'California').", domain: "state", format: "text", source: "nces", queryable: true },
  { field: "totalDistricts", column: "total_districts", label: "Total Districts", description: "Count of districts in the state.", domain: "state", format: "integer", source: "computed", queryable: true },
  { field: "totalEnrollment", column: "total_enrollment", label: "Total Enrollment", description: "Sum of student enrollment across districts.", domain: "demographics", format: "integer", source: "computed", queryable: true },
  { field: "totalSchools", column: "total_schools", label: "Total Schools", description: "Count of schools in the state.", domain: "state", format: "integer", source: "computed", queryable: true },
  { field: "totalCustomers", column: "total_customers", label: "Total Customers", description: "Count of Fullmind customer districts in the state.", domain: "crm", format: "integer", source: "computed", queryable: true },
  { field: "totalWithPipeline", column: "total_with_pipeline", label: "Total With Pipeline", description: "Count of districts with open pipeline.", domain: "crm", format: "integer", source: "computed", queryable: true },
  { field: "totalPipelineValue", column: "total_pipeline_value", label: "Total Pipeline Value", description: "Sum of open pipeline across districts. Rollup from district_financials.", domain: "crm", format: "currency", source: "computed", queryable: true },
  { field: "avgExpenditurePerPupil", column: "avg_expenditure_per_pupil", label: "Avg Expenditure Per Pupil", description: "Enrollment-weighted average.", domain: "finance", format: "currency", source: "computed", queryable: true },
  { field: "avgGraduationRate", column: "avg_graduation_rate", label: "Avg Graduation Rate", description: "Weighted average graduation rate (%).", domain: "graduation", format: "percentage", source: "computed", queryable: true },
  { field: "avgPovertyRate", column: "avg_poverty_rate", label: "Avg Poverty Rate", description: "Weighted average child-poverty rate (%).", domain: "poverty", format: "percentage", source: "computed", queryable: true },
  { field: "avgChronicAbsenteeismRate", column: "avg_chronic_absenteeism_rate", label: "Avg Chronic Absenteeism Rate", description: "Weighted average chronic absenteeism rate (%).", domain: "absenteeism", format: "percentage", source: "computed", queryable: true },
  { field: "avgStudentTeacherRatio", column: "avg_student_teacher_ratio", label: "Avg Student-Teacher Ratio", description: "Weighted student-to-teacher ratio.", domain: "staffing", format: "ratio", source: "computed", queryable: true },
  { field: "avgSwdPct", column: "avg_swd_pct", label: "Avg SWD %", description: "Weighted SPED student percentage.", domain: "sped", format: "percentage", source: "computed", queryable: true },
  { field: "avgEllPct", column: "avg_ell_pct", label: "Avg ELL %", description: "Weighted English-learner percentage.", domain: "demographics", format: "percentage", source: "computed", queryable: true },
  { field: "avgEnrollment", column: "avg_enrollment", label: "Avg Enrollment", description: "Average district enrollment in the state.", domain: "demographics", format: "integer", source: "computed", queryable: true },
  { field: "avgMathProficiency", column: "avg_math_proficiency", label: "Avg Math Proficiency", description: "Weighted average math proficiency (%).", domain: "assessment", format: "percentage", source: "computed", queryable: true },
  { field: "avgReadProficiency", column: "avg_read_proficiency", label: "Avg Read Proficiency", description: "Weighted average reading proficiency (%).", domain: "assessment", format: "percentage", source: "computed", queryable: true },
  { field: "icpAvgScore", column: "icp_avg_score", label: "ICP Avg Score", description: "Average ICP (ideal customer profile) score across districts.", domain: "icp", format: "decimal", source: "computed", queryable: true },
  { field: "icpT1Count", column: "icp_t1_count", label: "ICP Tier 1 Count", description: "Count of tier-1 ICP districts in the state.", domain: "icp", format: "integer", source: "computed", queryable: true },
  { field: "icpT2Count", column: "icp_t2_count", label: "ICP Tier 2 Count", description: "Count of tier-2 ICP districts.", domain: "icp", format: "integer", source: "computed", queryable: true },
  { field: "icpChurnPenalty", column: "icp_churn_penalty", label: "ICP Churn Penalty", description: "ICP score penalty from churn risk.", domain: "icp", format: "integer", source: "computed", queryable: true },
  { field: "territoryOwnerId", column: "territory_owner_id", label: "Territory Owner User ID", description: "FK to user_profiles.id — state-level rep owner.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text state notes.", domain: "user_edits", format: "text", source: "user", queryable: true },
  { field: "aggregatesUpdatedAt", column: "aggregates_updated_at", label: "Aggregates Updated At", description: "Last rollup refresh.", domain: "state", format: "date", source: "computed", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "state", format: "date", source: "computed", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "state", format: "date", source: "computed", queryable: true },
];

/** state_assessments — reference list of standardized tests each state administers */
export const STATE_ASSESSMENT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "PK.", domain: "assessment", format: "integer", source: "user", queryable: true },
  { field: "stateFips", column: "state_fips", label: "State FIPS", description: "FK to states.fips.", domain: "state", format: "text", source: "user", queryable: true },
  { field: "name", column: "name", label: "Assessment Name", description: "E.g., 'PSSA', 'CAASPP', 'Keystone Exams'.", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "subjects", column: "subjects", label: "Subjects", description: "Subject areas tested (free text, e.g., 'ELA, Math, Science').", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "grades", column: "grades", label: "Grades", description: "Grade levels tested (e.g., '3-8, 11').", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "testingWindow", column: "testing_window", label: "Testing Window", description: "Typical testing window (e.g., 'Spring').", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "vendor", column: "vendor", label: "Vendor", description: "Test vendor (e.g., 'DRC', 'ETS').", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text notes.", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "assessment", format: "date", source: "user", queryable: true },
];

/** territory_plans — one per rep per fiscal year; anchors plan district/target questions */
export const TERRITORY_PLAN_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Plan ID", description: "UUID PK.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "name", column: "name", label: "Name", description: "Plan display name.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "description", column: "description", label: "Description", description: "Free-text description.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "ownerId", column: "owner_id", label: "Owner User ID", description: "FK to user_profiles.id — the rep who owns this plan.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "color", column: "color", label: "Color", description: "Hex color for UI.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "One of: planning, active, archived.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "fiscalYear", column: "fiscal_year", label: "Fiscal Year", description: "Numeric FY (e.g., 2026). NOT 'FY26' string format.", domain: "crm", format: "year", source: "user", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Plan start date.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "endDate", column: "end_date", label: "End Date", description: "Plan end date.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "userId", column: "user_id", label: "Legacy User ID", description: "Legacy FK (use ownerId for new code).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Plan creation timestamp.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "districtCount", column: "district_count", label: "District Count", description: "Denormalized count of districts in plan.", domain: "plan", format: "integer", source: "computed", queryable: true },
  { field: "stateCount", column: "state_count", label: "State Count", description: "Denormalized count of states in plan.", domain: "plan", format: "integer", source: "computed", queryable: true },
  { field: "renewalRollup", column: "renewal_rollup", label: "Renewal Rollup", description: "Sum of per-district renewal targets.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "expansionRollup", column: "expansion_rollup", label: "Expansion Rollup", description: "Sum of per-district expansion targets.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "winbackRollup", column: "winback_rollup", label: "Winback Rollup", description: "Sum of per-district winback targets.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "newBusinessRollup", column: "new_business_rollup", label: "New Business Rollup", description: "Sum of per-district new-business targets.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "enrichmentStartedAt", column: "enrichment_started_at", label: "Enrichment Started At", description: "When bulk district enrichment was last kicked off.", domain: "plan", format: "date", source: "computed", queryable: true },
  { field: "enrichmentQueued", column: "enrichment_queued", label: "Enrichment Queued", description: "Count of districts still being enriched.", domain: "plan", format: "integer", source: "computed", queryable: true },
  { field: "enrichmentActivityId", column: "enrichment_activity_id", label: "Enrichment Activity ID", description: "Tracking activity for bulk enrichment run.", domain: "plan", format: "text", source: "computed", queryable: true },
];

/** activities — engagement records (conferences, emails, meetings, etc.) */
export const ACTIVITY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Activity ID", description: "UUID PK.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "type", column: "type", label: "Type", description: "E.g., conference, road_trip, email_campaign, meeting, call, note.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Activity title/subject.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text notes.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Activity start date/time.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "endDate", column: "end_date", label: "End Date", description: "Activity end date/time.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "One of: planned, requested, planning, in_progress, wrapping_up, completed, cancelled.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "createdByUserId", column: "created_by_user_id", label: "Created By User ID", description: "FK to user_profiles.id — who logged it.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "googleEventId", column: "google_event_id", label: "Google Event ID", description: "Link to Google Calendar event for two-way sync.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "source", column: "source", label: "Source", description: "'manual' or 'calendar_sync'.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "gmailMessageId", column: "gmail_message_id", label: "Gmail Message ID", description: "Dedup key for Gmail-sourced activities.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "slackChannelId", column: "slack_channel_id", label: "Slack Channel ID", description: "Dedup key for Slack-sourced activities.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "slackMessageTs", column: "slack_message_ts", label: "Slack Message TS", description: "Slack message timestamp for dedup.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "integrationMeta", column: "integration_meta", label: "Integration Meta", description: "Service-specific metadata (JSONB).", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "mixmaxSequenceName", column: "mixmax_sequence_name", label: "Mixmax Sequence Name", description: "Mixmax email sequence name.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "mixmaxSequenceStep", column: "mixmax_sequence_step", label: "Mixmax Sequence Step", description: "Step number within sequence.", domain: "activity", format: "integer", source: "etl_link", queryable: true },
  { field: "mixmaxSequenceTotal", column: "mixmax_sequence_total", label: "Mixmax Sequence Total", description: "Total steps in sequence.", domain: "activity", format: "integer", source: "etl_link", queryable: true },
  { field: "mixmaxStatus", column: "mixmax_status", label: "Mixmax Status", description: "Mixmax delivery status.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "mixmaxOpenCount", column: "mixmax_open_count", label: "Mixmax Open Count", description: "Times the email was opened.", domain: "activity", format: "integer", source: "etl_link", queryable: true },
  { field: "mixmaxClickCount", column: "mixmax_click_count", label: "Mixmax Click Count", description: "Times links in the email were clicked.", domain: "activity", format: "integer", source: "etl_link", queryable: true },
  { field: "outcome", column: "outcome", label: "Outcome", description: "Free-text outcome note (set on completion).", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "outcomeType", column: "outcome_type", label: "Outcome Type", description: "One of: positive_progress, neutral, negative, follow_up_needed.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "rating", column: "rating", label: "Rating", description: "1-5 star rating of activity outcome.", domain: "activity", format: "integer", source: "user", queryable: true },
  { field: "metadata", column: "metadata", label: "Metadata", description: "Type-specific scalar fields (JSON).", domain: "activity", format: "text", source: "user", queryable: true },
];

/** user_profiles — Fullmind teammates; FK target for reps, plan owners, task assignees */
export const USER_PROFILE_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "User ID", description: "UUID PK (matches Supabase auth.users.id).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "email", column: "email", label: "Email", description: "Unique email address. Join key from opportunities.sales_rep_email.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "fullName", column: "full_name", label: "Full Name", description: "Display name.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "avatarUrl", column: "avatar_url", label: "Avatar URL", description: "Profile avatar image URL.", domain: "links", format: "text", source: "user", queryable: true },
  { field: "jobTitle", column: "job_title", label: "Job Title", description: "Fullmind job title.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "role", column: "role", label: "Role", description: "System role enum: 'rep', 'admin', etc. (see UserRole Prisma enum).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "location", column: "location", label: "Location", description: "City/state string.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "locationLat", column: "location_lat", label: "Location Lat", description: "Latitude for map pin.", domain: "crm", format: "decimal", source: "user", queryable: true },
  { field: "locationLng", column: "location_lng", label: "Location Lng", description: "Longitude for map pin.", domain: "crm", format: "decimal", source: "user", queryable: true },
  { field: "phone", column: "phone", label: "Phone", description: "Phone number.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "slackUrl", column: "slack_url", label: "Slack URL", description: "Link to the user's Slack profile.", domain: "links", format: "text", source: "user", queryable: true },
  { field: "bookingLink", column: "booking_link", label: "Booking Link", description: "Calendly/booking URL.", domain: "links", format: "text", source: "user", queryable: true },
  { field: "bio", column: "bio", label: "Bio", description: "Free-text bio.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "crmName", column: "crm_name", label: "CRM Name", description: "Name as it appears in Salesforce (for matching to sales_rep_name).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "hasCompletedSetup", column: "has_completed_setup", label: "Has Completed Setup", description: "Onboarding flag.", domain: "crm", format: "boolean", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "lastLoginAt", column: "last_login_at", label: "Last Login At", description: "Last session timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
];

/** user_goals — per-user fiscal-year targets; pair with district_opportunity_actuals for attainment */
export const USER_GOAL_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "PK (autoincrement).", domain: "crm", format: "integer", source: "user", queryable: true },
  { field: "userId", column: "user_id", label: "User ID", description: "FK to user_profiles.id.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "fiscalYear", column: "fiscal_year", label: "Fiscal Year", description: "Numeric FY (2025, 2026, 2027).", domain: "crm", format: "year", source: "user", queryable: true },
  { field: "earningsTarget", column: "earnings_target", label: "Earnings Target", description: "Rep's personal earnings goal for the FY.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "takeRatePercent", column: "take_rate_percent", label: "Take Rate %", description: "Target take rate as percentage.", domain: "crm", format: "percentage", source: "user", queryable: true },
  { field: "renewalTarget", column: "renewal_target", label: "Renewal Target", description: "Target bookings for renewals.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "winbackTarget", column: "winback_target", label: "Winback Target", description: "Target bookings for winbacks.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "expansionTarget", column: "expansion_target", label: "Expansion Target", description: "Target bookings for expansions.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "newBusinessTarget", column: "new_business_target", label: "New Business Target", description: "Target bookings for new business.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "takeTarget", column: "take_target", label: "Take Target", description: "Target take (Fullmind margin) for the FY.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "newDistrictsTarget", column: "new_districts_target", label: "New Districts Target", description: "Target count of net-new districts.", domain: "crm", format: "integer", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
];

/** tasks — rep to-do items; kanban status + priority */
export const TASK_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Task ID", description: "UUID PK.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Task title.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "description", column: "description", label: "Description", description: "Free-text description.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "One of: todo, in_progress, blocked, done.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "priority", column: "priority", label: "Priority", description: "One of: low, medium, high, urgent.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "dueDate", column: "due_date", label: "Due Date", description: "Task due date.", domain: "task", format: "date", source: "user", queryable: true },
  { field: "position", column: "position", label: "Position", description: "Kanban column ordering.", domain: "task", format: "integer", source: "user", queryable: true },
  { field: "createdByUserId", column: "created_by_user_id", label: "Created By", description: "FK to user_profiles.id — creator.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "assignedToUserId", column: "assigned_to_user_id", label: "Assigned To", description: "FK to user_profiles.id — assignee.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "task", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "task", format: "date", source: "user", queryable: true },
];

/** schools — individual schools within districts (NCES directory) */
export const SCHOOL_COLUMNS: ColumnMetadata[] = [
  { field: "ncessch", column: "ncessch", label: "NCES School ID", description: "12-char NCES school PK.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid — parent district.", domain: "core", format: "text", source: "nces", queryable: true },
  { field: "schoolName", column: "school_name", label: "School Name", description: "School name.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "charter", column: "charter", label: "Charter", description: "0 = traditional, 1 = charter.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "schoolLevel", column: "school_level", label: "School Level", description: "1=Primary, 2=Middle, 3=High, 4=Other.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "schoolType", column: "school_type", label: "School Type", description: "NCES school type code.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "lograde", column: "lograde", label: "Low Grade", description: "Lowest grade served (e.g., 'KG', '06').", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "higrade", column: "higrade", label: "High Grade", description: "Highest grade served (e.g., '08', '12').", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "schoolStatus", column: "school_status", label: "School Status", description: "1=Open, 2=Closed, other codes per NCES.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "latitude", column: "latitude", label: "Latitude", description: "School latitude.", domain: "school", format: "decimal", source: "nces", queryable: true },
  { field: "longitude", column: "longitude", label: "Longitude", description: "School longitude.", domain: "school", format: "decimal", source: "nces", queryable: true },
  { field: "streetAddress", column: "street_address", label: "Street Address", description: "Street address.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "city", column: "city", label: "City", description: "City.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "stateAbbrev", column: "state_abbrev", label: "State Abbrev", description: "2-letter state code.", domain: "state", format: "text", source: "nces", queryable: true },
  { field: "stateFips", column: "state_fips", label: "State FIPS", description: "2-digit FIPS code.", domain: "state", format: "text", source: "nces", queryable: true },
  { field: "zip", column: "zip", label: "ZIP", description: "ZIP code.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "countyName", column: "county_name", label: "County", description: "County name.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "phone", column: "phone", label: "Phone", description: "School phone number.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "urbanCentricLocale", column: "urban_centric_locale", label: "Urban-Centric Locale", description: "NCES urbanicity code (1-8).", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "enrollment", column: "enrollment", label: "Enrollment", description: "Total school enrollment.", domain: "demographics", format: "integer", source: "nces", queryable: true },
  { field: "directoryDataYear", column: "directory_data_year", label: "Directory Data Year", description: "NCES CCD directory snapshot year.", domain: "school", format: "year", source: "nces", queryable: true },
  { field: "titleIStatus", column: "title_i_status", label: "Title I Status", description: "Title I participation status code.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleIEligible", column: "title_i_eligible", label: "Title I Eligible", description: "0/1 Title I eligibility flag.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleISchoolwide", column: "title_i_schoolwide", label: "Title I Schoolwide", description: "0/1 Schoolwide program flag.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleIDataYear", column: "title_i_data_year", label: "Title I Data Year", description: "Data year for Title I fields.", domain: "poverty", format: "year", source: "urban_institute", queryable: true },
  { field: "freeLunch", column: "free_lunch", label: "Free Lunch", description: "Count of students on free lunch.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "reducedPriceLunch", column: "reduced_price_lunch", label: "Reduced Price Lunch", description: "Count of students on reduced-price lunch.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "frplTotal", column: "frpl_total", label: "FRPL Total", description: "Free + reduced-price lunch count.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentWhite", column: "enrollment_white", label: "Enrollment White", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentBlack", column: "enrollment_black", label: "Enrollment Black", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentHispanic", column: "enrollment_hispanic", label: "Enrollment Hispanic", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentAsian", column: "enrollment_asian", label: "Enrollment Asian", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentAmericanIndian", column: "enrollment_american_indian", label: "Enrollment American Indian", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentPacificIslander", column: "enrollment_pacific_islander", label: "Enrollment Pacific Islander", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "enrollmentTwoOrMore", column: "enrollment_two_or_more", label: "Enrollment Two or More", description: "Count.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "demographicsDataYear", column: "demographics_data_year", label: "Demographics Data Year", description: "Data year for demographic counts.", domain: "demographics", format: "year", source: "urban_institute", queryable: true },
  { field: "ownerId", column: "owner_id", label: "Owner User ID", description: "FK to user_profiles.id — school-level rep owner.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text school notes.", domain: "user_edits", format: "text", source: "user", queryable: true },
  { field: "notesUpdatedAt", column: "notes_updated_at", label: "Notes Updated At", description: "Last notes edit timestamp.", domain: "user_edits", format: "date", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "school", format: "date", source: "nces", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "school", format: "date", source: "nces", queryable: true },
];

/** sessions — individual Fullmind session records (FK to opportunities) */
export const SESSION_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Session ID", description: "Salesforce session PK.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "opportunityId", column: "opportunity_id", label: "Opportunity ID", description: "FK to opportunities.id. NOT a hard FK — 33% of sessions point to historical opps not in our opportunities table (scheduler sync lag).", domain: "opportunity", format: "text", source: "opensearch", queryable: true },
  { field: "serviceType", column: "service_type", label: "Service Type", description: "Service type code for this session.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "sessionPrice", column: "session_price", label: "Session Price", description: "Customer-facing session price.", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "educatorPrice", column: "educator_price", label: "Educator Price", description: "Amount paid to the educator.", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "educatorApprovedPrice", column: "educator_approved_price", label: "Educator Approved Price", description: "Approved rate (may differ from negotiated).", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "startTime", column: "start_time", label: "Start Time", description: "Session start datetime.", domain: "session", format: "date", source: "opensearch", queryable: true },
  { field: "type", column: "type", label: "Type", description: "Session type (online, in-person, etc.).", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Session status (completed, scheduled, cancelled).", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "serviceName", column: "service_name", label: "Service Name", description: "Human-readable service name.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "syncedAt", column: "synced_at", label: "Synced At", description: "Last sync timestamp.", domain: "session", format: "date", source: "opensearch", queryable: true },
];

/** vacancies — job postings scraped from district job boards; signal for outreach */
export const VACANCY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Vacancy ID", description: "cuid PK.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid.", domain: "core", format: "text", source: "scraper", queryable: true },
  { field: "scanId", column: "scan_id", label: "Scan ID", description: "FK to vacancy_scans.id (excluded table).", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "fingerprint", column: "fingerprint", label: "Fingerprint", description: "Unique dedup key across scans.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "status", column: "status", label: "Status", description: "open, closed, or expired.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Job posting title.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "category", column: "category", label: "Category", description: "One of: SPED, ELL, General Ed, Admin, Specialist, Counseling, Related Services, Other.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "schoolNcessch", column: "school_ncessch", label: "School NCES ID", description: "FK to schools.ncessch when posting is school-specific.", domain: "school", format: "text", source: "scraper", queryable: true },
  { field: "schoolName", column: "school_name", label: "School Name", description: "School name as scraped.", domain: "school", format: "text", source: "scraper", queryable: true },
  { field: "hiringManager", column: "hiring_manager", label: "Hiring Manager", description: "Named hiring manager if present in posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "hiringEmail", column: "hiring_email", label: "Hiring Email", description: "Hiring manager email if present.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "contactId", column: "contact_id", label: "Contact ID", description: "FK to contacts.id when matched to a known contact.", domain: "contact", format: "integer", source: "scraper", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Job start date as free-text string from the posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "datePosted", column: "date_posted", label: "Date Posted", description: "When the posting was first observed.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "fullmindRelevant", column: "fullmind_relevant", label: "Fullmind Relevant", description: "Keyword-flagged as an opportunity for Fullmind.", domain: "vacancy", format: "boolean", source: "scraper", queryable: true },
  { field: "relevanceReason", column: "relevance_reason", label: "Relevance Reason", description: "Why the posting was flagged (matched keywords).", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "sourceUrl", column: "source_url", label: "Source URL", description: "URL of the original posting.", domain: "links", format: "text", source: "scraper", queryable: true },
  { field: "rawText", column: "raw_text", label: "Raw Text", description: "Full scraped text of the posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "districtVerified", column: "district_verified", label: "District Verified", description: "Whether the district-leaid match was verified.", domain: "vacancy", format: "boolean", source: "scraper", queryable: true },
  { field: "firstSeenAt", column: "first_seen_at", label: "First Seen At", description: "First time this posting was observed.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "lastSeenAt", column: "last_seen_at", label: "Last Seen At", description: "Last time this posting was observed.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text rep notes.", domain: "user_edits", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
];

// ============================================================================
// Table Registry & Semantic Context
// ============================================================================
// Consumed by the Claude query engine (MAP-5) and MCP server (MAP-4) to
// generate system-prompt context for natural-language-to-SQL translation.
// See Docs/superpowers/specs/2026-04-11-db-readiness-query-tool.md.

export interface TableRelationship {
  /** Target table (physical table name) */
  toTable: string;
  /**
   * Optional SQL alias for `toTable`. REQUIRED for self-joins (root table =
   * toTable) and for any case where multiple relationships target the same
   * toTable. When set, the alias is the user-facing identifier: Claude and
   * the UI refer to it in `joins: [{ toTable: <alias> }]`, column references
   * use `<alias>.<column>`, and the aliased join's `joinStatements` must
   * declare the alias (`LEFT JOIN district_financials AS df_competitor ...`).
   */
  alias?: string;
  /** Cardinality */
  type: "one-to-many" | "many-to-one" | "many-to-many";
  /**
   * SQL ON clause for a direct single-hop join. For multi-hop joins or
   * aliased joins, set `joinStatements` instead — the compiler prefers
   * `joinStatements` when present and `joinSql` is then informational only.
   */
  joinSql: string;
  /** One-line human description */
  description: string;
  /**
   * Multi-hop join statements. Array of full "LEFT JOIN <table> ON <expr>"
   * fragments in the order they should appear in the compiled SQL. Use when
   * reaching `toTable` requires transiting an intermediate table — e.g.,
   * `user_goals → district_opportunity_actuals` via `user_profiles`. Also
   * required for aliased joins (self-joins), where the alias must appear
   * inside the statements.
   * When set, the compiler emits these verbatim and skips the default
   * `LEFT JOIN <toTable> ON <joinSql>` line.
   */
  joinStatements?: string[];
  /**
   * Intermediate table names surfaced in UI labels ("via user_profiles").
   * Cosmetic only — the compiler uses `joinStatements` for SQL generation.
   */
  through?: string[];
}

export interface TableMetadata {
  /** Physical table name (matches @@map in Prisma schema) */
  table: string;
  /** One-line table purpose */
  description: string;
  /** Primary key field(s). Single string for scalar PK, array for composite */
  primaryKey: string | string[];
  /** Reference to the per-table columns array (empty [] for pure-FK junction tables) */
  columns: ColumnMetadata[];
  /** Columns excluded from the Claude-facing schema (e.g., geometry, PII) */
  excludedColumns?: string[];
  /** Joins out of this table */
  relationships: TableRelationship[];
  /** Table-specific warnings (in addition to cross-table warnings in SEMANTIC_CONTEXT) */
  warnings?: string[];
}

export interface ConceptMapping {
  /** The canonical aggregated expression (preferred) */
  aggregated?: string;
  /** The deal-level / raw-table expression (fallback when aggregation isn't granular enough) */
  dealLevel?: string;
  /** Free-form notes */
  note?: string;
}

export interface FormatMismatch {
  /** The concept that has inconsistent formats across tables (e.g., "fiscal year") */
  concept: string;
  /** Per-table format descriptions */
  tables?: Record<string, string>;
  /** SQL expression for converting between formats, if straightforward */
  conversionSql?: string;
  /** Additional notes */
  note?: string;
}

export interface Warning {
  /** Tables whose presence in a query triggers this warning */
  triggerTables: string[];
  /** "mandatory" warnings MUST be injected into Claude's system prompt verbatim */
  severity: "mandatory" | "informational";
  /** The warning text Claude sees */
  message: string;
}

export interface SemanticContext {
  /** Named business concepts → SQL expressions */
  conceptMappings: Record<string, ConceptMapping>;
  /** Cross-table format inconsistencies */
  formatMismatches: FormatMismatch[];
  /** Trigger-based warnings */
  warnings: Warning[];
  /** Tables NOT exposed to the query tool */
  excludedTables: string[];
}

/**
 * Registry of every queryable table. Populated table-by-table.
 * Every Prisma model must be either in this registry or in
 * SEMANTIC_CONTEXT.excludedTables (enforced by the schema coverage test).
 */
export const TABLE_REGISTRY: Record<string, TableMetadata> = {
  districts: {
    table: "districts",
    description:
      "~13K US school districts with demographics, education metrics, staffing, ICP scores, and Fullmind CRM state. The hub of nearly every revenue/account question — joins out to district_financials, opportunities, contacts, schools, vacancies, activities, plans, and history.",
    primaryKey: "leaid",
    columns: DISTRICT_COLUMNS,
    excludedColumns: ["geometry"],
    relationships: [
      {
        toTable: "district_financials",
        type: "one-to-many",
        joinSql: "district_financials.leaid = districts.leaid",
        description: "Financial data by vendor and fiscal year",
      },
      {
        toTable: "opportunities",
        type: "one-to-many",
        joinSql: "opportunities.district_lea_id = districts.leaid",
        description: "Individual Fullmind deal records (FK added in PR #108)",
      },
      {
        toTable: "contacts",
        type: "one-to-many",
        joinSql: "contacts.leaid = districts.leaid",
        description: "People at the district",
      },
      {
        toTable: "activity_districts",
        type: "one-to-many",
        joinSql: "activity_districts.district_leaid = districts.leaid",
        description: "Junction to activities (join activities via activity_id)",
      },
      {
        toTable: "task_districts",
        type: "one-to-many",
        joinSql: "task_districts.district_leaid = districts.leaid",
        description: "Junction to tasks (join tasks via task_id)",
      },
      {
        toTable: "territory_plan_districts",
        type: "one-to-many",
        joinSql: "territory_plan_districts.district_leaid = districts.leaid",
        description: "Junction to territory plans (join territory_plans via plan_id)",
      },
      {
        toTable: "schools",
        type: "one-to-many",
        joinSql: "schools.leaid = districts.leaid",
        description: "Schools in this district",
      },
      {
        toTable: "district_data_history",
        type: "one-to-many",
        joinSql: "district_data_history.leaid = districts.leaid",
        description: "Year-over-year historical snapshots",
      },
      {
        toTable: "district_grade_enrollment",
        type: "one-to-many",
        joinSql: "district_grade_enrollment.leaid = districts.leaid",
        description: "Grade-level enrollment per year",
      },
      {
        toTable: "vacancies",
        type: "one-to-many",
        joinSql: "vacancies.leaid = districts.leaid",
        description: "Scraped job postings",
      },
      {
        toTable: "vacancy_scans",
        type: "one-to-many",
        joinSql: "vacancy_scans.leaid = districts.leaid",
        description: "Vacancy scan run history",
      },
      {
        toTable: "states",
        type: "many-to-one",
        joinSql: "states.fips = districts.state_fips",
        description: "State name, abbreviation, and aggregates",
      },
      {
        toTable: "district_tags",
        type: "one-to-many",
        joinSql: "district_tags.district_leaid = districts.leaid",
        description: "Junction to tags",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "one-to-many",
        joinSql: "district_opportunity_actuals.district_lea_id = districts.leaid",
        description: "Hourly-refreshed opp rollups keyed on (district, FY, rep, category). Fans out across combinations when joined — filter FY/rep/category early.",
      },
    ],
  },

  district_financials: {
    table: "district_financials",
    description:
      "Aggregated financial metrics per district per vendor per fiscal year. Single source of truth for Fullmind revenue/pipeline/bookings AND competitor PO spend. The table the query tool should default to for any rep-agnostic 'how much' question, because refresh_fullmind_financials() rolls in BOTH session-derived revenue (from opportunities + sessions) AND Elevate K12 subscription revenue (from subscriptions). Querying opportunities or sessions directly will undercount EK12. One row per (leaid, vendor, fiscal_year). Vendor is one of: 'fullmind' (us), 'elevate'/'proximity'/'tbt' (competitors, sourced from GovSpend PO data — estimated, not actual). For rep-scoped or category-scoped (new_business/renewal/winback/expansion) questions, use district_opportunity_actuals instead.",
    primaryKey: "id",
    columns: DISTRICT_FINANCIALS_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "district_financials.leaid = districts.leaid",
        description: "Parent district",
      },
      {
        toTable: "unmatched_accounts",
        type: "many-to-one",
        joinSql: "district_financials.unmatched_account_id = unmatched_accounts.id",
        description: "ETL-unmatched account (alternative to leaid for accounts that didn't match a district during import)",
      },
      {
        toTable: "contacts",
        type: "one-to-many",
        joinSql: "contacts.leaid = district_financials.leaid",
        description: "District-level contacts — joined via shared leaid, no hard FK. Every district_financials row fan-outs across contacts at that LEA; SUM across aggregated columns will multiply by contact count unless you aggregate in a CTE first.",
      },
      {
        toTable: "schools",
        type: "one-to-many",
        joinSql: "schools.leaid = district_financials.leaid",
        description: "Schools within the district — joined via shared leaid. Same fan-out caveat as contacts.",
      },
      {
        toTable: "vacancies",
        type: "one-to-many",
        joinSql: "vacancies.leaid = district_financials.leaid",
        description: "Open job postings at the district — joined via shared leaid.",
      },
      {
        toTable: "opportunities",
        type: "one-to-many",
        joinSql: "opportunities.district_lea_id = district_financials.leaid",
        description: "Individual deals at the district — joined via leaid. DOUBLE-COUNT TRAP: each district_financials column multiplies by opportunity count when joined. Use a subquery/CTE to fetch aggregates separately.",
      },
      {
        toTable: "district_financials",
        alias: "df_same_district_fy",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          'LEFT JOIN district_financials AS df_same_district_fy ON df_same_district_fy.leaid = district_financials.leaid AND df_same_district_fy.fiscal_year = district_financials.fiscal_year AND df_same_district_fy.vendor <> district_financials.vendor',
        ],
        description:
          "Other vendors' financials at the same district + fiscal_year. Use for side-by-side Fullmind-vs-competitor comparisons — filter root to vendor='fullmind', then select df_same_district_fy.vendor, .total_revenue, etc.",
      },
      {
        toTable: "district_financials",
        alias: "df_prior_year",
        type: "many-to-one",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN district_financials AS df_prior_year ON df_prior_year.leaid = district_financials.leaid AND df_prior_year.vendor = district_financials.vendor AND df_prior_year.fiscal_year = 'FY' || LPAD((CAST(SUBSTRING(district_financials.fiscal_year FROM 3) AS INTEGER) - 1)::text, 2, '0')",
        ],
        description:
          "Prior fiscal year's financials at the same (leaid, vendor). Use for YoY deltas — SELECT district_financials.total_revenue AND df_prior_year.total_revenue side-by-side.",
      },
    ],
  },

  district_opportunity_actuals: {
    table: "district_opportunity_actuals",
    description:
      "Hourly-refreshed MATERIALIZED VIEW aggregating opportunities (+ EK12 subscription revenue) by (district_lea_id, school_yr, sales_rep_email, category). THE authoritative source for rep-scoped and category-scoped opportunity rollups — matches the leaderboard exactly. Prefer this over raw opportunities for ANY aggregate. The matview bakes in critical logic that raw opportunities queries LACK: (1) chain-deduplicated min_purchase_bookings preventing add-on 3-4× overcount, (2) text-stage closed-won detection (raw numeric-stage-only logic misses every closed-won deal since LMS doesn't emit numeric 6+ stages), (3) EK12 subscription revenue folded into total_revenue and completed_revenue via the opp_subscriptions CTE, (4) one-off Anurag reassignment for mixed-rep contracts. For EK12-inclusive 'total Fullmind revenue' questions that don't need rep/category breakdown, district_financials is equivalent (and rep-agnostic).",
    primaryKey: ["district_lea_id", "school_yr", "sales_rep_email", "category"],
    columns: DISTRICT_OPPORTUNITY_ACTUALS_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "district_opportunity_actuals.district_lea_id = districts.leaid",
        description: "Parent district (FK-enforced via underlying opportunities.district_lea_id)",
      },
      {
        toTable: "district_opportunity_actuals",
        alias: "doa_prior_year",
        type: "many-to-one",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN district_opportunity_actuals AS doa_prior_year ON doa_prior_year.district_lea_id = district_opportunity_actuals.district_lea_id AND doa_prior_year.sales_rep_email = district_opportunity_actuals.sales_rep_email AND doa_prior_year.category = district_opportunity_actuals.category AND doa_prior_year.school_yr = (CAST(SUBSTRING(district_opportunity_actuals.school_yr FROM 1 FOR 4) AS INTEGER) - 1)::text || '-' || LPAD((CAST(SUBSTRING(district_opportunity_actuals.school_yr FROM 1 FOR 4) AS INTEGER) % 100)::text, 2, '0')",
        ],
        description:
          "Prior school year's rollups at the same (district, rep, category). Use for rep YoY comparison — e.g., 'reps whose FY26 renewals lag their FY25 renewals'.",
      },
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "district_opportunity_actuals.sales_rep_email = user_profiles.email",
        description: "Owner rep's profile (by email match).",
      },
    ],
  },

  opportunities: {
    table: "opportunities",
    description:
      "Raw Salesforce opportunities, synced from OpenSearch by the scheduler. Safe ONLY for per-deal queries: SELECT by id/name, list individual deals, filter by a specific stage, count distinct deals, drill into a single contract. For any aggregate — bookings, pipeline, revenue, take, category rollup, closed-won totals — ROUTE TO district_opportunity_actuals instead. Raw aggregates silently produce wrong answers because: (a) LMS closed-won is text-only ('Closed Won'), numeric-prefix logic misses it; (b) minimum_purchase_amount / maximum_budget are cumulative on EK12 add-ons (SUM overcounts 3-4×); (c) session-revenue columns (total_revenue, completed_revenue, scheduled_revenue) don't include EK12 subscription revenue. Stage column has erroneous child-op text values ('Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending') that should be filtered out of deal-level listings. One opportunity can have many subscriptions (EK12) and many sessions (Fullmind native).",
    primaryKey: "id",
    columns: OPPORTUNITY_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "opportunities.district_lea_id = districts.leaid",
        description: "Parent district (FK enforced as of PR #108)",
      },
      {
        toTable: "subscriptions",
        type: "one-to-many",
        joinSql: "subscriptions.opportunity_id = opportunities.id",
        description: "EK12 subscription line items for this opportunity",
      },
      {
        toTable: "sessions",
        type: "one-to-many",
        joinSql: "sessions.opportunity_id = opportunities.id",
        description: "Fullmind session rows for this opportunity. ~33% of historical sessions have no matching opportunity (see sessions table warning).",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "many-to-one",
        joinSql: "district_opportunity_actuals.district_lea_id = opportunities.district_lea_id AND district_opportunity_actuals.school_yr = opportunities.school_yr AND district_opportunity_actuals.sales_rep_email = opportunities.sales_rep_email",
        description: "Aggregated rollup for this opp's (district, FY, rep, category) bucket. DOUBLE-COUNT TRAP: joining fans out; use a CTE for aggregates.",
      },
      {
        toTable: "district_financials",
        type: "many-to-one",
        joinSql: "district_financials.leaid = opportunities.district_lea_id",
        description: "Aggregated vendor financials for this opp's district. DOUBLE-COUNT TRAP: joining fans out across (vendor, FY); use a CTE for aggregates.",
      },
    ],
  },

  subscriptions: {
    table: "subscriptions",
    description:
      "Elevate K12 subscription line items, one row per purchased unit. FK-linked to opportunities by opportunity_id. net_total is SIGNED — credits/cancellations are negative rows that offset positive revenue when SUMmed. For aggregated EK12 revenue questions, prefer district_financials.total_revenue (vendor='fullmind', rep-agnostic) or district_opportunity_actuals.total_revenue (rep-scoped) — both already fold subscriptions in via refresh_fullmind_financials() and the opp_subscriptions CTE respectively. Query this table directly for: product-level drill-in ('which deals purchased Algebra'), per-school/grade reporting, line-item audits, or the session-vs-subscription split (see SEMANTIC_CONTEXT.conceptMappings.session_vs_subscription_revenue).",
    primaryKey: "id",
    columns: SUBSCRIPTION_COLUMNS,
    relationships: [
      {
        toTable: "opportunities",
        type: "many-to-one",
        joinSql: "subscriptions.opportunity_id = opportunities.id",
        description: "Parent opportunity (get district_lea_id, sales_rep_email, school_yr via the join)",
      },
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN opportunities ON opportunities.id = subscriptions.opportunity_id",
          "LEFT JOIN districts ON districts.leaid = opportunities.district_lea_id",
        ],
        through: ["opportunities"],
        description:
          "Parent district, via opportunities.district_lea_id. Use to slice EK12 subscription revenue by district geography/demographics without writing the opp→district join yourself.",
      },
      {
        toTable: "district_financials",
        type: "many-to-one",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN opportunities ON opportunities.id = subscriptions.opportunity_id",
          "LEFT JOIN district_financials ON district_financials.leaid = opportunities.district_lea_id",
        ],
        through: ["opportunities"],
        description:
          "Vendor-scoped financials at the subscription's district. Fans out across (vendor, FY) — filter vendor='fullmind' to see only our side.",
      },
    ],
  },

  contacts: {
    table: "contacts",
    description:
      "District-level points of contact (superintendents, admins, principals). Keyed on leaid (many contacts per district). Used for relationship questions ('who do we know at X', 'list all superintendents in CA'). Cross-linked to activities, tasks, schools, and vacancies via junction tables (those junctions are excluded from the registry; use raw Prisma joins if needed).",
    primaryKey: "id",
    columns: CONTACT_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "contacts.leaid = districts.leaid",
        description: "Parent district",
      },
      {
        toTable: "district_financials",
        type: "many-to-one",
        joinSql: "contacts.leaid = district_financials.leaid",
        description: "Vendor-scoped financials at this contact's district — joined via shared leaid. DOUBLE-COUNT TRAP when aggregating: fans out across (vendor, FY).",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "many-to-one",
        joinSql: "contacts.leaid = district_opportunity_actuals.district_lea_id",
        description: "Rep/category rollups at this contact's district — joined via shared leaid. DOUBLE-COUNT TRAP when aggregating: fans out across (FY, rep, category).",
      },
      {
        toTable: "vacancies",
        type: "one-to-many",
        joinSql: "vacancies.contact_id = contacts.id",
        description: "Job postings where this contact is the hiring manager.",
      },
    ],
  },

  unmatched_accounts: {
    table: "unmatched_accounts",
    description:
      "ETL accounts from Salesforce imports that couldn't match a known district. Used as an alternative parent key on district_financials when leaid is NULL. Query this for revenue attached to unmatched accounts (e.g., 'show Fullmind revenue that isn't tied to a district').",
    primaryKey: "id",
    columns: UNMATCHED_ACCOUNT_COLUMNS,
    relationships: [
      {
        toTable: "district_financials",
        type: "one-to-many",
        joinSql: "district_financials.unmatched_account_id = unmatched_accounts.id",
        description: "Financial rows attributed to this unmatched account",
      },
    ],
  },

  states: {
    table: "states",
    description:
      "One row per US state with denormalized aggregates (total districts, enrollment, customer count, ICP tier counts, etc.) refreshed from districts via ETL. Use this instead of SUM over districts when answering state-level rollup questions ('how many customers in CA', 'average grad rate by state') — it's pre-aggregated.",
    primaryKey: "fips",
    columns: STATE_COLUMNS,
    relationships: [
      {
        toTable: "state_assessments",
        type: "one-to-many",
        joinSql: "state_assessments.state_fips = states.fips",
        description: "Standardized tests administered by the state",
      },
      {
        toTable: "districts",
        type: "one-to-many",
        joinSql: "districts.state_fips = states.fips",
        description: "All districts in the state. Joining fans out to ~13K districts across the US — filter the state first.",
      },
      {
        toTable: "schools",
        type: "one-to-many",
        joinSql: "schools.state_fips = states.fips",
        description: "All schools in the state. Joining fans out massively — filter early.",
      },
    ],
  },

  state_assessments: {
    table: "state_assessments",
    description:
      "Reference table listing which standardized assessments each state administers (e.g., CA → CAASPP, PA → PSSA + Keystone). ~80-100 rows, updated ~once per year. Query for 'which tests does state X give', 'which states test in ELA'.",
    primaryKey: "id",
    columns: STATE_ASSESSMENT_COLUMNS,
    relationships: [
      {
        toTable: "states",
        type: "many-to-one",
        joinSql: "state_assessments.state_fips = states.fips",
        description: "Parent state",
      },
    ],
  },

  territory_plans: {
    table: "territory_plans",
    description:
      "One territory plan per rep per fiscal year (owner_id = rep). Anchors plan-scoped questions ('my plan's pipeline', 'which districts are in Jake's plan'). Note: fiscal_year is a NUMBER (2026), not the 'FY26' string used elsewhere. Districts-in-plan are accessed via the excluded junction table territory_plan_districts; use raw Prisma joins for those lookups.",
    primaryKey: "id",
    columns: TERRITORY_PLAN_COLUMNS,
    relationships: [
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "territory_plans.owner_id = user_profiles.id",
        description: "Plan owner (rep)",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN user_profiles ON user_profiles.id = territory_plans.owner_id",
          "LEFT JOIN district_opportunity_actuals ON district_opportunity_actuals.sales_rep_email = user_profiles.email",
        ],
        through: ["user_profiles"],
        description:
          "Plan owner's opp rollups across all their territory districts. Filter DOA.school_yr against territory_plans.fiscal_year if you want apples-to-apples plan-year comparison (note: DOA uses '2025-26' strings; territory_plans uses numeric year).",
      },
      {
        toTable: "districts",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN territory_plan_districts ON territory_plan_districts.plan_id = territory_plans.id",
          "LEFT JOIN districts ON districts.leaid = territory_plan_districts.district_leaid",
        ],
        through: ["territory_plan_districts"],
        description:
          "Districts assigned to this plan. Many-to-many: a district can be in multiple plans, a plan has many districts. Use to pull demographics/finance alongside plan rollups.",
      },
    ],
  },

  activities: {
    table: "activities",
    description:
      "Engagement records — conferences, road trips, meetings, emails, calls, notes. Linked to plans, districts, contacts, states, opportunities, and tasks via junction tables. Junctions are excluded from the registry, but the multi-hop relationships below expose the most common paths directly. Query for engagement frequency, outcome patterns, or pipeline-to-activity correlations.",
    primaryKey: "id",
    columns: ACTIVITY_COLUMNS,
    relationships: [
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "activities.created_by_user_id = user_profiles.id",
        description: "Creator",
      },
      {
        toTable: "districts",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN activity_districts ON activity_districts.activity_id = activities.id",
          "LEFT JOIN districts ON districts.leaid = activity_districts.district_leaid",
        ],
        through: ["activity_districts"],
        description:
          "Districts this activity touched. Many-to-many — an activity can tag multiple districts, and a district accumulates many activities. Filter activities.startDate for time-bounded engagement reports.",
      },
      {
        toTable: "contacts",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN activity_contacts ON activity_contacts.activity_id = activities.id",
          "LEFT JOIN contacts ON contacts.id = activity_contacts.contact_id",
        ],
        through: ["activity_contacts"],
        description:
          "Contacts involved in this activity. Use to find 'who have we actually talked to recently'.",
      },
      {
        toTable: "opportunities",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN activity_opportunities ON activity_opportunities.activity_id = activities.id",
          "LEFT JOIN opportunities ON opportunities.id = activity_opportunities.opportunity_id",
        ],
        through: ["activity_opportunities"],
        description:
          "Opportunities this activity progressed. Useful for 'which deals moved after a touch'.",
      },
    ],
  },

  user_profiles: {
    table: "user_profiles",
    description:
      "Fullmind teammates. The canonical user table — join target for plan owners, task assignees, district owners, state owners, school owners, and the email side of opportunities.sales_rep_email. Match opportunities.sales_rep_email → user_profiles.email to go from an opp to its rep's profile.",
    primaryKey: "id",
    columns: USER_PROFILE_COLUMNS,
    relationships: [
      {
        toTable: "user_goals",
        type: "one-to-many",
        joinSql: "user_goals.user_id = user_profiles.id",
        description: "Per-FY goals for this user",
      },
      {
        toTable: "territory_plans",
        type: "one-to-many",
        joinSql: "territory_plans.owner_id = user_profiles.id",
        description: "Plans this user owns.",
      },
      {
        toTable: "activities",
        type: "one-to-many",
        joinSql: "activities.created_by_user_id = user_profiles.id",
        description: "Activities this user logged.",
      },
      {
        toTable: "tasks",
        type: "one-to-many",
        joinSql: "tasks.assigned_to_user_id = user_profiles.id",
        description: "Tasks assigned to this user.",
      },
      {
        toTable: "opportunities",
        type: "one-to-many",
        joinSql: "opportunities.sales_rep_email = user_profiles.email",
        description: "Opportunities owned by this rep (by email match).",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "one-to-many",
        joinSql: "district_opportunity_actuals.sales_rep_email = user_profiles.email",
        description: "Rep rollups across all districts/categories (by email match).",
      },
    ],
  },

  user_goals: {
    table: "user_goals",
    description:
      "Per-user per-fiscal-year targets (earnings, take rate, category bookings, new-district count). One row per (user_id, fiscal_year). Pair with district_opportunity_actuals for attainment questions ('Jake vs his FY26 renewal target'). fiscal_year is numeric (2026), not 'FY26' string.",
    primaryKey: "id",
    columns: USER_GOAL_COLUMNS,
    relationships: [
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "user_goals.user_id = user_profiles.id",
        description: "The rep this goal belongs to",
      },
      {
        toTable: "district_opportunity_actuals",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN user_profiles ON user_profiles.id = user_goals.user_id",
          "LEFT JOIN district_opportunity_actuals ON district_opportunity_actuals.sales_rep_email = user_profiles.email",
        ],
        through: ["user_profiles"],
        description:
          "Rep's opp rollups, via user_profiles.email → DOA.sales_rep_email. Pair with user_goals.earningsTarget / renewalTarget / takeTarget to compare goal vs attainment per rep per FY.",
      },
    ],
  },

  tasks: {
    table: "tasks",
    description:
      "Rep to-do items with kanban status (todo/in_progress/blocked/done) and priority (low/medium/high/urgent). Junction tables link to districts, plans, activities, and contacts. Junctions are excluded from the registry but the multi-hop relationships below expose the common paths directly.",
    primaryKey: "id",
    columns: TASK_COLUMNS,
    relationships: [
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "tasks.assigned_to_user_id = user_profiles.id",
        description: "Assignee",
      },
      {
        toTable: "districts",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN task_districts ON task_districts.task_id = tasks.id",
          "LEFT JOIN districts ON districts.leaid = task_districts.district_leaid",
        ],
        through: ["task_districts"],
        description:
          "Districts this task targets. Use for 'tasks tied to my plan districts'.",
      },
      {
        toTable: "contacts",
        type: "many-to-many",
        joinSql: "",
        joinStatements: [
          "LEFT JOIN task_contacts ON task_contacts.task_id = tasks.id",
          "LEFT JOIN contacts ON contacts.id = task_contacts.contact_id",
        ],
        through: ["task_contacts"],
        description: "Contacts linked to this task — 'who is this follow-up for'.",
      },
    ],
  },

  schools: {
    table: "schools",
    description:
      "Individual schools within districts, keyed on 12-char NCES school ID (ncessch). Rich demographic data: Title I, FRPL, race/ethnicity enrollment breakdowns, charter/traditional flag. Join to districts via leaid for district-to-school drill-in.",
    primaryKey: "ncessch",
    columns: SCHOOL_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "schools.leaid = districts.leaid",
        description: "Parent district",
      },
      {
        toTable: "states",
        type: "many-to-one",
        joinSql: "schools.state_fips = states.fips",
        description: "Parent state",
      },
      {
        toTable: "district_financials",
        type: "many-to-one",
        joinSql: "schools.leaid = district_financials.leaid",
        description: "Vendor financials at this school's district — joined via shared leaid. DOUBLE-COUNT TRAP when aggregating: fans out across (vendor, FY).",
      },
      {
        toTable: "vacancies",
        type: "one-to-many",
        joinSql: "vacancies.school_ncessch = schools.ncessch",
        description: "Job postings at this specific school (not district-wide).",
      },
    ],
  },

  sessions: {
    table: "sessions",
    description:
      "Individual Fullmind session delivery records synced from OpenSearch. One-to-many from opportunities via opportunity_id. WARNING: opportunity_id is NULLable and ~33% of sessions point to historical opps not in our opportunities table (scheduler sync lag — sessions sync doesn't filter by recency the way opportunities sync does). For revenue aggregates use opportunities.completed_revenue / scheduled_revenue (or DOA / DF) — not session aggregates. Query this table directly for per-opp session listings, service-type breakdowns within a deal, or educator pricing questions.",
    primaryKey: "id",
    columns: SESSION_COLUMNS,
    relationships: [
      {
        toTable: "opportunities",
        type: "many-to-one",
        joinSql: "sessions.opportunity_id = opportunities.id",
        description: "Parent opportunity (may be missing for historical sessions)",
      },
    ],
  },

  vacancies: {
    table: "vacancies",
    description:
      "Job postings scraped from district job boards. Categorized (SPED, ELL, General Ed, Admin, etc.) and flagged as fullmind_relevant by keyword match. Feeds districts.vacancy_pressure_signal. Query for outreach signals — 'districts with open SPED postings', 'recent Fullmind-relevant vacancies in CA'.",
    primaryKey: "id",
    columns: VACANCY_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "vacancies.leaid = districts.leaid",
        description: "Parent district",
      },
      {
        toTable: "schools",
        type: "many-to-one",
        joinSql: "vacancies.school_ncessch = schools.ncessch",
        description: "Parent school (when posting is school-specific)",
      },
      {
        toTable: "contacts",
        type: "many-to-one",
        joinSql: "vacancies.contact_id = contacts.id",
        description: "Matched hiring contact (when recognized)",
      },
    ],
  },
};

/**
 * Cross-table semantic knowledge — concept mappings, format mismatches, and
 * warnings that are too broad for per-column description fields.
 */
export const SEMANTIC_CONTEXT: SemanticContext = {
  conceptMappings: {
    bookings: {
      aggregated:
        "Rep-agnostic: district_financials.closed_won_bookings WHERE vendor='fullmind'. Rep-scoped or category-scoped: district_opportunity_actuals.bookings (filter by sales_rep_email and/or category).",
      dealLevel:
        "SUM(opportunities.net_booking_amount) filtered by closed-won stage convention — see formatMismatches → 'opportunity stage'. Do NOT aggregate raw opportunities for rep/category rollups; the matview bakes in text-stage detection that raw numeric-stage logic misses.",
      note: "Always prefer an aggregated path. Choose DOA when the question mentions a rep or category (new_business/renewal/winback/expansion); choose DF for total-Fullmind or competitor spend.",
    },
    pipeline: {
      aggregated:
        "Rep-agnostic: district_financials.open_pipeline WHERE vendor='fullmind'. Rep-scoped or category-scoped: district_opportunity_actuals.open_pipeline.",
      dealLevel:
        "SUM(opportunities.net_booking_amount) WHERE numeric stage prefix BETWEEN 0 AND 5",
      note: "Prefer aggregated. DOA for rep/category. DF for total-Fullmind. For weighted pipeline use the .weighted_pipeline column on either table — same stage weights (0→0.05, 1→0.10, 2→0.25, 3→0.50, 4→0.75, 5→0.90).",
    },
    weighted_pipeline: {
      aggregated:
        "Rep-agnostic: district_financials.weighted_pipeline WHERE vendor='fullmind'. Rep-scoped or category-scoped: district_opportunity_actuals.weighted_pipeline.",
      note: "Pre-computed using stage probability weights: 0→0.05, 1→0.10, 2→0.25, 3→0.50, 4→0.75, 5→0.90. Closed-won and closed-lost deals are excluded from weighted pipeline (closed-won is in .bookings / .closed_won_bookings instead).",
    },
    revenue: {
      aggregated:
        "Rep-agnostic: district_financials.total_revenue WHERE vendor='fullmind' (includes EK12 via refresh_fullmind_financials). Rep-scoped or category-scoped: district_opportunity_actuals.total_revenue (also includes EK12 via opp_subscriptions CTE).",
      dealLevel:
        "For native Fullmind: opportunities.completed_revenue + opportunities.scheduled_revenue. For Elevate K12: SUM(subscriptions.net_total) joined via subscriptions.opportunity_id → opportunities.id → o.district_lea_id.",
      note: "STRONGLY prefer an aggregated path. BOTH aggregated tables roll in EK12 subscription revenue — DF via refresh_fullmind_financials(), DOA via the opp_subscriptions CTE. Choose DF for rep-agnostic, DOA for rep/category scope. The deal-level path is split across opportunities and subscriptions and will silently miss EK12 revenue if you only query opportunities.",
    },
    take: {
      aggregated:
        "Rep-agnostic: district_financials.total_take WHERE vendor='fullmind'. Rep-scoped or category-scoped: district_opportunity_actuals.total_take.",
      dealLevel: "opportunities.completed_take + opportunities.scheduled_take",
      note: "IMPORTANT: 'take' (Fullmind margin) is SESSION-DERIVED only — there is no take rate for EK12 subscription revenue, so subscription revenue does NOT contribute to take columns on either aggregated table. When answering take questions for an EK12-heavy rep or district, surface a caveat that take reflects session-derived deals only and excludes subscription contribution. For a session-margin RATIO that's meaningful on EK12-heavy reps, use DOA.avg_take_rate — it divides by session-only revenue, not the total_revenue column that folds in subs.",
    },
    contract_floor: {
      aggregated:
        "district_opportunity_actuals.min_purchase_bookings (rep-scoped, category-scoped, chain-deduplicated).",
      dealLevel:
        "opportunities.minimum_purchase_amount for a single deal (safe). Do NOT SUM across deals.",
      note: "Closed-won contracted minimum — the signed-contract floor, regardless of session delivery. STRONGLY prefer DOA over opportunities aggregates because Salesforce stores add-ons with cumulative minimum_purchase_amount values; naive SUM across add-ons triples/quadruples tier-1 contracts. DOA's min_purchase_bookings clusters contract chains (via name-suffix stripping) and picks MAX per chain, then SUMs across chains. Powers the leaderboard's 'Prior Year Bookings' column — the right metric for in-progress years where session-delivered revenue lags signed contract value.",
    },
    category_breakdown: {
      aggregated:
        "GROUP BY district_opportunity_actuals.category — values: 'new_business' (default), 'renewal', 'winback', 'expansion'.",
      note: "DOA is the ONLY source of this breakdown. Category is regex-derived from opportunities.contract_type (null contract_type → 'new_business'). Raw opportunities has the source contract_type but not the normalized bucket.",
    },
    rep_scope: {
      aggregated:
        "district_opportunity_actuals.sales_rep_email — filter or GROUP BY this column for any rep-scoped question.",
      note: "DOA and raw opportunities are the only sources with a rep column. Raw opportunities is unsafe for aggregates (no text-stage closed-won, no EK12 fold-in, no add-on chain dedup) — always prefer DOA for rep rollups. DF has no rep column and CANNOT answer rep-scoped questions.",
    },
    session_vs_subscription_revenue: {
      dealLevel:
        "session_revenue: SUM(opportunities.total_revenue) across opportunities in scope. subscription_revenue: SUM(subscriptions.net_total) where subscriptions.opportunity_id IN (<scope>). subscriptions.net_total is SIGNED — credits/cancellations reduce the sum.",
      note: "Neither DOA nor DF exposes session and subscription revenue separately — both fold them together in total_revenue. When a user explicitly asks for the split, compute deal-level: query opportunities and subscriptions separately and report both. If this breakdown becomes a frequent request, add session_revenue / subscription_revenue columns to DOA as a follow-up.",
    },
    competitor_revenue: {
      aggregated:
        "district_financials.total_revenue WHERE vendor IN ('elevate','proximity','tbt')",
      note: "These are competitor estimates from GovSpend PO data, not Fullmind revenue. Treat as 'estimated competitor spend' rather than 'actual competitor revenue' — the data is purchase-order-based and lossy.",
    },
    our_data: {
      note: "When the user says 'our' or 'Fullmind', filter district_financials WHERE vendor='fullmind'. Both EK12 and native Fullmind deals live there, rolled together by refresh_fullmind_financials(). Querying opportunities directly will MISS EK12 subscription revenue.",
    },
    customers: {
      aggregated: "districts.is_customer = TRUE",
      note: "districts.is_customer is a denormalized boolean computed from district_financials presence. Indexed for fast filtering. May lag the source by one ETL refresh cycle.",
    },
  },
  formatMismatches: [],
  warnings: [
    {
      triggerTables: [
        "district_financials",
        "district_opportunity_actuals",
        "opportunities",
      ],
      severity: "mandatory",
      message:
        "DOUBLE-COUNT TRAP: When joining an aggregated table (district_financials or district_opportunity_actuals) to opportunities, every aggregated column gets multiplied by the number of matching opportunity rows. For example, `SELECT df.open_pipeline, o.* FROM district_financials df JOIN opportunities o ON o.district_lea_id = df.leaid WHERE df.vendor='fullmind'` returns the same df.open_pipeline value once per opportunity row, so SUM(df.open_pipeline) gives a wildly inflated number. The same trap applies when joining district_opportunity_actuals to opportunities. Two safe patterns: (1) query the aggregated table alone if you only need its metrics, or (2) use a CTE/subquery to fetch aggregates separately and join deal-level rows for context only — never sum them together.",
    },
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message:
        "EK12 MASTER/ADD-ON DATA GAP: Elevate K12 deals follow a master-renewal-contract + add-ons structure that the data model does NOT yet capture. A master contract opportunity has minimum_purchase_amount and maximum_budget; add-on opportunities are separate rows in the same table and consume budget against the master's max — but there is NO parent_opportunity_id linking them. Implications: SUM(maximum_budget) across opportunities will roughly DOUBLE-COUNT the EK12 ceiling because both the master max and the add-on maxes are summed independently. SUM(minimum_purchase_amount) has the same trap but there IS a safe alternative: district_opportunity_actuals.min_purchase_bookings chain-deduplicates the add-on cumulative values correctly — prefer it for any closed-won contracted-floor aggregate. SUM(opportunities.net_booking_amount) is safe because add-ons add real incremental signed dollars. MAX(maximum_budget) per district is still misleading. When the user asks about 'upside', 'ceiling', 'potential', 'max FY26 pipeline', or any aggregation of maximum_budget, you MUST either refuse or surface a heavy caveat that the answer overcounts because we cannot distinguish master contracts from add-ons. Per-deal questions (single opportunity's min/max/budget) are fine. Tracked in Docs/superpowers/followups/2026-04-12-ek12-master-addon-data-gap.md.",
    },
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message:
        "PREFER THE MATVIEW FOR AGGREGATES: For any SUM/AVG/COUNT/GROUP BY on opportunities that answers a 'how much bookings/pipeline/revenue/take' question — especially anything rep-scoped or category-scoped — route to district_opportunity_actuals instead of aggregating raw opportunities. The matview bakes in four things raw opportunities queries LACK: (1) text-stage closed-won detection (raw numeric-only stage logic misses every closed-won deal since LMS doesn't actually emit numeric 6+ stages — closed-won is text-only: 'closed won', 'active', 'position purchased', 'requisition received', 'return position pending'), (2) chain-deduplicated min_purchase_bookings, (3) EK12 subscription revenue fold-in into total_revenue and completed_revenue, (4) a one-off rep reassignment for mixed-rep 'Anurag' contracts. Raw opportunities queries silently produce wrong answers for these aggregates. Raw opportunities is correct ONLY for per-deal questions (SELECT by id or name, list with LIMIT, filter by a specific stage, count of distinct deals).",
    },
  ],
  excludedTables: [
    // Permanently excluded — admin/ops tables, junction tables, the query
    // tool's own persistence, and data the query tool shouldn't surface.
    "CalendarEvent",
    "activity_attendees",
    "activity_contacts",
    "activity_districts",
    "activity_expenses",
    "activity_opportunities",
    "activity_plans",
    "activity_relations",
    "activity_states",
    "data_refresh_logs",
    "district_data_history",
    "district_tags",
    "initiative_metrics",
    "initiative_scores",
    "initiative_tier_thresholds",
    "map_views",
    "metric_registry",
    "query_log",
    "report_drafts",
    "saved_reports",
    "school_contacts",
    "school_enrollment_history",
    "school_tags",
    "tags",
    "task_activities",
    "task_contacts",
    "task_districts",
    "task_plans",
    "territory_plan_collaborators",
    "territory_plan_district_services",
    "territory_plan_districts",
    "territory_plan_states",
    "user_integrations",
    "vacancy_keyword_config",
    "vacancy_scans",

    // PENDING REGISTRATION — meaningful for reports but not yet worth their
    // own entry. Move into TABLE_REGISTRY as question shapes demand.
    "district_grade_enrollment",
    "initiatives",
    "services",
    "unmatched_opportunities",
  ],
};

/** Format fiscal year string for queries — vendor_financials uses 'FY' prefix */
export function formatFiscalYear(year: number | string): string {
  const numStr = String(year).replace(/^FY/, "");
  return `FY${numStr.padStart(2, "0")}`;
}
