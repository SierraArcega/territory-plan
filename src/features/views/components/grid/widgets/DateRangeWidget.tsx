import { useState } from "react";
import type { FilterWidget } from "@/features/views/lib/columns";

export type DateRangeValue =
  | { kind: "within"; value: string }          // "7 days", "30 days", "90 days", "1 quarter", "1 year"
  | { kind: "before"; value: string }          // ISO date
  | { kind: "between"; from: string; to: string } // ISO dates
  | null;

interface DateRangeWidgetProps {
  widget: Extract<FilterWidget, { kind: "dateRange" }>;
  value: DateRangeValue;
  onApply: (next: DateRangeValue) => void;
  onCancel: () => void;
}

const RELATIVE_LABEL: Record<string, { label: string; sqlValue: string }> = {
  "7d":  { label: "Last 7 days",  sqlValue: "7 days" },
  "30d": { label: "Last 30 days", sqlValue: "30 days" },
  "90d": { label: "Last 90 days", sqlValue: "90 days" },
  "qtd": { label: "QTD",          sqlValue: "1 quarter" },
  "ytd": { label: "YTD",          sqlValue: "1 year" },
};

export function DateRangeWidget({ widget, value, onApply, onCancel }: DateRangeWidgetProps) {
  const initialFrom = value?.kind === "between" ? value.from : "";
  const initialTo   = value?.kind === "between" ? value.to   : "";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const applyRelative = (chip: string) => {
    const meta = RELATIVE_LABEL[chip];
    if (meta) onApply({ kind: "within", value: meta.sqlValue });
  };

  const handleApply = () => {
    if (from && to) onApply({ kind: "between", from, to });
    else if (from)  onApply({ kind: "within", value: "0 days" }); // edge: not useful, but valid
    else            onApply(null);
  };

  return (
    <div className="w-72 rounded-lg border border-[#E2DEEC] bg-white p-3 shadow-md" style={{ maxWidth: "calc(100vw - 16px)" }}>
      {widget.relativeChips && widget.relativeChips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {widget.relativeChips.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => applyRelative(chip)}
              className="rounded-full border border-[#E2DEEC] px-2 py-0.5 text-[11px] text-[#544A78] hover:bg-[#F7F5FA]"
            >
              {RELATIVE_LABEL[chip]?.label ?? chip}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input
          type="date"
          aria-label="From"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px]"
        />
        <input
          type="date"
          aria-label="To"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="w-full rounded border border-[#E2DEEC] px-2 py-1 text-[13px]"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-[#EFEDF5] pt-2">
        <button onClick={onCancel} className="text-[12px] text-[#8A80A8]">Cancel</button>
        <button onClick={handleApply} className="rounded bg-[#403770] px-3 py-1 text-[12px] text-white">Apply</button>
      </div>
    </div>
  );
}
