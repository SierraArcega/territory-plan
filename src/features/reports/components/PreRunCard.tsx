"use client";

import { PlayTriangle } from "./ui/icons";

interface Props {
  summary: string;
  onRun: () => void;
  disabled?: boolean;
}

export default function PreRunCard({ summary, onRun, disabled }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="flex w-[480px] flex-col items-center gap-4 rounded-2xl border border-[#E2DEEC] bg-white p-8 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-[#fffaf1] text-[#a67800]">
          <PlayTriangle className="size-5" />
        </div>
        <h2 className="text-lg font-bold text-[#544A78]">Ready to run</h2>
        <p className="text-center text-[13px] text-[#6E6390]">{summary}</p>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-plum px-5 py-3 text-sm font-semibold text-white hover:bg-[#322a5a] transition-colors disabled:opacity-50"
        >
          <PlayTriangle className="size-3" />
          Run query
        </button>
        <p className="text-[10px] font-normal text-[#A69DC0]">
          Reruns of saved reports skip this step
        </p>
      </div>
    </div>
  );
}
