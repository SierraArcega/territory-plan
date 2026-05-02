"use client";

import { Check, Database, Eye } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { LiveTrace } from "./LiveTrace";
import { VersionPill } from "./VersionPill";
import type { BuilderTurn } from "./types";

interface Props {
  turn: BuilderTurn;
  selected: boolean;
  onSelect: (n: number) => void;
}

export function TurnBlock({ turn, selected, onSelect }: Props) {
  const userRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [pillTop, setPillTop] = useState(18);

  // Anchor the gutter pill vertically to the user message bubble. The chat
  // re-flows when traces expand or when long messages wrap, so re-measure on
  // resize.
  useLayoutEffect(() => {
    const measure = () => {
      const u = userRef.current?.getBoundingClientRect();
      const b = blockRef.current?.getBoundingClientRect();
      if (!u || !b) return;
      setPillTop(u.top - b.top + (u.height - 22) / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (blockRef.current) ro.observe(blockRef.current);
    return () => ro.disconnect();
  }, [turn.assistantText, turn.error, turn.inFlight]);

  const v = turn.version;

  return (
    <div ref={blockRef} className="relative px-0 py-3.5">
      {v && (
        <div
          className="absolute"
          style={{ left: -44 + 5, top: pillTop, zIndex: 2 }}
        >
          <VersionPill n={v.n} selected={selected} onClick={() => onSelect(v.n)} gutter />
        </div>
      )}

      {/* User message */}
      <div className="mb-2 flex justify-end">
        <div
          ref={userRef}
          className="max-w-[92%] rounded-xl bg-[#403770] px-3 py-1.5 text-[13px] leading-snug text-white"
        >
          {turn.userMessage}
        </div>
      </div>

      {/* Assistant card / in-flight placeholder / error */}
      {turn.inFlight ? (
        <InFlightCard turn={turn} />
      ) : turn.error ? (
        <ErrorCard message={turn.error} />
      ) : (
        <AssistantCard turn={turn} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

function AssistantCard({
  turn,
  selected,
  onSelect,
}: {
  turn: BuilderTurn;
  selected: boolean;
  onSelect: (n: number) => void;
}) {
  const v = turn.version;
  // Filter to only tool_result events for the "have any trace?" decision —
  // model_call-only events without any tool calls aren't worth a toggle.
  const hasTrace =
    !!turn.events && turn.events.some((e) => e.kind === "tool_result");
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-[13px] leading-relaxed text-[#403770]"
      style={{
        maxWidth: "94%",
        background: selected ? "#fff" : "#F7F5FA",
        border: `1px solid ${selected ? "#403770" : "#E2DEEC"}`,
        boxShadow: selected ? "0 1px 2px rgba(64,55,112,0.05)" : "none",
      }}
    >
      {hasTrace && (
        <div className="mb-1.5">
          <LiveTrace
            events={turn.events ?? []}
            completed
            totalMs={turn.durationMs}
          />
        </div>
      )}
      {turn.assistantText && <RenderMarkdown text={turn.assistantText} />}
      {v && (
        <div className="mt-2 flex items-center gap-2 border-t border-dashed border-[#E2DEEC] pt-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: selected ? "#F37167" : "#544A78" }}
          >
            <Database size={11} /> v{v.n}
          </span>
          <span className="text-[#D4CFE2]">·</span>
          <span className="whitespace-nowrap text-[11px] tabular-nums text-[#8A80A8]">
            {v.rowCount.toLocaleString()} rows
          </span>
          {v.summary.versionLabel && (
            <>
              <span className="text-[#D4CFE2]">·</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#8A80A8]">
                {v.summary.versionLabel}
              </span>
            </>
          )}
          <div className="flex-1" />
          {!selected ? (
            <button
              type="button"
              onClick={() => onSelect(v.n)}
              className="inline-flex items-center gap-1 rounded-md border border-[#D4CFE2] bg-transparent px-2 py-0.5 text-[10.5px] font-medium text-[#544A78] transition-colors hover:bg-white"
            >
              <Eye size={10} /> <span className="whitespace-nowrap">View result</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#8AC670]">
              <Check size={10} /> <span className="whitespace-nowrap">showing</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function InFlightCard({ turn }: { turn: BuilderTurn }) {
  // Streaming live trace — Style B (Terminal). The pendingVersionN is the
  // version this in-flight turn WILL produce when it lands. We don't know
  // the index yet at submit time, so the parent passes it via turn.version
  // (which stays null until the result event arrives — fall back to "next
  // version" semantics by leaving it unset and letting LiveTrace render
  // "Working" without the v{n} suffix until we have one).
  const events = turn.events ?? [];
  const hasAnyEvent = events.length > 0;
  return (
    <div
      className="rounded-xl border border-dashed border-[#C2BBD4] bg-[#FFFCFA] px-3 py-2.5 text-[12.5px] text-[#544A78]"
      style={{ maxWidth: "94%" }}
    >
      {hasAnyEvent ? (
        <LiveTrace events={events} completed={false} pendingVersionN={turn.version?.n} />
      ) : (
        // Pre-first-event placeholder: stream hasn't produced anything yet
        // (typically <500ms after submit). Same brand decoration so the
        // transition into the trace is calm.
        <>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#F37167]"
              style={{
                boxShadow: "0 0 0 3px rgba(243,113,103,0.2)",
                animation: "fm-pulse 1.4s ease-in-out infinite",
              }}
            />
            <span className="text-[11px] font-semibold">Working…</span>
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#8A80A8]">
            Searching schema and writing the query — usually 2–5 seconds.
          </div>
        </>
      )}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-[#f58d85] bg-[#fef1f0] px-3 py-2.5 text-[12.5px] text-[#c25a52]"
      style={{ maxWidth: "94%" }}
    >
      <div className="font-semibold">Couldn&apos;t complete that turn</div>
      <div className="mt-1 text-[11.5px] leading-relaxed">{message}</div>
    </div>
  );
}

// Minimal Markdown subset used in assistant replies — bold only. Anything
// richer would require a real renderer; agent prompt asks for short sentences
// with **emphasis** on key numbers.
function RenderMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-[#322a5a]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
