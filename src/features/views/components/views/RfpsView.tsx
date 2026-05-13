"use client";

/**
 * RfpsView — RFP table for the active plan/list district scope.
 *
 * Columns (per prototype `district-feeds.jsx::CanvasRfpsView`):
 *   - District
 *   - RFP (title + stage subtitle)
 *   - Category pill
 *   - Posted
 *   - Due (bold tabular)
 *   - Value (bold tabular)
 *   - Status pill (Open / Reviewing / Awarded)
 *
 * Data: `GET /api/rfps?leaids=<csv>&limit=N`. Phase C extended the route to
 * accept `leaids` (previously single-leaid only).
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

interface RfpsViewProps {
  leaids: string[] | null;
}

interface RfpRow {
  id: number;
  leaid: string | null;
  title: string;
  agencyName: string | null;
  capturedDate: string;
  dueDate: string | null;
  category: string | null;
  status: string | null;
  estimatedValue: number | null;
}

interface RfpsResponse {
  items: RfpRow[];
  nextCursor: string | null;
}

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#EDFFE3", fg: "#5f665b" },
  reviewing: { bg: "#FFF6DD", fg: "#7d6d3a" },
  awarded: { bg: "#EFEDF5", fg: "#6f6786" },
  closed: { bg: "#EFEDF5", fg: "#6f6786" },
};

const TH_CLS =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#E2DEEC] text-left whitespace-nowrap";
const TD_CLS = "py-2.5 px-3.5 border-b border-[#EFEDF5] bg-white";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export default function RfpsView({ leaids }: RfpsViewProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;
  const keyTag = leaidsKey(leaids);

  const q = useQuery({
    queryKey: ["views", "rfps", keyTag, visibleCount] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<RfpsResponse>(
        `${API_BASE}/rfps?leaids=${encodeURIComponent(csv)}&limit=${visibleCount}`,
      );
    },
    enabled: leaids !== null && leaids.length > 0,
    staleTime: 60 * 1000,
  });

  if (leaids === null || leaids.length === 0) {
    return (
      <EmptyState
        title="No districts in scope"
        hint="RFPs are listed per district — add districts to populate this view."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={6} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch RFPs.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="No RFPs yet"
        hint="Active RFPs in scoped districts will appear here."
      />
    );
  }

  const total = items.length;

  return (
    <ViewScroll>
      <FilterHintBanner total={total} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA]">
              <th className={TH_CLS}>District</th>
              <th className={TH_CLS}>RFP</th>
              <th className={TH_CLS}>Category</th>
              <th className={TH_CLS}>Posted</th>
              <th className={TH_CLS}>Due</th>
              <th className={TH_CLS}>Value</th>
              <th className={TH_CLS}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const status = (r.status ?? "open").toLowerCase();
              const stp = STATUS_PILL[status] ?? STATUS_PILL.open;
              return (
                <tr
                  key={r.id}
                  data-row-kind="rfp"
                  data-row-id={String(r.id)}
                  className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
                >
                  <td className={`${TD_CLS} font-semibold text-[#403770] whitespace-nowrap`}>
                    {r.agencyName ?? "—"}
                  </td>
                  <td className={TD_CLS}>
                    <div className="text-[13px] text-[#403770] font-medium whitespace-nowrap">
                      {r.title}
                    </div>
                  </td>
                  <td className={TD_CLS}>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-[#EFEDF5] text-[11px] font-semibold text-[#6f6786] whitespace-nowrap">
                      {r.category ?? "—"}
                    </span>
                  </td>
                  <td className={`${TD_CLS} text-[#8A80A8] tabular-nums whitespace-nowrap`}>
                    {fmtDate(r.capturedDate)}
                  </td>
                  <td className={`${TD_CLS} font-semibold tabular-nums text-[#403770] whitespace-nowrap`}>
                    {fmtDate(r.dueDate)}
                  </td>
                  <td className={`${TD_CLS} font-semibold tabular-nums text-[#403770] whitespace-nowrap`}>
                    {fmtMoney(r.estimatedValue)}
                  </td>
                  <td className={TD_CLS}>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: stp.bg, color: stp.fg }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length >= PAGE_SIZE && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={PAGE_SIZE}
        />
      )}
    </ViewScroll>
  );
}
