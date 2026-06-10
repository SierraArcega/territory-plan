"use client";

// Contact record panel — the durable view of a person, independent of any
// lead's status: retention note when there's no active lead, stat cells
// (Activities / Total points / Lead), details, "Works at" school + district
// rows, a lead row linking back to the pipeline, and the contact's full
// activity timeline. Per handoff §6 / RecordPanels.jsx → ContactRecordPanel.
//
// "Points" = the engagement score on the contact's lead(s) — see
// lib/server/record-helpers.ts.

import { ArrowRight, GraduationCap, School, UserCheck } from "lucide-react";
import { useContactRecordQuery } from "@/features/leads/lib/queries";
import { STATUS_CONFIG } from "@/features/leads/lib/status-config";
import type { RecordRef } from "@/features/leads/lib/types";
import MicroLabel from "../bits/MicroLabel";
import StatusBadge from "../bits/StatusBadge";
import { TimelineList } from "../LeadActivityTimeline";
import RecordPanelShell, {
  RecordPanelSkeleton,
  type BreadcrumbItem,
} from "./RecordPanelShell";
import {
  RecordIconTile,
  RetentionNote,
  RowButton,
  StatCell,
  activitiesLabel,
} from "./record-bits";

export interface ContactRecordPanelProps {
  contactId: number;
  trail: BreadcrumbItem[];
  onBack: () => void;
  onClose: () => void;
  onOpenRecord: (ref: RecordRef) => void;
  /** Jump back to a lead in the pipeline (clears the record stack). */
  onOpenLead: (leadId: string) => void;
  /** Injectable clock for tests. */
  now?: Date;
}

export default function ContactRecordPanel({
  contactId,
  trail,
  onBack,
  onClose,
  onOpenRecord,
  onOpenLead,
  now,
}: ContactRecordPanelProps) {
  const { data, isLoading, isError } = useContactRecordQuery(contactId);

  const lead = data?.lead ?? null;
  const noLead = !lead || lead.status === "unqualified";
  const districtName = data?.district?.name ?? "the district";

  return (
    <RecordPanelShell
      kicker="Contact record"
      title={data?.contact.name ?? "Contact"}
      subtitle={data?.contact.title}
      badges={
        data &&
        (lead ? (
          <StatusBadge status={lead.status} size="sm" />
        ) : (
          <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-[#F4F2F8] px-[9px] py-0.5 text-[11px] font-semibold text-[#8A80A8]">
            No active lead
          </span>
        ))
      }
      trail={trail}
      onBack={onBack}
      onClose={onClose}
    >
      {isLoading ? (
        <RecordPanelSkeleton />
      ) : isError || !data ? (
        <div className="py-2 text-[12.5px] text-[#C25A52]">
          Couldn&apos;t load this contact record.
        </div>
      ) : (
        <>
          {noLead && (
            <RetentionNote>
              {lead && lead.status === "unqualified" ? (
                <>
                  This contact&rsquo;s lead was disqualified
                  {lead.unqualifiedReason ? ` (${lead.unqualifiedReason})` : ""}. Its{" "}
                  <strong>{activitiesLabel(data.stats.activities)}</strong> stay on
                  this contact and on {districtName} — nothing was deleted.
                </>
              ) : (
                <>
                  No active lead points at this contact. Its{" "}
                  <strong>{activitiesLabel(data.stats.activities)}</strong> are
                  retained here and on {districtName}.
                </>
              )}
            </RetentionNote>
          )}

          <div className="mb-5 grid grid-cols-3 gap-2">
            <StatCell label="Activities" value={data.stats.activities} />
            <StatCell label="Total points" value={`+${data.stats.points}`} tone="good" />
            <StatCell
              label="Lead"
              value={lead ? STATUS_CONFIG[lead.status].label.split(" ")[0] : "—"}
            />
          </div>

          <MicroLabel className="mb-3">Details</MicroLabel>
          <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <MicroLabel>Email</MicroLabel>
              <div className="mt-0.5 text-[13px] text-[#403770] [overflow-wrap:anywhere]">
                {data.contact.email ?? "—"}
              </div>
            </div>
            <div>
              <MicroLabel>Phone</MicroLabel>
              <div className="mt-0.5 text-[13px] tabular-nums text-[#403770]">
                {data.contact.phone ?? "—"}
              </div>
            </div>
          </div>

          <MicroLabel className="mb-2">Works at</MicroLabel>
          {data.school && (
            <div className="mb-2">
              <RowButton
                onClick={() =>
                  onOpenRecord({
                    type: "school",
                    id: data.school!.ncessch,
                    label: data.school!.name ?? "School",
                  })
                }
              >
                <RecordIconTile icon={GraduationCap} bg="#E8F1F5" fg="#4D7285" />
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
                    {data.school.name ?? data.school.ncessch}
                  </span>
                  <span className="block whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                    NCES {data.school.ncessch} · open school record
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#C2BBD4]" aria-hidden />
              </RowButton>
            </div>
          )}
          {data.district && (
            <div className="mb-2">
              <RowButton
                onClick={() =>
                  onOpenRecord({
                    type: "district",
                    id: data.district!.leaid,
                    label: data.district!.name,
                  })
                }
              >
                <RecordIconTile icon={School} bg="#EFECFB" fg="#5A4F9E" />
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
                    {data.district.name}
                  </span>
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                    {data.school ? "District" : "District office"} · NCES{" "}
                    {data.district.leaid}
                    {data.district.city
                      ? ` · ${data.district.city}, ${data.district.stateAbbrev ?? ""}`.replace(/, $/, "")
                      : ""}
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#C2BBD4]" aria-hidden />
              </RowButton>
            </div>
          )}
          {lead && (
            <div className="mb-[22px]">
              <RowButton onClick={() => onOpenLead(lead.id)}>
                <RecordIconTile icon={UserCheck} bg="#FEF2F1" fg="#F37167" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-[7px] text-[13.5px] font-semibold text-[#403770]">
                    <span className="whitespace-nowrap">Lead</span>
                    <StatusBadge status={lead.status} size="sm" />
                  </span>
                  <span className="mt-px block whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                    Open the lead in the pipeline
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#C2BBD4]" aria-hidden />
              </RowButton>
            </div>
          )}

          <MicroLabel className="mb-3">Activity &amp; engagement · full history</MicroLabel>
          <TimelineList
            items={data.items}
            emptyText="No activity on this contact yet."
            now={now}
          />
        </>
      )}
    </RecordPanelShell>
  );
}
