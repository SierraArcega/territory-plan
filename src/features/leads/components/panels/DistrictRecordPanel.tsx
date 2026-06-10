"use client";

// District record panel — the account view: "Account" badge, retention note,
// stat cells (Schools / Contacts / Leads / Points), engaged Schools section
// (per-school contact + activity counts → School record), Contacts list
// (school name or "District office"), Leads list (active + closed), and the
// full account activity timeline. Per handoff §6 / RecordPanels.jsx.
// "Points" = sum of lead scores in the district (lib/server/record-helpers.ts).

import { GraduationCap, School, UserCheck } from "lucide-react";
import { useDistrictRecordQuery } from "@/features/leads/lib/queries";
import { leadTypeConfig } from "@/features/leads/lib/status-config";
import type { RecordRef } from "@/features/leads/lib/types";
import MicroLabel from "../bits/MicroLabel";
import StatusBadge from "../bits/StatusBadge";
import { TimelineList } from "../LeadActivityTimeline";
import RecordPanelShell, {
  RecordPanelSkeleton,
  type BreadcrumbItem,
} from "./RecordPanelShell";
import {
  ContactInitials,
  RecordIconTile,
  RetentionNote,
  RowButton,
  StatCell,
  activitiesLabel,
} from "./record-bits";

export interface DistrictRecordPanelProps {
  leaid: string;
  trail: BreadcrumbItem[];
  onBack: () => void;
  onClose: () => void;
  onOpenRecord: (ref: RecordRef) => void;
  /** Jump back to a lead in the pipeline (clears the record stack). */
  onOpenLead: (leadId: string) => void;
  /** Injectable clock for tests. */
  now?: Date;
}

export default function DistrictRecordPanel({
  leaid,
  trail,
  onBack,
  onClose,
  onOpenRecord,
  onOpenLead,
  now,
}: DistrictRecordPanelProps) {
  const { data, isLoading, isError } = useDistrictRecordQuery(leaid);

  // Per the prototype: only Unqualified counts as closed (an SQL lead is a
  // live opportunity downstream).
  const activeLeads = data ? data.leads.filter((l) => l.status !== "unqualified").length : 0;

  return (
    <RecordPanelShell
      kicker="District record"
      title={data?.district.name ?? "District"}
      subtitle={
        data
          ? [
              data.district.city
                ? `${data.district.city}, ${data.district.stateAbbrev ?? ""}`.replace(/, $/, "")
                : null,
              `NCES ${data.district.leaid}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : null
      }
      badges={
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-[#E8F1F5] px-[9px] py-0.5 text-[11px] font-semibold text-[#4D7285]">
          <School size={11} aria-hidden />
          Account
        </span>
      }
      trail={trail}
      onBack={onBack}
      onClose={onClose}
    >
      {isLoading ? (
        <RecordPanelSkeleton />
      ) : isError || !data ? (
        <div className="py-2 text-[12.5px] text-[#C25A52]">
          Couldn&apos;t load this district record.
        </div>
      ) : (
        <>
          <RetentionNote>
            Every activity below is anchored to this district. Contacts and leads
            come and go — disqualified, sales-qualified, reassigned — but this
            account-level history is never lost.
          </RetentionNote>

          <div className="mb-[22px] grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label="Schools" value={data.stats.schools} />
            <StatCell label="Contacts" value={data.stats.contacts} />
            <StatCell label="Leads" value={data.stats.leads} />
            <StatCell label="Points" value={`+${data.stats.points}`} tone="good" />
          </div>

          {data.schools.length > 0 && (
            <>
              <MicroLabel className="mb-2.5">Schools · {data.schools.length}</MicroLabel>
              <div className="mb-[22px] flex flex-col gap-2">
                {data.schools.map((s) => (
                  <RowButton
                    key={s.ncessch}
                    onClick={() =>
                      onOpenRecord({ type: "school", id: s.ncessch, label: s.name })
                    }
                  >
                    <RecordIconTile icon={GraduationCap} bg="#E8F1F5" fg="#4D7285" />
                    <span className="min-w-0 flex-1">
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
                        {s.name}
                      </span>
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                        {[s.level, `NCES ${s.ncessch}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[10.5px] leading-snug tabular-nums text-[#A69DC0]">
                      <span className="block whitespace-nowrap">
                        {s.contactCount} contact{s.contactCount === 1 ? "" : "s"}
                      </span>
                      <span className="block whitespace-nowrap">
                        {activitiesLabel(s.activityCount)}
                      </span>
                    </span>
                  </RowButton>
                ))}
              </div>
            </>
          )}

          <MicroLabel className="mb-2.5">
            Contacts at this district · {data.stats.contacts}
          </MicroLabel>
          <div className="mb-[22px] flex flex-col gap-2">
            {data.contacts.map((c) => (
              <RowButton
                key={c.id}
                onClick={() => onOpenRecord({ type: "contact", id: c.id, label: c.name })}
              >
                <ContactInitials name={c.name} />
                <span className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
                    {c.name}
                  </span>
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                    {[c.title, c.schoolName ?? "District office"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[3px]">
                  {c.leadStatus ? (
                    <StatusBadge status={c.leadStatus} size="sm" />
                  ) : (
                    <span className="whitespace-nowrap text-[10.5px] font-semibold text-[#A69DC0]">
                      No lead
                    </span>
                  )}
                  <span className="whitespace-nowrap text-[10.5px] tabular-nums text-[#A69DC0]">
                    {activitiesLabel(c.activityCount)}
                  </span>
                </span>
              </RowButton>
            ))}
            {data.contacts.length === 0 && (
              <div className="py-1 text-[12.5px] text-[#A69DC0]">
                No contacts at this district yet.
              </div>
            )}
          </div>

          {data.leads.length > 0 && (
            <>
              <MicroLabel className="mb-2.5">
                Leads · {activeLeads} active · {data.leads.length - activeLeads} closed
              </MicroLabel>
              <div className="mb-[22px] flex flex-col gap-2">
                {data.leads.map((l) => (
                  <RowButton key={l.id} onClick={() => onOpenLead(l.id)}>
                    <RecordIconTile icon={UserCheck} bg="#FEF2F1" fg="#F37167" size={14} />
                    <span className="min-w-0 flex-1">
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#403770]">
                        {l.contactName ?? "Lead"}
                      </span>
                      <span className="block whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                        {leadTypeConfig(l.leadType).label} · score {l.score}
                      </span>
                    </span>
                    <StatusBadge status={l.status} size="sm" />
                  </RowButton>
                ))}
              </div>
            </>
          )}

          <MicroLabel className="mb-3">Account activity · full history</MicroLabel>
          <TimelineList
            items={data.items}
            emptyText="No activity on this district yet."
            now={now}
          />
        </>
      )}
    </RecordPanelShell>
  );
}
