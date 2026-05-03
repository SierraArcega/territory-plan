"use client";

import { ArrowRight, HelpCircle, Plus, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { HowItWorksModal } from "./HowItWorksModal";

const EXAMPLES = [
  "My open opps stuck > 90 days",
  "Districts I won this fiscal year",
  "My activities this week",
  "Pipeline by stage",
] as const;

interface Props {
  onNewReport: () => void;
  onSubmitPrompt: (prompt: string) => void;
}

export function WelcomeStrip({ onNewReport, onSubmitPrompt }: Props) {
  const [value, setValue] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const canSubmit = value.trim().length > 0;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmitPrompt(trimmed);
    setValue("");
  };

  return (
    <>
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
            onClick={() => setShowHelp(true)}
            className="mt-1.5 inline-flex items-center gap-1 bg-transparent p-0 text-[11.5px] font-medium text-[#6EA3BE] hover:text-[#5a8ca8]"
          >
            <HelpCircle size={11} />
            <span className="whitespace-nowrap">How does this work?</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onNewReport}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-3 py-2 text-[13px] font-medium text-[#544A78] transition-colors hover:bg-[#F7F5FA] hover:text-[#403770]"
        >
          <Plus size={14} />
          <span className="whitespace-nowrap">New report</span>
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-4 flex items-center gap-2 rounded-xl border border-[#C2BBD4] bg-white px-3.5 py-2 shadow-[0_1px_2px_rgba(64,55,112,0.04)] transition-shadow focus-within:border-[#403770] focus-within:shadow-[0_0_0_3px_rgba(64,55,112,0.10)]"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          placeholder="Ask a question — e.g. show me Texas opps stuck more than 90 days…"
          aria-label="Ask a question to start a new report"
          className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[#403770] outline-none placeholder:text-[#A69DC0]"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed"
          style={{
            background: canSubmit ? "#403770" : "#EFEDF5",
            color: canSubmit ? "#fff" : "#A69DC0",
          }}
        >
          <Send size={12} />
          <span className="whitespace-nowrap">Send</span>
        </button>
      </form>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-dashed border-[#E2DEEC] pt-3">
        <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
          Try one
        </div>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onSubmitPrompt(ex)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-[#FFFCFA] px-3 py-1.5 text-xs font-medium text-[#544A78] transition-all duration-150 hover:border-[#F37167] hover:bg-white hover:text-[#F37167]"
          >
            <span className="whitespace-nowrap">{ex}</span>
            <ArrowRight size={11} className="shrink-0" />
          </button>
        ))}
      </div>
    </div>
    {showHelp && <HowItWorksModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
