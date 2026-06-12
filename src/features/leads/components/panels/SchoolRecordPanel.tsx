"use client";

// School record panel — "School" badge, roll-up note, stat cells (Contacts /
// Activities / Points), "Part of district" link, contacts at the school, and
// the school activity timeline. Per handoff §6 / RecordPanels.jsx.
// "Points" = sum of lead scores at this school (lib/server/record-helpers.ts).

import { ArrowRight, GraduationCap, School } from "lucide-react";
import { useSchoolRecordQuery } from "@/features/leads/lib/queries";
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

export interface SchoolRecordPanelProps {
  ncessch: string;
  trail: BreadcrumbItem[];
  onBack: () => void;
  onClose: () => void;
  onOpenRecord: (ref: RecordRef) => void;
  /** Injectable clock for tests. */
  now?: Date;
}

export default function SchoolRecordPanel({
  ncessch,
  trail,
  onBack,
  onClose,
  onOpenRecord,
  now,
}: SchoolRecordPanelProps) {
  const { data, isLoading, isError } = useSchoolRecordQuery(ncessch);

  return (
    <RecordPanelShell
      kicker="School record"
      title={data?.school.name ?? "School"}
      subtitle={
        data
          ? [data.school.level, `NCES ${data.school.ncessch}`].filter(Boolean).join(" · ")
          : null
      }
      badges={
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-[#E8F1F5] px-[9px] py-0.5 text-[11px] font-semibold text-[#4D7285]">
          <GraduationCap size={11} aria-hidden />
          School
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
          Couldn&apos;t load this school record.
        </div>
      ) : (
        <>
          <RetentionNote>
            This school sits inside {data.district?.name ?? "its district"}. Activity
            here rolls up to the district account, so the history stays attached to
            both records.
          </RetentionNote>

          <div className="mb-[22px] grid grid-cols-3 gap-2">
            <StatCell label="Contacts" value={data.stats.contacts} />
            <StatCell label="Activities" value={data.stats.activities} />
            <StatCell label="Points" value={`+${data.stats.points}`} tone="good" />
          </div>

          <MicroLabel className="mb-2">Part of district</MicroLabel>
          {data.district && (
            <div className="mb-[22px]">
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
                    NCES {data.district.leaid}
                    {data.district.city
                      ? ` · ${data.district.city}, ${data.district.stateAbbrev ?? ""}`.replace(/, $/, "")
                      : ""}{" "}
                    · open district record
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-[#C2BBD4]" aria-hidden />
              </RowButton>
            </div>
          )}

          <MicroLabel className="mb-2.5">
            Contacts at this school · {data.stats.contacts}
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
                    {c.title ?? "—"}
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
                No contacts at this school yet.
              </div>
            )}
          </div>

          <MicroLabel className="mb-3">School activity · full history</MicroLabel>
          <TimelineList
            items={data.items}
            emptyText="No activity at this school yet."
            now={now}
          />
        </>
      )}
    </RecordPanelShell>
  );
}
