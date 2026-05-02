"use client";

import { ChevronLeft, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Composer } from "./Composer";
import { JumpNav } from "./JumpNav";
import { TurnBlock } from "./TurnBlock";
import type { BuilderTurn, BuilderVersion } from "./types";

interface Props {
  title: string;
  turns: BuilderTurn[];
  versions: BuilderVersion[];
  selectedN: number | null;
  inFlight: boolean;
  onSelectVersion: (n: number) => void;
  onSubmit: (text: string) => void;
  onNewReport: () => void;
  onCollapseChat: () => void;
}

export function BuilderChat({
  title,
  turns,
  versions,
  selectedN,
  inFlight,
  onSelectVersion,
  onSubmit,
  onNewReport,
  onCollapseChat,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when a new turn lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns.length, inFlight]);

  const latestVersionN = versions.at(-1)?.n ?? null;

  return (
    <div className="flex h-full min-w-0 flex-col" style={{ maxWidth: 560, borderRight: "1px solid #E2DEEC" }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[#E2DEEC] px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
            Conversation
          </div>
          <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#403770]">
            {title}
          </div>
        </div>
        <JumpNav versions={versions} selectedN={selectedN} onSelect={onSelectVersion} />
        <button
          type="button"
          onClick={onNewReport}
          title="Start a new report"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#D4CFE2] bg-white px-2 py-1 text-[11px] font-medium text-[#544A78] transition-colors hover:bg-[#F7F5FA]"
        >
          <Plus size={11} />
          <span className="whitespace-nowrap">New</span>
        </button>
        <button
          type="button"
          onClick={onCollapseChat}
          title="Collapse chat — full-screen report"
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#D4CFE2] bg-white px-1.5 py-1 text-[#544A78] transition-colors hover:bg-[#F7F5FA]"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="fm-scrollbar min-h-0 flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <EmptyChat />
        ) : (
          <div className="relative px-4 pb-4 pt-3" style={{ paddingLeft: 44 }}>
            {/* Continuous dashed connector line in the gutter */}
            <div
              className="absolute"
              style={{
                left: 22,
                top: 12,
                bottom: 12,
                width: 1.5,
                background: "linear-gradient(#E2DEEC 50%, transparent)",
                backgroundSize: "1.5px 6px",
              }}
            />
            {turns.map((t) => (
              <TurnBlock
                key={t.id}
                turn={t}
                selected={t.version != null && t.version.n === selectedN}
                onSelect={onSelectVersion}
              />
            ))}
          </div>
        )}
      </div>

      <Composer inFlight={inFlight} latestVersionN={latestVersionN} onSubmit={onSubmit} />
    </div>
  );
}

function EmptyChat() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[360px] text-center">
        <div className="text-[13px] font-semibold text-[#403770]">Ask a question to start</div>
        <div className="mt-1 text-[12px] leading-relaxed text-[#8A80A8]">
          Try something like <em className="font-medium">my open opps stuck more than 90 days</em>.
          Each answer becomes a saved version you can refine or jump back to.
        </div>
      </div>
    </div>
  );
}
