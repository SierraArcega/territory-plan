"use client";

/**
 * KanbanView — district pipeline kanban for the active plan/list scope.
 *
 * Columns (per prototype): Prospect / Pipeline / Renewal / Active / At risk.
 * v1 derives the stage from district booleans (isCustomer / hasOpenPipeline)
 * to keep the spec scope manageable; a richer Stage model lands in v1.1.
 *
 * Column header: stage dot + name + count + (+) button (stub).
 * Cards: 1px border, 8px radius, white bg, signal dot + name + meta + value.
 * "+ Add district" dashed button at column end (stub).
 *
 * Like TableView, rows mark themselves with `data-row-kind="district"
 * data-row-id={leaid}` so GroupCanvas's event delegation opens the detail
 * panel.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PAGE_SIZE,
  leaidsCsv,
  leaidsKey,
} from "./_shared";
import { formatMoney } from "./TableView";

interface KanbanViewProps {
  leaids: string[] | null;
}

interface DistrictRow {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  metricValue: number | null;
}

interface DistrictsResponse {
  districts: DistrictRow[];
  total: number;
}

interface StageConfig {
  id: string;
  label: string;
  color: string;
  /** Predicate for assigning a district to this stage. */
  match: (d: DistrictRow) => boolean;
}

/**
 * Column order matches the prototype. Predicates are evaluated top-down so a
 * district matching more than one stage lands in the first match.
 */
const STAGES: StageConfig[] = [
  {
    id: "prospect",
    label: "Prospect",
    color: "#A69DC0",
    match: (d) => !d.isCustomer && !d.hasOpenPipeline,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    color: "#FFCF70",
    match: (d) => !d.isCustomer && d.hasOpenPipeline,
  },
  {
    id: "renewal",
    label: "Renewal",
    color: "#6EA3BE",
    match: (d) => d.isCustomer && !d.hasOpenPipeline,
  },
  {
    id: "active",
    label: "Active",
    color: "#69B34A",
    match: (d) => d.isCustomer && d.hasOpenPipeline,
  },
];

export default function KanbanView({ leaids }: KanbanViewProps) {
  const [limit] = useState(PAGE_SIZE * 2);
  const keyTag = leaidsKey(leaids);

  const q = useQuery({
    queryKey: ["views", "kanban", "districts", keyTag, limit] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<DistrictsResponse>(
        `${API_BASE}/districts?leaids=${encodeURIComponent(csv)}&limit=${limit}`,
      );
    },
    enabled: leaids !== null,
    staleTime: 60 * 1000,
  });

  if (leaids === null) {
    return (
      <EmptyState
        title="List scoping not wired yet"
        hint="Phase E adds live list previews — until then the kanban view is plan-only."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={3} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch districts.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.districts ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No districts in this plan"
        hint="Add districts from the plan workspace to populate this view."
      />
    );
  }

  const byStage = STAGES.map((stage) => ({
    stage,
    items: rows.filter(stage.match),
  }));

  return (
    <div
      className="h-full overflow-auto bg-[#FFFCFA] p-4"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex gap-3 min-w-max h-full">
        {byStage.map(({ stage, items }) => (
          <Column key={stage.id} stage={stage} items={items} />
        ))}
      </div>
    </div>
  );
}

function Column({
  stage,
  items,
}: {
  stage: StageConfig;
  items: DistrictRow[];
}) {
  return (
    <div className="w-60 flex flex-col flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: stage.color }}
            aria-hidden
          />
          <span className="text-[12px] font-semibold text-[#403770] whitespace-nowrap">
            {stage.label}
          </span>
          <span className="text-[11px] text-[#8A80A8] tabular-nums whitespace-nowrap">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => undefined}
          className="text-[#A69DC0] hover:text-[#403770] transition-colors duration-100 p-0.5"
          aria-label={`Add district to ${stage.label}`}
          title="Add district (coming soon)"
        >
          <Plus className="w-3 h-3" aria-hidden />
        </button>
      </div>
      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {items.map((row) => (
          <Card key={row.leaid} row={row} stage={stage} />
        ))}
        <button
          type="button"
          onClick={() => undefined}
          className="px-2.5 py-2 rounded-md border border-dashed border-[#D4CFE2] bg-transparent text-[12px] text-[#8A80A8] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100 whitespace-nowrap"
        >
          + Add district
        </button>
      </div>
    </div>
  );
}

function Card({ row, stage }: { row: DistrictRow; stage: StageConfig }) {
  return (
    <div
      data-row-kind="district"
      data-row-id={row.leaid}
      className="bg-white border border-[#D4CFE2] rounded-lg p-2.5 cursor-pointer hover:border-[#B8B0D0] transition-colors duration-100"
      style={{ boxShadow: "0 1px 2px rgba(64,55,112,0.05)" }}
    >
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#403770] mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: stage.color }}
          aria-hidden
        />
        <span className="truncate whitespace-nowrap">{row.name}</span>
      </div>
      <div className="text-[11px] text-[#8A80A8] mb-2 whitespace-nowrap">
        {row.stateAbbrev ?? "—"}
      </div>
      {row.metricValue != null && (
        <div className="flex gap-1.5 flex-wrap">
          <span className="inline-block px-2 py-0.5 rounded-full bg-[#EDFFE3] text-[11px] font-semibold text-[#5f665b] whitespace-nowrap">
            ARR {formatMoney(row.metricValue)}
          </span>
        </div>
      )}
    </div>
  );
}
