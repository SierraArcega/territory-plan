"use client";

import { useState } from "react";
import type { LineSuggestion } from "@/features/lineup/lib/queries";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import { useLinkActivityDistricts } from "@/features/activities/lib/queries";
import type { ActivityType } from "@/features/activities/types";

// Use the canonical icons from types when available; fall back to generic pins
// for types that may come from the AI layer (e.g. "meeting", "email") before
// they map cleanly to a real ActivityType.
const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  phone_call: "📞",
  discovery_call: "🔍",
  email_campaign: "📧",
  demo: "🖥️",
  conference: "🎤",
  proposal_review: "📋",
  customer_check_in: "🤝",
  road_trip: "🚗",
  trade_show: "🎪",
  school_visit_day: "🏫",
  linkedin_message: "💼",
  // Friendly aliases that may arrive from the rules engine
  email: "✉️",
  meeting: "🤝",
  other: "📌",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

interface SuggestionCardProps {
  suggestion: LineSuggestion;
}

export default function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkDistricts = useLinkActivityDistricts();

  const icon = ACTIVITY_TYPE_ICONS[suggestion.activityType] ?? "📌";

  // After the activity is created in the modal, link the district if one was
  // specified. If the link request fails (e.g. network issue) we don't want to
  // block the user — show an inline error so they can add it manually later.
  const handleActivityCreated = async (activityId: string) => {
    if (suggestion.districtLeaid) {
      try {
        await linkDistricts.mutateAsync({ activityId, leaids: [suggestion.districtLeaid] });
      } catch {
        setLinkError("Activity saved — couldn't link district. Add it manually.");
      }
    }
  };

  return (
    <>
      <div className="bg-[#FFFCFA] border border-[#D4CFE2] rounded-lg p-3">
        {/* Header row: icon + title + Schedule button */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[#403770] text-sm font-semibold">
              {icon} {suggestion.title}
            </div>
            {(suggestion.districtName || suggestion.planName) && (
              <div className="text-[#8A80A8] text-xs mt-0.5 truncate">
                {[suggestion.districtName, suggestion.planName].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            aria-label="Schedule"
            className="ml-3 flex-shrink-0 bg-[#403770] text-white text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-[#322a5a] transition-colors whitespace-nowrap"
          >
            + Schedule
          </button>
        </div>

        {/* Metric chips — only render when the value is present */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {suggestion.contractValue !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">
                {suggestion.opportunityType === "renewal" ? "Contract value" : "Opportunity"}
              </div>
              <div className="text-[#403770] text-[11px] font-semibold">
                {formatCurrency(suggestion.contractValue)}
              </div>
            </div>
          )}
          {suggestion.renewalWeeks !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">Renews in</div>
              <div
                className={`text-[11px] font-semibold ${
                  suggestion.renewalWeeks <= 8 ? "text-[#F37167]" : "text-[#403770]"
                }`}
              >
                {suggestion.renewalWeeks} weeks
              </div>
            </div>
          )}
          {suggestion.lastContactDays !== null && (
            <div className="bg-[#F7F5FA] border border-[#E2DEEC] rounded-md px-2 py-1">
              <div className="text-[#A69DC0] text-[9px] leading-none mb-0.5">Last contact</div>
              <div
                className={`text-[11px] font-semibold ${
                  suggestion.lastContactDays >= 14 ? "text-[#F37167]" : "text-[#403770]"
                }`}
              >
                {suggestion.lastContactDays} days ago
              </div>
            </div>
          )}
        </div>

        {/* Reasoning — italic, quoted */}
        <p className="text-[#6E6390] text-[11px] leading-relaxed mb-2 italic">
          &ldquo;{suggestion.reasoning}&rdquo;
        </p>

        {/* Tags: risk (coral) first, goal (plum) second */}
        <div className="flex flex-wrap gap-1">
          {suggestion.riskTags.map((tag) => (
            <span
              key={tag}
              className="bg-[#fef1f0] text-[#F37167] text-[10px] font-medium px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {suggestion.goalTags.map((tag) => (
            <span
              key={tag}
              className="bg-[#EFEDF5] text-[#403770] text-[10px] font-medium px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Inline error toast shown when district link fails after activity creation */}
      {linkError && (
        <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <span>{linkError}</span>
          <button
            onClick={() => setLinkError(null)}
            className="ml-2 text-amber-600 hover:text-amber-900 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      {/* ActivityFormModal pre-filled from the suggestion */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultPlanId={suggestion.planId ?? undefined}
        defaultActivityType={suggestion.activityType as ActivityType}
        defaultTitle={suggestion.title}
        onSuccess={handleActivityCreated}
      />
    </>
  );
}
