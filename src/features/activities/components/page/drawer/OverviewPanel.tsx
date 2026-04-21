"use client";

import { format } from "date-fns";
import { Clock, MapPin, User2, FileText, DollarSign, Paperclip } from "lucide-react";
import {
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityStatus,
} from "@/features/activities/types";
import type { Activity } from "@/features/shared/types/api-types";

interface OverviewPanelProps {
  activity: Activity;
  notesCount: number;
  expensesTotal: number;
  attachmentsCount: number;
  readOnly: boolean;
  onPatch: (patch: Partial<{ status: ActivityStatus; startDate: string | null; endDate: string | null; notes: string | null }>) => void;
}

function localDateTimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OverviewPanel({
  activity,
  notesCount,
  expensesTotal,
  attachmentsCount,
  readOnly,
  onPatch,
}: OverviewPanelProps) {
  return (
    <div className="space-y-5 px-5 py-5">
      {/* Status pills */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
          Status
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VALID_ACTIVITY_STATUSES.map((s) => {
            const cfg = ACTIVITY_STATUS_CONFIG[s];
            const active = activity.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={readOnly}
                onClick={() => onPatch({ status: s })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#403770] text-white"
                    : "bg-[#F7F5FA] text-[#6E6390] hover:text-[#403770] hover:bg-[#EFEDF5]"
                } ${readOnly ? "opacity-60 cursor-default" : ""}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: active ? "#fff" : cfg.color }}
                />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* When */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
          When
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <input
              type="datetime-local"
              disabled={readOnly}
              value={localDateTimeValue(activity.startDate)}
              onChange={(e) =>
                onPatch({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full px-2 py-1.5 text-sm border border-[#C2BBD4] rounded-lg text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA]"
            />
          </Field>
          <Field label="End">
            <input
              type="datetime-local"
              disabled={readOnly}
              value={localDateTimeValue(activity.endDate)}
              onChange={(e) =>
                onPatch({ endDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              className="w-full px-2 py-1.5 text-sm border border-[#C2BBD4] rounded-lg text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA]"
            />
          </Field>
        </div>
      </div>

      {/* Where + districts (read-only summary; full editing remains in legacy form) */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">Where</div>
        <div className="flex flex-wrap gap-1.5">
          {activity.districts.length === 0 && (
            <span className="text-xs text-[#A69DC0]">No district linked.</span>
          )}
          {activity.districts.slice(0, 6).map((d) => (
            <span
              key={d.leaid}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[#F7F5FA] text-[#403770]"
            >
              <MapPin className="w-3 h-3" />
              {d.name}
              <span className="text-[#A69DC0]">{d.stateAbbrev}</span>
            </span>
          ))}
          {activity.districts.length > 6 && (
            <span className="text-xs text-[#8A80A8] self-center">
              +{activity.districts.length - 6} more
            </span>
          )}
        </div>
      </div>

      {/* Attendees */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
          Attendees
        </div>
        <div className="flex flex-wrap gap-1.5">
          {activity.attendees.length === 0 && (
            <span className="text-xs text-[#A69DC0]">No attendees yet.</span>
          )}
          {activity.attendees.map((a) => (
            <span
              key={a.userId}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[#EEEAF5] text-[#403770]"
            >
              <User2 className="w-3 h-3" />
              {a.fullName || a.userId.slice(0, 6)}
            </span>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
          Description
        </div>
        <textarea
          disabled={readOnly}
          rows={4}
          defaultValue={activity.notes ?? ""}
          onBlur={(e) => onPatch({ notes: e.target.value.trim() || null })}
          placeholder="Add a description for this activity…"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA] resize-none"
        />
      </div>

      {/* Mini stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={<FileText className="w-3.5 h-3.5" />} label="Notes" value={notesCount} />
        <StatTile
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Expenses"
          value={`$${expensesTotal.toLocaleString()}`}
        />
        <StatTile
          icon={<Paperclip className="w-3.5 h-3.5" />}
          label="Files"
          value={attachmentsCount}
        />
      </div>

      {/* Source footnote */}
      <div className="pt-3 text-[11px] text-[#A69DC0] border-t border-[#F0EDF7]">
        {readOnly
          ? "Team activity · read-only"
          : activity.googleEventId
          ? "Your activity · changes sync to Google Calendar"
          : "Your activity · manual entry"}
        {activity.startDate && (
          <span className="ml-2">
            · Last updated{" "}
            {format(new Date(activity.updatedAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        )}
        <span className="ml-2 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-[#8A80A8] mb-0.5 block">{label}</span>
      {children}
    </label>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="px-3 py-2 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold text-[#403770]">{value}</div>
    </div>
  );
}
