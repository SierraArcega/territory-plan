"use client";

/**
 * TableView — district table for the active plan/list scope.
 *
 * Columns (per prototype `app-shared.jsx::CanvasTableView`):
 *   - District  — signal dot + name
 *   - State
 *   - Tier      — colored badge (A coral / B steel / C muted)
 *   - Students  — right-aligned tabular-nums
 *   - FY26 ARR  — right-aligned, muted when missing
 *   - Pipeline  — right-aligned, muted when missing
 *   - Stage     — filled pill + tiny dot prefix
 *
 * Data source: `GET /api/districts?leaids=<csv>&limit=N` (Phase C extended
 * the route to accept the `leaids` query). Rows mark themselves with
 * data-row-kind/id so GroupCanvas's event delegation opens the detail panel.
 *
 * Pagination: 50 per page with a "Show more" affordance (per CLAUDE.md). A
 * filter-hint banner appears at 200+ rows.
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

interface TableViewProps {
  leaids: string[] | null;
}

interface DistrictRow {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  accountType: string;
  cityLocation: string | null;
  metricValue: number | null;
  isRollup: boolean;
  childCount: number;
}

interface DistrictsResponse {
  districts: DistrictRow[];
  total: number;
}

/** Derive a stage label from the district's customer/pipeline booleans. */
function deriveStage(row: DistrictRow): { label: string; color: string } {
  if (row.isCustomer && row.hasOpenPipeline)
    return { label: "Active", color: "#69B34A" };
  if (row.isCustomer) return { label: "Renewal", color: "#6EA3BE" };
  if (row.hasOpenPipeline) return { label: "Pipeline", color: "#FFCF70" };
  return { label: "Prospect", color: "#A69DC0" };
}

/**
 * Derive a tier from accountType (placeholder until a real tier column lands).
 * For v1 we tier by isCustomer + hasOpenPipeline as a coarse proxy.
 */
function deriveTier(row: DistrictRow): "A" | "B" | "C" {
  if (row.isCustomer && row.hasOpenPipeline) return "A";
  if (row.isCustomer || row.hasOpenPipeline) return "B";
  return "C";
}

function tierPillStyle(tier: "A" | "B" | "C") {
  if (tier === "A") return { bg: "#FEF2F1", fg: "#F37167" };
  if (tier === "B") return { bg: "#e8f1f5", fg: "#4d7285" };
  return { bg: "#F7F5FA", fg: "#8A80A8" };
}

const TH_CLS =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap";
const TD_CLS = "py-2.5 px-3.5 border-b border-[#EFEDF5]";

export default function TableView({ leaids }: TableViewProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;

  const csv = leaidsCsv(leaids);
  // Stable query key per CLAUDE.md — serialize leaids to a primitive.
  const keyTag = leaidsKey(leaids);

  const url = leaids === null
    ? null
    : `${API_BASE}/districts?leaids=${encodeURIComponent(csv)}&limit=${visibleCount}`;

  const q = useQuery({
    queryKey: ["views", "table", "districts", keyTag, visibleCount] as const,
    queryFn: () => {
      if (!url) throw new Error("Missing leaids scope");
      return fetchJson<DistrictsResponse>(url);
    },
    // Lists pass null leaids in v0 — render empty state instead of fetching.
    enabled: leaids !== null,
    staleTime: 60 * 1000,
  });

  // For null-scope (lists in v0) we render an explanatory empty state so the
  // view is observable end-to-end and the URL routing checks out.
  if (leaids === null) {
    return (
      <EmptyState
        title="List scoping not wired yet"
        hint="Phase E adds live list previews — until then the table view is plan-only."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={8} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch districts.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.districts ?? [];
  const total = q.data?.total ?? 0;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No districts in this plan"
        hint="Add districts from the plan workspace to populate this view."
      />
    );
  }

  const remaining = Math.max(0, total - rows.length);

  return (
    <ViewScroll>
      <FilterHintBanner total={total} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA] sticky top-0 z-[1]">
              <th className={`${TH_CLS} text-left`}>District</th>
              <th className={`${TH_CLS} text-left`}>State</th>
              <th className={`${TH_CLS} text-left`}>Tier</th>
              <th className={`${TH_CLS} text-right`}>FY26 ARR</th>
              <th className={`${TH_CLS} text-left`}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.leaid} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={remaining}
        />
      )}
    </ViewScroll>
  );
}

function Row({ row }: { row: DistrictRow }) {
  const tier = deriveTier(row);
  const tierStyle = tierPillStyle(tier);
  const stage = deriveStage(row);
  return (
    <tr
      data-row-kind="district"
      data-row-id={row.leaid}
      className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
    >
      <td className={TD_CLS}>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: stage.color }}
            aria-hidden
          />
          <span className="font-medium text-[#403770] whitespace-nowrap">
            {row.name}
          </span>
        </div>
      </td>
      <td className={`${TD_CLS} text-[#6E6390] whitespace-nowrap`}>
        {row.stateAbbrev ?? "—"}
      </td>
      <td className={TD_CLS}>
        <span
          className="inline-block px-2 py-px rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{ background: tierStyle.bg, color: tierStyle.fg }}
        >
          {tier}
        </span>
      </td>
      <td
        className={`${TD_CLS} text-right tabular-nums whitespace-nowrap ${
          row.metricValue == null
            ? "text-[#A69DC0]"
            : "text-[#403770] font-medium"
        }`}
      >
        {row.metricValue == null ? "—" : formatMoney(row.metricValue)}
      </td>
      <td className={TD_CLS}>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{
            background: `${stage.color}22`,
            color: stage.color === "#FFCF70" ? "#997c43" : stage.color,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: stage.color }}
            aria-hidden
          />
          {stage.label}
        </span>
      </td>
    </tr>
  );
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

// Exposed for shared use by KanbanView's card pills.
export { formatMoney };
