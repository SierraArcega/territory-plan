"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";
import RangeFilter, { formatCompact } from "./controls/RangeFilter";
import ToggleChips from "./controls/ToggleChips";
import FilterMultiSelect from "./controls/FilterMultiSelect";

// Domain column sets for counting active filters per section
const SECTION_COLUMNS: Record<string, Set<string>> = {
  attributes: new Set([
    "urbanicity", "charterSchoolCount", "titleISchoolCount",
  ]),
  fullmind: new Set([
    "isCustomer", "hasOpenPipeline", "salesExecutive", "owner",
    "open_pipeline", "closed_won_bookings", "invoicing",
    "tags",
  ]),
  competitors: new Set([
    "competitor_proximity", "competitor_elevate", "competitor_tbt", "competitor_educere",
    "competitorEngagement", "competitorChurned",
  ]),
  finance: new Set([
    "expenditurePerPupil", "totalRevenue", "federalRevenue", "stateRevenue", "localRevenue",
    "techSpending", "titleIRevenue", "esserFundingTotal", "capitalOutlayTotal", "debtOutstanding",
  ]),
  demographics: new Set([
    "enrollment", "ell_percent", "sped_percent", "free_lunch_percent",
    "medianHouseholdIncome", "enrollmentTrend3yr",
  ]),
  academics: new Set([
    "graduationRate", "mathProficiency", "readProficiency", "chronicAbsenteeismRate",
    "studentTeacherRatio", "teachersFte", "spedExpenditurePerStudent",
  ]),
};

function countSectionFilters(filters: ExploreFilter[], section: string): number {
  const cols = SECTION_COLUMNS[section];
  if (!cols) return 0;
  // Also match FY-prefixed columns for fullmind
  return filters.filter((f) => {
    if (cols.has(f.column)) return true;
    return false;
  }).length;
}

const COMPETITOR_VENDORS = [
  { id: "proximity", label: "Proximity Learning" },
  { id: "elevate", label: "Elevate K-12" },
  { id: "tbt", label: "TBT (Teach by Tech)" },
  { id: "educere", label: "Educere" },
];

interface DistrictsDropdownProps {
  onClose: () => void;
}

type SectionKey = "attributes" | "fullmind" | "competitors" | "finance" | "demographics" | "academics";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "attributes", label: "District Attributes" },
  { key: "fullmind", label: "Fullmind" },
  { key: "competitors", label: "Competitors" },
  { key: "finance", label: "Finance" },
  { key: "demographics", label: "Demographics" },
  { key: "academics", label: "Academics" },
];

export default function DistrictsDropdown({ onClose }: DistrictsDropdownProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const updateSearchFilter = useMapV2Store((s) => s.updateSearchFilter);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);
  const selectedFY = useMapV2Store((s) => s.selectedFiscalYear);
  const ref = useRef<HTMLDivElement>(null);

  // Collapsible section state — start with first section open
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(["fullmind"]));

  // Fullmind data
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/sales-executives")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOwners((data || []).map((d: { id: string; fullName: string | null; email: string }) => ({ id: d.id, name: d.fullName || d.email }))))
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Allow up to 2 sections open at once
        if (next.size >= 2) {
          // Close the first one that was opened
          const first = next.values().next().value;
          if (first) next.delete(first);
        }
        next.add(key);
      }
      return next;
    });
  };

  const addFilter = (column: string, op: string, value: any, label?: string) => {
    addSearchFilter({ id: crypto.randomUUID(), column, op: op as any, value, ...(label && { label }) });
  };

  const handleRangeApply = (column: string, min: number, max: number) => {
    const existing = searchFilters.find((f) => f.column === column && f.op === "between");
    if (existing) {
      updateSearchFilter(existing.id, { value: [min, max] });
    } else {
      addSearchFilter({ id: crypto.randomUUID(), column, op: "between", value: [min, max] });
    }
  };

  const handleFinancialRangeApply = (column: string, min: number, max: number, fy: string) => {
    const existing = searchFilters.find((f) => f.column === column && f.op === "between");
    if (existing) {
      updateSearchFilter(existing.id, { value: [min, max], fy });
    } else {
      addSearchFilter({ id: crypto.randomUUID(), column, op: "between", value: [min, max], fy });
    }
  };

  const getExistingFilter = (column: string) =>
    searchFilters.find((f) => f.column === column && f.op === "is_not_empty");

  return (
    <div
      ref={ref}
      className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] min-w-[360px] w-[380px] max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-white z-10 border-b border-[#E2DEEC]">
        <h3 className="text-sm font-semibold text-[#544A78]">District Filters</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Collapsible sections */}
      <div className="py-1">
        {SECTIONS.map(({ key, label }) => {
          const isOpen = openSections.has(key);
          const filterCount = countSectionFilters(searchFilters, key);

          return (
            <div key={key} className="border-b border-[#E2DEEC] last:border-b-0">
              {/* Section header */}
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F5FA] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-3 h-3 text-[#8A80A8] transition-transform ${isOpen ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-[#544A78]">{label}</span>
                  {filterCount > 0 && (
                    <span className="rounded-full text-[9px] font-bold flex items-center justify-center leading-none min-w-[16px] h-4 px-1 bg-plum text-white">
                      {filterCount}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-3 h-3 text-[#A69DC0] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Section content */}
              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-3">
                  {key === "attributes" && <DistrictAttributesContent addFilter={addFilter} />}
                  {key === "fullmind" && <FullmindContent addFilter={addFilter} handleFinancialRangeApply={handleFinancialRangeApply} defaultFy={selectedFY} owners={owners} tags={tags} />}
                  {key === "competitors" && <CompetitorsContent addFilter={addFilter} getExistingFilter={getExistingFilter} removeSearchFilter={removeSearchFilter} />}
                  {key === "finance" && <FinanceContent handleRangeApply={handleRangeApply} />}
                  {key === "demographics" && <DemographicsContent handleRangeApply={handleRangeApply} />}
                  {key === "academics" && <AcademicsContent handleRangeApply={handleRangeApply} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section content components ─── */

function DistrictAttributesContent({ addFilter }: { addFilter: (column: string, op: string, value: any, label?: string) => void }) {
  return (
    <>
      <ToggleChips
        label="Urbanicity"
        options={[
          { label: "City", column: "urbanicity", op: "in", value: ["11", "12", "13"] },
          { label: "Suburb", column: "urbanicity", op: "in", value: ["21", "22", "23"] },
          { label: "Town", column: "urbanicity", op: "in", value: ["31", "32", "33"] },
          { label: "Rural", column: "urbanicity", op: "in", value: ["41", "42", "43"] },
        ]}
        onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
      />

      <ToggleChips
        label="District Type"
        options={[
          { label: "Has Charter Schools", column: "charterSchoolCount", op: "gte", value: 1 },
          { label: "Has Title I Schools", column: "titleISchoolCount", op: "gte", value: 1 },
        ]}
        onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
      />
    </>
  );
}

/** Financial range filter with per-filter FY picker */
function FinancialRangeFilter({
  label,
  column,
  defaultFy,
  min,
  max,
  step,
  formatValue,
  onApply,
}: {
  label: string;
  column: string;
  defaultFy: string;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  onApply: (column: string, min: number, max: number, fy: string) => void;
}) {
  const [fy, setFy] = useState(defaultFy);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-[#8A80A8]">{label}</span>
        <select
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          className="px-1 py-0.5 text-[10px] font-semibold rounded border border-[#D4CFE2] bg-white text-[#544A78] focus:outline-none focus:ring-1 focus:ring-plum/30"
        >
          {(["fy25", "fy26", "fy27"] as const).map((f) => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <RangeFilter
        label=""
        column={column}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
        onApply={(col, lo, hi) => onApply(col, lo, hi, fy)}
      />
    </div>
  );
}

function FullmindContent({
  addFilter,
  handleFinancialRangeApply,
  defaultFy,
  owners,
  tags,
}: {
  addFilter: (column: string, op: string, value: any, label?: string) => void;
  handleFinancialRangeApply: (column: string, min: number, max: number, fy: string) => void;
  defaultFy: string;
  owners: { id: string; name: string }[];
  tags: Array<{ id: string; name: string }>;
}) {
  return (
    <>
      <ToggleChips
        label="Customer Status"
        options={[
          { label: "Customer", column: "isCustomer", op: "is_true", value: true },
          { label: "Prospect", column: "isCustomer", op: "is_false", value: false },
        ]}
        onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
      />

      <ToggleChips
        label="Has Open Pipeline"
        options={[
          { label: "Yes", column: "hasOpenPipeline", op: "is_true", value: true },
          { label: "No", column: "hasOpenPipeline", op: "is_false", value: false },
        ]}
        onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
      />

      {owners.length > 0 && (
        <FilterMultiSelect
          label="Sales Executive"
          column="salesExecutive"
          options={owners.map((o) => ({ value: o.id, label: o.name }))}
          onApply={(col, vals) => {
            const names = vals.map((v) => owners.find((o) => o.id === v)?.name ?? v);
            addFilter(col, "in", vals, names.join(", "));
          }}
        />
      )}

      <FinancialRangeFilter label="Pipeline" column="open_pipeline" defaultFy={defaultFy} min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleFinancialRangeApply} />
      <FinancialRangeFilter label="Bookings" column="closed_won_bookings" defaultFy={defaultFy} min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleFinancialRangeApply} />
      <FinancialRangeFilter label="Invoicing" column="invoicing" defaultFy={defaultFy} min={0} max={500000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleFinancialRangeApply} />

      {tags.length > 0 && (
        <FilterMultiSelect
          label="Tags"
          column="tags"
          options={tags.map((t) => ({ value: t.name, label: t.name }))}
          onApply={(col, vals) => addFilter(col, "eq", vals)}
        />
      )}
    </>
  );
}

function CompetitorsContent({
  addFilter,
  getExistingFilter,
  removeSearchFilter,
}: {
  addFilter: (column: string, op: string, value: any) => void;
  getExistingFilter: (column: string) => ExploreFilter | undefined;
  removeSearchFilter: (id: string) => void;
}) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">Has Competitor</label>
        <div className="space-y-1.5">
          {COMPETITOR_VENDORS.map((v) => {
            const column = `competitor_${v.id}`;
            const existing = getExistingFilter(column);
            return (
              <label key={v.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${existing ? "bg-plum/5" : "hover:bg-[#EFEDF5]"}`}>
                <input
                  type="checkbox"
                  checked={!!existing}
                  onChange={() => {
                    if (existing) {
                      removeSearchFilter(existing.id);
                    } else {
                      addFilter(column, "is_not_empty", true);
                    }
                  }}
                  className="w-4 h-4 rounded border-[#C2BBD4] text-plum focus:ring-plum/30"
                />
                <span className="text-sm text-[#544A78]">{v.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <ToggleChips
        label="Competitor Engagement"
        options={[
          { label: "Any Active", column: "competitorEngagement", op: "is_not_empty", value: true },
          { label: "Churned", column: "competitorChurned", op: "is_true", value: true },
        ]}
        onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
      />
    </>
  );
}

function FinanceContent({ handleRangeApply }: { handleRangeApply: (column: string, min: number, max: number) => void }) {
  return (
    <>
      <RangeFilter label="Expenditure / Pupil" column="expenditurePerPupil" min={0} max={50000} step={500} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Total Revenue" column="totalRevenue" min={0} max={2000000000} step={10000000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Federal Revenue" column="federalRevenue" min={0} max={500000000} step={5000000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="State Revenue" column="stateRevenue" min={0} max={1000000000} step={10000000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Local Revenue" column="localRevenue" min={0} max={1000000000} step={10000000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Tech Spending" column="techSpending" min={0} max={50000000} step={500000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Title I Revenue" column="titleIRevenue" min={0} max={50000000} step={500000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="ESSER Funding" column="esserFundingTotal" min={0} max={100000000} step={1000000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
    </>
  );
}

function DemographicsContent({ handleRangeApply }: { handleRangeApply: (column: string, min: number, max: number) => void }) {
  return (
    <>
      <RangeFilter label="Enrollment" column="enrollment" min={0} max={200000} step={500} onApply={handleRangeApply} />
      <RangeFilter label="ELL %" column="ell_percent" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="SWD %" column="sped_percent" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Poverty %" column="free_lunch_percent" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Median Household Income" column="medianHouseholdIncome" min={0} max={250000} step={5000} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
      <RangeFilter label="Enrollment Trend (3yr)" column="enrollmentTrend3yr" min={-50} max={50} step={0.5} formatValue={(v) => `${v}%`} onApply={handleRangeApply} />
    </>
  );
}

function AcademicsContent({ handleRangeApply }: { handleRangeApply: (column: string, min: number, max: number) => void }) {
  return (
    <>
      <RangeFilter label="Graduation Rate %" column="graduationRate" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Math Proficiency %" column="mathProficiency" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Reading Proficiency %" column="readProficiency" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Chronic Absenteeism %" column="chronicAbsenteeismRate" min={0} max={100} step={1} onApply={handleRangeApply} />
      <RangeFilter label="Student-Teacher Ratio" column="studentTeacherRatio" min={0} max={50} step={0.5} onApply={handleRangeApply} />
      <RangeFilter label="Teacher FTE" column="teachersFte" min={0} max={10000} step={10} onApply={handleRangeApply} />
      <RangeFilter label="SPED Expenditure / Student" column="spedExpenditurePerStudent" min={0} max={50000} step={500} formatValue={(v) => `$${formatCompact(v)}`} onApply={handleRangeApply} />
    </>
  );
}
