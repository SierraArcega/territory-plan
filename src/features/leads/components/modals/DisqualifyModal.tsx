"use client";

// Disqualify lead — history-preserving confirm per LeadModals.jsx. Names
// exactly what's preserved ("all N events stay on [Contact] and [District]"),
// requires a reason, and PATCHes { status: unqualified, reason }. The
// engagement itself is untouched by design — it lives on the records.

import { useState, type ReactNode } from "react";
import { Check, School, Users, X, type LucideIcon } from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import {
  useLeadTimelineQuery,
  useUpdateLeadMutation,
} from "@/features/leads/lib/queries";
import { UNQUAL_REASONS } from "@/features/leads/lib/status-config";
import type { Lead } from "@/features/leads/lib/types";
import MicroLabel from "../bits/MicroLabel";
import LeadModalShell, {
  BTN_DANGER,
  BTN_GHOST,
  FieldLabel,
  SELECT_CLASS,
} from "./modal-chrome";

function RetainedRow({
  Icon,
  title,
  sub,
}: {
  Icon: LucideIcon;
  title: ReactNode;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[#CDE9BC] bg-[#EAF8E0] px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-[#56792F]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-[#403770]">{title}</div>
        <div className="whitespace-nowrap text-[11px] text-[#4A6A2A]">{sub}</div>
      </div>
      <Check size={15} className="shrink-0 text-[#56792F]" aria-hidden />
    </div>
  );
}

export interface DisqualifyModalProps {
  lead: Lead;
  onClose: () => void;
}

export default function DisqualifyModal({ lead, onClose }: DisqualifyModalProps) {
  const [reason, setReason] = useState("");
  const updateLead = useUpdateLeadMutation();
  const { showToast } = useToast();

  // Preserved-event count = the engagement items already on the merged
  // timeline (lifecycle events stay on the lead and are excluded).
  const { data: timeline, isLoading: countLoading } = useLeadTimelineQuery(lead.id);
  const n = timeline?.items.filter((i) => i.itemType === "engagement").length ?? 0;
  const nLabel = countLoading ? "…" : String(n);
  const plural = countLoading || n !== 1;

  const confirm = () => {
    if (!reason || updateLead.isPending) return;
    updateLead.mutate(
      { id: lead.id, status: "unqualified", reason },
      {
        onSuccess: () => {
          showToast(`Disqualified · ${n} activit${n === 1 ? "y" : "ies"} kept on records`, {
            tone: "success",
          });
          onClose();
        },
      },
    );
  };

  return (
    <LeadModalShell
      title="Disqualify lead"
      subtitle={`${lead.contact?.name ?? "Lead"}${lead.district ? ` · ${lead.district.name}` : ""}`}
      onClose={onClose}
      maxWidth="max-w-[480px]"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!reason || updateLead.isPending}
            className={BTN_DANGER}
          >
            <X size={15} aria-hidden />
            Disqualify · keep history
          </button>
        </>
      }
    >
      <p className="mb-4 text-[13.5px] leading-[1.5] text-[#5C5277]">
        The lead leaves the pipeline and the acceptance SLA stops. Its activity is not
        deleted — all <strong className="font-bold text-[#403770]">{nLabel}</strong> event
        {plural ? "s" : ""} stay on the records below and reappear if the lead ever
        re-opens.
      </p>
      <MicroLabel className="mb-2">History preserved on</MicroLabel>
      <div className="mb-5 flex flex-col gap-2">
        <RetainedRow
          Icon={Users}
          title={lead.contact?.name ?? "Contact record"}
          sub="Contact record"
        />
        <RetainedRow
          Icon={School}
          title={lead.district?.name ?? "District record"}
          sub="District record"
        />
      </div>
      <FieldLabel req>Disqualification reason</FieldLabel>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Disqualification reason"
        className={SELECT_CLASS}
        style={{ borderColor: reason ? "#C2BBD4" : "#F7C9C5" }}
      >
        <option value="">Select a reason…</option>
        {UNQUAL_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </LeadModalShell>
  );
}
