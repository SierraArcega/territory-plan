"use client";

import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";

const COLUMN_LABELS: Record<string, string> = {
  // Geography
  state: "State",
  urbanicity: "Urbanicity",
  _zipRadius: "ZIP Radius",
  charterSchoolCount: "Charter Schools",
  titleISchoolCount: "Title I Schools",
  // Fullmind
  isCustomer: "Customer",
  hasOpenPipeline: "Pipeline",
  salesExecutive: "Sales Exec",
  owner: "Owner",
  fy26_open_pipeline_value: "FY26 Pipeline",
  fy26_closed_won_net_booking: "FY26 Bookings",
  fy26_net_invoicing: "FY26 Invoicing",
  // Finance
  expenditurePerPupil: "Expend/Pupil",
  totalRevenue: "Total Revenue",
  federalRevenue: "Federal Revenue",
  stateRevenue: "State Revenue",
  localRevenue: "Local Revenue",
  techSpending: "Tech Spending",
  titleIRevenue: "Title I",
  esserFundingTotal: "ESSER",
  capitalOutlayTotal: "Capital Outlay",
  debtOutstanding: "Debt",
  // Demographics
  enrollment: "Enrollment",
  ell_percent: "ELL %",
  sped_percent: "SWD %",
  free_lunch_percent: "Poverty %",
  medianHouseholdIncome: "Median Income",
  enrollmentTrend3yr: "Enroll Trend",
  // Academics
  graduationRate: "Grad Rate",
  mathProficiency: "Math Prof",
  readProficiency: "Read Prof",
  chronicAbsenteeismRate: "Absenteeism",
  studentTeacherRatio: "S:T Ratio",
  teachersFte: "Teachers FTE",
  spedExpenditurePerStudent: "SPED $/Student",
};

const MONEY_COLUMNS = new Set([
  "fy26_open_pipeline_value", "fy26_closed_won_net_booking", "fy26_net_invoicing",
  "expenditurePerPupil", "totalRevenue", "federalRevenue", "stateRevenue", "localRevenue",
  "techSpending", "titleIRevenue", "esserFundingTotal", "capitalOutlayTotal", "debtOutstanding",
  "medianHouseholdIncome", "spedExpenditurePerStudent",
]);

const PCT_COLUMNS = new Set([
  "ell_percent", "sped_percent", "free_lunch_percent",
  "graduationRate", "mathProficiency", "readProficiency", "chronicAbsenteeismRate",
]);

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

function formatFilterValue(f: ExploreFilter): string {
  // "Has charter/title I schools" shows as "Yes" instead of ">= 1"
  if (f.op === "gte" && f.value === 1 && (f.column === "charterSchoolCount" || f.column === "titleISchoolCount")) {
    return "Yes";
  }

  if (f.op === "is_true") return "Yes";
  if (f.op === "is_false") return "No";
  if (f.op === "is_empty") return "Empty";
  if (f.op === "is_not_empty") return "Not Empty";

  if (f.op === "between" && Array.isArray(f.value)) {
    const [min, max] = f.value as [number, number];
    if (MONEY_COLUMNS.has(f.column)) {
      return `${formatMoney(min)} – ${formatMoney(max)}`;
    }
    if (PCT_COLUMNS.has(f.column)) {
      return `${min}% – ${max}%`;
    }
    return `${min.toLocaleString()} – ${max.toLocaleString()}`;
  }

  if (f.op === "in" && Array.isArray(f.value)) {
    if (f.label) return f.label;
    if (f.column === "urbanicity") {
      const vals = f.value as string[];
      if (vals.every((v) => v.startsWith("1"))) return "City";
      if (vals.every((v) => v.startsWith("2"))) return "Suburb";
      if (vals.every((v) => v.startsWith("3"))) return "Town";
      if (vals.every((v) => v.startsWith("4"))) return "Rural";
      return vals.join(", ");
    }
    return (f.value as string[]).join(", ");
  }

  if (f.column === "_zipRadius" && f.value && typeof f.value === "object") {
    const zr = f.value as unknown as { zip: string; miles: number };
    return `${zr.zip} + ${zr.miles} mi`;
  }

  if (f.label) return f.label;

  if (f.op === "eq") return String(f.value);

  return String(f.value);
}

export default function FilterPills() {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);
  const clearSearchFilters = useMapV2Store((s) => s.clearSearchFilters);

  if (searchFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {searchFilters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e8f4f4] text-[#403770] border border-[#C4E7E6] text-xs font-medium shadow-sm"
        >
          <span className="text-[#403770]/60">{COLUMN_LABELS[f.column] || f.column}</span>
          <span>{formatFilterValue(f)}</span>
          <button
            onClick={() => removeSearchFilter(f.id)}
            className="ml-0.5 text-[#403770]/40 hover:text-[#403770] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {searchFilters.length > 1 && (
        <button
          onClick={clearSearchFilters}
          className="text-xs text-coral hover:text-coral/80 font-medium"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
