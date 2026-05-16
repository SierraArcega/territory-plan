import { useState } from "react";
import type { FilterWidget } from "@/features/views/lib/columns";

interface NumberRangeWidgetProps {
  widget: Extract<FilterWidget, { kind: "numberRange" }>;
  value: { min: number | null; max: number | null };
  onApply: (next: { min: number | null; max: number | null }) => void;
  onCancel: () => void;
}

export function NumberRangeWidget({ widget, value, onApply, onCancel }: NumberRangeWidgetProps) {
  const [min, setMin] = useState<string>(value.min == null ? "" : String(value.min));
  const [max, setMax] = useState<string>(value.max == null ? "" : String(value.max));

  const applyPreset = (range: readonly [number, number]) => {
    setMin(String(range[0]));
    setMax(range[1] >= Number.MAX_SAFE_INTEGER ? "" : String(range[1]));
  };

  const handleApply = () => {
    onApply({
      min: min === "" ? null : Number(min),
      max: max === "" ? null : Number(max),
    });
  };

  return (
    <div className="w-72 rounded-lg border border-[#E2DEEC] bg-white p-3 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={e => setMin(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px] tabular-nums"
        />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={e => setMax(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px] tabular-nums"
        />
      </div>
      {widget.presets && widget.presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {widget.presets.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.range)}
              className="rounded-full border border-[#E2DEEC] px-2 py-0.5 text-[11px] text-[#544A78] hover:bg-[#F7F5FA]"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="rounded bg-[#403770] px-3 py-1 text-[12px] text-white"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
