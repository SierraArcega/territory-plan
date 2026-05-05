"use client";

import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import { ACTIVITY_STATUS_CONFIG, VALID_ACTIVITY_STATUSES } from "@/features/activities/types";
import { Square, SquareCheck } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

export default function StatusFilter({ onClose }: { onClose: () => void }) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  function toggle(value: string) {
    const next = filters.statuses.includes(value)
      ? filters.statuses.filter((v) => v !== value)
      : [...filters.statuses, value];
    patchFilters({ statuses: next });
  }

  return (
    <div className="p-1 w-56">
      {VALID_ACTIVITY_STATUSES.map((s) => {
        const cfg = ACTIVITY_STATUS_CONFIG[s];
        const active = filters.statuses.includes(s);
        const Checkbox = active ? SquareCheck : Square;
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            aria-pressed={active}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
              active ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
            )}
          >
            <Checkbox className={cn("w-3.5 h-3.5", active ? "text-[#403770]" : "text-[#A69DC0]")} />
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden />
            {cfg.label}
          </button>
        );
      })}
      <div className="flex items-center justify-between border-t border-[#EFEDF5] mt-1 pt-1.5 px-1">
        <button
          type="button"
          onClick={() => patchFilters({ statuses: [] })}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#F37167]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#544A78] hover:text-[#403770]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
