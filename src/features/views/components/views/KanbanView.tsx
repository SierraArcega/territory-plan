"use client";

/**
 * KanbanView — opportunity pipeline board for the active plan.
 *
 * Columns are the real Salesforce opportunity stages (funnel 0–5 + Closed Won /
 * Closed Lost) from lib/opp-stage-columns. Opps are scoped to the plan's
 * districts and the plan's fiscal year (→ school year). Read-only: cards open
 * the opp detail panel via GroupCanvas's [data-row-kind][data-row-id]
 * delegation — there is no drag-to-move and no card create in v1 (opps are a
 * read-only Salesforce mirror).
 *
 * Lists are not scoped yet (leaids === null) — same plan-only empty state as the
 * other views until list previews are wired.
 */
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";
import { OPP_STAGE_COLUMNS } from "@/features/views/lib/opp-stage-columns";
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
  /** Plan's fiscal year (e.g. 2026). null for lists (not scoped in v1). */
  fiscalYear: number | null;
}

interface KanbanCard {
  id: string;
  name: string | null;
  districtName: string | null;
  contractType: string | null;
  netBookingAmount: number | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  closeDate: string | null;
  salesRepName: string | null;
}

interface KanbanColumnData {
  id: string;
  label: string;
  count: number;
  totalBookings: number;
  cards: KanbanCard[];
  hasMore: boolean;
}

interface KanbanResponse {
  schoolYr: string;
  columns: KanbanColumnData[];
}

const ACCENT_BY_ID: Record<string, string> = Object.fromEntries(
  OPP_STAGE_COLUMNS.map((c) => [c.id, c.accent]),
);

export default function KanbanView({ leaids, fiscalYear }: KanbanViewProps) {
  const keyTag = leaidsKey(leaids);
  const schoolYr = fiscalYear != null ? fiscalYearToSchoolYear(fiscalYear) : "";

  const q = useQuery({
    queryKey: ["views", "opps-kanban", keyTag, schoolYr, PAGE_SIZE] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<KanbanResponse>(
        `${API_BASE}/views/opps-kanban?leaids=${encodeURIComponent(csv)}` +
          `&schoolYr=${encodeURIComponent(schoolYr)}&limit=${PAGE_SIZE}`,
      );
    },
    enabled: leaids !== null && schoolYr !== "",
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
        message={String(q.error?.message ?? "Could not fetch opportunities.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const columns = q.data?.columns ?? [];
  const totalOpps = columns.reduce((sum, c) => sum + c.count, 0);
  if (totalOpps === 0) {
    return (
      <EmptyState
        title="No opportunities for this plan's year"
        hint="Opportunities sync from Salesforce for the plan's districts and fiscal year."
      />
    );
  }

  return (
    <div
      className="h-full overflow-auto bg-[#FFFCFA] p-4"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex gap-3 min-w-max h-full">
        {columns.map((col) => (
          <Column
            key={col.id}
            col={col}
            accent={ACCENT_BY_ID[col.id] ?? "#A69DC0"}
          />
        ))}
      </div>
    </div>
  );
}

function Column({ col, accent }: { col: KanbanColumnData; accent: string }) {
  return (
    <div className="w-64 flex flex-col flex-shrink-0">
      <div
        className="rounded-full mb-2"
        style={{ height: 2, background: accent }}
        aria-hidden
      />
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="text-[12px] font-semibold text-[#403770] truncate">
            {col.label}
          </span>
          <span className="text-[11px] text-[#8A80A8] tabular-nums whitespace-nowrap">
            {col.count}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#544A78] tabular-nums whitespace-nowrap">
          {formatMoney(col.totalBookings)}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {col.cards.map((card) => (
          <Card key={card.id} card={card} accent={accent} />
        ))}
        {col.cards.length === 0 && (
          <div className="px-2.5 py-3 text-[11px] text-[#A69DC0] text-center whitespace-nowrap">
            No opportunities
          </div>
        )}
        {col.hasMore && (
          <div className="px-2.5 py-1 text-[11px] text-[#8A80A8] text-center whitespace-nowrap">
            +{col.count - col.cards.length} more
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ card, accent }: { card: KanbanCard; accent: string }) {
  return (
    <div
      data-row-kind="opp"
      data-row-id={card.id}
      className="bg-white border border-[#D4CFE2] rounded-lg p-2.5 cursor-pointer hover:border-[#B8B0D0] transition-colors duration-100"
      style={{ boxShadow: "0 1px 2px rgba(64,55,112,0.05)" }}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="text-[13px] font-semibold text-[#403770] truncate">
            {card.name ?? "Untitled opportunity"}
          </span>
        </div>
        {card.contractType && (
          <span className="inline-block px-1.5 py-0.5 rounded-full bg-[#EFEDF5] text-[10px] font-semibold text-[#6f6786] whitespace-nowrap flex-shrink-0">
            {card.contractType}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 text-[11px]">
        <CardRow label="District" value={card.districtName ?? "—"} />
        <CardRow
          label="Amount"
          value={card.netBookingAmount != null ? formatMoney(card.netBookingAmount) : "—"}
        />
        <CardRow
          label="Min purchase"
          value={
            card.minimumPurchaseAmount != null
              ? formatMoney(card.minimumPurchaseAmount)
              : "—"
          }
        />
        {card.maximumBudget != null && (
          <CardRow label="Max budget" value={formatMoney(card.maximumBudget)} />
        )}
        <CardRow label="Close" value={formatCloseDate(card.closeDate)} />
        <CardRow label="Sales rep" value={card.salesRepName ?? "—"} />
      </div>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#8A80A8] whitespace-nowrap">{label}</span>
      <span className="text-[#544A78] font-medium tabular-nums truncate text-right">
        {value}
      </span>
    </div>
  );
}

function formatCloseDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
