"use client";

import { useState, useMemo } from "react";
import { usePlanVacancies } from "@/features/vacancies/lib/queries";
import type { PlanVacancyItem } from "@/features/vacancies/lib/queries";

// ─── Helpers ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  SPED: { bg: "#F37167", text: "#FFFFFF" },
  ELL: { bg: "#6EA3BE", text: "#FFFFFF" },
  "General Ed": { bg: "#403770", text: "#FFFFFF" },
  Admin: { bg: "#5C4E8C", text: "#FFFFFF" },
  Specialist: { bg: "#8AA891", text: "#FFFFFF" },
  Counseling: { bg: "#C4E7E6", text: "#403770" },
  "Related Services": { bg: "#A69DC0", text: "#FFFFFF" },
  Other: { bg: "#E8E5F0", text: "#403770" },
};

function getCategoryColor(category: string | null) {
  if (!category) return CATEGORY_COLORS["Other"];
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Other"];
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 0) return "upcoming";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    return `${w} week${w !== 1 ? "s" : ""} ago`;
  }
  if (diffDays < 365) {
    const m = Math.floor(diffDays / 30);
    return `${m} month${m !== 1 ? "s" : ""} ago`;
  }
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DistrictGroup {
  districtName: string;
  districtLeaid: string;
  vacancies: PlanVacancyItem[];
  relevantCount: number;
  categories: string[];
}

// ─── Main Component ─────────────────────────────────────────────

interface PlanVacanciesTabProps {
  planId: string;
}

export default function PlanVacanciesTab({ planId }: PlanVacanciesTabProps) {
  const { data, isLoading } = usePlanVacancies(planId);
  const vacancies = data?.vacancies ?? [];
  const summary = data?.summary;
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [expandedVacancy, setExpandedVacancy] = useState<string | null>(null);

  const districtGroups = useMemo(() => {
    const map = new Map<string, DistrictGroup>();
    for (const v of vacancies) {
      let group = map.get(v.districtLeaid);
      if (!group) {
        group = {
          districtName: v.districtName,
          districtLeaid: v.districtLeaid,
          vacancies: [],
          relevantCount: 0,
          categories: [],
        };
        map.set(v.districtLeaid, group);
      }
      group.vacancies.push(v);
      if (v.fullmindRelevant) group.relevantCount++;
    }
    // Sort categories and compute unique list
    for (const group of map.values()) {
      const cats = new Set(group.vacancies.map((v) => v.category ?? "Other"));
      group.categories = [...cats].sort();
    }
    // Sort by district name
    return [...map.values()].sort((a, b) =>
      a.districtName.localeCompare(b.districtName)
    );
  }, [vacancies]);

  if (isLoading) {
    return (
      <div className="p-5 space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#f0edf5] rounded-lg" />
        ))}
      </div>
    );
  }

  if (vacancies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No vacancies</p>
        <p className="text-xs text-[#A69DC0] mt-1">
          No open positions found across districts in this plan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section label */}
      <div className="shrink-0 px-5 pt-2.5 pb-1.5 flex items-baseline justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">
          Open Positions
        </span>
        <span className="text-[9px] text-[#C2BBD4]">
          Click district to expand · Click vacancy for details
        </span>
      </div>

      {/* Table header */}
      <div className="shrink-0 border-y border-[#E2DEEC] bg-[#FAFAFE]">
        <div className="grid grid-cols-[1fr_80px_60px_80px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
          <span>District</span>
          <span className="text-center">Positions</span>
          <span className="text-center">Relevant</span>
          <span className="text-right">Categories</span>
        </div>
      </div>

      {/* District groups */}
      <div className="flex-1 overflow-y-auto">
        {districtGroups.map((group) => {
          const isExpanded = expandedDistrict === group.districtLeaid;
          return (
            <DistrictGroupRow
              key={group.districtLeaid}
              group={group}
              isExpanded={isExpanded}
              onToggle={() =>
                setExpandedDistrict((prev) =>
                  prev === group.districtLeaid ? null : group.districtLeaid
                )
              }
              expandedVacancy={expandedVacancy}
              onToggleVacancy={(id) =>
                setExpandedVacancy((prev) => (prev === id ? null : id))
              }
            />
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        <span className="text-[11px] text-[#A69DC0]">
          {vacancies.length} vacanc{vacancies.length !== 1 ? "ies" : "y"}
          {" across "}
          {districtGroups.length} district{districtGroups.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-[#A69DC0]">
          Relevant: <span className="font-semibold text-[#544A78]">{summary?.fullmindRelevant ?? 0}</span>
          {" · "}
          Categories: <span className="font-semibold text-[#544A78]">{Object.keys(summary?.byCategory ?? {}).length}</span>
        </span>
      </div>
    </div>
  );
}

// ─── District Group Row ─────────────────────────────────────────

function DistrictGroupRow({
  group,
  isExpanded,
  onToggle,
  expandedVacancy,
  onToggleVacancy,
}: {
  group: DistrictGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedVacancy: string | null;
  onToggleVacancy: (id: string) => void;
}) {
  // Group vacancies by category within this district
  const categoryGroups = useMemo(() => {
    const map = new Map<string, PlanVacancyItem[]>();
    for (const v of group.vacancies) {
      const cat = v.category ?? "Other";
      const list = map.get(cat) ?? [];
      list.push(v);
      map.set(cat, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [group.vacancies]);

  return (
    <div className={`${isExpanded ? "border-b-2 border-[#E2DEEC]" : "border-b border-[#f0edf5]"} last:border-b-0`}>
      {/* District header row */}
      <div
        className={`grid grid-cols-[1fr_80px_60px_80px] items-center px-5 py-2.5 cursor-pointer transition-colors ${
          isExpanded ? "bg-[#FAFAFE] border-b border-[#E2DEEC]" : "hover:bg-[#FAFAFE]"
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
          >
            <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth={isExpanded ? "1.5" : "1.2"} fill="none" strokeLinecap="round" />
          </svg>
          <span className={`text-xs truncate ${isExpanded ? "font-semibold text-[#403770]" : "font-medium text-[#544A78]"}`}>
            {group.districtName}
          </span>
        </div>

        <span className="text-xs text-center tabular-nums font-semibold text-[#544A78]">
          {group.vacancies.length}
        </span>

        <span className="text-xs text-center tabular-nums">
          {group.relevantCount > 0 ? (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#EFF5F0] text-[#5a7a61]">
              {group.relevantCount}
            </span>
          ) : (
            <span className="text-[#C2BBD4]">—</span>
          )}
        </span>

        <div className="flex justify-end gap-0.5 flex-wrap">
          {group.categories.slice(0, 3).map((cat) => {
            const color = getCategoryColor(cat);
            return (
              <span
                key={cat}
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color.bg }}
                title={cat}
              />
            );
          })}
          {group.categories.length > 3 && (
            <span className="text-[8px] text-[#A69DC0]">+{group.categories.length - 3}</span>
          )}
        </div>
      </div>

      {/* Expanded: vacancies grouped by category */}
      {isExpanded && (
        <div className="bg-[#FAFAFE]">
          {categoryGroups.map(([category, items]) => {
            const color = getCategoryColor(category);
            return (
              <div key={category} className="pl-6 pr-5">
                {/* Category sub-header */}
                <div className="flex items-center gap-2 py-2 border-b border-[#f0edf5]">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {category}
                  </span>
                  <span className="text-[10px] text-[#A69DC0]">
                    {items.length} position{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Vacancy rows */}
                {items.map((vacancy) => (
                  <VacancyRow
                    key={vacancy.id}
                    vacancy={vacancy}
                    isExpanded={expandedVacancy === vacancy.id}
                    onToggle={() => onToggleVacancy(vacancy.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Vacancy Row ────────────────────────────────────────────────

function VacancyRow({
  vacancy,
  isExpanded,
  onToggle,
}: {
  vacancy: PlanVacancyItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`border-b border-[#f0edf5] last:border-b-0 ${isExpanded ? "bg-white" : ""}`}>
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-white transition-colors"
        onClick={onToggle}
      >
        <svg
          width="7"
          height="7"
          viewBox="0 0 8 8"
          className={`shrink-0 transition-transform ${isExpanded ? "rotate-90 text-[#403770]" : "text-[#C2BBD4]"}`}
        >
          <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>

        <span className="text-[11px] font-medium text-[#544A78] truncate flex-1 min-w-0">
          {vacancy.title}
        </span>

        {vacancy.fullmindRelevant && (
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-[#EFF5F0] text-[#5a7a61]">
            Relevant
          </span>
        )}

        <span className="shrink-0 text-[10px] text-[#A69DC0] tabular-nums">
          {formatRelativeDate(vacancy.datePosted)}
        </span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-5 pb-3 pt-1 ml-4 space-y-2.5">
          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <DetailField label="Title" value={vacancy.title} />
            <DetailField label="Status" value={vacancy.status} />
            <DetailField label="School" value={vacancy.schoolName} />
            <DetailField label="Posted" value={formatDate(vacancy.datePosted)} />
            <DetailField label="Hiring Manager" value={vacancy.hiringManager} />
            <DetailField
              label="Days Open"
              value={vacancy.daysOpen != null ? `${vacancy.daysOpen} days` : null}
            />
            <DetailField label="Email" value={vacancy.hiringEmail} isEmail />
            <DetailField label="Start Date" value={formatDate(vacancy.startDate)} />
          </div>

          {/* Relevance reason */}
          {vacancy.relevanceReason && (
            <div className="pt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">
                Why Relevant
              </span>
              <p className="text-[11px] text-[#6E6390] mt-0.5 leading-relaxed">
                {vacancy.relevanceReason}
              </p>
            </div>
          )}

          {/* Source link */}
          {vacancy.sourceUrl && (
            <a
              href={vacancy.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6EA3BE] hover:text-[#3D5A80] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M5 1H2.5C1.67 1 1 1.67 1 2.5V9.5C1 10.33 1.67 11 2.5 11H9.5C10.33 11 11 10.33 11 9.5V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                <path d="M7 1H11V5M11 1L5.5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              View original posting
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail Field ───────────────────────────────────────────────

function DetailField({
  label,
  value,
  isEmail,
}: {
  label: string;
  value: string | null | undefined;
  isEmail?: boolean;
}) {
  const display = value && value !== "—" ? value : null;
  return (
    <div className="min-w-0">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#A69DC0]">
        {label}
      </span>
      {display ? (
        isEmail ? (
          <a
            href={`mailto:${display}`}
            className="block text-[11px] text-[#6EA3BE] hover:text-[#3D5A80] truncate transition-colors"
          >
            {display}
          </a>
        ) : (
          <p className="text-[11px] text-[#544A78] truncate">{display}</p>
        )
      ) : (
        <p className="text-[11px] text-[#C2BBD4]">—</p>
      )}
    </div>
  );
}
