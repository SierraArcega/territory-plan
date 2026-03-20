"use client";

import { useState } from "react";
import type { Feature, Point } from "geojson";
import AddToPlanButton from "@/features/map/components/panels/district/AddToPlanButton";

interface VacancyCardProps {
  feature: Feature<Point>;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open:      { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  active:    { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  closed:    { bg: "rgba(200,80,70,0.12)", text: "#a84a42" },
  filled:    { bg: "rgba(138,128,168,0.12)", text: "#6E6390" },
  pending:   { bg: "rgba(220,180,60,0.15)", text: "#8a7230" },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Speech-Language Pathologist": { bg: "rgba(255,207,112,0.20)", text: "#8a7230" },
  "Special Education":          { bg: "rgba(255,207,112,0.20)", text: "#8a7230" },
  default:                      { bg: "rgba(255,207,112,0.15)", text: "#8a7230" },
};

function getStatusStyle(status: string | undefined) {
  if (!status) return STATUS_COLORS.open;
  return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.open;
}

function getCategoryStyle(category: string | undefined) {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

export default function VacancyCard({ feature, onClick }: VacancyCardProps) {
  const p = feature.properties ?? {};
  const title = p.title ?? "Untitled Vacancy";
  const category = p.category ?? null;
  const status = p.status ?? null;
  const schoolName = p.schoolName ?? null;
  const daysOpen = p.daysOpen ?? null;
  const districtName = p.districtName ?? null;
  const fullmindRelevant = p.fullmindRelevant ?? false;

  const leaid = p.leaid ?? null;
  const sourceUrl = p.sourceUrl ?? null;
  const jobBoardUrl = p.jobBoardUrl ?? null;
  const plans: { id: string; name: string; fiscalYear: number; color: string }[] | null = p.plans ?? null;
  const [plansOpen, setPlansOpen] = useState(false);

  // Resolve which URL to show — prefer individual posting, fall back to district board
  const listingUrl = sourceUrl ?? jobBoardUrl ?? null;

  const statusStyle = getStatusStyle(status);
  const categoryStyle = getCategoryStyle(category);

  return (
    <div
      className="group relative px-3 py-2.5 rounded-lg border border-[#E2DEEC] cursor-pointer transition-colors hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      onClick={onClick}
    >
      {/* Header: Title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[#544A78] truncate">{title}</h4>
        </div>
        {status && (
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {status}
          </span>
        )}
      </div>

      {/* Badges + days open row */}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {category && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[120px]"
              style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text }}
            >
              {category}
            </span>
          )}
          {fullmindRelevant && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FFCF70]/20 text-[#8a7230]">
              FM Relevant
            </span>
          )}
        </div>
        {daysOpen != null && (
          <span className="shrink-0 text-[10px] text-[#8A80A8] tabular-nums">
            <span className="font-semibold text-[#6E6390]">{daysOpen}</span>d open
          </span>
        )}
      </div>

      {/* Location + job board row */}
      <div className="flex items-start justify-between gap-2 mt-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[#544A78] font-medium truncate">
            {districtName ?? "Unknown District"}
          </div>
          {schoolName && (
            <div className="text-[10px] text-[#8A80A8] truncate mt-0.5">
              {schoolName}
            </div>
          )}
        </div>
        {listingUrl && (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[#6EA3BE] hover:text-[#4a7a90] transition-colors mt-0.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Job Board
          </a>
        )}
      </div>

      {/* Footer: plan indicator + add to plan */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#E2DEEC]/60">
        <div className="min-w-0 flex-1">
          {plans && plans.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlansOpen(!plansOpen);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#403770]/10 text-[#544A78] hover:bg-[#403770]/15 transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
                In {plans.length} {plans.length === 1 ? "Plan" : "Plans"}
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${plansOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {plansOpen && (
                <div className="mt-1.5 ml-1 space-y-1">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center gap-1.5 text-[10px] text-[#6E6390]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: plan.color }}
                      />
                      <span className="truncate">{plan.name}</span>
                      <span className="text-[#8A80A8] shrink-0">FY{String(plan.fiscalYear).slice(-2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-[#A69DC0]">District not in any plan</span>
          )}
        </div>
        {leaid && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <AddToPlanButton
              leaid={leaid}
              existingPlanIds={plans?.map((p) => p.id) ?? []}
            />
          </div>
        )}
      </div>

      {/* Layer accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#FFCF70] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
