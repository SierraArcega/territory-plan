"use client";

import OutcomesTab from "@/features/activities/components/tabs/OutcomesTab";
import type { Activity } from "@/features/shared/types/api-types";

interface OutcomePanelProps {
  activity: Activity;
  readOnly: boolean;
  onPatch: (patch: { outcomeType?: string | null; outcome?: string | null }) => void;
}

// Wraps the existing OutcomesTab so the per-category outcome system continues
// to drive Activity.outcomeType + Activity.outcome. The new sentiment / deal
// impact / next-step / follow-up fields from the design are intentionally not
// added — the existing outcomeType already covers those signals (e.g.
// follow_up_needed auto-creates a follow-up task).
export default function OutcomePanel({ activity, readOnly, onPatch }: OutcomePanelProps) {
  if (readOnly) {
    return (
      <div className="px-5 py-5 space-y-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
          Outcome
        </div>
        <div className="text-sm text-[#6E6390]">
          {activity.outcomeType || activity.outcome
            ? `${activity.outcomeType ?? ""} ${activity.outcome ? `— ${activity.outcome}` : ""}`.trim()
            : "No outcome captured."}
        </div>
        <p className="text-xs text-[#A69DC0]">
          Read-only — only the activity owner can update outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-5">
      <OutcomesTab
        activityType={activity.type}
        outcomeType={activity.outcomeType}
        outcome={activity.outcome}
        onOutcomeTypeChange={(outcomeType) => onPatch({ outcomeType })}
        onOutcomeChange={(outcome) => onPatch({ outcome })}
      />
    </div>
  );
}
