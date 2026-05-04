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
  | "audit"
  | "news";

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
  | "query_tool"        // query_log, saved_reports
  | "news_ingest";      // news_articles + junctions (RSS/Google News + Haiku classifier)

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
    description: "Total expenditure divided by enrollment — what reps call 'spending per student', 'spend per student', or 'per-pupil spend'. Current-year snapshot; for trend across years use district_data_history.expenditure_per_pupil.",
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
      "Fullmind LMS school year string, e.g. '2025-26' (= FY26). Join key for FY-scoped questions; use fiscalYearToSchoolYear() in src/lib/opportunity-actuals.ts to convert a numeric FY.",
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
      "Opportunity owner email, sourced from the Fullmind LMS via OpenSearch sync. Can be NULL for orphan opps. A one-off migration reassigned mixed-rep 'Anurag' contract groups to the real rep, but the scheduler's hourly sync clobbers these — known fragile until fixed upstream.",
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
      "SUM(net_booking_amount) on closed-won opportunities. Closed-won detection handles BOTH numeric stage prefix ≥ 6 AND text stages ('closed won', 'active', 'position purchased', 'requisition received', 'return position pending'). Fullmind LMS-native booking total. For contracted-floor view (preferred for in-progress years), use min_purchase_bookings.",
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
      "Closed-won CONTRACT FLOOR, sourced from opportunities.minimum_purchase_amount. Chain-deduplicated: Fullmind LMS stores add-ons with cumulative minimum_purchase_amount values, so the matview clusters contract chains (by name after stripping 'Add-On'/'AddOn'/'Add On' suffixes and district-name prefixes), takes MAX per chain (the latest cumulative floor), then SUMs across chains. A naive SUM(opportunities.minimum_purchase_amount) would 3-4× overcount tier-1 contracts. Powers the leaderboard's 'Prior Year Bookings' column — preferred for in-progress years where session delivery lags signed contract value.",
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
 * auxiliary opportunity rows from the Fullmind LMS — DOA counts them as closed-won
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
    description: "Fullmind LMS opportunity ID (primary key). Also referenced by subscriptions.opportunity_id and sessions.opportunity_id.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "name",
    column: "name",
    label: "Name",
    description: "Fullmind LMS opportunity name. Add-on opportunities typically include 'Add-On' / 'AddOn' / 'Add On' in the name — DOA's min_purchase_bookings uses this pattern to cluster contract chains.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "schoolYr",
    column: "school_yr",
    label: "School Year",
    description: "Fullmind LMS school year string, e.g. '2025-26' (= FY26). Same format as DOA.school_yr and different from district_financials.fiscal_year ('FY26'). Use fiscalYearToSchoolYear() to convert between.",
    domain: "crm",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "contractType",
    column: "contract_type",
    label: "Contract Type",
    description: "Free-text contract type label from the Fullmind LMS — the source that says whether a deal is a renewal, winback, expansion, or new business. No picklist, so values are human-entered and can vary. For category rollups (group-by, filter, counts), use district_opportunity_actuals.category — it regex-normalizes this field into 4 canonical buckets ('new_business', 'renewal', 'winback', 'expansion'). For 'renewals we haven't closed yet' or 'new business in California' questions, DOA is the right source. This raw column is fine for per-deal display and for audit questions ('which deals have unusual contract_type values').",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "state",
    column: "state",
    label: "State",
    description: "State name as stored in the Fullmind LMS (may be full name or abbreviation).",
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
    description: "Opportunity owner display name from the Fullmind LMS.",
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
    description: "District name as stored in the Fullmind LMS (may not exactly match districts.name).",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtLmsId",
    column: "district_lms_id",
    label: "District LMS ID",
    description: "Internal LMS district identifier from the Fullmind LMS.",
    domain: "core",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "districtNcesId",
    column: "district_nces_id",
    label: "District NCES ID",
    description: "NCES district identifier from the Fullmind LMS. Often matches but may differ from the canonical districts.leaid — prefer district_lea_id for joins.",
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
    description: "Opportunity creation timestamp in the Fullmind LMS.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "closeDate",
    column: "close_date",
    label: "Close Date",
    description: "Projected or actual close date for a deal — what a rep asks about with 'closing this month', 'projected close', 'close quarter', or 'deals that slipped'. For open deals this is the forecasted close date (often moved by the rep); for closed deals it's the actual close. Route date-range aggregate questions to district_opportunity_actuals when the rep mentions a category or a rep name.",
    domain: "opportunity",
    format: "date",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "brandAmbassador",
    column: "brand_ambassador",
    label: "Brand Ambassador",
    description: "Name of the brand ambassador who sourced this deal. Brand ambassadors (often called 'BAs') are external partners — not Fullmind employees — who generate leads and get paid per closed deal. A common lead source. Reps ask questions like 'which deals did <name> bring in', 'top brand ambassadors by bookings', 'what's <name>'s pipeline this year', or 'BOCES deals sourced by ambassadors'. Free-text name, so use LIKE / ILIKE for fuzzy matching and call get_column_values('opportunities', 'brand_ambassador') when the rep mentions a specific person to confirm exact spelling.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "stage",
    column: "stage",
    label: "Stage",
    description: "Deal stage. Canonical values: numeric prefix stages 0-5 for open pipeline (e.g., '0 - Lead' through '5 - Final Negotiation'), and text 'Closed Won' / 'Closed Lost' for terminal states. Closed-won is ALWAYS the literal text 'Closed Won' — there is no numeric 6+ closed-won state. Four other text values ('Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending') are ERRONEOUS child/auxiliary opportunity rows and MUST be filtered out in deal-level queries (WHERE stage NOT IN (...) using ERRONEOUS_CHILD_OP_STAGES). Note: DOA aggregates intentionally include these child rows for leaderboard accrual — that's a DOA choice, not a closed-won redefinition. For any closed-won/lost/open aggregate, use DOA or district_financials, not raw opportunities. For 'open pipeline' / 'weighted pipeline' questions a rep would ask, route aggregates to district_financials (rep-agnostic) or district_opportunity_actuals (rep/category-scoped) — both pre-compute open and weighted pipeline correctly. Raw opportunities for pipeline is only safe when filtering stage ~ '^[0-5]' and excluding ERRONEOUS_CHILD_OP_STAGES.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "netBookingAmount",
    column: "net_booking_amount",
    label: "Net Booking Amount",
    description: "The contract dollar value of a deal — what a rep calls 'bookings', 'deal size', 'contract value', or 'signed revenue'. Safe to SUM per individual deal; add-ons add real incremental signed dollars. For CLOSED-WON aggregates across deals (district totals, rep totals, state totals), route to district_financials.closed_won_bookings (rep-agnostic, vendor='fullmind') or district_opportunity_actuals.bookings (rep-scoped). When a rep asks 'how much have we booked in Texas this year', they want one of those — not raw SUM here. Raw SUM is only correct if you filter stage = 'Closed Won' AND exclude the ERRONEOUS_CHILD_OP_STAGES child rows.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "contractThrough",
    column: "contract_through",
    label: "Contract Through",
    description: "How the deal is contracted — the rep question this answers is 'is this BOCES or Direct?' and, when BOCES, 'which BOCES is the deal attributed to?' (BOCES = Boards of Cooperative Educational Services, New York's regional cooperative purchasing structure.) Values include 'Direct' for direct-to-district deals and BOCES region names (e.g., 'Monroe 2-Orleans BOCES', 'Nassau BOCES', 'Eastern Suffolk BOCES') when the deal is purchased via a BOCES cooperative. Free-text / free-picklist, so run get_column_values('opportunities', 'contract_through') to see the actual distribution before filtering on a specific BOCES name.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "fundingThrough",
    column: "funding_through",
    label: "Funding Through",
    description: "Where the purchase dollars flow through — closely related to contract_through. Answers 'is this a BOCES deal or Direct' from the funding-flow angle and, when BOCES, which BOCES is carrying the funds. Reps will ask 'BOCES deals this year', 'deals funded through <specific BOCES>', or 'Direct vs BOCES breakdown'. Free-text / free-picklist; values overlap with contract_through (Direct, individual BOCES names). When a question references BOCES or Direct, consider filtering BOTH contract_through AND funding_through to catch deals tagged on either column.",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "paymentType",
    column: "payment_type",
    label: "Payment Type",
    description: "Fullmind LMS payment type (e.g., annual, monthly, per-session).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "paymentTerms",
    column: "payment_terms",
    label: "Payment Terms",
    description: "Fullmind LMS payment terms (e.g., Net 30).",
    domain: "opportunity",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "leadSource",
    column: "lead_source",
    label: "Lead Source",
    description: "How the opportunity originated — the tag that captures whether the deal came from inbound, a conference, a referral, a brand ambassador (see brand_ambassador column), or another source. Free-text / free-picklist, so run get_column_values('opportunities', 'lead_source') before filtering on a specific value.",
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
    description: "Revenue already delivered — reps ask about this as 'delivered revenue', 'revenue completed', or 'how much has been delivered so far'. Compare against scheduled_revenue for the delivered-vs-scheduled breakdown on a deal. SESSION-ONLY — does NOT include EK12 subscription revenue. For inclusive revenue aggregates use DOA.completed_revenue or district_financials.total_revenue.",
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
    description: "Count of scheduled (future) sessions on this opportunity — what a rep is asking when they say 'how many sessions are scheduled', 'scheduled session count', or 'upcoming sessions on this deal'. Paired with scheduled_revenue (dollar view) and completed_revenue/total_revenue for the delivered-vs-scheduled breakdown. Session-only concept; EK12 subscription deals have no sessions and therefore 0 here.",
    domain: "session",
    format: "integer",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "scheduledRevenue",
    column: "scheduled_revenue",
    label: "Scheduled Revenue",
    description: "Revenue committed but not yet delivered — reps ask about this as 'scheduled revenue', 'upcoming revenue', 'revenue yet to be delivered', or 'pipeline-to-deliver on closed-won deals'. Compare against completed_revenue for the delivered-vs-scheduled breakdown. SESSION-ONLY — no EK12 subscription equivalent. For inclusive aggregates use DOA.scheduled_revenue.",
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
    label: "Total Revenue (deal, session-only)",
    description: "Session-only deal revenue (completed_revenue + scheduled_revenue). DOES NOT include EK12 subscription revenue — subscriptions are a separate table linked by opportunity_id. RULE OF THUMB: when a rep asks about 'revenue' on a deal, default to the SUBSCRIPTION-FOLDED total: COALESCE(o.total_revenue, 0) + COALESCE((SELECT SUM(s.net_total) FROM subscriptions s WHERE s.opportunity_id = o.id), 0). Applies to single-deal lookups only — for multi-deal aggregates this correlated subquery is both slow and error-prone, so use district_opportunity_actuals.total_revenue instead. Skip the COALESCE fold and use this column directly ONLY when the rep explicitly asks for 'session revenue', 'session-only', or the delivered/scheduled split (in which case also pair with completed_revenue + scheduled_revenue). If the rep asks for the session-vs-subscription split rather than a folded total, see SEMANTIC_CONTEXT.conceptMappings.session_vs_subscription_revenue. For aggregated revenue across many deals, prefer district_opportunity_actuals.total_revenue or district_financials.total_revenue — both fold subscriptions in already.",
    domain: "opportunity",
    format: "currency",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "totalTake",
    column: "total_take",
    label: "Total Take",
    description: "completed_take + scheduled_take — the Fullmind margin on a deal, sometimes called 'take' or 'take rate' by reps (margin = what Fullmind keeps after paying educators). Take only exists on deals that originated in the Fullmind LMS OR deals whose revenue is session-derived; Elevate K12 deals (subscription-revenue-only) have $0 take here because subscriptions have no take concept. For rep/district-aggregated take questions use DOA.total_take instead — same session-only caveat applies there too. For closed-won take totals, DOA is the preferred source.",
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
    description: "JSON array of service type codes assigned to this deal (tutoring, enrichment, SPED, ELL, etc.) — the deal-level 'what services are part of this contract' tag. Stored as jsonb; use jsonb operators or `::text LIKE` for matching. For revenue breakdowns by service ('revenue by service type this year', 'how much of our Algebra revenue came from EK12 vs sessions'), this deal-level tag is NOT the canonical breakdown surface — sessions carry per-session service_type / service_name, and subscriptions carry product / product_type / sub_product / course_name. See SEMANTIC_CONTEXT.conceptMappings.service_type_breakdown for the cross-table pattern.",
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
    description: "URL to the deal in the Fullmind LMS (useful for user-facing result cards).",
    domain: "links",
    format: "text",
    source: "opensearch",
    queryable: true,
  },
  {
    field: "stageHistory",
    column: "stage_history",
    label: "Stage History",
    description: "JSON array of {stage, timestamp} entries capturing every stage transition over a deal's life. This is the source for rep-velocity questions: 'deal velocity', 'days in stage', 'deal age', 'how long has this deal been at stage 3', 'deals stuck in negotiation', 'average time to close'. Use jsonb operators to walk the array — e.g., jsonb_array_elements(stage_history) to unnest, then compare timestamps between adjacent entries. For a single 'days since last stage change' style filter, compare the latest entry's timestamp to now(). No aggregate analog exists in DOA or district_financials — velocity questions must use raw opportunities.",
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
    description: "Signed line-item total (net_price × quantity). SUM across rows is the correct aggregate — negative credits offset positive revenue. This is the canonical column for 'EK12 subscription revenue', 'Elevate revenue', or 'subscription bookings' rep questions when they want to drill into EK12 line items directly. For rep-scoped or vendor='fullmind' totals that fold session + subscription together, prefer DOA.total_revenue or district_financials.total_revenue — both roll this column in via refresh_fullmind_financials() / the opp_subscriptions CTE.",
    domain: "subscription",
    format: "currency",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "product",
    column: "product",
    label: "Product",
    description: "Top-level product name on an EK12 subscription line (Elevate taxonomy) — the subscription-side equivalent of a session's service_type. Reps use this for 'EK12 subscription revenue by product', 'which districts purchased product X', or 'our Algebra subscription mix'. Pair with product_type (category) and sub_product (detail) for finer breakdowns. See SEMANTIC_CONTEXT.conceptMappings.service_type_breakdown for the cross-table pattern when a rep asks about service breakdowns including both sessions and subscriptions.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "productType",
    column: "product_type",
    label: "Product Type",
    description: "Category tier of the EK12 product (Elevate taxonomy) — one level of hierarchy above product. Use for high-level breakdowns like 'subscription revenue by product type'. Pair with product and sub_product for drill-down.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "subProduct",
    column: "sub_product",
    label: "Sub Product",
    description: "Most specific level of the EK12 product taxonomy — narrower than product and product_type. Reps use this for finest-grain 'which districts bought X specifically' queries.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "courseName",
    column: "course_name",
    label: "Course Name",
    description: "Specific course attached to this EK12 subscription line (e.g., 'Algebra 1', 'AP Biology'). The subscription-side analog of sessions.service_name. Use for course-level breakdowns a rep might ask about ('revenue from Algebra 1 this year', 'top courses by bookings').",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "curriculumProvider",
    column: "curriculum_provider",
    label: "Curriculum Provider",
    description: "Third-party curriculum partner supplying the course content for this line (e.g., Savvas, McGraw-Hill, etc.). Reps ask about 'how much revenue flows through <partner>', 'partner curriculum breakdown', or 'which districts are on X curriculum'. Free-text; run get_column_values('subscriptions', 'curriculum_provider') to see the actual vendor set before filtering.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "schoolName",
    column: "school_name",
    label: "School Name",
    description: "Specific school within the district for this EK12 subscription line — the level below the district. Reps ask about 'EK12 revenue by school', 'which schools in this district purchased X', or 'top schools by subscription revenue'. Free-text name (NOT a schools.ncessch FK); use LIKE / ILIKE for match. Only populated when the line item is school-scoped; district-scoped lines have NULL here.",
    domain: "school",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "grade",
    column: "grade",
    label: "Grade",
    description: "Grade level targeted by this EK12 subscription line — free-text with values like 'K', '6', '9-12'. Reps ask about 'EK12 revenue by grade', 'middle school vs high school subscription mix', or 'which grades bought Algebra'. Because the column is free-text, run get_column_values('subscriptions', 'grade') before filtering on a specific band — conventions like 'K-5' vs 'K,1,2,3,4,5' vary by contract.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "officeHours",
    column: "office_hours",
    label: "Office Hours",
    description: "Office-hours allocation on this EK12 subscription line (free-text, e.g., hour counts or schedule text). Reps may ask 'which subscriptions include office hours' or 'total office-hours allocation for this district'. Because it's free-text, LIKE / ILIKE searches are safer than exact filters.",
    domain: "subscription",
    format: "text",
    source: "elevate_k12",
    queryable: true,
  },
  {
    field: "ccTeacherCollabMeetings",
    column: "cc_teacher_collab_meetings",
    label: "CC Teacher Collab Meetings",
    description: "Classroom-connection teacher-collaboration meeting allocation on this EK12 subscription line (free-text). Reps may ask about 'teacher collaboration meetings included' or 'subscriptions with CC meetings' when auditing delivery scope. LIKE / ILIKE for fuzzy match.",
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
  { field: "title", column: "title", label: "Title", description: "Free-text job title at the district (e.g., 'Director of Curriculum', 'Asst Superintendent of HR'). Because it's free-text, two contacts with the same role may have different strings — persona is a more reliable categorical filter. Use ILIKE for keyword matches ('all contacts with curriculum in their title').", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "email", column: "email", label: "Email", description: "Contact email address. Safe for exact match when a rep names a specific person; use ILIKE for domain-based filtering ('contacts at @monroe2boces.org').", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "phone", column: "phone", label: "Phone", description: "Contact phone number (free-text format).", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "isPrimary", column: "is_primary", label: "Is Primary", description: "Primary POC flag. Reps use this for 'primary contact at <district>' questions. One district may have multiple contacts but at most one primary.", domain: "contact", format: "boolean", source: "fullmind_crm", queryable: true },
  { field: "linkedinUrl", column: "linkedin_url", label: "LinkedIn URL", description: "LinkedIn profile URL.", domain: "links", format: "text", source: "fullmind_crm", queryable: true },
  { field: "persona", column: "persona", label: "Persona", description: "Categorical persona bucket — the reliable column for role-based filtering ('all superintendents in <state>', 'HR directors we know', 'principals at <district>'). The set of valid personas lives in this column itself — call get_column_values('contacts', 'persona') to see the current set before filtering on a specific value. Prefer persona over the free-text title column for role questions.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "seniorityLevel", column: "seniority_level", label: "Seniority Level", description: "Seniority classification for the contact (e.g., executive / director / manager tiers). The authoritative value set lives in this column — call get_column_values('contacts', 'seniority_level') to see the current options. Pair with persona for 'senior decision makers by district' style questions.", domain: "contact", format: "text", source: "fullmind_crm", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the contact record was created.", domain: "contact", format: "date", source: "fullmind_crm", queryable: true },
  { field: "lastEnrichedAt", column: "last_enriched_at", label: "Last Enriched At", description: "Last time Clay/enrichment refreshed this contact. Reps use this for 'stale contacts' or 'contacts I haven't refreshed in a while' questions — compare against now() for freshness filtering. NULL if the contact has never been enriched.", domain: "contact", format: "date", source: "etl_link", queryable: true },
];

/** unmatched_accounts — ETL accounts that couldn't match a district during import */
export const UNMATCHED_ACCOUNT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "PK (autoincrement). Referenced by district_financials.unmatched_account_id.", domain: "unmatched", format: "integer", source: "fullmind_crm", queryable: true },
  { field: "accountName", column: "account_name", label: "Account Name", description: "Fullmind LMS account name as it arrived from import.", domain: "unmatched", format: "text", source: "fullmind_crm", queryable: true },
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
  { field: "totalDistricts", column: "total_districts", label: "Total Districts", description: "Denormalized count of districts in the state. PREFER COUNT(*) FROM districts WHERE state_fips = <fips> for the latest truth — this rollup may lag an ETL cycle.", domain: "state", format: "integer", source: "computed", queryable: true },
  { field: "totalEnrollment", column: "total_enrollment", label: "Total Enrollment", description: "Denormalized sum of district enrollment. PREFER SUM(districts.enrollment) WHERE state_fips = <fips> for accuracy — this rollup may lag an ETL cycle.", domain: "demographics", format: "integer", source: "computed", queryable: true },
  { field: "totalSchools", column: "total_schools", label: "Total Schools", description: "Denormalized count of schools in the state. PREFER COUNT(*) FROM schools WHERE state_fips = <fips> for accuracy — this rollup may lag.", domain: "state", format: "integer", source: "computed", queryable: true },
  { field: "totalCustomers", column: "total_customers", label: "Total Customers", description: "Denormalized count of Fullmind customer districts in the state. PREFER COUNT(*) FROM districts WHERE state_fips = <fips> AND is_customer = true for accuracy — this rollup may lag.", domain: "crm", format: "integer", source: "computed", queryable: true },
  { field: "totalWithPipeline", column: "total_with_pipeline", label: "Total With Pipeline", description: "Denormalized count of districts with open pipeline in the state. PREFER computing from district_financials / DOA for accuracy — this rollup may lag.", domain: "crm", format: "integer", source: "computed", queryable: true },
  { field: "totalPipelineValue", column: "total_pipeline_value", label: "Total Pipeline Value", description: "Denormalized sum of open pipeline. PREFER SUM(district_financials.open_pipeline) WHERE state_fips = <fips> AND vendor = 'fullmind' for accuracy — this rollup may lag.", domain: "crm", format: "currency", source: "computed", queryable: true },
  { field: "avgExpenditurePerPupil", column: "avg_expenditure_per_pupil", label: "Avg Expenditure Per Pupil", description: "Enrollment-weighted state-level average. Denormalized; may lag — recompute from districts if the rep wants precision.", domain: "finance", format: "currency", source: "computed", queryable: true },
  { field: "avgGraduationRate", column: "avg_graduation_rate", label: "Avg Graduation Rate", description: "Enrollment-weighted state average graduation rate (%). Denormalized; may lag — recompute from districts if the rep wants precision.", domain: "graduation", format: "percentage", source: "computed", queryable: true },
  { field: "avgPovertyRate", column: "avg_poverty_rate", label: "Avg Poverty Rate", description: "Enrollment-weighted state average child-poverty rate (%). Denormalized; may lag — recompute from districts if the rep wants precision.", domain: "poverty", format: "percentage", source: "computed", queryable: true },
  { field: "avgChronicAbsenteeismRate", column: "avg_chronic_absenteeism_rate", label: "Avg Chronic Absenteeism Rate", description: "Enrollment-weighted state average chronic absenteeism rate (%). Denormalized; may lag — recompute from districts if the rep wants precision.", domain: "absenteeism", format: "percentage", source: "computed", queryable: true },
  { field: "avgStudentTeacherRatio", column: "avg_student_teacher_ratio", label: "Avg Student-Teacher Ratio", description: "Enrollment-weighted state student-to-teacher ratio. Denormalized; may lag.", domain: "staffing", format: "ratio", source: "computed", queryable: true },
  { field: "avgSwdPct", column: "avg_swd_pct", label: "Avg SWD %", description: "Enrollment-weighted state average SPED (Students With Disabilities) percentage. Denormalized; may lag.", domain: "sped", format: "percentage", source: "computed", queryable: true },
  { field: "avgEllPct", column: "avg_ell_pct", label: "Avg ELL %", description: "Enrollment-weighted state average English-learner percentage. Denormalized; may lag.", domain: "demographics", format: "percentage", source: "computed", queryable: true },
  { field: "avgEnrollment", column: "avg_enrollment", label: "Avg Enrollment", description: "Average district enrollment in the state (AVG, not enrollment-weighted). Denormalized; may lag.", domain: "demographics", format: "integer", source: "computed", queryable: true },
  { field: "avgMathProficiency", column: "avg_math_proficiency", label: "Avg Math Proficiency", description: "Enrollment-weighted state average math proficiency (%). Denormalized; may lag.", domain: "assessment", format: "percentage", source: "computed", queryable: true },
  { field: "avgReadProficiency", column: "avg_read_proficiency", label: "Avg Read Proficiency", description: "Enrollment-weighted state average reading proficiency (%). Denormalized; may lag.", domain: "assessment", format: "percentage", source: "computed", queryable: true },
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
  { field: "stateFips", column: "state_fips", label: "State FIPS", description: "FK to states.fips. Join to get state name / abbreviation for display.", domain: "state", format: "text", source: "user", queryable: true },
  { field: "name", column: "name", label: "Assessment Name", description: "Name of the state-administered test (e.g., 'PSSA', 'CAASPP', 'Keystone Exams', 'SBAC'). Reps ask 'does <state> use SBAC', 'what tests does <state> give', 'which states use CAASPP'.", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "subjects", column: "subjects", label: "Subjects", description: "Subject areas tested (free text, e.g., 'ELA, Math, Science'). ILIKE for subject-specific filters.", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "grades", column: "grades", label: "Grades", description: "Grade levels tested (free text, e.g., '3-8, 11').", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "testingWindow", column: "testing_window", label: "Testing Window", description: "When the test is typically administered (free text, e.g., 'Spring', 'March-May', 'April 15-May 30'). Reps use this for outreach-timing questions: 'which states test in Spring', 'tests happening this month', 'when does <state> test'. Plan outreach around these windows — avoid scheduling pitches during a state's testing window.", domain: "assessment", format: "text", source: "user", queryable: true },
  { field: "vendor", column: "vendor", label: "Vendor", description: "Test vendor (e.g., 'DRC', 'ETS', 'NWEA'). Reps may ask 'which states use <vendor>'.", domain: "assessment", format: "text", source: "user", queryable: true },
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
  { field: "status", column: "status", label: "Status", description: "Plan lifecycle status. Full enum: 'planning', 'active', 'archived'. Reps ask about this as 'my active plans', 'plans I'm still drafting' (planning), or 'past plans' (archived).", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "fiscalYear", column: "fiscal_year", label: "Fiscal Year", description: "Numeric FY (e.g., 2026 = FY26). NOT the 'FY26' string used on district_financials or the 'YYYY-YY' string used on opportunities — see SEMANTIC_CONTEXT.formatMismatches.fiscal_year. Reps filter on this for 'my FY26 plan' / 'my plan for this year' style questions.", domain: "crm", format: "year", source: "user", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Plan start date.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "endDate", column: "end_date", label: "End Date", description: "Plan end date.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "userId", column: "user_id", label: "Legacy User ID", description: "Legacy FK (use ownerId for new code).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Plan creation timestamp.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "districtCount", column: "district_count", label: "District Count", description: "Denormalized count of districts in the plan — the canonical answer for 'how many districts are in my plan'. May briefly lag the territory_plan_districts junction right after an edit; SUM the junction if you need reconciliation-grade precision.", domain: "plan", format: "integer", source: "computed", queryable: true },
  { field: "stateCount", column: "state_count", label: "State Count", description: "Denormalized count of states in the plan. Same lag caveat as district_count.", domain: "plan", format: "integer", source: "computed", queryable: true },
  { field: "renewalRollup", column: "renewal_rollup", label: "Renewal Rollup", description: "Sum of per-district renewal targets for this plan (dollars). This is the canonical answer for 'my renewal target' / 'my plan's renewal goal'. Denormalized from SUM(territory_plan_districts.renewal_target) — may briefly lag after an edit; use the junction if reconciliation-grade precision is needed.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "expansionRollup", column: "expansion_rollup", label: "Expansion Rollup", description: "Sum of per-district expansion targets for this plan (dollars). Canonical answer for 'my expansion target' / 'my growth goal'. Same lag caveat as renewal_rollup.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "winbackRollup", column: "winback_rollup", label: "Winback Rollup", description: "Sum of per-district winback targets for this plan (dollars). Canonical answer for 'my winback target' / 'my winback goal'. Same lag caveat as renewal_rollup.", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "newBusinessRollup", column: "new_business_rollup", label: "New Business Rollup", description: "Sum of per-district new-business targets for this plan (dollars). Canonical answer for 'my new-business target'. Same lag caveat as renewal_rollup. For a rep's TOTAL target across categories, sum all four rollup columns (renewal + expansion + winback + new_business).", domain: "plan", format: "currency", source: "computed", queryable: true },
  { field: "enrichmentStartedAt", column: "enrichment_started_at", label: "Enrichment Started At", description: "Internal-ops field. When bulk district enrichment was last kicked off for this plan.", domain: "plan", format: "date", source: "computed", queryable: false },
  { field: "enrichmentQueued", column: "enrichment_queued", label: "Enrichment Queued", description: "Internal-ops field. Count of districts still being enriched.", domain: "plan", format: "integer", source: "computed", queryable: false },
  { field: "enrichmentActivityId", column: "enrichment_activity_id", label: "Enrichment Activity ID", description: "Internal-ops field. Tracking activity for bulk enrichment run.", domain: "plan", format: "text", source: "computed", queryable: false },
];

/** territory_plan_districts — per-district goals within a rep's territory plan */
export const TERRITORY_PLAN_DISTRICT_COLUMNS: ColumnMetadata[] = [
  { field: "planId", column: "plan_id", label: "Plan ID", description: "FK to territory_plans.id. Join here to get the plan's owner (rep), fiscal_year, and status.", domain: "plan", format: "text", source: "user", queryable: true },
  { field: "districtLeaid", column: "district_leaid", label: "LEA ID", description: "FK to districts.leaid. One row per (plan, district) pair.", domain: "core", format: "text", source: "user", queryable: true },
  { field: "addedAt", column: "added_at", label: "Added At", description: "When this district was added to the plan.", domain: "plan", format: "date", source: "user", queryable: true },
  { field: "renewalTarget", column: "renewal_target", label: "Renewal Target", description: "Dollar goal a rep has set for renewing existing business in this district this fiscal year. Reps ask about this as 'my renewal target for <district>' or 'which districts have the highest renewal goals'. For plan-level totals see territory_plans.renewal_rollup.", domain: "plan", format: "currency", source: "user", queryable: true },
  { field: "winbackTarget", column: "winback_target", label: "Winback Target", description: "Dollar goal a rep has set for winning back lapsed business in this district. Reps ask 'my winback target for <district>', 'biggest winback opportunities'. Plan-level totals: territory_plans.winback_rollup.", domain: "plan", format: "currency", source: "user", queryable: true },
  { field: "expansionTarget", column: "expansion_target", label: "Expansion Target", description: "Dollar goal a rep has set for expanding an existing customer in this district. Reps ask 'my expansion target for <district>', 'expansion goals'. Plan-level totals: territory_plans.expansion_rollup.", domain: "plan", format: "currency", source: "user", queryable: true },
  { field: "newBusinessTarget", column: "new_business_target", label: "New Business Target", description: "Dollar goal a rep has set for landing new business in this district. Reps ask 'my new business target for <district>', 'where am I going after net new'. Plan-level totals: territory_plans.new_business_rollup. For the rep's TOTAL target in this district, sum all 4 target columns.", domain: "plan", format: "currency", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text rep notes scoped to a specific district in the plan — rep-editable. Reps may include these in reports or ask 'districts where I noted X' (use ILIKE). Distinct from the district-wide notes stored elsewhere.", domain: "user_edits", format: "text", source: "user", queryable: true },
];

/** activities — engagement records (conferences, emails, meetings, etc.) */
export const ACTIVITY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Activity ID", description: "UUID PK.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "type", column: "type", label: "Type", description: "Activity type — the kind of engagement logged. Active set includes values like 'conference', 'road_trip', 'dinner', 'happy_hour', 'school_site_visit', 'fun_and_games', 'mixmax_campaign', 'discovery_call', 'program_check_in', 'proposal_review', 'renewal_conversation', 'gift_drop', 'booth_exhibit', 'conference_sponsor', 'meal_reception', 'charity_event', 'webinar', 'speaking_engagement', 'professional_development', 'course', 'sponsorships', plus the generic 'meeting' / 'call' / 'note' / 'email_campaign'. Run get_column_values('activities', 'type') to confirm the current set before filtering on an exact value. Reps often cluster these into higher-level buckets the data doesn't explicitly model: 'in-person vs virtual' (e.g., conference / road_trip / school_site_visit / dinner are in-person; webinar / call / mixmax_campaign are virtual), 'district visits' (school_site_visit, road_trip), 'meals' (dinner, meal_reception, happy_hour), 'conferences' (conference, booth_exhibit, conference_sponsor). Map the rep's phrasing onto one or more type values using rep judgment.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Activity title/subject.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text notes.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Activity start date/time.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "endDate", column: "end_date", label: "End Date", description: "Activity end date/time.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Activity lifecycle status. Full enum: 'planned', 'requested', 'planning', 'in_progress', 'wrapping_up', 'completed', 'cancelled'. Reps ask about this as 'my upcoming activities' (planned / planning / requested / in_progress), 'completed activities' (completed), or 'cancelled plans' (cancelled). For 'what have I done' questions filter to completed; for 'what's on my plate' filter to the active (non-terminal) subset.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "createdByUserId", column: "created_by_user_id", label: "Created By User ID", description: "FK to user_profiles.id — who logged it.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "activity", format: "date", source: "user", queryable: true },
  { field: "googleEventId", column: "google_event_id", label: "Google Event ID", description: "Link to Google Calendar event for two-way sync.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "source", column: "source", label: "Source", description: "How the activity was created. Full enum today: 'manual' (logged directly by the rep), 'calendar_sync' (synced in from Google Calendar). The gmail / slack / mixmax integration sources referenced by legacy code are NOT active — only calendar_sync is running.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "gmailMessageId", column: "gmail_message_id", label: "Gmail Message ID", description: "Dedup key for Gmail-sourced activities.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "slackChannelId", column: "slack_channel_id", label: "Slack Channel ID", description: "Dedup key for Slack-sourced activities.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "slackMessageTs", column: "slack_message_ts", label: "Slack Message TS", description: "Slack message timestamp for dedup.", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "integrationMeta", column: "integration_meta", label: "Integration Meta", description: "Service-specific metadata (JSONB).", domain: "activity", format: "text", source: "etl_link", queryable: true },
  { field: "mixmaxSequenceName", column: "mixmax_sequence_name", label: "Mixmax Sequence Name", description: "Legacy Mixmax email-sequence name. Mixmax integration is removed — no new data flows in, but historical rows remain. Reps still log activities with type='mixmax_campaign' manually; those don't populate this column. Treat as historical only.", domain: "activity", format: "text", source: "etl_link", queryable: false },
  { field: "mixmaxSequenceStep", column: "mixmax_sequence_step", label: "Mixmax Sequence Step", description: "Legacy Mixmax sequence step number. Historical only — Mixmax integration removed.", domain: "activity", format: "integer", source: "etl_link", queryable: false },
  { field: "mixmaxSequenceTotal", column: "mixmax_sequence_total", label: "Mixmax Sequence Total", description: "Legacy total-steps count. Historical only — Mixmax integration removed.", domain: "activity", format: "integer", source: "etl_link", queryable: false },
  { field: "mixmaxStatus", column: "mixmax_status", label: "Mixmax Status", description: "Legacy Mixmax delivery status. Historical only — Mixmax integration removed.", domain: "activity", format: "text", source: "etl_link", queryable: false },
  { field: "mixmaxOpenCount", column: "mixmax_open_count", label: "Mixmax Open Count", description: "Legacy email-open count. Historical only — Mixmax integration removed.", domain: "activity", format: "integer", source: "etl_link", queryable: false },
  { field: "mixmaxClickCount", column: "mixmax_click_count", label: "Mixmax Click Count", description: "Legacy email-click count. Historical only — Mixmax integration removed.", domain: "activity", format: "integer", source: "etl_link", queryable: false },
  { field: "outcome", column: "outcome", label: "Outcome", description: "Free-text outcome note set when the activity completes. Reps search this for 'what came out of <activity>' questions or to find the narrative behind a logged engagement. Use ILIKE for keyword matching; pair with outcome_type for structured filtering.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "outcomeType", column: "outcome_type", label: "Outcome Type", description: "Structured outcome classification. Full enum: 'positive_progress', 'neutral', 'negative', 'follow_up_needed'. Reps ask about this as 'most positive activities', 'activities that need follow-up', 'negative outcomes by rep', or 'which districts had bad engagements'. Use for GROUP BY / COUNT / rep leaderboard questions.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "rating", column: "rating", label: "Rating", description: "1-5 star rep rating of how the activity went (set on completion). Reps ask about 'highest-rated conferences', 'average rating per rep', or 'activities rated 4+'. NULL on activities that haven't been rated.", domain: "activity", format: "integer", source: "user", queryable: true },
  { field: "metadata", column: "metadata", label: "Metadata", description: "Type-specific scalar fields (JSON).", domain: "activity", format: "text", source: "user", queryable: true },
];

/** activity_expenses — per-activity spending line items (food, travel, gifts, etc.) */
export const ACTIVITY_EXPENSE_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Expense ID", description: "UUID primary key.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "activityId", column: "activity_id", label: "Activity ID", description: "FK to activities.id. Join here to filter expenses by the activity's type, district junction, date, or rep.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "description", column: "description", label: "Description", description: "Free-text line-item description — what the spend was for (e.g., 'Dinner at Steakhouse', 'Lyft to conference', 'Gift basket'). Use ILIKE for keyword matches. Paired with activity.type for category-style breakdowns.", domain: "activity", format: "text", source: "user", queryable: true },
  { field: "amount", column: "amount", label: "Amount", description: "Dollar amount spent on this line item. SUM is the canonical aggregate. Reps ask about this as 'how much did we spend on <district>', 'activity spend this quarter', 'cost per road trip', 'top districts by spend'. Join through activity_districts to filter by district, or through activities.created_by_user_id for rep-level spend.", domain: "activity", format: "currency", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the expense line was logged.", domain: "activity", format: "date", source: "user", queryable: true },
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
  { field: "crmName", column: "crm_name", label: "CRM Name", description: "Name as it appears in the Fullmind LMS (for matching to sales_rep_name).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "hasCompletedSetup", column: "has_completed_setup", label: "Has Completed Setup", description: "Onboarding flag.", domain: "crm", format: "boolean", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "lastLoginAt", column: "last_login_at", label: "Last Login At", description: "Last session timestamp.", domain: "crm", format: "date", source: "user", queryable: true },
];

/** tasks — rep to-do items; kanban status + priority */
export const TASK_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Task ID", description: "UUID PK.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Task title — the short label a rep sees in the kanban board. ILIKE search for 'find the task about <topic>'.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "description", column: "description", label: "Description", description: "Free-text task description. ILIKE search for rep questions like 'tasks mentioning <keyword>'.", domain: "task", format: "text", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Task status. Full enum: 'todo', 'in_progress', 'blocked', 'done'. Reps ask about this as 'my open tasks' (todo + in_progress), 'blocked tasks', 'what I've finished' (done), or 'on my plate' (todo + in_progress + blocked — everything non-done).", domain: "task", format: "text", source: "user", queryable: true },
  { field: "priority", column: "priority", label: "Priority", description: "Task priority. Full enum: 'low', 'medium', 'high', 'urgent'. Reps ask about this as 'urgent tasks', 'high-priority tasks', or 'top of my list' (high + urgent).", domain: "task", format: "text", source: "user", queryable: true },
  { field: "dueDate", column: "due_date", label: "Due Date", description: "Task due date. Reps ask about this as 'tasks due this week', 'overdue tasks' (due_date < current_date AND status != 'done'), 'due today', 'due this month'. NULL on tasks with no due date.", domain: "task", format: "date", source: "user", queryable: true },
  { field: "position", column: "position", label: "Position", description: "Kanban column ordering for UI. Not rep-facing.", domain: "task", format: "integer", source: "user", queryable: false },
  { field: "createdByUserId", column: "created_by_user_id", label: "Created By", description: "FK to user_profiles.id — task creator. Used for 'tasks I created' or 'tasks I delegated' questions (creator != assignee).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "assignedToUserId", column: "assigned_to_user_id", label: "Assigned To", description: "FK to user_profiles.id — task assignee. This is the DEFAULT filter for 'my tasks' / 'what's on my plate' / 'my to-dos' rep questions. Only fall back to created_by_user_id when the rep specifically says 'tasks I created' or 'tasks I assigned to someone else'.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "task", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "task", format: "date", source: "user", queryable: true },
];

/** schools — individual schools within districts (NCES directory) */
export const SCHOOL_COLUMNS: ColumnMetadata[] = [
  { field: "ncessch", column: "ncessch", label: "NCES School ID", description: "12-char NCES school PK.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid — parent district.", domain: "core", format: "text", source: "nces", queryable: true },
  { field: "schoolName", column: "school_name", label: "School Name", description: "School name — ILIKE search for 'find <school>' rep questions.", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "charter", column: "charter", label: "Charter", description: "Charter-school flag stored as Int: 0 = traditional public, 1 = charter. Reps ask about this as 'charter schools in <district>', 'traditional schools', or 'charter-heavy districts'. Filter with charter = 1 for charters.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "schoolLevel", column: "school_level", label: "School Level", description: "School level stored as Int: 1 = Primary / Elementary, 2 = Middle, 3 = High, 4 = Other. Reps ask 'elementary schools' / 'primary schools' (= 1), 'middle schools' (= 2), 'high schools' (= 3). NULL for schools where the level wasn't categorized.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "schoolType", column: "school_type", label: "School Type", description: "NCES school type code (e.g., regular, alternative, vocational). Secondary to school_level for most rep questions.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "lograde", column: "lograde", label: "Low Grade", description: "Lowest grade served by the school (e.g., 'KG', '01', '06', 'PK').", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "higrade", column: "higrade", label: "High Grade", description: "Highest grade served by the school (e.g., '05', '08', '12').", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "schoolStatus", column: "school_status", label: "School Status", description: "Operational status stored as Int: 1 = Open, 2 = Closed. DEFAULT filter for 'current schools' / 'open schools' rep questions is school_status = 1. Only broaden when the rep explicitly asks about closed schools.", domain: "school", format: "integer", source: "nces", queryable: true },
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
  { field: "titleIStatus", column: "title_i_status", label: "Title I Status", description: "Title I participation status code (from Urban Institute / CCD). Reps ask 'Title I schools in <district>', 'which schools participate in Title I', or 'Title I-eligible schools'. Pair with title_i_eligible and title_i_schoolwide for finer splits. Note: no Title I funding DOLLAR amount is stored — if a rep asks about funding amounts, we only have participation flags, not dollars.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleIEligible", column: "title_i_eligible", label: "Title I Eligible", description: "Title I eligibility flag (0/1). Reps ask 'Title I eligible schools' — filter title_i_eligible = 1.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleISchoolwide", column: "title_i_schoolwide", label: "Title I Schoolwide", description: "Schoolwide-program flag (0/1) — higher-poverty schools that run Title I services school-wide rather than targeted. Reps ask 'Title I schoolwide programs' or 'schoolwide Title I' — filter title_i_schoolwide = 1.", domain: "poverty", format: "integer", source: "urban_institute", queryable: true },
  { field: "titleIDataYear", column: "title_i_data_year", label: "Title I Data Year", description: "Data year for Title I fields (check for freshness).", domain: "poverty", format: "year", source: "urban_institute", queryable: true },
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

/** district_data_history — per-district-year snapshots from multi-source ETL (CCD / SAIPE / EdFacts); fallback for trend questions not covered by districts' precomputed trend columns */
export const DISTRICT_DATA_HISTORY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Autoincrement PK.", domain: "core", format: "integer", source: "urban_institute", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid — the district this historical snapshot belongs to.", domain: "core", format: "text", source: "urban_institute", queryable: true },
  { field: "year", column: "year", label: "Year", description: "School-year snapshot as Int (e.g., 2024 = 2024–25 per CCD convention). History goes back as far as the Urban Institute series provides for each source — varies by source.", domain: "core", format: "year", source: "urban_institute", queryable: true },
  { field: "source", column: "source", label: "Source", description: "Which upstream ETL produced the row. Known values: 'ccd_directory' (enrollment, staffing), 'ccd_finance' (revenue, expenditure breakdowns), 'saipe' (poverty), 'edfacts_grad' (graduation rate), 'edfacts_assess' (math/read proficiency). Different sources fill different columns, so filtering by source is needed when asking about a specific metric to avoid NULL noise. Only cite the source to the rep if they ask.", domain: "audit", format: "text", source: "urban_institute", queryable: true },
  { field: "enrollment", column: "enrollment", label: "Enrollment", description: "Historical enrollment snapshot (from ccd_directory). Use for 'enrollment over time' when districts' pre-computed trend columns don't cover the year span the rep wants.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "teachersFte", column: "teachers_fte", label: "Teachers FTE", description: "Full-time-equivalent teacher count (from ccd_directory). For staffing-trend questions.", domain: "staffing", format: "decimal", source: "urban_institute", queryable: true },
  { field: "staffTotalFte", column: "staff_total_fte", label: "Staff Total FTE", description: "Full-time-equivalent total staff count (from ccd_directory).", domain: "staffing", format: "decimal", source: "urban_institute", queryable: true },
  { field: "specEdStudents", column: "spec_ed_students", label: "Special Ed Students", description: "Historical SPED student count (from ccd_directory).", domain: "sped", format: "integer", source: "urban_institute", queryable: true },
  { field: "ellStudents", column: "ell_students", label: "ELL Students", description: "Historical English-learner student count (from ccd_directory).", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "chronicAbsenteeismRate", column: "chronic_absenteeism_rate", label: "Chronic Absenteeism Rate", description: "Historical chronic absenteeism rate (from ccd_directory).", domain: "absenteeism", format: "percentage", source: "urban_institute", queryable: true },
  { field: "totalRevenue", column: "total_revenue", label: "Total Revenue", description: "District total revenue for the year (from ccd_finance). 'Revenue history' for the district — NOT Fullmind revenue. For Fullmind revenue, use district_financials.", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "totalExpenditure", column: "total_expenditure", label: "Total Expenditure", description: "District total spending for the year (from ccd_finance).", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "expenditurePp", column: "expenditure_per_pupil", label: "Expenditure Per Pupil", description: "Per-pupil spending for the year (from ccd_finance). Reps ask about this as 'spending per student', 'spend per student', 'per-pupil spend', or 'expenditure per pupil over time'.", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "federalRevenue", column: "federal_revenue", label: "Federal Revenue", description: "District federal-source revenue for the year (from ccd_finance).", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "stateRevenue", column: "state_revenue", label: "State Revenue", description: "District state-source revenue for the year (from ccd_finance).", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "localRevenue", column: "local_revenue", label: "Local Revenue", description: "District local-source revenue for the year (from ccd_finance).", domain: "finance", format: "currency", source: "urban_institute", queryable: true },
  { field: "spedExpenditure", column: "sped_expenditure_total", label: "SPED Expenditure", description: "District SPED expenditure for the year (from ccd_finance). For 'SPED spending trend' rep questions.", domain: "sped", format: "currency", source: "urban_institute", queryable: true },
  { field: "povertyPct", column: "poverty_percent", label: "Poverty %", description: "Historical child-poverty rate (from saipe).", domain: "poverty", format: "percentage", source: "urban_institute", queryable: true },
  { field: "graduationRate", column: "graduation_rate", label: "Graduation Rate", description: "Historical graduation rate (from edfacts_grad).", domain: "graduation", format: "percentage", source: "urban_institute", queryable: true },
  { field: "mathProficiency", column: "math_proficiency_pct", label: "Math Proficiency %", description: "Historical math proficiency (from edfacts_assess).", domain: "assessment", format: "percentage", source: "urban_institute", queryable: true },
  { field: "readProficiency", column: "read_proficiency_pct", label: "Read Proficiency %", description: "Historical reading proficiency (from edfacts_assess).", domain: "assessment", format: "percentage", source: "urban_institute", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Row creation timestamp.", domain: "audit", format: "date", source: "urban_institute", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "audit", format: "date", source: "urban_institute", queryable: true },
];

/** district_grade_enrollment — per-grade yearly enrollment per district */
export const DISTRICT_GRADE_ENROLLMENT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Autoincrement PK.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid.", domain: "core", format: "text", source: "urban_institute", queryable: true },
  { field: "year", column: "year", label: "Year", description: "School-year snapshot as Int (e.g., 2024 = 2024–25).", domain: "demographics", format: "year", source: "urban_institute", queryable: true },
  { field: "grade", column: "grade", label: "Grade", description: "Grade code as VarChar. Known values: 'K' (kindergarten), '01' through '12' (grades 1-12, zero-padded), 'PK' (pre-K), 'UG' (ungraded). For grade-range filters use IN / LIKE — e.g., elementary = ('K', '01', '02', '03', '04', '05'), middle = ('06', '07', '08'), high = ('09', '10', '11', '12').", domain: "demographics", format: "text", source: "urban_institute", queryable: true },
  { field: "enrollment", column: "enrollment", label: "Enrollment", description: "Student count at that grade in that district-year. Use for 'biggest K-2 populations', 'high-school enrollment in <state>' (join districts for state_fips), or 'grade-band demographics' rep questions.", domain: "demographics", format: "integer", source: "urban_institute", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Row creation timestamp.", domain: "audit", format: "date", source: "urban_institute", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "audit", format: "date", source: "urban_institute", queryable: true },
];

/** school_enrollment_history — per-school yearly enrollment snapshots; used for growth/shrinkage trends */
export const SCHOOL_ENROLLMENT_HISTORY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Autoincrement PK.", domain: "school", format: "integer", source: "nces", queryable: true },
  { field: "ncessch", column: "ncessch", label: "NCES School ID", description: "FK to schools.ncessch. One row per (school, year).", domain: "school", format: "text", source: "nces", queryable: true },
  { field: "year", column: "year", label: "Year", description: "School-year snapshot as an integer (e.g., 2024 represents the 2024–25 school year per NCES CCD convention). For YoY comparisons, compare rows with consecutive year values.", domain: "school", format: "year", source: "nces", queryable: true },
  { field: "enrollment", column: "enrollment", label: "Enrollment", description: "Total enrollment at the school for that year. Use this column for growth/shrinkage questions ('schools that grew the most between FY23 and FY24', 'schools with declining enrollment', 'biggest enrollment jumps'). For single-year current enrollment prefer schools.enrollment (the denormalized latest value).", domain: "demographics", format: "integer", source: "nces", queryable: true },
];

/** sessions — individual Fullmind session records (FK to opportunities) */
export const SESSION_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Session ID", description: "Fullmind LMS session PK.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "opportunityId", column: "opportunity_id", label: "Opportunity ID", description: "FK to opportunities.id. NOT a hard FK — 33% of sessions point to historical opps not in our opportunities table (scheduler sync lag).", domain: "opportunity", format: "text", source: "opensearch", queryable: true },
  { field: "serviceType", column: "service_type", label: "Service Type", description: "Service type code for this session (e.g., math, tutoring, SPED, ELL, enrichment, science) — the canonical per-session tag used for 'math sessions this month', 'science sessions by district', 'SPED sessions', 'session revenue by service type', or 'which services did we deliver in Texas' breakdowns. Pair with service_name for human-readable labels. Session-level; session_price × sessions aggregates give per-service session revenue. See SEMANTIC_CONTEXT.conceptMappings.service_type_breakdown for the cross-table pattern.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "sessionPrice", column: "session_price", label: "Session Price", description: "Customer-facing price per session — the revenue side of the session economics. Reps ask about this as 'session revenue' (SUM(session_price) on completed sessions), 'price per session', or as the top line of margin math. Per-session margin = session_price − educator_price. For deal-level or rep-level revenue rollups, prefer opportunities.completed_revenue / scheduled_revenue (or DOA / DF); aggregate sessions directly only when the question is session-grain.", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "educatorPrice", column: "educator_price", label: "Educator Price", description: "Amount paid to the educator for the session — the cost side of the session economics. Reps ask about this as 'educator cost' (SUM(educator_price) on completed sessions), 'pay rate', or as the bottom line of margin math. Per-session margin = session_price − educator_price. See educator_approved_price for the approved-rate variant.", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "educatorApprovedPrice", column: "educator_approved_price", label: "Educator Approved Price", description: "Admin-approved educator rate. In most cases matches educator_price; diverges only when the approved rate is set but the actual paid rate has been adjusted. For margin math or 'educator cost' questions, default to educator_price — only reach for educator_approved_price when the rep specifically asks about approved/contracted rates vs paid.", domain: "session", format: "currency", source: "opensearch", queryable: true },
  { field: "startTime", column: "start_time", label: "Start Time", description: "Session start datetime.", domain: "session", format: "date", source: "opensearch", queryable: true },
  { field: "type", column: "type", label: "Type", description: "Session modality — whether a session is instructional (live tutoring), hybrid staffing, or virtual. NOT an in-person/online distinction. Reps use this when asking about modality mix: 'how much of our revenue is instructional vs hybrid staffing', 'virtual sessions this year'. Run get_column_values('sessions', 'type') to see the exact string values before filtering.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Session lifecycle status — full enum is 'completed', 'scheduled', 'cancelled'. Reps ask about this as 'completed sessions' / 'sessions delivered' (status = 'completed'), 'sessions scheduled' / 'upcoming sessions' (status = 'scheduled'), 'cancellations' / 'cancelled sessions' / 'no-shows' (status = 'cancelled' — no-shows are tracked under the cancelled status; if a finer distinction is needed, check for a cancellation-reason column elsewhere). For 'session count' aggregates, COUNT(*) filtered by the relevant status.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "serviceName", column: "service_name", label: "Service Name", description: "Human-readable name of the service delivered in this session (e.g., 'Algebra 1 Tutoring'). Pair with service_type for the canonical code. Use this column when displaying results to a rep and service_type for filtering / grouping.", domain: "session", format: "text", source: "opensearch", queryable: true },
  { field: "syncedAt", column: "synced_at", label: "Synced At", description: "Last sync timestamp.", domain: "session", format: "date", source: "opensearch", queryable: true },
];

/** vacancies — job postings scraped from district job boards; signal for outreach */
export const VACANCY_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Vacancy ID", description: "cuid PK.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "leaid", column: "leaid", label: "LEA ID", description: "FK to districts.leaid.", domain: "core", format: "text", source: "scraper", queryable: true },
  { field: "scanId", column: "scan_id", label: "Scan ID", description: "FK to vacancy_scans.id (excluded table).", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "fingerprint", column: "fingerprint", label: "Fingerprint", description: "Unique dedup key across scans.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Posting lifecycle status. Full enum: 'open', 'closed', 'expired'. Default filter for 'current vacancies' / 'open postings' / 'districts still hiring' rep questions is status = 'open'. Only broaden beyond open when the rep explicitly asks about closed/expired (rare).", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Job posting title (free-text). This is where most subject/role rep questions land: 'case manager postings', 'science teacher openings', 'math jobs in Texas'. Use ILIKE for keyword matching; combine with category for bucketed filtering ('SPED postings' → category = 'SPED' AND/OR title ILIKE '%special ed%').", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "category", column: "category", label: "Category", description: "Vacancy bucket. Full enum: 'SPED', 'ELL', 'General Ed', 'Admin', 'Specialist', 'Counseling', 'Related Services', 'Other'. Reps ask 'SPED postings' (category = 'SPED'), 'counseling vacancies' (category = 'Counseling'), etc. For finer subject/role distinctions (e.g., 'case managers', 'science teachers'), the title or raw_text columns are more specific — category is the high-level bucket.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "schoolNcessch", column: "school_ncessch", label: "School NCES ID", description: "FK to schools.ncessch when posting is school-specific.", domain: "school", format: "text", source: "scraper", queryable: true },
  { field: "schoolName", column: "school_name", label: "School Name", description: "School name as scraped.", domain: "school", format: "text", source: "scraper", queryable: true },
  { field: "hiringManager", column: "hiring_manager", label: "Hiring Manager", description: "Named hiring manager scraped from the posting. Reps ask 'who's the hiring manager at <school>'. Free-text name; NULL when not present in the source posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "hiringEmail", column: "hiring_email", label: "Hiring Email", description: "Hiring manager email if present in the posting. NULL when the posting doesn't list one.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "contactId", column: "contact_id", label: "Contact ID", description: "FK to contacts.id when the scraper matched the hiring manager to a known contact. NULL when unmatched.", domain: "contact", format: "integer", source: "scraper", queryable: true },
  { field: "startDate", column: "start_date", label: "Start Date", description: "Job start date as free-text string from the posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "datePosted", column: "date_posted", label: "Date Posted", description: "When the posting was first observed by the scraper. Use for 'recent postings' / 'postings from this week' filtering. For freshness on currently-active postings, last_seen_at is more relevant.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "fullmindRelevant", column: "fullmind_relevant", label: "Fullmind Relevant", description: "Flag indicating whether this posting aligns with Fullmind's service coverage — subject/role match (math, science, special ed, case manager, etc.) based on keyword rules. Reps ask 'Fullmind-relevant vacancies in <state>' or 'districts with openings we could fill'. Default filter when a rep asks about outreach-worthy vacancies: fullmind_relevant = true AND status = 'open'.", domain: "vacancy", format: "boolean", source: "scraper", queryable: true },
  { field: "relevanceReason", column: "relevance_reason", label: "Relevance Reason", description: "Which matched keywords triggered the fullmind_relevant flag. Useful for 'why is this posting flagged' explanation.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "sourceUrl", column: "source_url", label: "Source URL", description: "URL of the original posting.", domain: "links", format: "text", source: "scraper", queryable: true },
  { field: "rawText", column: "raw_text", label: "Raw Text", description: "Full scraped text of the posting.", domain: "vacancy", format: "text", source: "scraper", queryable: true },
  { field: "districtVerified", column: "district_verified", label: "District Verified", description: "Whether the district-leaid match was verified.", domain: "vacancy", format: "boolean", source: "scraper", queryable: true },
  { field: "firstSeenAt", column: "first_seen_at", label: "First Seen At", description: "First time this posting was observed by the scraper.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "lastSeenAt", column: "last_seen_at", label: "Last Seen At", description: "Most recent scan that saw this posting. Use for 'still-active postings' filters (e.g., last_seen_at > current_date - interval '14 days' AND status = 'open').", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "notes", column: "notes", label: "Notes", description: "Free-text rep notes.", domain: "user_edits", format: "text", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Record creation timestamp.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last update timestamp.", domain: "vacancy", format: "date", source: "scraper", queryable: true },
];

/**
 * news_articles — RSS + Google News ingestion of K-12 news, matched to
 * districts/schools/contacts via junction tables and classified by a Haiku
 * pass for topic categories and Fullmind sales relevance.
 */
export const NEWS_ARTICLE_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Article ID", description: "cuid PK.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "url", column: "url", label: "URL", description: "Canonical article URL. Rep questions linking out to the original story should expose this column.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "urlHash", column: "url_hash", label: "URL Hash", description: "Internal dedup key (sha256 of url). Not user-relevant — never SELECT for reps.", domain: "news", format: "text", source: "news_ingest", queryable: false },
  { field: "title", column: "title", label: "Title", description: "Headline. Use ILIKE for keyword search ('news mentioning Algebra', 'articles about ESSER').", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "description", column: "description", label: "Description", description: "1-sentence summary from the feed (often null for Google News results).", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "content", column: "content", label: "Full Content", description: "Full article body when available. Large text — only include in SELECT when the rep asks for the article body or wants a deep keyword scan.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "imageUrl", column: "image_url", label: "Image URL", description: "Lead image URL when present in the feed.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "author", column: "author", label: "Author", description: "Article byline (often null).", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "source", column: "source", label: "Source", description: "Publication name as parsed from the feed (e.g., 'Chalkbeat', 'EdSurge', a local paper). For 'news from Chalkbeat' style filters use this column. For the originating ingest pipeline use feed_source.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "feedSource", column: "feed_source", label: "Feed Source", description: "Which ingest pipeline produced this row. Full enum: 'chalkbeat', 'k12dive', 'the74', 'edsurge', 'google_news_query' (industry-wide topic searches), 'google_news_district' (per-district name searches), 'manual_refresh' (admin-triggered). Industry-trends questions favor the first 4 + google_news_query; per-district coverage favors google_news_district plus the junction.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "publishedAt", column: "published_at", label: "Published At", description: "When the article was published per the source feed. Default sort/filter column for 'recent news' / 'this week' / 'last 30 days' rep questions. Indexed.", domain: "news", format: "date", source: "news_ingest", queryable: true },
  { field: "fetchedAt", column: "fetched_at", label: "Fetched At", description: "When our ingestor first saw the article. Use published_at for rep-facing recency questions; fetched_at is mainly for ops/freshness debugging.", domain: "news", format: "date", source: "news_ingest", queryable: true },
  { field: "stateAbbrevs", column: "state_abbrevs", label: "State Abbreviations", description: "Array of 2-letter state codes the article was geo-tagged to (e.g., {'TX','OK'}). Sourced from feed metadata + district junction backfill. Use the postgres array operator: state_abbrevs && ARRAY['TX'] for 'news in TX', or 'TX' = ANY(state_abbrevs). For multi-state queries use the && (overlap) operator. May be empty when geo couldn't be inferred.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "categories", column: "categories", label: "Categories", description: "Haiku-assigned topic tags (text[]). Full enum: 'budget_funding', 'leadership_change', 'vacancies_staffing', 'academic_performance', 'enrollment_trends', 'labor_contract', 'curriculum_adoption', 'technology_edtech', 'school_choice', 'procurement_rfp', 'policy_regulation', 'facility_operations', 'student_services', 'tutoring_intervention', 'homeschool', 'scandal_incident'. Use postgres array ops: categories && ARRAY['budget_funding','leadership_change'] for any-match, or 'tutoring_intervention' = ANY(categories). Empty array means classifier ran but nothing applied; NULL means not yet classified.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "fullmindRelevance", column: "fullmind_relevance", label: "Fullmind Relevance", description: "Sales-actionability tier from the Haiku classifier. Full enum: 'high' (direct action this week — leadership change, any budget movement, vacancies/layoffs, school choice / vouchers / virtual schools / homeschool, RFPs in any subject, accountability/lawsuit/learning-loss problem statements, tutoring or intervention announcements, labor disruption / strikes), 'medium' (useful context — non-tutoring curriculum, SEL/mental-health expansion, routine test scores, sub-director board changes, facility news, plain enrollment trends), 'low' (skippable district news — sports, routine state policy, facilities, social justice / DEI commentary, crime / investigations), 'none' (off-topic — higher-ed, private school, passing-mention articles). NULL until classified. For 'high-priority news' / 'sales-relevant news' default to fullmind_relevance IN ('high','medium'). Indexed alongside published_at.", domain: "news", format: "text", source: "news_ingest", queryable: true },
  { field: "classifiedAt", column: "classified_at", label: "Classified At", description: "When the Haiku classifier ran. NULL = not yet classified (categories / fullmind_relevance will both be null on those rows).", domain: "news", format: "date", source: "news_ingest", queryable: true },
];

/** query_log — audit log of every natural-language query and agentic action */
export const QUERY_LOG_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Auto-increment primary key.", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "userId", column: "user_id", label: "User ID", description: "UUID of the user who ran the query.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "conversationId", column: "conversation_id", label: "Conversation ID", description: "Groups queries into a single chat conversation. The agent loop loads prior turns by this id so 'like that but for Texas' works.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "question", column: "question", label: "Question", description: "Natural-language question the user asked.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "sql", column: "sql", label: "Generated SQL", description: "SQL Claude generated (null for non-query actions). Server-side only — never returned to clients per the never-show-SQL rule.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "params", column: "params", label: "Params (JSON)", description: "Per-turn JSON payload — currently stores { summary } so the chat history can re-render chips for prior turns.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "rowCount", column: "row_count", label: "Row Count", description: "Number of rows returned.", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "executionTimeMs", column: "execution_time_ms", label: "Execution Time (ms)", description: "How long the SQL took to run.", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "error", column: "error", label: "Error", description: "Error message if the query failed (Claude-paraphrased before user display).", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "action", column: "action", label: "Action", description: "Action tool name for agentic actions (null for reads). Examples: add_districts_to_plan, create_task, create_activity, create_contact.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "actionParams", column: "action_params", label: "Action Params", description: "JSON of the action parameters.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "actionSuccess", column: "action_success", label: "Action Success", description: "Whether the action executed successfully.", domain: "audit", format: "boolean", source: "query_tool", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the query was logged.", domain: "audit", format: "date", source: "query_tool", queryable: true },
];

/** saved_reports — user-saved query reports with stored SQL and chip summary; reruns bypass Claude */
export const SAVED_REPORT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "ID", description: "Auto-increment primary key.", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "userId", column: "user_id", label: "User ID", description: "Owner of the saved report.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "title", column: "title", label: "Title", description: "Human-readable report title (rep-named at save time).", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "question", column: "question", label: "Original Question", description: "The natural-language question that produced this SQL.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "sql", column: "sql", label: "Stored SQL", description: "Exact SQL string re-executed by /api/reports/:id/run. Reruns are zero-Claude. Server-side only — never shown to users.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "params", column: "params", label: "Params (JSON)", description: "Legacy structured-params payload from the pre-agent-loop design. New reports store summary instead; this column remains for backwards compatibility.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "summary", column: "summary", label: "Chip Summary (JSON)", description: "Stored QuerySummary object — the chip representation rendered when the saved report runs. Lets the UI show the report's structure without re-asking Claude.", domain: "audit", format: "text", source: "query_tool", queryable: false },
  { field: "conversationId", column: "conversation_id", label: "Origin Conversation", description: "The chat thread the report was saved from. Used to 'open in chat to modify' — opening the saved report rehydrates the conversation context.", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "isTeamPinned", column: "is_team_pinned", label: "Team Pinned", description: "Whether this report is pinned to the Team Reports tab (out of scope for v1 UI but flag exists).", domain: "audit", format: "boolean", source: "query_tool", queryable: true },
  { field: "pinnedBy", column: "pinned_by", label: "Pinned By", description: "Admin who pinned the report (null if not pinned).", domain: "audit", format: "text", source: "query_tool", queryable: true },
  { field: "lastRunAt", column: "last_run_at", label: "Last Run At", description: "When the report was most recently executed.", domain: "audit", format: "date", source: "query_tool", queryable: true },
  { field: "runCount", column: "run_count", label: "Run Count", description: "How many times the report has been executed.", domain: "audit", format: "integer", source: "query_tool", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "When the report was saved.", domain: "audit", format: "date", source: "query_tool", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "When the report was last modified.", domain: "audit", format: "date", source: "query_tool", queryable: true },
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
  /** Cardinality */
  type: "one-to-many" | "many-to-one" | "many-to-many";
  /** Literal SQL fragment Claude can drop into a JOIN clause */
  joinSql: string;
  /** One-line human description */
  description: string;
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
        toTable: "news_article_districts",
        type: "one-to-many",
        joinSql: "news_article_districts.leaid = districts.leaid",
        description: "Junction to news articles (join news_articles via article_id; default confidence IN ('high','llm'))",
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
    ],
  },

  opportunities: {
    table: "opportunities",
    description:
      "Raw Fullmind LMS opportunities, synced from OpenSearch by the scheduler. Safe ONLY for per-deal queries: SELECT by id/name, list individual deals, filter by a specific stage, count distinct deals, drill into a single contract. For any aggregate — bookings, pipeline, revenue, take, category rollup, closed-won totals — ROUTE TO district_opportunity_actuals instead. Raw aggregates silently produce wrong answers because: (a) LMS closed-won is text-only ('Closed Won'), numeric-prefix logic misses it; (b) minimum_purchase_amount / maximum_budget are cumulative on EK12 add-ons (SUM overcounts 3-4×); (c) session-revenue columns (total_revenue, completed_revenue, scheduled_revenue) don't include EK12 subscription revenue. Stage column has erroneous child-op text values ('Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending') that should be filtered out of deal-level listings. One opportunity can have many subscriptions (EK12) and many sessions (Fullmind native).",
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
    ],
  },

  contacts: {
    table: "contacts",
    description:
      "District-level people records — superintendents, admins, principals, curriculum directors, etc. One district can have many contacts. Rep questions: 'who do we know at <district>', 'all superintendents in CA', 'HR directors we've reached', 'primary contact at <district>', 'stale contacts', 'contacts at <specific school>' (via the school_contacts junction), 'contacts who attended <event>' (via the activity_contacts junction), 'contacts assigned to <task>' (via task_contacts), 'contacts mentioned in recent news' (via the news_article_contacts junction). Use persona / seniority_level for role-based filtering (both columns' value sets live in the data — call get_column_values to confirm). For contacts-at-a-school questions, the school_contacts junction is the right hop (still excluded from TABLE_REGISTRY; use raw Prisma join).",
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
        toTable: "news_article_contacts",
        type: "one-to-many",
        joinSql: "news_article_contacts.contact_id = contacts.id",
        description: "Junction to news articles mentioning this contact (default confidence IN ('high','llm'))",
      },
    ],
  },


  states: {
    table: "states",
    description:
      "One row per US state with FIPS / abbrev / name as identifiers, plus denormalized aggregates (total districts / enrollment / customers / pipeline / ICP tier counts, weighted averages). The aggregates are convenience caches — PREFER computing from districts / district_financials directly for accuracy since the rollups may lag an ETL cycle. Rep questions: 'customers in <state>' (COUNT from districts WHERE is_customer = true), 'pipeline in <state>' (SUM from district_financials WHERE vendor='fullmind'), 'top states by bookings' (SUM from district_financials grouped by state_fips), 'states with highest chronic absenteeism' (compute from districts). For 'which tests does <state> give' or testing-window outreach timing, join to state_assessments.",
    primaryKey: "fips",
    columns: STATE_COLUMNS,
    relationships: [
      {
        toTable: "state_assessments",
        type: "one-to-many",
        joinSql: "state_assessments.state_fips = states.fips",
        description: "Standardized tests administered by the state",
      },
    ],
  },

  state_assessments: {
    table: "state_assessments",
    description:
      "Reference table listing which standardized assessments each state administers (e.g., CA → CAASPP, PA → PSSA + Keystone). ~80-100 rows, refreshed annually. Rep questions: 'does <state> use SBAC', 'what tests does <state> give', 'which states test in Spring', 'testing windows in <state>', 'outreach timing — when not to pitch <state>' (avoid the testing_window). Testing-window awareness is the main rep utility: reps plan outreach around state testing blackout periods.",
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
      "One territory plan per rep per fiscal year (owner_id = rep). Anchors plan-scoped questions — 'my plan', 'my FY26 plan', 'Jake's plan', 'my renewal target', 'my plan's districts'. Reps set per-district goals here (they don't have rep-level quotas in this tool). Plan-level target totals live in the denormalized rollup columns; per-district goals live in territory_plan_districts. fiscal_year is a NUMBER (2026 = FY26), not the 'FY26' string used elsewhere — see SEMANTIC_CONTEXT.formatMismatches.fiscal_year.",
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
        toTable: "territory_plan_districts",
        type: "one-to-many",
        joinSql: "territory_plan_districts.plan_id = territory_plans.id",
        description: "Districts in this plan with per-district target goals",
      },
    ],
  },
  territory_plan_districts: {
    table: "territory_plan_districts",
    description:
      "Per-district goal records inside a rep's territory plan. One row per (plan, district). Reps set 4 dollar-denominated target columns here: renewal_target, winback_target, expansion_target, new_business_target — reps will ask about any of them individually or as a rep's total target for a district (sum of all 4). Free-text notes are rep-editable and may be included in reports. For plan-level totals, prefer the denormalized rollup columns on territory_plans (district_count, renewal_rollup, etc.) which answer 'my total renewal target' questions directly.",
    primaryKey: ["planId", "districtLeaid"],
    columns: TERRITORY_PLAN_DISTRICT_COLUMNS,
    relationships: [
      {
        toTable: "territory_plans",
        type: "many-to-one",
        joinSql: "territory_plan_districts.plan_id = territory_plans.id",
        description: "Parent plan (get fiscal_year, owner, status here)",
      },
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "territory_plan_districts.district_leaid = districts.leaid",
        description: "District in the plan",
      },
    ],
  },

  activities: {
    table: "activities",
    description:
      "Engagement records — conferences, road trips, school visits, dinners, meetings, calls, notes, and more. Linked to plans, districts, contacts, states, opportunities, and tasks via junction tables (still excluded from registry; use raw Prisma joins to get the junctions). Per-activity spending lives in activity_expenses (registered) — use it for 'how much did we spend on <district>' or 'activity cost per rep'. Query this table for engagement frequency, outcome patterns, pipeline-to-activity correlations, or spend questions (via activity_expenses).",
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
        toTable: "activity_expenses",
        type: "one-to-many",
        joinSql: "activity_expenses.activity_id = activities.id",
        description: "Per-activity expense line items (cost side of an activity)",
      },
    ],
  },
  activity_expenses: {
    table: "activity_expenses",
    description:
      "Per-activity expense line items — food, travel, gifts, and other spend tied to a specific activity. One activity can have many expense rows. Use for 'how much did we spend on <district>', 'activity spend this quarter', 'cost per road trip', 'spend per rep', 'top districts by spend'. Join through activities.id and then through the relevant activity junction (activity_districts for district-level spend, activities.created_by_user_id for rep-level spend) since activity_expenses has no direct rep/district FK.",
    primaryKey: "id",
    columns: ACTIVITY_EXPENSE_COLUMNS,
    relationships: [
      {
        toTable: "activities",
        type: "many-to-one",
        joinSql: "activity_expenses.activity_id = activities.id",
        description: "Parent activity (travel through this to get rep, district, type, date)",
      },
    ],
  },

  user_profiles: {
    table: "user_profiles",
    description:
      "Fullmind teammates. The canonical user table — join target for plan owners, task assignees, district owners, state owners, school owners, and the email side of opportunities.sales_rep_email. Match opportunities.sales_rep_email → user_profiles.email to go from an opp to its rep's profile.",
    primaryKey: "id",
    columns: USER_PROFILE_COLUMNS,
    relationships: [],
  },


  tasks: {
    table: "tasks",
    description:
      "Rep to-do items with kanban status (todo / in_progress / blocked / done) and priority (low / medium / high / urgent). Rep questions: 'my tasks' / 'what's on my plate' / 'my to-dos' (filter by assigned_to_user_id), 'tasks due this week', 'overdue tasks', 'urgent tasks', 'blocked tasks', 'tasks for <district>' (via task_districts junction), 'tasks for <plan>' (via task_plans junction), 'tasks I delegated' (created_by_user_id vs assigned_to_user_id differ). DEFAULT filter for 'my tasks' is assigned_to_user_id, not created_by_user_id. Junction tables (task_districts / task_plans / task_activities / task_contacts) remain excluded; use raw Prisma joins.",
    primaryKey: "id",
    columns: TASK_COLUMNS,
    relationships: [
      {
        toTable: "user_profiles",
        type: "many-to-one",
        joinSql: "tasks.assigned_to_user_id = user_profiles.id",
        description: "Assignee",
      },
    ],
  },

  schools: {
    table: "schools",
    description:
      "Individual schools within districts, keyed on 12-char NCES school ID (ncessch). Rich demographic data: Title I participation, FRPL, race/ethnicity enrollment breakdowns, charter/traditional flag, grade span, urbanicity. Join to districts via leaid for district-to-school drill-in. Rep questions: 'charter schools in <district>', 'high schools in <state>' (school_level = 3), 'Title I schools', 'largest schools by enrollment', 'schools with the highest FRPL rate', 'demographic breakdown at <school>', 'schools that grew/shrank' (via school_enrollment_history). DEFAULT filter for 'current schools' is school_status = 1 (Open).",
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
        toTable: "school_enrollment_history",
        type: "one-to-many",
        joinSql: "school_enrollment_history.ncessch = schools.ncessch",
        description: "Historical enrollment snapshots per year (trend / growth / shrinkage)",
      },
      {
        toTable: "news_article_schools",
        type: "one-to-many",
        joinSql: "news_article_schools.ncessch = schools.ncessch",
        description: "Junction to news articles mentioning this school (default confidence IN ('high','llm'))",
      },
    ],
  },
  district_data_history: {
    table: "district_data_history",
    description:
      "Per-district-year historical snapshots from multi-source ETL (CCD directory, CCD finance, SAIPE poverty, EdFacts grad, EdFacts assess). One row per (leaid, year, source) — so a single district-year has multiple rows, each populated by one upstream source. PREFER districts' pre-computed trend columns (e.g., enrollmentTrend3yr) for common trend questions; fall back to this table for year-specific or longer-span questions (history goes as far back as the Urban Institute series allows). When filtering a specific metric (grad rate, poverty, etc.) filter by source first to avoid NULL noise (see source column). Rep questions: 'enrollment over time', 'poverty trend in <district>', 'grad rate 5 years back', 'spending per student trend', 'SPED spending history'. Note: total_revenue here is the DISTRICT's revenue (federal + state + local), not Fullmind revenue — for Fullmind use district_financials.",
    primaryKey: "id",
    columns: DISTRICT_DATA_HISTORY_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "district_data_history.leaid = districts.leaid",
        description: "Parent district",
      },
    ],
  },
  district_grade_enrollment: {
    table: "district_grade_enrollment",
    description:
      "Per-(district, year, grade) enrollment snapshots. Grade values: 'K', '01'..'12', 'PK', 'UG'. Rep questions: 'biggest K-2 populations', 'high-school enrollment in <state>', 'grade-band demographics', 'districts with the most SPED-relevant elementary enrollment'. For grade-range filters, use IN / LIKE: elementary ('K','01'..'05'), middle ('06','07','08'), high ('09'..'12'). Join districts for state_fips or other district-level filters.",
    primaryKey: "id",
    columns: DISTRICT_GRADE_ENROLLMENT_COLUMNS,
    relationships: [
      {
        toTable: "districts",
        type: "many-to-one",
        joinSql: "district_grade_enrollment.leaid = districts.leaid",
        description: "Parent district",
      },
    ],
  },
  school_enrollment_history: {
    table: "school_enrollment_history",
    description:
      "Per-school yearly enrollment snapshots. One row per (school, year). Use this table for 'which schools are growing', 'declining enrollment', 'biggest enrollment jumps YoY', 'enrollment trend at <school>', or 'top growers in <state>' questions. For a single current enrollment number, schools.enrollment is the denormalized latest value and is faster.",
    primaryKey: "id",
    columns: SCHOOL_ENROLLMENT_HISTORY_COLUMNS,
    relationships: [
      {
        toTable: "schools",
        type: "many-to-one",
        joinSql: "school_enrollment_history.ncessch = schools.ncessch",
        description: "The school this history row belongs to",
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
      "Job postings scraped from district job boards. Categorized (SPED, ELL, General Ed, Admin, Specialist, Counseling, Related Services, Other) and flagged as fullmind_relevant when subject/role matches Fullmind coverage. Feeds districts.vacancy_pressure_signal. Rep questions: 'open SPED postings in <state>', 'districts with Fullmind-relevant vacancies', 'case manager openings', 'science teacher postings', 'recent postings' / 'postings from this week', 'districts still hiring', 'who's the hiring manager at <school>'. DEFAULT filter for 'current' / 'active' vacancies is status = 'open'. For outreach-worthy vacancies default to fullmind_relevant = true AND status = 'open'. For finer subject/role slices (case managers, science, special ed at a specific level), search title or raw_text with ILIKE — category is the high-level bucket.",
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
  news_articles: {
    table: "news_articles",
    description:
      "K-12 news articles ingested from RSS (Chalkbeat, K12 Dive, The 74, EdSurge), Google News (industry-topic + per-district queries), and admin manual refreshes. Classified by a Haiku pass for sentiment, topic categories, and Fullmind sales relevance — those columns are NULL until the classifier runs. Article-to-entity matching is many-to-many via three junctions: news_article_districts, news_article_schools, news_article_contacts. Rep questions split three ways: (1) per-entity coverage ('news at <district>', 'recent news at my schools', 'articles mentioning <superintendent>') — go through the junction, (2) per-state recency ('news in TX this week', 'recent CA coverage') — use state_abbrevs (postgres text[]) WITHOUT the junction, (3) industry trends ('what's been hot in K-12 news this month', 'most-covered topics') — group by categories or feed_source on news_articles directly. For 'sales-relevant news' default to fullmind_relevance IN ('high','medium'). Articles can outlive their classification window — when filtering by sentiment / categories / fullmind_relevance, surface a brief caveat that unclassified articles are excluded. Always order by published_at DESC for recency questions.",
    primaryKey: "id",
    columns: NEWS_ARTICLE_COLUMNS,
    relationships: [
      {
        toTable: "news_article_districts",
        type: "one-to-many",
        joinSql: "news_article_districts.article_id = news_articles.id",
        description: "Junction to districts (each row carries a confidence tier)",
      },
      {
        toTable: "news_article_schools",
        type: "one-to-many",
        joinSql: "news_article_schools.article_id = news_articles.id",
        description: "Junction to schools",
      },
      {
        toTable: "news_article_contacts",
        type: "one-to-many",
        joinSql: "news_article_contacts.article_id = news_articles.id",
        description: "Junction to contacts (named people mentioned in the article)",
      },
    ],
  },
  news_article_districts: {
    table: "news_article_districts",
    description:
      "Junction between news articles and districts. confidence column is critical: full enum 'high' (exact-name match against district directory, ~5% false-positive rate), 'llm' (LLM-confirmed match against ambiguous candidates, the medium-quality tier), 'low' (uncertain — usually filtered out). DEFAULT filter for rep-facing news: confidence IN ('high','llm'). Use 'high' alone for the strictest accuracy.",
    primaryKey: ["articleId", "leaid"],
    columns: [],
    relationships: [
      { toTable: "news_articles", type: "many-to-one", joinSql: "news_article_districts.article_id = news_articles.id", description: "Parent article" },
      { toTable: "districts", type: "many-to-one", joinSql: "news_article_districts.leaid = districts.leaid", description: "Matched district" },
    ],
  },
  news_article_schools: {
    table: "news_article_schools",
    description:
      "Junction between news articles and schools. Same confidence semantics as news_article_districts: full enum 'high' / 'llm' / 'low'. DEFAULT filter for rep-facing news: confidence IN ('high','llm'). School matches are a subset of high-confidence district matches (we only scan school names within an article's matched districts).",
    primaryKey: ["articleId", "ncessch"],
    columns: [],
    relationships: [
      { toTable: "news_articles", type: "many-to-one", joinSql: "news_article_schools.article_id = news_articles.id", description: "Parent article" },
      { toTable: "schools", type: "many-to-one", joinSql: "news_article_schools.ncessch = schools.ncessch", description: "Matched school" },
    ],
  },
  news_article_contacts: {
    table: "news_article_contacts",
    description:
      "Junction between news articles and contacts (named people: superintendents, CFOs, board members, principals, etc.). Same confidence semantics as the other news junctions: full enum 'high' / 'llm' / 'low'. DEFAULT filter for rep-facing news: confidence IN ('high','llm'). Contact matches require both name co-occurrence AND a title-keyword co-occurrence in the article — so this surface is good for 'news mentioning <superintendent>' or 'recent coverage of leadership at <district>'.",
    primaryKey: ["articleId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "news_articles", type: "many-to-one", joinSql: "news_article_contacts.article_id = news_articles.id", description: "Parent article" },
      { toTable: "contacts", type: "many-to-one", joinSql: "news_article_contacts.contact_id = contacts.id", description: "Matched contact" },
    ],
  },

  query_log: {
    table: "query_log",
    description:
      "Audit log of every natural-language query run through the Claude query tool, plus every agentic action executed. One row per agent-loop turn. Rep-relevance is low (operational data), but rep questions may include 'my recent questions', 'queries that failed', or 'how often have I asked about Texas renewals' — answerable via user_id + conversation_id + question / error. The sql and action_params columns are queryable: false (server-side only; never returned to clients).",
    primaryKey: "id",
    columns: QUERY_LOG_COLUMNS,
    relationships: [],
  },
  saved_reports: {
    table: "saved_reports",
    description:
      "User-saved query reports with stored SQL. Team-pinned reports are surfaced to all users. Re-running a report re-executes the stored SQL directly against the read-only pool — zero Claude calls, zero token cost. sql / summary / params are queryable: false (stored SQL is never shown to users). Rep questions: 'my saved reports', 'my team-pinned reports', 'reports I ran last week', 'most-run reports' (via run_count / last_run_at).",
    primaryKey: "id",
    columns: SAVED_REPORT_COLUMNS,
    relationships: [],
  },

  // === Junction tables (no column arrays — Claude navigates through relationships) ===

  district_tags: {
    table: "district_tags",
    description: "Junction between districts and tags.",
    primaryKey: ["districtLeaid", "tagId"],
    columns: [],
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "district_tags.district_leaid = districts.leaid", description: "District" },
      { toTable: "tags", type: "many-to-one", joinSql: "district_tags.tag_id = tags.id", description: "Tag" },
    ],
  },
  school_tags: {
    table: "school_tags",
    description: "Junction between schools and tags.",
    primaryKey: ["schoolId", "tagId"],
    columns: [],
    relationships: [
      { toTable: "schools", type: "many-to-one", joinSql: "school_tags.school_id = schools.ncessch", description: "School" },
      { toTable: "tags", type: "many-to-one", joinSql: "school_tags.tag_id = tags.id", description: "Tag" },
    ],
  },
  school_contacts: {
    table: "school_contacts",
    description: "Junction between schools and contacts.",
    primaryKey: ["schoolId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "schools", type: "many-to-one", joinSql: "school_contacts.school_id = schools.ncessch", description: "School" },
      { toTable: "contacts", type: "many-to-one", joinSql: "school_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  territory_plan_states: {
    table: "territory_plan_states",
    description: "Junction between territory plans and states.",
    primaryKey: ["planId", "stateFips"],
    columns: [],
    relationships: [
      { toTable: "territory_plans", type: "many-to-one", joinSql: "territory_plan_states.plan_id = territory_plans.id", description: "Plan" },
      { toTable: "states", type: "many-to-one", joinSql: "territory_plan_states.state_fips = states.fips", description: "State" },
    ],
  },
  territory_plan_collaborators: {
    table: "territory_plan_collaborators",
    description: "Junction between territory plans and additional user collaborators (beyond the owner).",
    primaryKey: ["planId", "userId"],
    columns: [],
    relationships: [
      { toTable: "territory_plans", type: "many-to-one", joinSql: "territory_plan_collaborators.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  territory_plan_district_services: {
    table: "territory_plan_district_services",
    description: "Junction linking plan-district rows to target services (return vs new).",
    primaryKey: ["planId", "districtLeaid", "serviceId", "category"],
    columns: [],
    relationships: [
      { toTable: "territory_plan_districts", type: "many-to-one", joinSql: "territory_plan_district_services.plan_id = territory_plan_districts.plan_id AND territory_plan_district_services.district_leaid = territory_plan_districts.district_leaid", description: "Plan-district row" },
      { toTable: "services", type: "many-to-one", joinSql: "territory_plan_district_services.service_id = services.id", description: "Service" },
    ],
  },
  activity_districts: {
    table: "activity_districts",
    description: "Junction between activities and districts, with visit_date, position, and notes for road-trip style activities.",
    primaryKey: ["activityId", "districtLeaid"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_districts.activity_id = activities.id", description: "Activity" },
      { toTable: "districts", type: "many-to-one", joinSql: "activity_districts.district_leaid = districts.leaid", description: "District" },
    ],
  },
  activity_plans: {
    table: "activity_plans",
    description: "Junction between activities and territory plans.",
    primaryKey: ["activityId", "planId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_plans.activity_id = activities.id", description: "Activity" },
      { toTable: "territory_plans", type: "many-to-one", joinSql: "activity_plans.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  activity_contacts: {
    table: "activity_contacts",
    description: "Junction between activities and contacts.",
    primaryKey: ["activityId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_contacts.activity_id = activities.id", description: "Activity" },
      { toTable: "contacts", type: "many-to-one", joinSql: "activity_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  activity_states: {
    table: "activity_states",
    description: "Junction between activities and states.",
    primaryKey: ["activityId", "stateFips"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_states.activity_id = activities.id", description: "Activity" },
      { toTable: "states", type: "many-to-one", joinSql: "activity_states.state_fips = states.fips", description: "State" },
    ],
  },
  activity_opportunities: {
    table: "activity_opportunities",
    description: "Junction between activities and opportunities.",
    primaryKey: ["activityId", "opportunityId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_opportunities.activity_id = activities.id", description: "Activity" },
      { toTable: "opportunities", type: "many-to-one", joinSql: "activity_opportunities.opportunity_id = opportunities.id", description: "Opportunity" },
    ],
  },
  activity_attendees: {
    table: "activity_attendees",
    description: "Internal Fullmind users who attended an activity.",
    primaryKey: ["activityId", "userId"],
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_attendees.activity_id = activities.id", description: "Activity" },
    ],
  },
  activity_relations: {
    table: "activity_relations",
    description: "Links between related activities (e.g., follow-up, part-of, preceded-by).",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "activities", type: "many-to-one", joinSql: "activity_relations.activity_id = activities.id", description: "Source activity" },
    ],
  },
  task_districts: {
    table: "task_districts",
    description: "Junction between tasks and districts.",
    primaryKey: ["taskId", "districtLeaid"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_districts.task_id = tasks.id", description: "Task" },
      { toTable: "districts", type: "many-to-one", joinSql: "task_districts.district_leaid = districts.leaid", description: "District" },
    ],
  },
  task_plans: {
    table: "task_plans",
    description: "Junction between tasks and territory plans.",
    primaryKey: ["taskId", "planId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_plans.task_id = tasks.id", description: "Task" },
      { toTable: "territory_plans", type: "many-to-one", joinSql: "task_plans.plan_id = territory_plans.id", description: "Plan" },
    ],
  },
  task_activities: {
    table: "task_activities",
    description: "Junction between tasks and activities.",
    primaryKey: ["taskId", "activityId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_activities.task_id = tasks.id", description: "Task" },
      { toTable: "activities", type: "many-to-one", joinSql: "task_activities.activity_id = activities.id", description: "Activity" },
    ],
  },
  task_contacts: {
    table: "task_contacts",
    description: "Junction between tasks and contacts.",
    primaryKey: ["taskId", "contactId"],
    columns: [],
    relationships: [
      { toTable: "tasks", type: "many-to-one", joinSql: "task_contacts.task_id = tasks.id", description: "Task" },
      { toTable: "contacts", type: "many-to-one", joinSql: "task_contacts.contact_id = contacts.id", description: "Contact" },
    ],
  },
  tags: {
    table: "tags",
    description: "User-managed tags that can be applied to districts or schools. Rep questions: 'districts tagged <name>', 'what tags does this district have', 'schools with <tag>'.",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "district_tags", type: "one-to-many", joinSql: "district_tags.tag_id = tags.id", description: "Junction to districts" },
      { toTable: "school_tags", type: "one-to-many", joinSql: "school_tags.tag_id = tags.id", description: "Junction to schools" },
    ],
  },
  services: {
    table: "services",
    description: "Catalog of Fullmind service offerings that can be targeted for districts in a plan (via territory_plan_district_services).",
    primaryKey: "id",
    columns: [],
    relationships: [
      { toTable: "territory_plan_district_services", type: "one-to-many", joinSql: "territory_plan_district_services.service_id = services.id", description: "Junction to plan-districts" },
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
      note: "Closed-won contracted minimum — the signed-contract floor, regardless of session delivery. STRONGLY prefer DOA over opportunities aggregates because Fullmind LMS stores add-ons with cumulative minimum_purchase_amount values; naive SUM across add-ons triples/quadruples tier-1 contracts. DOA's min_purchase_bookings clusters contract chains (via name-suffix stripping) and picks MAX per chain, then SUMs across chains. Powers the leaderboard's 'Prior Year Bookings' column — the right metric for in-progress years where session-delivered revenue lags signed contract value.",
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
    default_revenue: {
      dealLevel:
        "When a rep asks about 'revenue' for a single deal or for per-deal results, the default is session+subscription folded together: COALESCE(o.total_revenue, 0) + COALESCE((SELECT SUM(s.net_total) FROM subscriptions s WHERE s.opportunity_id = o.id), 0) AS revenue. Apply this fold-in by default — do NOT use raw o.total_revenue (session-only) unless the rep explicitly says 'session revenue', 'session-only', or asks for a delivered/scheduled split.",
      aggregated:
        "For revenue aggregates across many deals (rep totals, district totals, state totals, FY totals), use district_opportunity_actuals.total_revenue (rep/category-scoped) or district_financials.total_revenue WHERE vendor='fullmind' (rep-agnostic). Both already fold EK12 subscription revenue in via refresh_fullmind_financials() / opp_subscriptions CTE — do NOT re-add subscriptions on top.",
      note: "The single most common revenue mistake on this agent is reaching for opportunities.total_revenue as the default and silently producing session-only numbers. Reps don't think in modalities — when they say 'revenue' they mean 'all the dollars on this deal'. This mapping makes the right default explicit. If the user asks for the SPLIT (session vs subscription), see session_vs_subscription_revenue.",
    },
    session_vs_subscription_revenue: {
      dealLevel:
        "session_revenue: SUM(opportunities.total_revenue) across opportunities in scope. subscription_revenue: SUM(subscriptions.net_total) where subscriptions.opportunity_id IN (<scope>). subscriptions.net_total is SIGNED — credits/cancellations reduce the sum.",
      note: "Neither DOA nor DF exposes session and subscription revenue separately — both fold them together in total_revenue. When a user explicitly asks for the split, compute deal-level: query opportunities and subscriptions separately and report both. If this breakdown becomes a frequent request, add session_revenue / subscription_revenue columns to DOA as a follow-up. For the combined default when a rep just says 'revenue', see default_revenue.",
    },
    delivered_vs_scheduled_revenue: {
      dealLevel:
        "Delivered (already-earned): opportunities.completed_revenue. Scheduled (committed but not yet delivered): opportunities.scheduled_revenue. Total-for-deal: opportunities.total_revenue = completed + scheduled. All three are session-only.",
      aggregated:
        "For rep/category-scoped rollups with EK12 subscriptions folded in, use DOA.completed_revenue and DOA.scheduled_revenue. DOA.total_revenue = both plus EK12 subscription revenue. For rep-agnostic totals, district_financials has total_revenue only; it does not expose the delivered-vs-scheduled split.",
      note: "When a rep asks 'how much of this deal has been delivered' or 'what's scheduled to deliver this year' or 'completed vs scheduled revenue for <rep>', this is the breakdown to reach for. EK12 subscription revenue has no delivered-vs-scheduled concept in our data (subscriptions are a single line-item value). If a rep asks for the split on an EK12-heavy rep or district, surface that caveat.",
    },
    win_rate: {
      aggregated:
        "There is no pre-computed win_rate column. Compute as: SUM(closed_won_bookings) / SUM(closed_won_bookings + closed_lost_bookings) over the scope, using district_financials (rep-agnostic) or district_opportunity_actuals (rep/category-scoped). For a count-based win rate, COUNT(deals WHERE stage='Closed Won') / COUNT(deals WHERE stage IN ('Closed Won','Closed Lost')) on opportunities, excluding ERRONEOUS_CHILD_OP_STAGES.",
      note: "Reps may ask 'win rate', 'close rate', or 'hit rate' — same concept. Dollar-weighted (bookings-based) and count-based are both valid; clarify with the rep when the question is ambiguous. Limit to closed deals only (exclude open stages 0-5 from the denominator, otherwise you're computing an 'including open deals' rate which isn't a true win rate).",
    },
    plan_targets: {
      aggregated:
        "Plan-level targets (per rep per fiscal year) live on territory_plans as denormalized rollup columns: renewal_rollup, expansion_rollup, winback_rollup, new_business_rollup. These sum each category's per-district targets. For the rep's TOTAL target, sum all 4 rollups. For 'my FY26 target', filter territory_plans by owner_id + fiscal_year and read the rollups directly.",
      dealLevel:
        "Per-district targets live on territory_plan_districts: renewal_target, winback_target, expansion_target, new_business_target (all dollar amounts). One row per (plan, district). For a district's total target within a plan, sum all 4 target columns on that row. Join through territory_plans to filter by rep / fiscal year.",
      note: "Reps DO NOT have rep-level quotas in this tool — they set per-district goals. 'My renewal target' / 'my winback target' / 'my total target' all trace back to rollups on territory_plans. Denormalized rollup columns may briefly lag the territory_plan_districts junction right after an edit; they are the canonical answer for rep-facing questions but fall back to SUM(territory_plan_districts) when reconciliation-grade precision is required.",
    },
    service_type_breakdown: {
      dealLevel:
        "For service-type breakdowns of revenue, the canonical shape depends on the modality: native Fullmind (session-based) → sessions.service_type / sessions.service_name with session_price × count(*) for revenue (or SUM(session_price)); EK12 subscriptions → subscriptions.product / product_type / sub_product / course_name with SUM(subscriptions.net_total). opportunities.service_types is a deal-level jsonb tag, not the canonical breakdown surface. For a combined cross-modality breakdown ('Algebra revenue overall'), UNION the two sources with a modality column and sum.",
      note: "Neither DOA nor DF breaks revenue down by service type — the breakdown must be computed from sessions and/or subscriptions directly. When a rep asks 'revenue by service type' or 'how much Algebra did we book this year', route to sessions for session-based revenue and subscriptions for EK12 revenue, and combine if the question is modality-agnostic. Use DOA or DF to cross-check totals afterward (sum of breakdown should match DOA/DF total_revenue for the same scope, modulo small timing differences).",
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
  formatMismatches: [
    {
      concept: "fiscal year",
      tables: {
        opportunities: "school_yr text 'YYYY-YY' e.g., '2025-26' (= FY26)",
        district_opportunity_actuals: "school_yr text 'YYYY-YY' e.g., '2025-26'",
        district_financials: "fiscal_year text 'FYNN' e.g., 'FY26'",
        territory_plans: "fiscal_year integer e.g., 2026 (represents FY26)",
      },
      conversionSql:
        "SUBSTRING(opportunities.school_yr, 6, 2) = SUBSTRING(district_financials.fiscal_year, 3, 2). Or use fiscalYearToSchoolYear() / schoolYearToFiscalYear() helpers.",
      note: "A rep asking about 'FY26' / 'this year' / '2025-26' / 'school year 2025-26' is asking for the SAME fiscal year but the three formats do not compare directly. Always convert before joining or filtering across these tables.",
    },
    {
      concept: "opportunity stage",
      note: "opportunities.stage has mixed conventions. Open pipeline stages are numeric-prefixed: '0 - Lead' through '5 - Final Negotiation'. Terminal stages are text: 'Closed Won' and 'Closed Lost'. There is NO numeric 6+ closed-won state — closed-won is always the literal text 'Closed Won'. FOUR OTHER text values ('Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending') are ERRONEOUS child/auxiliary opportunity rows that MUST be excluded from deal-level queries. Canonical patterns: closed-won → `stage = 'Closed Won'`; open pipeline → `stage ~ '^[0-5]'`; closed-lost → `stage = 'Closed Lost'`; always-exclude child rows → `stage NOT IN ('Active','Position Purchased','Requisition Received','Return Position Pending')` (constant exported as ERRONEOUS_CHILD_OP_STAGES). Note: district_opportunity_actuals aggregates intentionally include those 4 child values for leaderboard accrual — that is a DOA-only behavior, not a closed-won redefinition. For any aggregate, route to DOA (rep/category-scoped) or district_financials (rep-agnostic) instead of aggregating raw opportunities.",
    },
  ],
  warnings: [
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message:
        "OPPORTUNITY STAGE CONVENTION: opportunities.stage has mixed open-pipeline and terminal-state encodings plus 4 child-row stage values that MUST be excluded from deal-level queries. Closed-won is ALWAYS the literal text 'Closed Won' (there is no numeric 6+ closed-won state). Open pipeline is numeric prefix '0-5'. Four text values — 'Active', 'Position Purchased', 'Requisition Received', 'Return Position Pending' — are ERRONEOUS child/auxiliary rows; filter them out with `stage NOT IN (<ERRONEOUS_CHILD_OP_STAGES>)` in any deal-level query. For closed-won/open/lost AGGREGATES (totals, rep/district/state rollups, category breakdowns), prefer district_financials.closed_won_bookings WHERE vendor='fullmind' (rep-agnostic) or district_opportunity_actuals.bookings (rep/category-scoped). DOA aggregates DO include those 4 child values for leaderboard accrual — that is intentional and only correct inside DOA's aggregation, not as a closed-won definition.",
    },
    {
      triggerTables: ["sessions"],
      severity: "mandatory",
      message:
        "HISTORICAL SESSIONS DATA GAP: a meaningful minority of sessions (~a third, concentrated in years before FY24) have opportunity_id values that don't match any row in the opportunities table. Root cause: the OpenSearch opportunity sync is recency-filtered while the session sync is not. Any query joining sessions to opportunities will UNDER-COUNT historical revenue by roughly that share. When the user asks about session data older than FY24, you MUST surface a caveat in your answer noting this gap. For aggregate revenue, always prefer district_financials (vendor='fullmind') or district_opportunity_actuals instead of session-level aggregation. Tracked in Docs/superpowers/followups/2026-04-11-opportunity-sync-historical-gap.md.",
    },
    {
      triggerTables: ["opportunities", "subscriptions"],
      severity: "mandatory",
      message:
        "EK12 REVENUE QUIRK: Elevate K12 opportunities have $0 in their session-derived revenue columns (completed_revenue, scheduled_revenue, total_revenue, completed_take, scheduled_take, total_take). Their real revenue lives in the subscriptions table via SUM(subscriptions.net_total). A query that asks 'what's this rep's FY26 revenue' and reads only opportunities.total_revenue will return $0 for every EK12 rep despite millions in contracted subscription revenue. ALWAYS prefer district_financials (vendor='fullmind') for revenue totals because the ETL rolls in both session AND subscription sources. If you must query opportunities directly, join subscriptions on opportunity_id and sum net_total. 'Take' has no subscription analog — any take-rate query reflects session-derived deals only.",
    },
    {
      triggerTables: ["district_financials"],
      severity: "informational",
      message:
        "Use vendor='fullmind' for our internal data. Other vendors ('elevate', 'proximity', 'tbt') are competitors sourced from GovSpend PO data and represent ESTIMATED competitor spend, not Fullmind revenue. The 'fullmind' vendor rows aggregate BOTH session-derived revenue (from opportunities + sessions) AND Elevate K12 subscription revenue (from subscriptions) via refresh_fullmind_financials() — so a rep asking about 'our revenue' or 'Fullmind revenue' should always filter vendor='fullmind' and does not need to separately join subscriptions.",
    },
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
      triggerTables: [
        "news_articles",
        "news_article_districts",
        "news_article_schools",
        "news_article_contacts",
      ],
      severity: "mandatory",
      message:
        "NEWS QUERY DEFAULTS: (1) When joining any of the three news junctions (news_article_districts / news_article_schools / news_article_contacts), DEFAULT to confidence IN ('high','llm'). The third value 'low' is uncertain matches and pollutes rep-facing results — only include it when the rep explicitly asks for everything. There is no 'medium' value; 'llm' IS the medium tier. (2) Classification columns (sentiment, categories, fullmind_relevance, classified_at) are NULL on the unclassified backlog. Filtering on any of them silently drops those rows — when a rep asks 'all news at <district>' or 'this week's coverage' WITHOUT a sentiment/category/relevance filter, do NOT add one (you'll under-count). When a rep DOES filter on classification ('negative news', 'sales-relevant news'), add a brief caveat that unclassified articles are excluded. (3) Always order by published_at DESC for recency questions; the (published_at) and (fullmind_relevance, published_at) indexes make this fast. (4) For per-state recency ('news in TX'), use news_articles.state_abbrevs (postgres text[]) directly with the && or = ANY operators — going through the district junction is slower and unnecessary unless the rep wants per-district drill-in. (5) For 'sales-relevant news' default fullmind_relevance IN ('high','medium').",
    },
    {
      triggerTables: ["opportunities"],
      severity: "mandatory",
      message:
        "PREFER THE MATVIEW FOR AGGREGATES: For any SUM/AVG/COUNT/GROUP BY on opportunities that answers a 'how much bookings/pipeline/revenue/take' question — especially anything rep-scoped or category-scoped — route to district_opportunity_actuals instead of aggregating raw opportunities. The matview bakes in four things raw opportunities queries LACK: (1) text-stage closed-won detection (raw numeric-only stage logic misses every closed-won deal since LMS doesn't actually emit numeric 6+ stages — closed-won is text-only: 'closed won', 'active', 'position purchased', 'requisition received', 'return position pending'), (2) chain-deduplicated min_purchase_bookings, (3) EK12 subscription revenue fold-in into total_revenue and completed_revenue, (4) a one-off rep reassignment for mixed-rep 'Anurag' contracts. Raw opportunities queries silently produce wrong answers for these aggregates. Raw opportunities is correct ONLY for per-deal questions (SELECT by id or name, list with LIMIT, filter by a specific stage, count of distinct deals).",
    },
  ],
  excludedTables: [
    // Permanently excluded — admin/ops tables, attachments/notes, the query
    // tool's own persistence, OAuth/PII, deprecated modules, and data the
    // query tool shouldn't surface.
    "CalendarEvent",
    "activity_attachments",
    "activity_notes",
    "audit_log",
    "data_refresh_logs",
    "district_news_fetch",
    "initiative_metrics",
    "initiative_scores",
    "initiative_tier_thresholds",
    "initiatives",
    "map_views",
    "metric_registry",
    "news_ingest_runs",
    "news_match_queue",
    "opportunity_snapshots",
    "report_drafts",
    "unmatched_accounts",
    "unmatched_opportunities",
    "user_integrations",
    "vacancy_keyword_config",
    "vacancy_scans",
  ],
};

/** Format fiscal year string for queries — vendor_financials uses 'FY' prefix */
export function formatFiscalYear(year: number | string): string {
  const numStr = String(year).replace(/^FY/, "");
  return `FY${numStr.padStart(2, "0")}`;
}
