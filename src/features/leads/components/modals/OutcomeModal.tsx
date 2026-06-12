"use client";

// "What happened?" engagement-outcome capture per LeadOutcomeModal.jsx:
// activity type → star rating (required) → outcome pills → notes → resulting
// lead status (+ required disqualification reason; + required opp when
// entering Meeting Scheduled without one). The engagement is written to the
// shared activities store (contact/district/school junctions) — never the
// lead — via POST /api/leads/[id]/engagement.

import { useState } from "react";
import { Calendar, Mail, Phone, type LucideIcon } from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import {
  useDistrictOpenOppsQuery,
  useLinkOpportunityMutation,
  useLogEngagementMutation,
} from "@/features/leads/lib/queries";
import {
  LEAD_TRANSITIONS,
  OUTCOME_PILLS,
  STATUS_CONFIG,
  STATUS_ORDER,
  UNQUAL_REASONS,
} from "@/features/leads/lib/status-config";
import {
  oppDraftPayload,
  oppDraftValid,
  suggestOppDraft,
} from "@/features/leads/lib/opp-draft";
import type { Lead, LeadStatus } from "@/features/leads/lib/types";
import LeadModalShell, { BTN_PRIMARY, ChoiceButton, SELECT_CLASS } from "./modal-chrome";
import OppFields from "./OppFields";

// Call / Email / Meeting → existing app activity types (mirrors the import
// mapping in lib/server/lead-import.ts — never mint new types).
const ACT_CHOICES: Array<{ key: string; type: string; label: string; Icon: LucideIcon }> = [
  { key: "call", type: "cold_call", label: "Call", Icon: Phone },
  { key: "email", type: "email", label: "Email", Icon: Mail },
  { key: "meeting", type: "discovery_call", label: "Meeting", Icon: Calendar },
];

const SECTION_LABEL =
  "mb-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]";

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className={`p-0.5 text-2xl leading-none transition-colors duration-100 ${
              on ? "text-[#FFCF70]" : "text-[#E2DEEC]"
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export interface OutcomeModalProps {
  lead: Lead;
  onClose: () => void;
  /** Injectable clock for tests (opp close-date suggestion). */
  now?: Date;
}

export default function OutcomeModal({ lead, onClose, now }: OutcomeModalProps) {
  const [actKey, setActKey] = useState("call");
  const [rating, setRating] = useState(0);
  // Single-select — only one outcome persists (outcomeType), so the pills
  // behave like a radio group with deselect (click the active pill to clear).
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>(
    lead.status === "meeting_scheduled" ? "meeting_scheduled" : "working",
  );
  const [reason, setReason] = useState("");
  const [oppDraft, setOppDraft] = useState(() => suggestOppDraft(lead, now));

  const logEngagement = useLogEngagementMutation();
  const linkOpp = useLinkOpportunityMutation();
  const { showToast } = useToast();

  // Offer the current status plus every legal transition (pipeline order) —
  // the same table the server validates with, so no choice can 422.
  const allowed = new Set<LeadStatus>([lead.status, ...LEAD_TRANSITIONS[lead.status]]);
  const statusChoices = STATUS_ORDER.filter((s) => s !== "new" && allowed.has(s));

  const needReason = status === "unqualified";
  const needOpp = status === "meeting_scheduled" && !lead.opportunity;
  const { data: openOpps, isLoading: oppsLoading } = useDistrictOpenOppsQuery(
    lead.district?.leaid ?? "",
  );

  const pending = logEngagement.isPending || linkOpp.isPending;
  const canSave =
    rating >= 1 &&
    (!needReason || !!reason) &&
    (!needOpp || oppDraftValid(oppDraft)) &&
    !pending;

  const toggle = (key: string) => setPick((p) => (p === key ? null : key));

  const save = async () => {
    if (!canSave) return;
    const choice = ACT_CHOICES.find((c) => c.key === actKey)!;
    try {
      // Linking first lets the transition see the opp and skip its blank
      // auto-created Stage 0 (the user's amount/close-date win).
      if (needOpp) {
        await linkOpp.mutateAsync(oppDraftPayload(lead.id, oppDraft));
      }
      await logEngagement.mutateAsync({
        leadId: lead.id,
        type: choice.type,
        title: `${choice.label} · ${lead.district?.name ?? lead.contact?.name ?? "Lead"}`,
        notes: note.trim() || null,
        rating,
        outcomeType: pick,
        resultingStatus: status,
        reason: needReason ? reason : null,
      });
      showToast(`Logged ${choice.label.toLowerCase()} · ${STATUS_CONFIG[status].label}`, {
        tone: "success",
      });
      onClose();
    } catch {
      // Mutation hooks already toast the server error; keep the modal open.
    }
  };

  return (
    <LeadModalShell
      title="What happened?"
      subtitle={`${lead.contact?.name ?? "Lead"}${lead.district ? ` · ${lead.district.name}` : ""}`}
      onClose={onClose}
      maxWidth="max-w-[460px]"
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap text-[13px] font-semibold text-[#A69DC0] hover:text-[#403770]"
          >
            Skip
          </button>
          <button type="button" onClick={save} disabled={!canSave} className={BTN_PRIMARY}>
            Save &amp; close
          </button>
        </div>
      }
    >
      {/* Activity type */}
      <div className="mb-5">
        <div className={SECTION_LABEL}>Activity type</div>
        <div className="flex gap-2">
          {ACT_CHOICES.map((c) => (
            <ChoiceButton key={c.key} active={actKey === c.key} onClick={() => setActKey(c.key)}>
              <c.Icon size={14} aria-hidden />
              {c.label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      {/* Star rating */}
      <div className="mb-5">
        <div className={SECTION_LABEL}>Rate this activity</div>
        <Stars value={rating} onChange={setRating} />
        {rating === 0 && (
          <div className="mt-[5px] text-[11px] font-medium text-[#A69DC0]">Required to save</div>
        )}
      </div>

      {/* Outcome pills */}
      <div className="mb-5">
        <div className={SECTION_LABEL}>How did it go?</div>
        <div className="flex flex-wrap gap-2">
          {OUTCOME_PILLS.map((o) => {
            const on = pick === o.key;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.key)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all duration-[120ms]"
                style={{
                  background: on ? o.color : o.bg,
                  color: on ? "#fff" : o.color,
                  boxShadow: on ? `0 0 0 2px ${o.color}40` : "none",
                }}
              >
                <span aria-hidden>{o.icon}</span>
                {o.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Notes or details — key takeaways, next steps…"
          aria-label="Notes"
          className="mt-3 w-full resize-none rounded-lg border border-[#C2BBD4] px-3 py-2.5 text-[13px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]"
        />
      </div>

      {/* Resulting lead status */}
      <div className={needReason ? "mb-3" : "mb-1"}>
        <div className={SECTION_LABEL}>Set lead status</div>
        <div className="flex flex-wrap gap-2">
          {statusChoices.map((k) => {
            const c = STATUS_CONFIG[k];
            const on = status === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setStatus(k)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-[120ms]"
                style={{
                  borderColor: on ? c.dot : "#D4CFE2",
                  background: on ? c.bg : "#fff",
                  color: on ? c.fg : "#5C5277",
                }}
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: c.dot }}
                  aria-hidden
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage 0 opportunity — required to enter Meeting Scheduled */}
      {needOpp && (
        <div className="mb-1 mt-4 border-t border-[#EFEDF5] pt-[18px]">
          <div className={`${SECTION_LABEL} mb-3 text-[#5A4F9E]`}>
            Link opportunity <span className="text-[#C25A52]">· required</span>
          </div>
          <OppFields
            draft={oppDraft}
            onChange={setOppDraft}
            openOpps={openOpps}
            openOppsLoading={oppsLoading}
            districtLeaId={lead.district?.leaid}
            districtName={lead.district?.name}
          />
        </div>
      )}

      {/* Required disqualification reason */}
      {needReason && (
        <div className="mb-1">
          <div className={`${SECTION_LABEL} mb-1.5`}>
            Disqualification reason <span className="text-[#C25A52]">· required</span>
          </div>
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
        </div>
      )}
    </LeadModalShell>
  );
}
