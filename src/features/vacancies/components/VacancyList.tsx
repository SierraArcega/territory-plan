"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────

interface VacancyRecord {
  id: string;
  title: string;
  category: string | null;
  status: string;
  schoolName: string | null;
  school: { ncessch: string; name: string } | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  contact: { id: string; name: string } | null;
  startDate: string | null;
  datePosted: string | null;
  daysOpen: number;
  fullmindRelevant: boolean;
  relevanceReason: string | null;
  sourceUrl: string | null;
}

interface VacancySummary {
  totalOpen: number;
  fullmindRelevant: number;
  byCategory: Record<string, number>;
  lastScannedAt: string | null;
}

interface VacanciesResponse {
  summary: VacancySummary;
  vacancies: VacancyRecord[];
}

export interface VacancyListProps {
  leaid: string;
  schoolNcessch?: string | null;
  highlightVacancyId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

function formatDaysOpen(days: number): string {
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Posted 1 week ago";
  if (weeks < 5) return `Posted ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "Posted 1 month ago";
  return `Posted ${months} months ago`;
}

// ─── Component ──────────────────────────────────────────────────────

export default function VacancyList({ leaid, schoolNcessch, highlightVacancyId }: VacancyListProps) {
  // Fetch vacancies
  const {
    data,
    isLoading,
    error,
  } = useQuery<VacanciesResponse>({
    queryKey: ["vacancies", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/vacancies`);
      if (!res.ok) throw new Error("Failed to fetch vacancies");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filter by school if provided
  const filteredVacancies = schoolNcessch
    ? (data?.vacancies ?? []).filter((v) => v.school?.ncessch === schoolNcessch)
    : (data?.vacancies ?? []);

  // Group vacancies by category
  const groupedByCategory = filteredVacancies.reduce<
    Record<string, VacancyRecord[]>
  >((acc, v) => {
    const cat = v.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {} as Record<string, VacancyRecord[]>);

  const categoryKeys = Object.keys(groupedByCategory).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  // ─── Loading state ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse space-y-1.5">
            <div className="h-4 bg-[#C4E7E6]/20 rounded w-3/4" />
            <div className="h-3 bg-[#C4E7E6]/15 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-sm text-red-400 py-2">
        Failed to load vacancies
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────
  if (!data || filteredVacancies.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          {schoolNcessch
            ? "No vacancies matched to this school"
            : data?.summary.lastScannedAt
              ? "No vacancies found"
              : "Not yet scanned"}
        </p>
        {data?.summary.lastScannedAt && (
          <LastScannedInfo lastScannedAt={data.summary.lastScannedAt} />
        )}
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────────
  const { summary } = data;

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-[#403770]">{filteredVacancies.length}</span>{" "}
        open position{filteredVacancies.length !== 1 ? "s" : ""}
        {(() => {
          const relevantCount = filteredVacancies.filter((v) => v.fullmindRelevant).length;
          return relevantCount > 0 ? (
            <>
              {" "}
              <span className="text-xs text-gray-400">(</span>
              <span className="font-semibold text-[#F37167]">{relevantCount}</span>
              <span className="text-xs text-gray-400"> Fullmind-relevant)</span>
            </>
          ) : null;
        })()}
        {schoolNcessch && data && filteredVacancies.length !== data.vacancies.length && (
          <span className="text-xs text-[#A69DC0] ml-1">
            (filtered from {data.vacancies.length} district-wide)
          </span>
        )}
      </div>

      {/* Grouped vacancy listings */}
      {categoryKeys.map((category) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            {category}
            <span className="ml-1 text-gray-400 normal-case">
              ({groupedByCategory[category].length})
            </span>
          </h4>
          <div className="space-y-2">
            {groupedByCategory[category].map((vacancy) => (
              <VacancyRow key={vacancy.id} vacancy={vacancy} isHighlighted={vacancy.id === highlightVacancyId} />
            ))}
          </div>
        </div>
      ))}

      {/* Last scanned info */}
      {summary.lastScannedAt && (
        <LastScannedInfo lastScannedAt={summary.lastScannedAt} />
      )}
    </div>
  );
}

// ─── VacancyRow ─────────────────────────────────────────────────────

function VacancyRow({ vacancy, isHighlighted }: { vacancy: VacancyRecord; isHighlighted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  const displaySchool =
    vacancy.school?.name || vacancy.schoolName || null;

  return (
    <div ref={ref} className={`rounded-lg p-2.5 space-y-1 ${isHighlighted ? "border-2 border-[#FFCF70] bg-[#FFCF70]/5" : "border border-gray-100"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#403770] leading-tight">
          {vacancy.sourceUrl ? (
            <a
              href={vacancy.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {vacancy.title}
            </a>
          ) : (
            vacancy.title
          )}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {vacancy.category && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#403770]/10 text-[#403770]">
              {vacancy.category}
            </span>
          )}
          {vacancy.fullmindRelevant && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-[#F37167]/15 text-[#9b4840]">
              Relevant
            </span>
          )}
        </div>
      </div>

      {displaySchool && (
        <div className="text-xs text-gray-500">
          <span className="text-gray-400">School:</span> {displaySchool}
        </div>
      )}

      {(vacancy.hiringManager || vacancy.hiringEmail) && (
        <div className="text-xs text-gray-500">
          {vacancy.hiringManager && (
            <span>
              <span className="text-gray-400">Contact:</span>{" "}
              {vacancy.hiringManager}
            </span>
          )}
          {vacancy.hiringEmail && (
            <span>
              {vacancy.hiringManager ? " · " : ""}
              <a
                href={`mailto:${vacancy.hiringEmail}`}
                className="text-[#6EA3BE] hover:underline"
              >
                {vacancy.hiringEmail}
              </a>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        {vacancy.startDate && (
          <span>Starts: {vacancy.startDate}</span>
        )}
        <span>{formatDaysOpen(vacancy.daysOpen)}</span>
      </div>
    </div>
  );
}

// ─── LastScannedInfo ─────────────────────────────────────────────────

function LastScannedInfo({ lastScannedAt }: { lastScannedAt: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Auto-scanned {formatRelativeTime(lastScannedAt)}
    </div>
  );
}
