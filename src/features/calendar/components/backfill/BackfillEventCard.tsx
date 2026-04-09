// BackfillEventCard — The rich inline-edit card used inside the backfill wizard.
// Shows the event with a confidence banner, then editable Type / Plan / District /
// Notes fields, and a read-only attendees list. Local state resets when a new
// event id arrives from props.

"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { CalendarEvent } from "@/features/shared/types/api-types";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ALL_ACTIVITY_TYPES,
  type ActivityType,
} from "@/features/activities/types";
import { MultiSelect } from "@/features/shared/components/MultiSelect";
import { useTerritoryPlans } from "@/features/plans/lib/queries";

export interface BackfillConfirmOverrides {
  activityType: ActivityType;
  title: string;
  planIds: string[];
  districtLeaids: string[];
  notes: string | null;
}

interface BackfillEventCardProps {
  event: CalendarEvent;
  onConfirm: (overrides: BackfillConfirmOverrides) => void;
  onSkip: () => void;
  onDismiss: () => void;
  isSaving: boolean;
}

type ConfidenceVariant = "high" | "medium" | "low" | "none";

interface ConfidenceStyle {
  label: string;
  icon: string;
  className: string;
}

const CONFIDENCE_STYLES: Record<ConfidenceVariant, ConfidenceStyle> = {
  high: {
    label: "Strong match",
    icon: "✨",
    className: "bg-[#EDFFE3] text-[#5C8A3F] border-[#8AA891]/30",
  },
  medium: {
    label: "Possible match",
    icon: "💡",
    className: "bg-[#E8F1F5] text-[#4E7C94] border-[#8bb5cb]/30",
  },
  low: {
    label: "No match found",
    icon: "❔",
    className: "bg-[#FFF8EC] text-[#8A6A00] border-[#E8C77A]/40",
  },
  none: { label: "", icon: "", className: "" },
};

function formatTimeRange(event: CalendarEvent): { date: string; time: string; duration: string } {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const date = format(start, "EEE, MMM d, yyyy");
  const time = `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const duration =
    minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10}h` : `${minutes}m`;
  return { date, time, duration };
}

export default function BackfillEventCard({
  event,
  onConfirm,
  onSkip,
  onDismiss,
  isSaving,
}: BackfillEventCardProps) {
  const { data: plans } = useTerritoryPlans();

  const initialType: ActivityType =
    (event.suggestedActivityType as ActivityType | null) ?? "program_check_in";
  const initialPlanIds = useMemo(
    () => (event.suggestedPlanId ? [event.suggestedPlanId] : []),
    [event.suggestedPlanId]
  );
  const initialDistrictLeaids = useMemo(
    () => (event.suggestedDistrictId ? [event.suggestedDistrictId] : []),
    [event.suggestedDistrictId]
  );
  const initialNotes = event.description ?? "";

  // Local state — resets whenever a new event.id is passed in
  const [title, setTitle] = useState(event.title);
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [planIds, setPlanIds] = useState<string[]>(initialPlanIds);
  const [districtLeaids, setDistrictLeaids] = useState<string[]>(initialDistrictLeaids);
  const [notes, setNotes] = useState<string>(initialNotes);

  useEffect(() => {
    setTitle(event.title);
    setActivityType(
      (event.suggestedActivityType as ActivityType | null) ?? "program_check_in"
    );
    setPlanIds(event.suggestedPlanId ? [event.suggestedPlanId] : []);
    setDistrictLeaids(event.suggestedDistrictId ? [event.suggestedDistrictId] : []);
    setNotes(event.description ?? "");
    // We intentionally only reset when event.id changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  // Build plan options from all active plans + guarantee the suggested plan is present
  const planOptions = useMemo(() => {
    const list = (plans ?? [])
      .filter((p) => p.status === "planning" || p.status === "working")
      .map((p) => ({ value: p.id, label: p.name }));
    // If the suggested plan isn't in the list (e.g. archived), make sure it's still selectable
    if (
      event.suggestedPlanId &&
      !list.some((opt) => opt.value === event.suggestedPlanId)
    ) {
      list.unshift({
        value: event.suggestedPlanId,
        label: event.suggestedPlanName ?? "Suggested plan",
      });
    }
    return list;
  }, [plans, event.suggestedPlanId, event.suggestedPlanName]);

  // District options — just the suggested district when present. Users can clear
  // the selection; editing to a different district happens via the full Edit &
  // Confirm flow in the main inbox. This keeps the wizard focused on triage.
  const districtOptions = useMemo(() => {
    if (!event.suggestedDistrictId) return [];
    const label = event.suggestedDistrictName
      ? event.suggestedDistrictState
        ? `${event.suggestedDistrictName} (${event.suggestedDistrictState})`
        : event.suggestedDistrictName
      : event.suggestedDistrictId;
    return [{ value: event.suggestedDistrictId, label }];
  }, [event.suggestedDistrictId, event.suggestedDistrictName, event.suggestedDistrictState]);

  const typeOptions = useMemo(
    () => ALL_ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] })),
    []
  );

  const { date: dateText, time: timeText, duration } = formatTimeRange(event);

  const confidence: ConfidenceVariant = event.matchConfidence as ConfidenceVariant;
  const confidenceStyle = CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.none;
  const showConfidence = confidence !== "none" && confidence !== undefined;

  const handleSave = () => {
    if (isSaving) return;
    onConfirm({
      activityType,
      title: title.trim() || event.title,
      planIds,
      districtLeaids,
      notes: notes.trim() ? notes.trim() : null,
    });
  };

  const cardClasses = `
    bg-white rounded-2xl border border-[#D4CFE2] overflow-hidden
    ${isSaving ? "pointer-events-none opacity-70" : ""}
  `;

  return (
    <div className={cardClasses} data-testid="backfill-event-card">
      {/* Confidence banner */}
      {showConfidence && (
        <div
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium border-b ${confidenceStyle.className}`}
        >
          <span aria-hidden="true">{confidenceStyle.icon}</span>
          <span>{confidenceStyle.label}</span>
          {event.suggestedDistrictName && (
            <span className="text-[#6E6390]">
              · {event.suggestedDistrictName}
              {event.suggestedDistrictState && ` (${event.suggestedDistrictState})`}
            </span>
          )}
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="sr-only" htmlFor="backfill-title">
            Meeting title
          </label>
          <input
            id="backfill-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xl font-semibold text-[#403770] bg-transparent focus:outline-none focus:ring-2 focus:ring-[#F37167] rounded px-1 -mx-1"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-[#8A80A8]">
            <span aria-hidden="true">🗓</span>
            <span>{dateText}</span>
            <span aria-hidden="true">·</span>
            <span>{timeText}</span>
            <span aria-hidden="true">·</span>
            <span>{duration}</span>
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="backfill-type"
              className="block text-xs font-medium text-[#544A78] uppercase tracking-wider mb-1"
            >
              Activity type
            </label>
            <select
              id="backfill-type"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className="w-full bg-white border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm text-[#403770] focus:ring-2 focus:ring-[#F37167] focus:border-[#F37167] focus:outline-none"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {ACTIVITY_TYPE_ICONS[opt.value as ActivityType]} {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#544A78] uppercase tracking-wider mb-1">
              Plan
            </label>
            <MultiSelect
              id="backfill-plan"
              label="Territory plan"
              options={planOptions}
              selected={planIds}
              onChange={setPlanIds}
              placeholder="Select plan..."
              countLabel="plans"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#544A78] uppercase tracking-wider mb-1">
              District
            </label>
            {districtOptions.length === 0 ? (
              <div className="text-xs italic text-[#A69DC0] py-2">
                No district match found — log this and edit from Activities if needed.
              </div>
            ) : (
              <MultiSelect
                id="backfill-district"
                label="District"
                options={districtOptions}
                selected={districtLeaids}
                onChange={setDistrictLeaids}
                placeholder="Select district..."
                countLabel="districts"
              />
            )}
          </div>
        </div>

        {/* Attendees — read only */}
        {event.attendees.length > 0 && (
          <div>
            <div className="text-xs font-medium text-[#544A78] uppercase tracking-wider mb-2">
              Attendees ({event.attendees.length})
            </div>
            <ul className="space-y-1">
              {event.attendees.map((attendee) => {
                const matched = event.suggestedContacts.find(
                  (c) => c.email?.toLowerCase() === attendee.email.toLowerCase()
                );
                const displayName = matched?.name ?? attendee.name ?? attendee.email;
                const subtitle = matched?.title ?? attendee.email;
                return (
                  <li
                    key={attendee.email}
                    className="flex items-center gap-2 text-sm text-[#403770]"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        matched ? "bg-[#F37167]" : "bg-[#C2BBD4]"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{displayName}</span>
                    {subtitle && subtitle !== displayName && (
                      <span className="text-xs text-[#8A80A8]">· {subtitle}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Notes */}
        <div>
          <label
            htmlFor="backfill-notes"
            className="block text-xs font-medium text-[#544A78] uppercase tracking-wider mb-1"
          >
            Notes
          </label>
          <textarea
            id="backfill-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything to remember from this meeting?"
            className="w-full bg-white border border-[#C2BBD4] rounded-lg px-3 py-2 text-sm text-[#403770] focus:ring-2 focus:ring-[#F37167] focus:border-[#F37167] focus:outline-none resize-none"
          />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#E2DEEC]">
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSaving}
            className="px-3 py-2 text-xs font-medium text-[#8A80A8] hover:text-[#403770] transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isSaving}
            className="px-3 py-2 text-xs font-medium text-[#6E6390] hover:text-[#403770] transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  data-testid="save-spinner"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <span aria-hidden="true">★</span>
                Save &amp; Next
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
