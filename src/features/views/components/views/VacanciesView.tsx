"use client";

/**
 * VacanciesView — vacancy feed table for the active plan/list district scope.
 *
 * Columns (per prototype `district-feeds.jsx::CanvasVacanciesView`):
 *   - District
 *   - Role
 *   - Signal pill (High / Med / Low) — derived from fullmindRelevant flag
 *   - Posted (relative)
 *   - Status pill (Open / Search active / Filled)
 *   - Note (relevanceReason, when present)
 *
 * Data: `GET /api/vacancies?leaids=<csv>&limit=N&status=open` — the route
 * that landed in Phase A.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import {
  EmptyState,
  ErrorState,
  FilterHintBanner,
  LoadingState,
  PAGE_SIZE,
  ShowMoreButton,
  ViewScroll,
  leaidsCsv,
  leaidsKey,
} from "./_shared";

interface VacanciesViewProps {
  leaids: string[] | null;
}

interface VacancyRow {
  id: number;
  leaid: string;
  districtName: string | null;
  stateAbbrev: string | null;
  status: string | null;
  title: string;
  category: string | null;
  hiringManager: string | null;
  datePosted: string | null;
  fullmindRelevant: boolean;
  relevanceReason: string | null;
}

interface VacanciesResponse {
  vacancies: VacancyRow[];
}

const SIGNAL_PILL: Record<"high" | "med" | "low", { bg: string; fg: string; label: string }> = {
  high: { bg: "#FEF2F1", fg: "#c25a52", label: "High" },
  med: { bg: "#FFF6DD", fg: "#7d6d3a", label: "Med" },
  low: { bg: "#EFEDF5", fg: "#6f6786", label: "Low" },
};

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#EDFFE3", fg: "#5f665b" },
  closed: { bg: "#EFEDF5", fg: "#6f6786" },
  expired: { bg: "#EFEDF5", fg: "#6f6786" },
};

function relativeFromIso(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 14) return `${diffDays}d ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks}w ago`;
}

const TH_CLS =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#E2DEEC] text-left whitespace-nowrap";
const TD_CLS = "py-2.5 px-3.5 border-b border-[#EFEDF5] bg-white";

export default function VacanciesView({ leaids }: VacanciesViewProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;
  const keyTag = leaidsKey(leaids);

  const q = useQuery({
    queryKey: ["views", "vacancies", keyTag, visibleCount] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<VacanciesResponse>(
        `${API_BASE}/vacancies?leaids=${encodeURIComponent(csv)}&limit=${visibleCount}&status=open`,
      );
    },
    enabled: leaids !== null && leaids.length > 0,
    staleTime: 60 * 1000,
  });

  if (leaids === null || leaids.length === 0) {
    return (
      <EmptyState
        title="No districts in scope"
        hint="Vacancies are listed per district — add districts to populate this view."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={6} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch vacancies.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.vacancies ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No open vacancies"
        hint="Open vacancies in scoped districts will appear here."
      />
    );
  }

  const total = rows.length;

  return (
    <ViewScroll>
      <FilterHintBanner total={total} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA]">
              <th className={TH_CLS}>District</th>
              <th className={TH_CLS}>Role</th>
              <th className={TH_CLS}>Signal</th>
              <th className={TH_CLS}>Posted</th>
              <th className={TH_CLS}>Status</th>
              <th className={TH_CLS}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const signal: keyof typeof SIGNAL_PILL = v.fullmindRelevant
                ? "high"
                : v.category
                  ? "med"
                  : "low";
              const sp = SIGNAL_PILL[signal];
              const status = (v.status ?? "open").toLowerCase();
              const stp = STATUS_PILL[status] ?? STATUS_PILL.open;
              return (
                <tr
                  key={v.id}
                  data-row-kind="vacancy"
                  data-row-id={String(v.id)}
                  className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
                >
                  <td className={`${TD_CLS} font-semibold text-[#403770] whitespace-nowrap`}>
                    {v.districtName ?? "—"}
                  </td>
                  <td className={`${TD_CLS} text-[#544A78] whitespace-nowrap`}>
                    {v.title}
                  </td>
                  <td className={TD_CLS}>
                    <Pill {...sp} text={sp.label} />
                  </td>
                  <td className={`${TD_CLS} text-[#8A80A8] tabular-nums whitespace-nowrap`}>
                    {relativeFromIso(v.datePosted)}
                  </td>
                  <td className={TD_CLS}>
                    <Pill bg={stp.bg} fg={stp.fg} text={status.charAt(0).toUpperCase() + status.slice(1)} />
                  </td>
                  <td className={`${TD_CLS} text-[#8A80A8] text-[12px] max-w-xs truncate`}>
                    {v.relevanceReason ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length >= PAGE_SIZE && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={PAGE_SIZE}
        />
      )}
    </ViewScroll>
  );
}

function Pill({ bg, fg, text }: { bg: string; fg: string; text: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  );
}
