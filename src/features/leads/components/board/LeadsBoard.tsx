"use client";

// Pipeline board — two switchable layouts (per the design handoff §3; the
// grouped list was retired in favor of the sortable table):
//   columns   — one drop-zone column per stage; HTML5 drag-to-restage
//   swimlanes — manager grid: BDR rows × stage columns (all stages, New first),
//               sticky header row + sticky first column; each cell pages one
//               card at a time with a "N of M" pager to keep rows short
// Drag-to-restage calls onMove(leadId, status); the caller owns the optimistic
// mutation (server validates transitions — 422 rolls back with a toast).

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import InfoTip from "@/features/shared/components/InfoTip";
import UserAvatar from "@/features/shared/components/UserAvatar";
import { PIPELINE, STATUS_CONFIG } from "@/features/leads/lib/status-config";
import { RENDER_PAGE_SIZE } from "@/features/leads/lib/queries";
import { slaState } from "@/features/leads/lib/sla";
import type { Lead, LeadStatus } from "@/features/leads/lib/types";
import LeadCard from "./LeadCard";

export type BoardLayout = "columns" | "swimlanes";

interface LeadsBoardProps {
  leads: Lead[];
  layout: BoardLayout;
  selectedId: string | null;
  onSelectLead: (lead: Lead) => void;
  onMove: (leadId: string, status: LeadStatus) => void;
  /** Current user's profile id — renders "You" in swimlane rows. */
  currentUserId?: string | null;
  /** Injectable clock for tests. */
  now?: Date;
}

function countOverdue(leads: Lead[], now?: Date): number {
  return leads.filter(
    (l) => l.status === "new" && (slaState(l.assignedAt, now)?.overdue ?? false),
  ).length;
}

function OverduePill({ count }: { count: number }) {
  return (
    <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#F7C9C5] bg-[#FEF1F0] px-[7px] py-px text-[10.5px] font-bold text-[#C25A52]">
      <AlertTriangle size={11} aria-hidden />
      {count} overdue
    </span>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-[#EFEDF5] px-[7px] py-px text-[11px] font-semibold tabular-nums text-[#8A80A8]">
      {count}
    </span>
  );
}

// ---- Layout 1: status columns ----------------------------------------------

function Column({
  statusKey,
  leads,
  selectedId,
  onSelectLead,
  onMove,
  draggingId,
  setDraggingId,
  tipAlign,
  now,
}: {
  statusKey: LeadStatus;
  leads: Lead[];
  selectedId: string | null;
  onSelectLead: (lead: Lead) => void;
  onMove: (leadId: string, status: LeadStatus) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  tipAlign: "left" | "center" | "right";
  now?: Date;
}) {
  const c = STATUS_CONFIG[statusKey];
  const [over, setOver] = useState(false);
  const [visible, setVisible] = useState(RENDER_PAGE_SIZE);
  const overdueCount = statusKey === "new" ? countOverdue(leads, now) : 0;
  const shown = leads.slice(0, visible);

  return (
    <div className="flex h-full min-w-[248px] flex-1 basis-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: c.dot }}
        />
        <span className="whitespace-nowrap text-[12.5px] font-bold text-[#403770]">
          {c.label}
        </span>
        <InfoTip label={c.label} text={c.definition} align={tipAlign} />
        <CountPill count={leads.length} />
        {overdueCount > 0 && <OverduePill count={overdueCount} />}
      </div>
      <div
        data-testid={`board-column-${statusKey}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!over) setOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          setDraggingId(null);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onMove(id, statusKey);
        }}
        className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-[10px] p-2 transition-colors duration-[120ms] ease-out"
        style={{
          background: over ? c.bg : "#FAF8FC",
          border: `1px ${over ? "dashed" : "solid"} ${over ? c.dot : "#EDEAF4"}`,
        }}
      >
        {shown.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            selectedId={selectedId}
            onOpen={onSelectLead}
            draggable
            onDragStart={(lead) => setDraggingId(lead.id)}
            onDragEnd={() => setDraggingId(null)}
            dragging={draggingId === l.id}
            now={now}
          />
        ))}
        {leads.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + RENDER_PAGE_SIZE)}
            className="whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-3 py-2 text-xs font-semibold text-[#403770] hover:bg-[#F7F5FA]"
          >
            Show {Math.min(RENDER_PAGE_SIZE, leads.length - visible)} more
          </button>
        )}
        {leads.length === 0 && (
          <div
            className="px-2 py-5 text-center text-[11.5px]"
            style={{ color: over ? c.fg : "#B8B0D0" }}
          >
            {over ? `Move to ${c.label}` : "None"}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Layout 2 cell: BDR × stage (paginated at 50 like every list) -------------

function SwimlaneCell({
  cell,
  selectedId,
  onSelectLead,
  firstRow,
  now,
}: {
  cell: Lead[];
  selectedId: string | null;
  onSelectLead: (lead: Lead) => void;
  firstRow: boolean;
  now?: Date;
}) {
  const [page, setPage] = useState(0);
  // Clamp instead of effect-reset so a shrinking cell (lead restaged away)
  // never points past the end.
  const idx = Math.min(page, Math.max(0, cell.length - 1));
  const lead = cell[idx];
  return (
    <div
      className={`flex min-h-16 flex-col gap-[7px] border-l border-[#EFEDF5] bg-[#FAF8FC] p-2 ${
        firstRow ? "" : "border-t border-t-[#EFEDF5]"
      }`}
    >
      {lead && (
        <LeadCard
          key={lead.id}
          lead={lead}
          selectedId={selectedId}
          onOpen={onSelectLead}
          dense
          now={now}
        />
      )}
      {cell.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label="Previous lead"
            disabled={idx === 0}
            onClick={() => setPage(idx - 1)}
            className="rounded-md p-0.5 text-[#6E6390] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#6E6390]"
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[#6E6390]">
            {idx + 1} of {cell.length}
          </span>
          <button
            type="button"
            aria-label="Next lead"
            disabled={idx >= cell.length - 1}
            onClick={() => setPage(idx + 1)}
            className="rounded-md p-0.5 text-[#6E6390] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#6E6390]"
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Board ------------------------------------------------------------------

export default function LeadsBoard({
  leads,
  layout,
  selectedId,
  onSelectLead,
  onMove,
  currentUserId,
  now,
}: LeadsBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const byStatus = (k: LeadStatus) => leads.filter((l) => l.status === k);

  // Swimlane rows: distinct BDRs across the visible leads — current user
  // first, then alphabetical; an Unassigned row only when needed.
  const reps = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; fullName: string | null; avatarUrl: string | null }
    >();
    let hasUnassigned = false;
    for (const l of leads) {
      if (l.assignedBdr) {
        if (!seen.has(l.assignedBdr.id)) seen.set(l.assignedBdr.id, l.assignedBdr);
      } else {
        hasUnassigned = true;
      }
    }
    const sorted = [...seen.values()].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return (a.fullName ?? "").localeCompare(b.fullName ?? "");
    });
    return { sorted, hasUnassigned };
  }, [leads, currentUserId]);

  // Layout 1: status columns -------------------------------------------------
  if (layout === "columns") {
    return (
      <div
        className="flex h-full gap-3.5 overflow-x-auto pb-1"
        style={{ touchAction: "pan-x" }}
      >
        {PIPELINE.map((k, i) => (
          <Column
            key={k}
            statusKey={k}
            leads={byStatus(k)}
            selectedId={selectedId}
            onSelectLead={onSelectLead}
            onMove={onMove}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
            tipAlign={i === 0 ? "left" : i === PIPELINE.length - 1 ? "right" : "center"}
            now={now}
          />
        ))}
      </div>
    );
  }

  // Layout 2: swimlanes by BDR (manager grid) ---------------------------------
  const cols = PIPELINE;
  const rows: Array<{
    key: string;
    label: string;
    bdr: { fullName: string | null; avatarUrl: string | null } | null;
  }> = reps.sorted.map((r) => ({
    key: r.id,
    label: r.id === currentUserId ? "You" : (r.fullName ?? "").split(" ")[0] || "—",
    bdr: r,
  }));
  if (reps.hasUnassigned) {
    rows.push({ key: "__unassigned", label: "Unassigned", bdr: null });
  }
  return (
    <div
      className="h-full overflow-auto rounded-[10px] border border-[#E2DEEC] bg-white"
      style={{ touchAction: "pan-x pan-y" }}
    >
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `150px repeat(${cols.length}, minmax(190px, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-[2] whitespace-nowrap border-b border-[#E2DEEC] bg-[#F7F5FA] px-3.5 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#6E6390]">
          BDR
        </div>
        {cols.map((k) => {
          const c = STATUS_CONFIG[k];
          return (
            <div
              key={k}
              className="sticky top-0 z-[2] flex items-center gap-1.5 border-b border-[#E2DEEC] border-l border-l-[#EFEDF5] bg-[#F7F5FA] px-3 py-[11px]"
            >
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: c.dot }}
              />
              <span className="whitespace-nowrap text-[11.5px] font-bold text-[#403770]">
                {c.label}
              </span>
              <InfoTip label={c.label} text={c.definition} size={12} align="center" />
            </div>
          );
        })}
        {rows.map((row, ri) => (
          <div key={row.key} className="contents">
            <div
              className={`sticky left-0 z-[1] flex items-center gap-2 bg-[#FFFCFA] px-3.5 py-3 ${
                ri === 0 ? "" : "border-t border-[#EFEDF5]"
              }`}
            >
              {row.bdr ? (
                <UserAvatar
                  name={row.bdr.fullName}
                  avatarUrl={row.bdr.avatarUrl}
                  size={26}
                />
              ) : (
                <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-dashed border-[#C2BBD4] text-[10px] text-[#A69DC0]">
                  —
                </span>
              )}
              <span className="truncate whitespace-nowrap text-[12.5px] font-semibold text-[#403770]">
                {row.label}
              </span>
            </div>
            {cols.map((k) => (
              <SwimlaneCell
                key={k}
                cell={leads.filter(
                  (l) =>
                    l.status === k &&
                    (row.bdr ? l.assignedBdr?.id === row.key : !l.assignedBdr),
                )}
                selectedId={selectedId}
                onSelectLead={onSelectLead}
                firstRow={ri === 0}
                now={now}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

}
