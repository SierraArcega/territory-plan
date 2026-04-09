// BackfillEventCard — The rich inline-edit card used inside the backfill wizard.
// Controlled component: the parent BackfillWizard owns the edit state so that
// keyboard shortcuts (Y/Enter) can send the user's latest edits, not the raw
// event suggestions. Shows the event with a confidence banner, editable Type /
// Plan / District / Notes fields, a read-only attendees list, and an optional
// inline error banner when a save attempt fails mid-wizard.

"use client";

import { useMemo } from "react";
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

// Edited, in-flight values for a single event card. The wizard holds this
// state so keyboard shortcuts can read the user's latest edits.
export interface BackfillCardValues {
  title: string;
  activityType: ActivityType;
  planIds: string[];
  districtLeaids: string[];
  notes: string;
}

// Back-compat alias for the old props name. Keep for external callers that
// may still reference BackfillConfirmOverrides.
export type BackfillConfirmOverrides = BackfillCardValues;

// Derive the initial card values from a CalendarEvent's suggestions.
export function initialValuesFromEvent(event: CalendarEvent): BackfillCardValues {
  return {
    title: event.title,
    activityType:
      (event.suggestedActivityType as ActivityType | null) ?? "program_check_in",
    planIds: event.suggestedPlanId ? [event.suggestedPlanId] : [],
    districtLeaids: event.suggestedDistrictId ? [event.suggestedDistrictId] : [],
    notes: event.description ?? "",
  };
}

interface BackfillEventCardProps {
  event: CalendarEvent;
  values: BackfillCardValues;
  onValuesChange: (next: BackfillCardValues) => void;
  onConfirm: (overrides: BackfillCardValues) => void;
  onSkip: () => void;
  onDismiss: () => void;
  isSaving: boolean;
  errorMessage?: string | null;
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
    // Warning tokens from Documentation/UI Framework/tokens.md §Semantic Colors:
    // bg #fffaf1, border #ffd98d, accent #FFCF70 (golden).
    label: "No match found",
    icon: "❔",
    className: "bg-[#fffaf1] text-[#8A6A00] border-[#ffd98d]",
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
  values,
  onValuesChange,
  onConfirm,
  onSkip,
  onDismiss,
  isSaving,
  errorMessage,
}: BackfillEventCardProps) {
  const { data: plans } = useTerritoryPlans();

  const { title, activityType, planIds, districtLeaids, notes } = values;

  const setField = <K extends keyof BackfillCardValues>(key: K, value: BackfillCardValues[K]) => {
    onValuesChange({ ...values, [key]: value });
  };

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
    onConfirm(values);
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
        {/* Inline error banner — shown when a save or dismiss attempt fails */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="backfill-event-error"
            className="px-3 py-2 rounded-lg bg-[#fef1f0] border border-[#f58d85] text-xs text-[#F37167]"
          >
            {errorMessage}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="sr-only" htmlFor="backfill-title">
            Meeting title
          </label>
          <input
            id="backfill-title"
            type="text"
            value={title}
            onChange={(e) => setField("title", e.target.value)}
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
              onChange={(e) => setField("activityType", e.target.value as ActivityType)}
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
              onChange={(next) => setField("planIds", next)}
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
                onChange={(next) => setField("districtLeaids", next)}
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
            onChange={(e) => setField("notes", e.target.value)}
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
