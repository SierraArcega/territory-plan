"use client";

// Link opportunity — standalone create-Stage-0 / link-existing flow per
// LeadOpportunity.jsx. Opened from the detail panel: required when a lead sits
// in Meeting Scheduled without an opp, optional from Working.

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import {
  useDistrictOpenOppsQuery,
  useLinkOpportunityMutation,
  type DistrictOpenOpp,
} from "@/features/leads/lib/queries";
import { fmtMoney } from "@/features/leads/lib/status-config";
import {
  oppDraftPayload,
  oppDraftValid,
  suggestOppDraft,
} from "@/features/leads/lib/opp-draft";
import type { Lead } from "@/features/leads/lib/types";
import LeadModalShell, { BTN_GHOST, BTN_PRIMARY } from "./modal-chrome";
import OppFields from "./OppFields";

export interface LinkOpportunityModalProps {
  lead: Lead;
  onClose: () => void;
  /** Injectable clock for tests (close-date suggestion). */
  now?: Date;
}

export default function LinkOpportunityModal({ lead, onClose, now }: LinkOpportunityModalProps) {
  const [draft, setDraft] = useState(() => suggestOppDraft(lead, now));
  // The picked row may come from the cross-district search, not the district
  // list — keep it for the success toast's amount.
  const [picked, setPicked] = useState<DistrictOpenOpp | null>(null);
  const linkOpp = useLinkOpportunityMutation();
  const { showToast } = useToast();
  const { data: openOpps, isLoading: oppsLoading } = useDistrictOpenOppsQuery(
    lead.district?.leaid ?? "",
  );

  const contactName = lead.contact?.name ?? "Lead";
  const isLink = draft.mode === "existing";
  const canSave = oppDraftValid(draft) && !linkOpp.isPending;

  const save = () => {
    if (!canSave) return;
    const linked = isLink
      ? (openOpps?.find((o) => o.id === draft.existingId) ??
        (picked?.id === draft.existingId ? picked : null))
      : null;
    linkOpp.mutate(oppDraftPayload(lead.id, draft), {
      onSuccess: () => {
        showToast(
          isLink
            ? `Linked to opportunity · ${fmtMoney(linked?.netBookingAmount ?? null)}`
            : `Stage 0 opportunity created · ${fmtMoney(draft.amount)}`,
          { tone: "success" },
        );
        onClose();
      },
    });
  };

  return (
    <LeadModalShell
      title="Link opportunity"
      subtitle={
        lead.status === "meeting_scheduled"
          ? `Required for ${contactName} in Meeting Scheduled`
          : `${contactName}${lead.district ? ` · ${lead.district.name}` : ""}`
      }
      onClose={onClose}
      maxWidth="max-w-[440px]"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!canSave} className={BTN_PRIMARY}>
            <Link2 size={15} aria-hidden />
            {isLink ? "Link opportunity" : "Link Stage 0 opportunity"}
          </button>
        </>
      }
    >
      <OppFields
        draft={draft}
        onChange={setDraft}
        openOpps={openOpps}
        openOppsLoading={oppsLoading}
        districtLeaId={lead.district?.leaid}
        districtName={lead.district?.name}
        onPickOpp={setPicked}
      />
    </LeadModalShell>
  );
}
