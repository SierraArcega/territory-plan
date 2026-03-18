"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

interface ScanResponse {
  scanId: string;
  status: string;
}

interface ScanStatusResponse {
  scanId: string;
  status: string;
  vacancyCount: number | null;
  fullmindRelevantCount: number | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface VacancyListProps {
  leaid: string;
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

export default function VacancyList({ leaid }: VacancyListProps) {
  const queryClient = useQueryClient();
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

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

  // Trigger scan mutation
  const scanMutation = useMutation<
    ScanResponse,
    Error,
    { leaid: string; jobBoardUrl?: string }
  >({
    mutationFn: async ({ leaid: scanLeaid, jobBoardUrl }) => {
      const res = await fetch("/api/vacancies/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaid: scanLeaid, jobBoardUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || "Failed to trigger scan"
        );
      }
      return res.json();
    },
    onSuccess: (result) => {
      setActiveScanId(result.scanId);
    },
  });

  // Poll scan status
  const { data: scanStatus } = useQuery<ScanStatusResponse>({
    queryKey: ["vacancyScan", activeScanId],
    queryFn: async () => {
      const res = await fetch(`/api/vacancies/scan/${activeScanId}`);
      if (!res.ok) throw new Error("Failed to poll scan status");
      return res.json();
    },
    enabled: !!activeScanId,
    refetchInterval: 2000,
  });

  // When scan finishes, refetch vacancies
  const handleScanComplete = useCallback(() => {
    setActiveScanId(null);
    queryClient.invalidateQueries({ queryKey: ["vacancies", leaid] });
  }, [queryClient, leaid]);

  useEffect(() => {
    if (!scanStatus) return;
    const doneStatuses = ["completed", "completed_partial", "failed"];
    if (doneStatuses.includes(scanStatus.status)) {
      handleScanComplete();
    }
  }, [scanStatus, handleScanComplete]);

  const isScanning = !!activeScanId || scanMutation.isPending;

  // Group vacancies by category
  const groupedByCategory = data?.vacancies.reduce<
    Record<string, VacancyRecord[]>
  >((acc, v) => {
    const cat = v.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {}) ?? {};

  const categoryKeys = Object.keys(groupedByCategory).sort((a, b) => {
    // Put "Other" last
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
  if (!data || data.vacancies.length === 0) {
    const hasJobBoardUrl = !!data?.summary.lastScannedAt;
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          {hasJobBoardUrl
            ? "No vacancies found"
            : "No job board URL configured or never scanned"}
        </p>
        <ScanButton
          isScanning={isScanning}
          scanError={scanMutation.error?.message ?? null}
          showUrlInput={!hasJobBoardUrl}
          onScan={(jobBoardUrl) =>
            scanMutation.mutate({ leaid, jobBoardUrl })
          }
        />
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────────
  const { summary } = data;

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="text-sm text-gray-600">
        <span className="font-semibold text-[#403770]">{summary.totalOpen}</span>{" "}
        open position{summary.totalOpen !== 1 ? "s" : ""}
        {summary.fullmindRelevant > 0 && (
          <>
            {" "}
            <span className="text-xs text-gray-400">(</span>
            <span className="font-semibold text-[#F37167]">{summary.fullmindRelevant}</span>
            <span className="text-xs text-gray-400"> Fullmind-relevant)</span>
          </>
        )}
        {summary.lastScannedAt && (
          <span className="text-xs text-gray-400">
            {" "}
            — Last scanned {formatRelativeTime(summary.lastScannedAt)}
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
              <VacancyRow key={vacancy.id} vacancy={vacancy} />
            ))}
          </div>
        </div>
      ))}

      {/* Scan button */}
      <ScanButton
        isScanning={isScanning}
        scanError={scanMutation.error?.message ?? null}
        onScan={() => scanMutation.mutate({ leaid })}
      />
    </div>
  );
}

// ─── VacancyRow ─────────────────────────────────────────────────────

function VacancyRow({ vacancy }: { vacancy: VacancyRecord }) {
  const displaySchool =
    vacancy.school?.name || vacancy.schoolName || null;

  return (
    <div className="border border-gray-100 rounded-lg p-2.5 space-y-1">
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

// ─── ScanButton ─────────────────────────────────────────────────────

function ScanButton({
  isScanning,
  scanError,
  showUrlInput,
  onScan,
}: {
  isScanning: boolean;
  scanError: string | null;
  showUrlInput?: boolean;
  onScan: (jobBoardUrl?: string) => void;
}) {
  const [urlValue, setUrlValue] = useState("");

  return (
    <div className="pt-1 space-y-2">
      {showUrlInput && (
        <input
          type="url"
          placeholder="Paste job board URL…"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          className="w-full px-3 py-1.5 text-sm text-[#403770] placeholder:text-gray-400 border border-gray-200 rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
        />
      )}
      <button
        onClick={() => onScan(showUrlInput ? urlValue || undefined : undefined)}
        disabled={isScanning || (showUrlInput && !urlValue.trim())}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#403770]/10 text-[#403770] hover:bg-[#403770]/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isScanning ? (
          <>
            <svg
              className="w-3.5 h-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Scanning...
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Scan Now
          </>
        )}
      </button>
      {scanError && (
        <p className="text-xs text-red-400 mt-1">{scanError}</p>
      )}
    </div>
  );
}
