"use client";

import type { EntitySchema } from "../lib/types";

interface SourceSelectorProps {
  entities: EntitySchema[];
  value: string;
  onChange: (source: string) => void;
  isLoading: boolean;
}

export default function SourceSelector({
  entities,
  value,
  onChange,
  isLoading,
}: SourceSelectorProps) {
  if (isLoading) {
    return (
      <div className="w-48 h-9 bg-[#EFEDF5] rounded-lg animate-pulse" />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-[#8A80A8]">
        Source
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 text-sm font-medium text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent appearance-none cursor-pointer pr-8"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23403770' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        <option value="">Select a data source...</option>
        {entities.map((entity) => (
          <option key={entity.name} value={entity.name}>
            {entity.label}
          </option>
        ))}
      </select>
    </div>
  );
}
