"use client";

/**
 * SourcePicker — 6-card grid that lets the rep choose which entity kind the
 * list contains. Active card has a coral border + `#FEF2F1` background; the
 * inactive state matches the rest of the modal's surface-raised neutrals.
 *
 * The total-count badge under each card is a placeholder pulled from
 * SOURCE_META until a `/api/lists/source-totals` endpoint exists. The
 * prototype's hardcoded values are accurate enough for v1 dev work — TODO
 * (Phase F) wire to a real count call.
 */
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import { SOURCE_META } from "./builder-utils";

interface SourcePickerProps {
  value: SavedListSource;
  onChange: (next: SavedListSource) => void;
}

export default function SourcePicker({ value, onChange }: SourcePickerProps) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      role="radiogroup"
      aria-label="Source"
    >
      {SOURCE_META.map((s) => {
        const isActive = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(s.id)}
            className={[
              "flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors duration-100",
              isActive
                ? "bg-[#FEF2F1] border-[1.5px] border-[#F37167] text-[#403770]"
                : "bg-[#FFFCFA] border border-[#E2DEEC] text-[#544A78] hover:bg-[#FEF2F1] hover:border-[#F0D9D6]",
            ].join(" ")}
          >
            <span className="text-base leading-none flex-shrink-0" aria-hidden>
              {s.icon}
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="text-xs font-semibold whitespace-nowrap">
                {s.label}
              </span>
              <span className="text-[10px] text-[#8A80A8] tabular-nums mt-0.5 whitespace-nowrap">
                {s.countBase.toLocaleString()}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
