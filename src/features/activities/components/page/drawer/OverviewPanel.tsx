"use client";

import { format } from "date-fns";
import { Clock, MapPin, User2, FileText, DollarSign, Paperclip } from "lucide-react";
import {
  ACTIVITY_STATUS_CONFIG,
  type ActivityStatus,
  type ActivityType,
} from "@/features/activities/types";
import FieldLabel from "@/features/shared/components/FieldLabel";
import type { Activity } from "@/features/shared/types/api-types";

interface OverviewPanelProps {
  activity: Activity;
  readOnly: boolean;
  onPatch: (
    patch: Partial<{
      type: ActivityType;
      title: string;
      status: ActivityStatus;
      startDate: string | null;
      endDate: string | null;
      notes: string | null;
    }>
  ) => void;
  notesCount: number;
  attachmentsCount: number;
}

// 5 statuses surfaced as buttons (handoff vocabulary, mapped to project enum).
// `requested` is rendered with the "Tentative" label since the project's enum
// doesn't include `tentative` — same semantic, different name.
const PRIMARY_STATUSES: { id: ActivityStatus; label: string }[] = [
  { id: "planned", label: "Planned" },
  { id: "requested", label: "Tentative" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const LEGACY_STATUSES: ActivityStatus[] = ["planning", "wrapping_up"];

function localDateTimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function durationMinutes(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export default function OverviewPanel({
  activity,
  readOnly,
  onPatch,
  notesCount,
  attachmentsCount,
}: OverviewPanelProps) {
  const dur = durationMinutes(activity.startDate, activity.endDate);
  const startDisabled = !activity.startDate;
  const expensesTotalCents = activity.expenses.reduce(
    (s, e) => s + (e.amountCents ?? Math.round(Number(e.amount || 0) * 100)),
    0
  );

  function onDurationChange(next: number) {
    if (!activity.startDate) return;
    const startMs = new Date(activity.startDate).getTime();
    const endIso = new Date(startMs + next * 60000).toISOString();
    onPatch({ endDate: endIso });
  }

  const isLegacyStatus = (LEGACY_STATUSES as string[]).includes(activity.status);

  return (
    <div className="space-y-5 px-5 py-5 overflow-auto h-full">
      {/* Status pills */}
      <div>
        <FieldLabel>Status</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {PRIMARY_STATUSES.map(({ id, label }) => {
            const cfg = ACTIVITY_STATUS_CONFIG[id];
            const active = activity.status === id;
            return (
              <button
                key={id}
                type="button"
                disabled={readOnly}
                onClick={() => onPatch({ status: id })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-[#403770] text-white border-[#403770]"
                    : "bg-white text-[#6E6390] border-[#E2DEEC] hover:text-[#403770] hover:bg-[#FFFCFA]"
                } ${readOnly ? "opacity-60 cursor-default" : ""}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: active ? "#fff" : cfg.color }}
                />
                {label}
              </button>
            );
          })}
          {isLegacyStatus && (
            <span
              aria-label={`Legacy status ${ACTIVITY_STATUS_CONFIG[activity.status].label}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F7F5FA] text-[#A69DC0] border border-dashed border-[#D4CFE2] cursor-default"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: ACTIVITY_STATUS_CONFIG[activity.status].color }}
              />
              {ACTIVITY_STATUS_CONFIG[activity.status].label} (legacy)
            </span>
          )}
        </div>
      </div>

      {/* When — start + duration-min */}
      <div>
        <FieldLabel>When</FieldLabel>
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <input
            type="datetime-local"
            disabled={readOnly}
            value={localDateTimeValue(activity.startDate)}
            onChange={(e) =>
              onPatch({
                startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-[#C2BBD4] rounded-lg text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA]"
          />
          <div className="relative">
            <input
              type="number"
              disabled={readOnly || startDisabled}
              value={dur || ""}
              min={15}
              step={15}
              onChange={(e) => onDurationChange(Number(e.target.value) || 0)}
              placeholder="min"
              aria-label="Duration in minutes"
              className="w-full px-2 pr-8 py-1.5 text-sm border border-[#C2BBD4] rounded-lg text-[#403770] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA]"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#A69DC0] pointer-events-none">
              min
            </span>
          </div>
        </div>
      </div>

      {/* Where */}
      <div>
        <FieldLabel>Where</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {activity.districts.length === 0 && (
            <span className="text-xs text-[#A69DC0] italic">
              No district linked.{!readOnly && " Manage in activity form."}
            </span>
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
        <FieldLabel>Attendees</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {activity.attendees.length === 0 && (
            <span className="text-xs text-[#A69DC0] italic">No attendees yet.</span>
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
        <FieldLabel optional>Description</FieldLabel>
        <textarea
          key={activity.updatedAt}
          disabled={readOnly}
          rows={4}
          defaultValue={activity.notes ?? ""}
          onBlur={(e) => onPatch({ notes: e.target.value.trim() || null })}
          placeholder="Add agenda, context, meeting goals…"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA] resize-none"
        />
      </div>

      {/* Mini stat strip */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[#FFFCFA] border border-[#E2DEEC]">
        <StatTile icon={<FileText className="w-3.5 h-3.5" />} label="Notes" value={notesCount} />
        <StatTile
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Expenses"
          value={`$${(expensesTotalCents / 100).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`}
        />
        <StatTile
          icon={<Paperclip className="w-3.5 h-3.5" />}
          label="Files"
          value={attachmentsCount}
        />
      </div>

      {/* Source footnote */}
      <div className="pt-3 text-[11px] text-[#A69DC0] border-t border-[#F0EDF7] flex items-center gap-2 flex-wrap">
        <Clock className="w-3 h-3" />
        <span>
          {readOnly
            ? "Team activity · read-only"
            : activity.googleEventId
            ? "Your activity · changes sync to Google Calendar"
            : "Your activity · manual entry"}
        </span>
        <span>· Last updated {format(new Date(activity.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
      </div>
    </div>
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
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-md flex-shrink-0 bg-white border border-[#E2DEEC] text-[#403770] inline-flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A80A8] truncate">
          {label}
        </div>
        <div className="text-sm font-bold text-[#403770] tabular-nums">{value}</div>
      </div>
    </div>
  );
}
