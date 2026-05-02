"use client";

import { FileText, Inbox, Plus, Star } from "lucide-react";

interface Props {
  kind: "mine" | "starred" | "team";
  onNewReport: () => void;
}

const COPY: Record<Props["kind"], { heading: string; body: string; Icon: typeof Inbox }> = {
  mine: {
    heading: "No saved reports yet.",
    body: "Build one to keep coming back.",
    Icon: Inbox,
  },
  starred: {
    heading: "Admins haven't starred any reports yet.",
    body: "Starred reports are the company-wide canon.",
    Icon: Star,
  },
  team: {
    heading: "No reports from teammates yet.",
    body: "When someone saves a report, it shows up here.",
    Icon: FileText,
  },
};

export function EmptyLibrary({ kind, onNewReport }: Props) {
  const { heading, body, Icon } = COPY[kind];
  return (
    <div className="rounded-xl border border-[#D4CFE2] bg-white px-6 py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#F7F5FA] text-[#A69DC0]">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <div className="mt-3.5 text-sm font-semibold text-[#403770]">{heading}</div>
      <div className="mt-1 text-[12.5px] text-[#8A80A8]">{body}</div>
      {kind !== "team" && (
        <button
          type="button"
          onClick={onNewReport}
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#403770] px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a]"
        >
          <Plus size={12} />
          <span className="whitespace-nowrap">New report</span>
        </button>
      )}
    </div>
  );
}
