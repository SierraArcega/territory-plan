"use client";

import { formatDistanceToNow } from "date-fns";
import type { ReportCardData } from "../lib/ui-types";

interface Props {
  report: ReportCardData;
  currentUserId: string;
  onRun: (id: number) => void;
  onOpen: (id: number) => void;
  running?: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  try {
    return `${formatDistanceToNow(new Date(iso))} ago`;
  } catch {
    return "—";
  }
}

export default function ReportCard({
  report,
  currentUserId,
  onRun,
  onOpen,
  running,
}: Props) {
  const isMine = report.userId === currentUserId;
  const pinned = report.isTeamPinned;
  const authorLabel = isMine
    ? "Me"
    : (report.user?.fullName ?? report.userId.slice(0, 8));

  return (
    <article className="flex w-full items-center gap-5 rounded-xl border border-[#E2DEEC] bg-white px-5 py-[18px] shadow-sm">
      <div
        className={`flex size-11 items-center justify-center rounded-lg text-lg font-semibold ${
          pinned ? "bg-[#faf4e0] text-[#b07d00]" : "bg-[#EFEDF5] text-[#8A80A8]"
        }`}
      >
        {pinned ? "★" : "⬢"}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onOpen(report.id)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold text-[#544A78] hover:underline">
            {report.title}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${
              pinned
                ? "bg-[#e8f1f5] text-[#4a7790]"
                : "bg-[#EFEDF5] text-[#8A80A8]"
            }`}
          >
            {pinned ? "Team" : "Private"}
          </span>
          {pinned && (
            <span className="inline-flex items-center rounded-full bg-[#fff9e8] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[#c89000]">
              Pinned
            </span>
          )}
        </button>
        <p className="truncate text-xs text-[#6E6390]">{report.question}</p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-bold text-[#544A78]">{report.runCount}</p>
          <p className="text-xs font-medium text-[#6E6390]">runs</p>
        </div>
        <p className="text-[11px] font-normal text-[#8A80A8]">
          {relativeTime(report.lastRunAt ?? report.updatedAt)} · by {authorLabel}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onRun(report.id)}
          disabled={running}
          className="rounded-lg border border-plum bg-white px-3.5 py-2 text-[13px] font-semibold text-plum hover:bg-[#F5F2FB] transition-colors disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>
    </article>
  );
}
