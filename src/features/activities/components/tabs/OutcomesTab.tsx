"use client";

import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CONFIGS,
  type OutcomeType,
} from "@/features/activities/outcome-types";
import { getCategoryForType, type ActivityType } from "@/features/activities/types";

interface OutcomesTabProps {
  activityType: ActivityType;
  outcomeType: string | null;
  outcome: string | null;
  onOutcomeTypeChange: (outcomeType: string | null) => void;
  onOutcomeChange: (outcome: string | null) => void;
}

export default function OutcomesTab({
  activityType,
  outcomeType,
  outcome,
  onOutcomeTypeChange,
  onOutcomeChange,
}: OutcomesTabProps) {
  const category = getCategoryForType(activityType);
  const availableOutcomes = OUTCOMES_BY_CATEGORY[category] || [];

  return (
    <div className="space-y-5">
      {/* Outcome type pills */}
      <div>
        <p className="text-xs font-medium text-[#8A80A8] mb-2.5">What was the outcome?</p>
        <div className="flex flex-wrap gap-2">
          {availableOutcomes.map((ot) => {
            const config = OUTCOME_CONFIGS[ot];
            const isSelected = outcomeType === ot;

            return (
              <button
                key={ot}
                type="button"
                onClick={() => onOutcomeTypeChange(isSelected ? null : ot)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isSelected
                    ? "ring-2 ring-offset-1 shadow-sm"
                    : "hover:shadow-sm"
                }`}
                style={{
                  backgroundColor: isSelected ? config.bgColor : "#F7F5FA",
                  color: isSelected ? config.color : "#6E6390",
                  ...(isSelected ? { boxShadow: `0 0 0 2px ${config.color}` } : {}),
                }}
                title={config.description}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Outcome note */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Outcome Notes
        </label>
        <textarea
          value={outcome || ""}
          onChange={(e) => onOutcomeChange(e.target.value || null)}
          placeholder="Add notes about what happened..."
          rows={3}
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
