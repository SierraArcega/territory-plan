"use client";

// Lead card — shared across the three board layouts. Pixels per the design
// handoff §3 / LeadsBoard.jsx: name 13.5/600 plum + title 11.5 muted, ScorePill
// + outline LeadTypeBadge stacked right, School-icon district line, city/state,
// then a status-specific footer signal + opp-amount pill + BDR avatar.
// Selected = coral border + 3px coral ring; overdue New = #F7C9C5 border;
// hover = #B8B0D0 border + shadow lift.

import type { DragEvent } from "react";
import { Briefcase, Calendar, CheckCircle2, School, Zap } from "lucide-react";
import UserAvatar from "@/features/shared/components/UserAvatar";
import { fmtDate, fmtRel } from "@/features/shared/lib/date-utils";
import { fmtMoney } from "@/features/leads/lib/status-config";
import { slaState } from "@/features/leads/lib/sla";
import type { Lead } from "@/features/leads/lib/types";
import SlaBadge from "../bits/SlaBadge";
import ScorePill from "../bits/ScorePill";
import LeadTypeBadge from "../bits/LeadTypeBadge";

interface LeadCardProps {
  lead: Lead;
  selectedId: string | null;
  onOpen: (lead: Lead) => void;
  dense?: boolean;
  draggable?: boolean;
  onDragStart?: (lead: Lead) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Status-specific footer signal (left side of the card footer). */
function FooterSignal({ lead, now }: { lead: Lead; now?: Date }) {
  if (lead.status === "new") {
    return lead.assignedAt ? (
      <SlaBadge assignedAt={lead.assignedAt} compact now={now} />
    ) : (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[#9A7B3F]">
        <Zap size={12} aria-hidden />
        Needs routing
      </span>
    );
  }
  if (lead.status === "meeting_scheduled") {
    return (
      <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-[11px] font-semibold text-[#5A4F9E]">
        <Calendar size={12} aria-hidden />
        {fmtDate(new Date(lead.meetingAt ?? lead.updatedAt), now)}
      </span>
    );
  }
  if (lead.status === "sales_qualified") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[#56792F]">
        <CheckCircle2 size={12} aria-hidden />
        Sales Qualified
      </span>
    );
  }
  if (lead.status === "unqualified") {
    return (
      <span className="truncate whitespace-nowrap text-[11px] text-[#A69DC0]">
        {lead.unqualifiedReason}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap text-[11px] text-[#9E97B8]">
      {fmtRel(lead.updatedAt, now)}
    </span>
  );
}

export default function LeadCard({
  lead,
  selectedId,
  onOpen,
  dense = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
  now,
}: LeadCardProps) {
  const sel = lead.id === selectedId;
  const overdue =
    lead.status === "new" && (slaState(lead.assignedAt, now)?.overdue ?? false);

  const chrome = sel
    ? "border-[#F37167] shadow-[0_0_0_3px_rgba(243,113,103,0.12)]"
    : overdue
      ? "border-[#F7C9C5] shadow-[0_1px_2px_rgba(64,55,112,0.04)] hover:border-[#B8B0D0] hover:shadow-[0_4px_8px_-2px_rgba(64,55,112,0.10)]"
      : "border-[#E2DEEC] shadow-[0_1px_2px_rgba(64,55,112,0.04)] hover:border-[#B8B0D0] hover:shadow-[0_4px_8px_-2px_rgba(64,55,112,0.10)]";

  const location = [lead.district?.city, lead.district?.stateAbbrev]
    .filter(Boolean)
    .join(", ");

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lead.id);
    onDragStart?.(lead);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open lead: ${lead.contact?.name ?? "Lead"}`}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(lead);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      className={`cursor-pointer rounded-lg border bg-white transition-[box-shadow,border-color] duration-[120ms] ease-out ${chrome} ${
        dense ? "px-[11px] py-[9px]" : "px-[13px] py-3"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
            {lead.contact?.name}
          </div>
          <div className="mt-px truncate whitespace-nowrap text-[11.5px] text-[#8A80A8]">
            {lead.contact?.title}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[5px]">
          <ScorePill score={lead.score} />
          <LeadTypeBadge type={lead.leadType} size="sm" outline />
        </div>
      </div>

      <div className="mt-[7px] flex items-center gap-[5px] text-xs text-[#5C5277]">
        <School size={13} className="shrink-0 text-[#A69DC0]" aria-hidden />
        <span className="truncate whitespace-nowrap">{lead.district?.name}</span>
      </div>
      {!dense && location && (
        <div className="ml-[18px] mt-[3px] whitespace-nowrap text-[11.5px] text-[#9E97B8]">
          {location}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <FooterSignal lead={lead} now={now} />
        <div className="flex shrink-0 items-center gap-[7px]">
          {lead.opportunity && (
            <span className="inline-flex items-center gap-[3px] whitespace-nowrap rounded-full bg-[#EFECFB] px-[7px] py-0.5 text-[11px] font-bold tabular-nums text-[#5A4F9E]">
              <Briefcase size={11} aria-hidden />
              {fmtMoney(lead.opportunity.amount)}
            </span>
          )}
          {lead.assignedBdr ? (
            <UserAvatar
              name={lead.assignedBdr.fullName}
              avatarUrl={lead.assignedBdr.avatarUrl}
              size={22}
            />
          ) : (
            <span
              className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-[#C2BBD4] text-[9px] text-[#A69DC0]"
              title="Unassigned"
            >
              —
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
