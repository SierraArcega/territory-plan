"use client";

import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import EditableText from "@/features/shared/components/EditableText";
import EditableSelect from "@/features/shared/components/EditableSelect";
import FieldLabel from "@/features/shared/components/FieldLabel";
import type {
  ActivityOutcomeDisposition,
  ActivitySentiment,
  DealImpact,
} from "@/features/activities/types";
import type { Activity } from "@/features/shared/types/api-types";

interface OutcomePanelProps {
  activity: Activity;
  readOnly: boolean;
  onPatch: (
    patch: Partial<{
      outcome: string | null;
      sentiment: ActivitySentiment | null;
      nextStep: string | null;
      followUpDate: string | null;
      dealImpact: DealImpact;
      outcomeDisposition: ActivityOutcomeDisposition | null;
    }>
  ) => void;
}

const OUTCOME_CARDS: {
  id: ActivityOutcomeDisposition;
  label: string;
  dot: string;
  desc: string;
}[] = [
  { id: "completed", label: "Completed", dot: "#69B34A", desc: "Activity happened as planned" },
  { id: "no_show", label: "No-show", dot: "#FFCF70", desc: "Attendee missed the meeting" },
  { id: "rescheduled", label: "Rescheduled", dot: "#6EA3BE", desc: "Moved to another date" },
  { id: "cancelled", label: "Cancelled", dot: "#F37167", desc: "Will not happen" },
];

const SENTIMENT_BUTTONS: {
  id: ActivitySentiment;
  label: string;
  icon: React.ReactNode;
  tint: string;
  ink: string;
}[] = [
  { id: "positive", label: "Positive", icon: <ThumbsUp className="w-3.5 h-3.5" />, tint: "#EDFFE3", ink: "#5f665b" },
  { id: "neutral", label: "Neutral", icon: <Minus className="w-3.5 h-3.5" />, tint: "#F7F5FA", ink: "#6E6390" },
  { id: "negative", label: "Negative", icon: <ThumbsDown className="w-3.5 h-3.5" />, tint: "#fef1f0", ink: "#c25a52" },
];

const DEAL_IMPACT_OPTIONS: { id: DealImpact; label: string; dot: string }[] = [
  { id: "none", label: "No change", dot: "#D4CFE2" },
  { id: "progressed", label: "Progressed", dot: "#6EA3BE" },
  { id: "won", label: "Won", dot: "#69B34A" },
  { id: "lost", label: "Lost", dot: "#F37167" },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OutcomePanel({ activity, readOnly, onPatch }: OutcomePanelProps) {
  const disposition = activity.outcomeDisposition;
  const sentiment = activity.sentiment;
  const dealImpact = activity.dealImpact ?? "none";

  return (
    <div className="space-y-5 px-5 py-5 overflow-auto h-full">
      {/* Outcome cards 2x2 */}
      <div>
        <FieldLabel>Outcome</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {OUTCOME_CARDS.map((card) => {
            const active = disposition === card.id;
            return (
              <button
                key={card.id}
                type="button"
                disabled={readOnly}
                onClick={() => onPatch({ outcomeDisposition: card.id })}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  active
                    ? "border-[#403770] bg-[#FFFCFA] shadow-[inset_0_0_0_1px_#403770]"
                    : "border-[#E2DEEC] bg-white hover:bg-[#FFFCFA]"
                } ${readOnly ? "cursor-default" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: card.dot }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-[#403770]">{card.label}</span>
                </div>
                <div className="text-[11px] text-[#8A80A8] mt-0.5 leading-relaxed">
                  {card.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sentiment row */}
      <div>
        <FieldLabel>How did it go?</FieldLabel>
        <div className="flex gap-1.5">
          {SENTIMENT_BUTTONS.map((s) => {
            const active = sentiment === s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={readOnly}
                onClick={() => onPatch({ sentiment: s.id })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                  active
                    ? "border-[#403770] font-semibold"
                    : "border-[#E2DEEC] bg-white text-[#6E6390] font-medium hover:text-[#403770]"
                } ${readOnly ? "cursor-default" : ""}`}
                style={
                  active
                    ? { backgroundColor: s.tint, color: s.ink }
                    : undefined
                }
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next step */}
      <div>
        <FieldLabel optional>Next step</FieldLabel>
        <EditableText
          value={activity.nextStep}
          multiline
          readOnly={readOnly}
          placeholder="e.g. Send proposal by Friday"
          onChange={(v) => onPatch({ nextStep: v.trim() || null })}
          ariaLabel="Next step"
        />
      </div>

      {/* Outcome notes (free-text) */}
      <div>
        <FieldLabel optional>Notes</FieldLabel>
        <textarea
          key={activity.updatedAt}
          disabled={readOnly}
          rows={3}
          defaultValue={activity.outcome ?? ""}
          onBlur={(e) => onPatch({ outcome: e.target.value.trim() || null })}
          placeholder="Capture what happened, what was discussed, any notable details…"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA] resize-none"
        />
      </div>

      {/* Follow-up + Deal impact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel optional>Follow-up by</FieldLabel>
          <input
            type="date"
            disabled={readOnly}
            value={toDateInputValue(activity.followUpDate)}
            onChange={(e) =>
              onPatch({
                followUpDate: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-[#C2BBD4] rounded-md text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] disabled:bg-[#F7F5FA]"
          />
        </div>
        <div>
          <FieldLabel optional>Deal impact</FieldLabel>
          <EditableSelect<DealImpact>
            value={dealImpact}
            options={DEAL_IMPACT_OPTIONS}
            readOnly={readOnly}
            ariaLabel="Deal impact"
            onChange={(v) => onPatch({ dealImpact: v })}
          />
        </div>
      </div>
    </div>
  );
}
