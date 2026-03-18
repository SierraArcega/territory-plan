"use client";

// VacanciesTable - Plan-level vacancy table showing open positions across all districts
// Features: Sortable columns, category badges, relative date display, relevance indicator

import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";

export interface PlanVacancy {
  id: string;
  title: string;
  category: string | null;
  status: string;
  districtName: string;
  districtLeaid: string;
  schoolName: string | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  startDate: string | null;
  datePosted: string | null;
  daysOpen: number | null;
  fullmindRelevant: boolean;
  relevanceReason: string | null;
  sourceUrl: string | null;
}

interface VacanciesTableProps {
  vacancies: PlanVacancy[];
  onDistrictClick?: (leaid: string) => void;
}

// Category badge color mapping using brand palette
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "SPED":             { bg: "#F37167", text: "#FFFFFF" },     // coral
  "ELL":              { bg: "#6EA3BE", text: "#FFFFFF" },     // steel blue
  "General Ed":       { bg: "#403770", text: "#FFFFFF" },     // plum
  "Admin":            { bg: "#5C4E8C", text: "#FFFFFF" },     // light plum
  "Specialist":       { bg: "#8AA891", text: "#FFFFFF" },     // sage
  "Counseling":       { bg: "#C4E7E6", text: "#403770" },     // robin's egg
  "Related Services": { bg: "#A69DC0", text: "#FFFFFF" },     // muted plum
  "Other":            { bg: "#E8E5F0", text: "#403770" },     // faint plum
};

function getCategoryColor(category: string | null) {
  if (!category) return CATEGORY_COLORS["Other"];
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"];
}

// Format a date string as a relative time like "3 days ago"
function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "upcoming";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }
  return `${Math.floor(diffDays / 365)}y ago`;
}

// Custom comparators for fields that need special handling
const vacancyComparators: Record<string, SortComparator<PlanVacancy>> = {
  datePosted: (a, b, dir) => {
    const aVal = a.datePosted ? new Date(a.datePosted).getTime() : null;
    const bVal = b.datePosted ? new Date(b.datePosted).getTime() : null;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
  fullmindRelevant: (a, b, dir) => {
    const aVal = a.fullmindRelevant ? 1 : 0;
    const bVal = b.fullmindRelevant ? 1 : 0;
    return dir === "desc" ? bVal - aVal : aVal - bVal;
  },
};

export default function VacanciesTable({
  vacancies,
  onDistrictClick,
}: VacanciesTableProps) {
  const { sorted: sortedVacancies, sortState, onSort } = useSortableTable<PlanVacancy>({
    data: vacancies,
    defaultField: "datePosted",
    defaultDir: "desc",
    comparators: vacancyComparators,
  });

  // Empty state
  if (vacancies.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#C4E7E6]/40 flex items-center justify-center">
          <svg className="w-7 h-7 text-[#6EA3BE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[#403770] mb-1">No vacancies found</h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Run a vacancy scan on your districts to discover open positions. Vacancies will appear here once scanned.
        </p>
      </div>
    );
  }

  // Summary counts
  const fullmindRelevantCount = vacancies.filter((v) => v.fullmindRelevant).length;
  const categorySet = new Set(vacancies.map((v) => v.category || "Other"));

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          {/* Header */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <SortHeader field="title" label="Title" sortState={sortState} onSort={onSort} className="px-4" />
              <SortHeader field="districtName" label="District" sortState={sortState} onSort={onSort} className="px-4" />
              <SortHeader field="category" label="Category" sortState={sortState} onSort={onSort} className="px-4" />
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                School
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <SortHeader field="datePosted" label="Posted" sortState={sortState} onSort={onSort} className="px-4" />
              <SortHeader field="fullmindRelevant" label="Relevant" sortState={sortState} onSort={onSort} className="px-4" />
            </tr>
          </thead>

          {/* Rows */}
          <tbody>
            {sortedVacancies.map((vacancy, idx) => {
              const isLast = idx === sortedVacancies.length - 1;
              const catColor = getCategoryColor(vacancy.category);

              return (
                <tr
                  key={vacancy.id}
                  className={`group transition-colors duration-100 hover:bg-gray-50/70 ${!isLast ? "border-b border-gray-100" : ""}`}
                >
                  {/* Title */}
                  <td className="px-4 py-3">
                    {vacancy.sourceUrl ? (
                      <a
                        href={vacancy.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[#403770] hover:text-[#6EA3BE] transition-colors"
                        title={vacancy.title}
                      >
                        <span className="line-clamp-1">{vacancy.title}</span>
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-[#403770] line-clamp-1" title={vacancy.title}>
                        {vacancy.title}
                      </span>
                    )}
                  </td>

                  {/* District */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDistrictClick?.(vacancy.districtLeaid)}
                      className="text-[13px] text-[#403770]/80 hover:text-[#403770] transition-colors truncate max-w-[180px] block text-left"
                    >
                      {vacancy.districtName}
                    </button>
                  </td>

                  {/* Category badge */}
                  <td className="px-4 py-3">
                    {vacancy.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap"
                        style={{ backgroundColor: catColor.bg, color: catColor.text }}
                      >
                        {vacancy.category}
                      </span>
                    ) : (
                      <span className="text-[13px] text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* School */}
                  <td className="px-4 py-3">
                    {vacancy.schoolName ? (
                      <span className="text-[13px] text-[#403770]/70 truncate max-w-[180px] block">
                        {vacancy.schoolName}
                      </span>
                    ) : (
                      <span className="text-[13px] text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3">
                    {vacancy.hiringManager ? (
                      <div className="min-w-0">
                        <span className="text-[13px] text-[#403770]/80 block truncate max-w-[160px]">
                          {vacancy.hiringManager}
                        </span>
                        {vacancy.hiringEmail && (
                          <a
                            href={`mailto:${vacancy.hiringEmail}`}
                            className="text-[11px] text-[#6EA3BE] hover:text-[#403770] transition-colors truncate max-w-[160px] block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {vacancy.hiringEmail}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-300">&mdash;</span>
                    )}
                  </td>

                  {/* Posted (relative date) */}
                  <td className="px-4 py-3">
                    <span
                      className="text-[13px] text-[#403770]/60 whitespace-nowrap"
                      title={vacancy.datePosted ? new Date(vacancy.datePosted).toLocaleDateString() : undefined}
                    >
                      {formatRelativeDate(vacancy.datePosted)}
                    </span>
                  </td>

                  {/* Relevant */}
                  <td className="px-4 py-3">
                    {vacancy.fullmindRelevant ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-[#F37167]/15 text-[#F37167]"
                        title={vacancy.relevanceReason || "Fullmind relevant"}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Yes
                      </span>
                    ) : (
                      <span className="text-[13px] text-gray-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-400 tracking-wide">
          {vacancies.length} vacanc{vacancies.length !== 1 ? "ies" : "y"}
        </span>
        <div className="flex gap-4 text-[12px] text-gray-400">
          <span>
            Relevant: <span className="font-medium text-[#F37167]">{fullmindRelevantCount}</span>
          </span>
          <span>
            Categories: <span className="font-medium text-gray-500">{categorySet.size}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
