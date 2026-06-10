"use client";

// Schedule meeting — Working → Meeting Scheduled with a meeting date/time.
// PATCH { status: meeting_scheduled, meetingAt }; the server creates the
// Stage 0 opportunity as part of the transition when none is linked yet
// (the lead-to-opp handoff), which the banner here announces.

import { useState } from "react";
import { Briefcase, Calendar } from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import { useUpdateLeadMutation } from "@/features/leads/lib/queries";
import { OPP_STAGES } from "@/features/leads/lib/status-config";
import { addBizDays } from "@/features/leads/lib/sla";
import type { Lead } from "@/features/leads/lib/types";
import LeadModalShell, { BTN_GHOST, BTN_PRIMARY, FIELD_CLASS, FieldLabel } from "./modal-chrome";

const STAGE0 = OPP_STAGES[0];

/** Next business day at 10:00 local, formatted for <input type="datetime-local">. */
function defaultMeetingAt(now: Date): string {
  const d = addBizDays(now, 1);
  d.setHours(10, 0, 0, 0);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ScheduleMeetingModalProps {
  lead: Lead;
  onClose: () => void;
  /** Injectable clock for tests (default meeting suggestion). */
  now?: Date;
}

export default function ScheduleMeetingModal({ lead, onClose, now }: ScheduleMeetingModalProps) {
  const [meetingAt, setMeetingAt] = useState(() => defaultMeetingAt(now ?? new Date()));
  const updateLead = useUpdateLeadMutation();
  const { showToast } = useToast();

  const contactName = lead.contact?.name ?? "Lead";
  const willCreateOpp = !lead.opportunity;
  const canSave = !!meetingAt && !updateLead.isPending;

  const save = () => {
    if (!canSave) return;
    updateLead.mutate(
      {
        id: lead.id,
        status: "meeting_scheduled",
        meetingAt: new Date(meetingAt).toISOString(),
      },
      {
        onSuccess: () => {
          showToast(
            willCreateOpp
              ? `${contactName} → Meeting Scheduled · Stage 0 opportunity created`
              : `${contactName} → Meeting Scheduled`,
            { tone: "success" },
          );
          onClose();
        },
      },
    );
  };

  return (
    <LeadModalShell
      title="Schedule meeting"
      subtitle={`${contactName}${lead.district ? ` · ${lead.district.name}` : ""}`}
      onClose={onClose}
      maxWidth="max-w-[440px]"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!canSave} className={BTN_PRIMARY}>
            <Calendar size={15} aria-hidden />
            Move to Meeting Scheduled
          </button>
        </>
      }
    >
      <div className="mb-4">
        <FieldLabel req>Meeting date &amp; time</FieldLabel>
        <input
          type="datetime-local"
          value={meetingAt}
          onChange={(e) => setMeetingAt(e.target.value)}
          aria-label="Meeting date and time"
          className={`${FIELD_CLASS} cursor-pointer tabular-nums`}
        />
      </div>

      {willCreateOpp && (
        <div
          className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5"
          style={{ background: STAGE0.bg, borderColor: `${STAGE0.dot}33` }}
        >
          <Briefcase size={16} className="shrink-0" style={{ color: STAGE0.fg }} aria-hidden />
          <div className="min-w-0">
            <div
              className="whitespace-nowrap text-[12.5px] font-bold"
              style={{ color: STAGE0.fg }}
            >
              Creates a Stage 0 opportunity
            </div>
            <div className="mt-px text-[11px] text-[#8A80A8]">
              Opens at {STAGE0.prob}% · advances through the pipeline from here
            </div>
          </div>
        </div>
      )}
    </LeadModalShell>
  );
}
