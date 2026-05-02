"use client";

import { ChevronRight, Send } from "lucide-react";
import { useState } from "react";
import type { BuilderVersion } from "./types";

interface Props {
  versions: BuilderVersion[];
  selectedN: number | null;
  onSelectVersion: (n: number) => void;
  onExpand: () => void;
}

/**
 * 44px slim rail that replaces the chat column when the user clicks the
 * chevron-left in the chat header. Lets them switch versions without giving
 * up screen real estate; clicking the top expand button or the send icon at
 * the bottom restores the chat column.
 *
 * The breathing ring around the expand chevron is a 'I'm still here' cue —
 * it pulses every 2.6s and pauses on rail hover so it doesn't fight the
 * hover affordance.
 */
export function CollapsedChatRail({ versions, selectedN, onSelectVersion, onExpand }: Props) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center border-r border-[#E2DEEC] py-3 transition-colors duration-200"
      style={{
        width: 44,
        flexShrink: 0,
        background: hovered ? "#F7F5FA" : "#FFFCFA",
      }}
    >
      {/* Breathing ring behind the expand chevron — pauses on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 28,
          height: 28,
          borderRadius: 8,
          boxShadow: "0 0 0 0 rgba(64,55,112,0.28)",
          animation: hovered ? "none" : "fm-rail-breathe 2.6s ease-out infinite",
        }}
      />
      <button
        type="button"
        onClick={onExpand}
        title="Expand chat"
        aria-label="Expand chat"
        className="relative z-10 inline-flex items-center justify-center transition-all duration-200"
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          border: `1px solid ${hovered ? "#403770" : "#D4CFE2"}`,
          background: hovered ? "#403770" : "#fff",
          color: hovered ? "#fff" : "#544A78",
          cursor: "pointer",
          fontFamily: "inherit",
          transform: hovered ? "translateX(2px)" : "translateX(0)",
        }}
      >
        <ChevronRight size={14} />
      </button>

      {/* Vertical version pill stack with dashed connector */}
      {versions.length > 0 && (
        <div className="relative mt-4 flex flex-col items-center gap-2.5 py-1.5">
          <div
            className="absolute"
            style={{
              left: "50%",
              top: 6,
              bottom: 6,
              width: 1.5,
              background: "linear-gradient(#E2DEEC 50%, transparent)",
              backgroundSize: "1.5px 6px",
              transform: "translateX(-50%)",
              zIndex: 0,
            }}
          />
          {versions.map((v) => {
            const sel = v.n === selectedN;
            return (
              <button
                key={v.n}
                type="button"
                onClick={() => onSelectVersion(v.n)}
                title={`v${v.n} · ${v.summary.versionLabel ?? v.summary.source}`}
                className="relative inline-flex items-center justify-center whitespace-nowrap rounded-full text-[10.5px] font-bold leading-none tabular-nums text-white transition-all duration-150"
                style={{
                  zIndex: 1,
                  width: 30,
                  height: 22,
                  border: `1.5px solid ${sel ? "#F37167" : "#403770"}`,
                  background: sel ? "#F37167" : "#403770",
                  boxShadow: sel
                    ? "0 0 0 3px rgba(243,113,103,0.18), 0 0 0 6px #FFFCFA"
                    : "0 0 0 3px #FFFCFA",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                v{v.n}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onExpand}
        title="Expand to ask a follow-up"
        aria-label="Expand to ask a follow-up"
        className="mb-2.5 inline-flex items-center justify-center transition-all duration-200"
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          border: `1px solid ${hovered ? "#403770" : "#D4CFE2"}`,
          background: hovered ? "#403770" : "#fff",
          color: hovered ? "#fff" : "#544A78",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Send size={12} />
      </button>
    </div>
  );
}
