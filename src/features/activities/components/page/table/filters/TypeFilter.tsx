"use client";

import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  CATEGORY_LABELS,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { Square, SquareCheck } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

export default function TypeFilter({ onClose }: { onClose: () => void }) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  function toggleCategory(c: ActivityCategory) {
    const next = filters.categories.includes(c)
      ? filters.categories.filter((v) => v !== c)
      : [...filters.categories, c];
    patchFilters({ categories: next });
  }

  function toggleType(t: ActivityType) {
    const next = filters.types.includes(t)
      ? filters.types.filter((v) => v !== t)
      : [...filters.types, t];
    patchFilters({ types: next });
  }

  return (
    <div className="p-1 w-64 max-h-96 overflow-y-auto">
      {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => {
        const childTypes = ACTIVITY_CATEGORIES[c] as readonly ActivityType[];
        const catActive = filters.categories.includes(c);
        const CatBox = catActive ? SquareCheck : Square;
        return (
          <div key={c} className="mb-0.5">
            <button
              type="button"
              onClick={() => toggleCategory(c)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold rounded-md transition-colors",
                catActive ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
              )}
            >
              <CatBox className={cn("w-3.5 h-3.5", catActive ? "text-[#403770]" : "text-[#A69DC0]")} />
              {CATEGORY_LABELS[c]}
            </button>
            {childTypes.map((t) => {
              const active = filters.types.includes(t);
              const Box = active ? SquareCheck : Square;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    "w-full flex items-center gap-2 pl-7 pr-2 py-1.5 text-xs text-left rounded-md transition-colors",
                    active ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
                  )}
                >
                  <Box className={cn("w-3.5 h-3.5", active ? "text-[#403770]" : "text-[#A69DC0]")} />
                  {ACTIVITY_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-[#EFEDF5] mt-1 pt-1.5 px-1">
        <button
          type="button"
          onClick={() => patchFilters({ categories: [], types: [] })}
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
