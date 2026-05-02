"use client";

import { ArrowRight, HelpCircle, Plus, Sparkles } from "lucide-react";

const EXAMPLES = [
  "My open opps stuck > 90 days",
  "Districts I won this fiscal year",
  "My activities this week",
  "Pipeline by stage",
] as const;

interface Props {
  onNewReport: () => void;
  onTryExample: (prompt: string) => void;
}

export function WelcomeStrip({ onNewReport, onTryExample }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#D4CFE2] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(64,55,112,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="grid h-[26px] w-[26px] place-items-center rounded-md bg-[#FEF2F1] text-[#F37167]">
              <Sparkles size={14} />
            </div>
            <div className="text-sm font-bold tracking-[-0.01em] text-[#403770]">Reports</div>
          </div>
          <div className="mt-2 max-w-[640px] text-sm leading-relaxed text-[#544A78]">
            Ask plain-English questions about your pipeline, districts, and activities. Claude writes the query for you.
          </div>
          <button
            type="button"
            className="mt-1.5 inline-flex items-center gap-1 bg-transparent p-0 text-[11.5px] font-medium text-[#6EA3BE] hover:text-[#5a8ca8]"
          >
            <HelpCircle size={11} />
            <span className="whitespace-nowrap">How does this work?</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onNewReport}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#403770] px-4 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(64,55,112,0.15)] transition-colors hover:bg-[#322a5a]"
        >
          <Plus size={14} />
          <span className="whitespace-nowrap">New report</span>
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-dashed border-[#E2DEEC] pt-3.5">
        <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
          Try one
        </div>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onTryExample(ex)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-[#FFFCFA] px-3 py-1.5 text-xs font-medium text-[#544A78] transition-all duration-150 hover:border-[#F37167] hover:bg-white hover:text-[#F37167]"
          >
            <span className="whitespace-nowrap">{ex}</span>
            <ArrowRight size={11} className="shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
