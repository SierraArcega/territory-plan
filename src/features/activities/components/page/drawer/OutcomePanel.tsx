"use client";

import FieldLabel from "@/features/shared/components/FieldLabel";
import StarRating from "@/features/activities/components/StarRating";
import OpportunitySearch from "@/features/activities/components/OpportunitySearch";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CONFIGS,
  type OutcomeType,
} from "@/features/activities/outcome-types";
import {
  getCategoryForType,
  type ActivityType,
} from "@/features/activities/types";
import type { Activity, ActivityOpportunityLink } from "@/features/shared/types/api-types";
import type { OpportunityResult } from "@/features/activities/lib/outcome-types-api";

interface OutcomePanelProps {
  activity: Activity;
  readOnly: boolean;
  onPatch: (
    patch: Partial<{
      outcome: string | null;
      outcomeType: string | null;
      rating: number;
      opportunityIds: string[];
    }>
  ) => void;
}

function toOpportunityResult(o: ActivityOpportunityLink): OpportunityResult {
  return {
    id: o.id,
    name: o.name,
    stage: o.stage,
    netBookingAmount: o.netBookingAmount,
    districtName: o.districtName,
    districtLeaId: o.districtLeaId,
    closeDate: o.closeDate,
  };
}

export default function OutcomePanel({ activity, readOnly, onPatch }: OutcomePanelProps) {
  const category = getCategoryForType(activity.type as ActivityType);
  const outcomes: OutcomeType[] = OUTCOMES_BY_CATEGORY[category] ?? [];
  const selectedOutcome = activity.outcomeType as OutcomeType | null;
  const linkedOpportunities = activity.opportunities.map(toOpportunityResult);

  return (
    <div className="space-y-5 px-5 py-5 overflow-auto h-full">
      {/* Star rating */}
      <div>
        <FieldLabel>Rating</FieldLabel>
        <StarRating
          value={activity.rating ?? 0}
          onChange={(n) => onPatch({ rating: n })}
          disabled={readOnly}
        />
      </div>

      {/* Outcome pills (single-select by category) */}
      <div>
        <FieldLabel>Outcome</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((o) => {
            const cfg = OUTCOME_CONFIGS[o];
            const active = selectedOutcome === o;
            return (
              <button
                key={o}
                type="button"
                disabled={readOnly}
                onClick={() =>
                  onPatch({ outcomeType: active ? null : o })
                }
                className={`text-left p-3 rounded-lg border [transition-duration:120ms] transition-colors ${
                  active
                    ? "border-[#403770] bg-[#FFFCFA] shadow-[inset_0_0_0_1px_#403770]"
                    : "border-[#E2DEEC] bg-white hover:bg-[#FFFCFA]"
                } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden>
                    {cfg.icon}
                  </span>
                  <span className="text-sm font-semibold text-[#403770]">{cfg.label}</span>
                </div>
                <div className="text-[11px] text-[#8A80A8] mt-0.5 leading-relaxed">
                  {cfg.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
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

      {/* Linked deals */}
      <div>
        <FieldLabel optional>Linked deals</FieldLabel>
        <OpportunitySearch
          value={linkedOpportunities}
          onChange={(opps) =>
            onPatch({ opportunityIds: opps.map((o) => o.id) })
          }
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
