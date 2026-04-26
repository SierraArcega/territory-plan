"use client";

import type { QueryParams } from "../../lib/types";
import { PlayTriangle } from "../ui/icons";

type StatusKind = "empty" | "dirty" | "running" | "clean";

interface Props {
  params: QueryParams;
  dirty: boolean;
  running: boolean;
  /** Whether a previous run produced a snapshot. */
  hasSnapshot: boolean;
  onRun: () => void;
}

function determine(p: Props): StatusKind {
  if (p.running) return "running";
  if (!p.params.table) return "empty";
  if (p.dirty || !p.hasSnapshot) return "dirty";
  return "clean";
}

export default function StatusChip(props: Props) {
  const kind = determine(props);

  if (kind === "running") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
          Status
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-[#EFEDF5] px-2.5 py-1.5 text-xs font-medium text-[#544A78]">
          <span className="animate-pulse">●</span>
          Running…
        </span>
      </div>
    );
  }

  if (kind === "empty") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
          Status
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-[#EFEDF5] px-2.5 py-1.5 text-xs font-medium text-[#8A80A8]">
          <span className="size-[6px] rounded-full bg-[#A69DC0]" aria-hidden />
          Ready to start
        </span>
      </div>
    );
  }

  if (kind === "dirty") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
          Status
        </span>
        <button
          type="button"
          onClick={props.onRun}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#322a5a] transition-colors"
        >
          <PlayTriangle className="size-[10px]" />
          Run
        </button>
      </div>
    );
  }

  // clean
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
        Status
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#69B34A] bg-[#F7FFF2] px-2.5 py-1.5 text-[11px] font-medium text-[#69B34A]">
        <span className="size-[6px] rounded-full bg-[#69B34A]" aria-hidden />
        Up to date
      </span>
    </div>
  );
}
