"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";
import type { MapVacancyProperties } from "@/features/shared/types/api-types";

interface VacancyDetailData {
  id: string;
  title: string;
  category: string | null;
  status: string;
  schoolName: string | null;
  districtName: string | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  datePosted: string | null;
  startDate: string | null;
  fullmindRelevant: boolean;
  sourceUrl: string | null;
  matchedServiceLine: string | null;
  leaid: string;
}

interface VacancyDetailProps {
  vacancyId: string;
}

/** Format a date string for display. */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Compute days since a date. */
function daysOpen(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const posted = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - posted.getTime()) / 86400000));
}

/** Status badge color mapping. */
function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "open":
      return { bg: "#F7FFF2", text: "#69B34A" };
    case "closed":
      return { bg: "#F7F5FA", text: "#8A80A8" };
    case "expired":
      return { bg: "#fef1f0", text: "#F37167" };
    default:
      return { bg: "#F7F5FA", text: "#8A80A8" };
  }
}

/** Category badge color. */
function categoryColor(category: string | null): { bg: string; text: string } {
  switch (category) {
    case "SPED":
      return { bg: "#e8f1f5", text: "#6EA3BE" };
    case "ELL":
      return { bg: "#fffaf1", text: "#FFCF70" };
    default:
      return { bg: "#F7F5FA", text: "#8A80A8" };
  }
}

export default function VacancyDetail({ vacancyId }: VacancyDetailProps) {
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  // Fetch vacancy detail via the existing district vacancy endpoint
  // For now we look up the vacancy from the map features — the right panel receives
  // props from the clicked feature's properties, so we can render directly.
  // If a dedicated /api/vacancies/:id endpoint exists, we'd use it here.
  // For v1, we pass-through the feature properties.

  const days = daysOpen(null); // Will be calculated from the properties passed in

  // Since VacancyDetail is opened from pin click, the store should have the data
  // For a proper detail view, let's try to fetch from district vacancies
  const { data, isLoading } = useQuery({
    queryKey: ["vacancyDetail", vacancyId],
    queryFn: async () => {
      // Try direct vacancy fetch first
      try {
        return await fetchJson<VacancyDetailData>(`${API_BASE}/vacancies/${encodeURIComponent(vacancyId)}`);
      } catch {
        return null;
      }
    },
    enabled: !!vacancyId,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-xs text-[#A69DC0]">
        Vacancy not found
      </div>
    );
  }

  const status = statusColor(data.status);
  const catColor = categoryColor(data.category);
  const computedDays = daysOpen(data.datePosted);

  const infoRows: { label: string; value: React.ReactNode }[] = [];

  if (data.schoolName) {
    infoRows.push({
      label: "School",
      value: <span className="text-xs text-[#6E6390]">{data.schoolName}</span>,
    });
  }

  if (data.districtName) {
    infoRows.push({
      label: "District",
      value: <span className="text-xs text-[#6E6390]">{data.districtName}</span>,
    });
  }

  if (data.hiringManager) {
    infoRows.push({
      label: "Hiring Manager",
      value: <span className="text-xs text-[#6E6390]">{data.hiringManager}</span>,
    });
  }

  if (data.hiringEmail) {
    infoRows.push({
      label: "Email",
      value: (
        <a
          href={`mailto:${data.hiringEmail}`}
          className="text-xs text-steel-blue hover:underline break-all"
        >
          {data.hiringEmail}
        </a>
      ),
    });
  }

  infoRows.push({
    label: "Date Posted",
    value: <span className="text-xs text-[#6E6390]">{formatDate(data.datePosted)}</span>,
  });

  if (computedDays !== null) {
    infoRows.push({
      label: "Days Open",
      value: (
        <span className={`text-xs font-medium ${computedDays > 30 ? "text-[#F37167]" : "text-[#6E6390]"}`}>
          {computedDays} days
        </span>
      ),
    });
  }

  return (
    <div className="space-y-4">
      {/* Title + badges */}
      <div>
        <h3 className="text-sm font-semibold text-[#403770] leading-snug">
          {data.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1.5">
          {/* Status badge */}
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {data.status}
          </span>
          {/* Category badge */}
          {data.category && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
              style={{ backgroundColor: catColor.bg, color: catColor.text }}
            >
              {data.category}
            </span>
          )}
          {/* Relevance flag */}
          {data.fullmindRelevant && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#F7FFF2] text-[#69B34A] text-[9px] font-semibold">
              Relevant
            </span>
          )}
        </div>
      </div>

      {/* Info rows */}
      {infoRows.length > 0 && (
        <div className="space-y-2">
          {infoRows.map((row) => (
            <div key={row.label}>
              <div className="text-[9px] font-medium text-[#A69DC0] uppercase tracking-wider mb-0.5">
                {row.label}
              </div>
              {row.value}
            </div>
          ))}
        </div>
      )}

      {/* Source URL */}
      {data.sourceUrl && (
        <div>
          <div className="text-[9px] font-medium text-[#A69DC0] uppercase tracking-wider mb-0.5">
            Source
          </div>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-steel-blue hover:underline flex items-center gap-1"
          >
            View listing
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <path
                d="M4 2H2V10H10V8M7 2H10V5M10 2L5 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-1.5 pt-1 border-t border-[#E2DEEC]">
        <button
          onClick={() => openRightPanel({ type: "vacancy_form", id: vacancyId })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-[#F7F5FA] transition-colors text-xs font-medium text-[#6E6390]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#A69DC0]">
            <path
              d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit Vacancy
        </button>
        <button
          onClick={() => openRightPanel({ type: "task_form", id: data.leaid })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-[#F7F5FA] transition-colors text-xs font-medium text-[#6E6390]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#A69DC0]">
            <path
              d="M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Add Task
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="h-4 bg-[#E2DEEC] rounded w-3/4 animate-pulse" />
        <div className="flex gap-1.5">
          <div className="h-4 w-12 bg-[#E2DEEC] rounded-full animate-pulse" />
          <div className="h-4 w-16 bg-[#E2DEEC] rounded-full animate-pulse" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-2 bg-[#F7F5FA] rounded w-12 mb-1 animate-pulse" />
            <div className="h-3 bg-[#F7F5FA] rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-9 bg-[#F7F5FA] rounded-xl animate-pulse" />
    </div>
  );
}
