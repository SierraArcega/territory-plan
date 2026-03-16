"use client";

import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";

interface ChipOption {
  label: string;
  column: string;
  op: string;
  value: any;
}

interface ToggleChipsProps {
  label: string;
  options: ChipOption[];
  onSelect: (option: ChipOption) => void;
}

function isChipActive(opt: ChipOption, filters: ExploreFilter[]): ExploreFilter | undefined {
  return filters.find((f) =>
    f.column === opt.column && f.op === opt.op && JSON.stringify(f.value) === JSON.stringify(opt.value)
  );
}

export default function ToggleChips({ label, options, onSelect }: ToggleChipsProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);

  return (
    <div>
      <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const activeFilter = isChipActive(opt, searchFilters);
          return (
            <button
              key={opt.label}
              onClick={() => activeFilter ? removeSearchFilter(activeFilter.id) : onSelect(opt)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeFilter
                  ? "bg-plum text-white hover:bg-plum/80"
                  : "bg-[#F7F5FA] text-[#544A78] hover:bg-plum/10 hover:text-plum"
              }`}
            >
              {opt.label}
              {activeFilter && (
                <span className="ml-1 opacity-70">×</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
