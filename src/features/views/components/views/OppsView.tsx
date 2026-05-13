"use client";

/**
 * OppsView — opportunities table for the active plan/list district scope.
 *
 * Columns (per prototype `CanvasOppsView`):
 *   - Opportunity (title)
 *   - District
 *   - Stage     — pill (Discovery / Proposal / Negotiation / Closed Won …)
 *   - ARR       — right-aligned bold tabular-nums
 *   - Close date
 *   - Owner avatar
 *
 * Data: `GET /api/opportunities?leaids=<csv>&limit=N`. Phase C extended the
 * existing route to accept `leaids` (was search-only before).
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
import { formatMoney } from "./TableView";

interface OppsViewProps {
  leaids: string[] | null;
  /**
   * Plan id, currently unused — reserved for a future plan-scoped opp endpoint
   * that joins through TerritoryPlanDistrict directly. Today we filter by
   * `districtLeaId`, which is sufficient for plans and unblocked for lists.
   */
  planId: string | null;
}

interface OppRow {
  id: string;
  name: string;
  stage: string | null;
  netBookingAmount: number | null;
  districtName: string | null;
  districtLeaId: string | null;
  closeDate: string | null;
}

interface OppsResponse {
  opportunities: OppRow[];
}

/** Stage pill styling — derived from prototype `OPP_STAGE_PILL`. */
function stagePill(stage: string | null): { bg: string; fg: string; bd: string } {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("discovery"))
    return { bg: "#FFFCFA", fg: "#8A80A8", bd: "#E2DEEC" };
  if (s.includes("proposal"))
    return { bg: "#e8f1f5", fg: "#4d7285", bd: "transparent" };
  if (s.includes("negotiat"))
    return { bg: "#FEF2F1", fg: "#c25a52", bd: "transparent" };
  if (s.includes("closed won"))
    return { bg: "#EDFFE3", fg: "#5f665b", bd: "transparent" };
  return { bg: "#F7F5FA", fg: "#6f6786", bd: "transparent" };
}

const TH_CLS =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-4 border-b border-[#E2DEEC] whitespace-nowrap";
const TD_CLS = "py-2.5 px-4 border-b border-[#EFEDF5] bg-white";

export default function OppsView({ leaids }: OppsViewProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;
  const keyTag = leaidsKey(leaids);

  const q = useQuery({
    queryKey: ["views", "opps", keyTag, visibleCount] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<OppsResponse>(
        `${API_BASE}/opportunities?leaids=${encodeURIComponent(csv)}&limit=${visibleCount}`,
      );
    },
    enabled: leaids !== null && leaids.length > 0,
    staleTime: 60 * 1000,
  });

  if (leaids === null || leaids.length === 0) {
    return (
      <EmptyState
        title="No districts in scope"
        hint="Add districts to this plan or list to see their opportunities."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={6} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch opportunities.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.opportunities ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No opportunities yet"
        hint="Opportunities in scope will appear here as your team logs them."
      />
    );
  }

  // The endpoint doesn't return a total — use the row count for the show-more
  // remaining calc and the filter-hint banner threshold.
  const total = rows.length;

  return (
    <ViewScroll>
      <FilterHintBanner total={total} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#FFFCFA]">
              <th className={`${TH_CLS} text-left`}>Opportunity</th>
              <th className={`${TH_CLS} text-left`}>District</th>
              <th className={`${TH_CLS} text-left`}>Stage</th>
              <th className={`${TH_CLS} text-right`}>ARR</th>
              <th className={`${TH_CLS} text-left`}>Close date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const pill = stagePill(o.stage);
              return (
                <tr
                  key={o.id}
                  data-row-kind="opp"
                  data-row-id={o.id}
                  className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
                >
                  <td className={`${TD_CLS} font-semibold text-[#403770] whitespace-nowrap`}>
                    {o.name}
                  </td>
                  <td className={`${TD_CLS} text-[#544A78] whitespace-nowrap`}>
                    {o.districtName ?? "—"}
                  </td>
                  <td className={TD_CLS}>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{
                        background: pill.bg,
                        color: pill.fg,
                        border: `1px solid ${pill.bd}`,
                      }}
                    >
                      {o.stage ?? "—"}
                    </span>
                  </td>
                  <td
                    className={`${TD_CLS} text-right tabular-nums whitespace-nowrap ${
                      o.netBookingAmount == null
                        ? "text-[#A69DC0]"
                        : "text-[#403770] font-semibold"
                    }`}
                  >
                    {o.netBookingAmount == null
                      ? "—"
                      : formatMoney(o.netBookingAmount)}
                  </td>
                  <td className={`${TD_CLS} text-[#544A78] tabular-nums whitespace-nowrap`}>
                    {o.closeDate ? formatDate(o.closeDate) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === PAGE_SIZE && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={PAGE_SIZE}
        />
      )}
    </ViewScroll>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
