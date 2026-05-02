"use client";

import type { BuilderVersion } from "./types";

interface Props {
  versions: BuilderVersion[];
  selectedN: number | null;
  onSelect: (n: number) => void;
}

export function JumpNav({ versions, selectedN, onSelect }: Props) {
  if (versions.length === 0) return null;
  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-1.5 py-[3px]">
      <span className="mr-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#A69DC0]">
        Jump
      </span>
      {versions.map((v) => {
        const sel = v.n === selectedN;
        return (
          <button
            key={v.n}
            type="button"
            title={v.summary.versionLabel ?? v.summary.source}
            onClick={() => onSelect(v.n)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border-0 transition-all duration-100"
            style={{
              minWidth: 28,
              height: 22,
              padding: "0 8px",
              fontSize: 10.5,
              fontWeight: 600,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              background: sel ? "#403770" : "transparent",
              color: sel ? "#fff" : "#544A78",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            v{v.n}
          </button>
        );
      })}
    </div>
  );
}
