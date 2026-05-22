"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

type Bucket = "rank" | "win_back" | "new";
const OPTIONS: { value: Bucket; label: string }[] = [
  { value: "rank", label: "Ranked" },
  { value: "win_back", label: "Win Back" },
  { value: "new", label: "New" },
];

export function RankFilterChip({
  value,
  onChange,
}: {
  value: Bucket[];
  onChange: (next: Bucket[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (b: Bucket) =>
    onChange(value.includes(b) ? value.filter((x) => x !== b) : [...value, b]);
  const label =
    value.length === 0
      ? "Rank bucket"
      : OPTIONS.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ");
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] whitespace-nowrap ${
          value.length
            ? "border-[#E2DEEC] bg-[#F7F5FA] text-[#403770]"
            : "border-dashed border-[#E2DEEC] text-[#544A78] hover:bg-[#F7F5FA]"
        }`}
      >
        {value.length === 0 && <Plus className="h-3 w-3" />}
        <span>{label}</span>
        {value.length > 0 && (
          <X
            className="h-3 w-3 text-[#8A80A8] hover:text-[#403770]"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md">
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1 text-[13px] hover:bg-[#F7F5FA]">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="whitespace-nowrap">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
