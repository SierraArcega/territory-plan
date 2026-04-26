"use client";

import type { ReportsTab } from "../lib/queries";

interface Tab {
  id: ReportsTab;
  label: string;
  count: number;
}

interface Props {
  tabs: Tab[];
  active: ReportsTab;
  onChange: (id: ReportsTab) => void;
}

export default function LibraryTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-[#E2DEEC] px-10 pb-4">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] transition-colors ${
              isActive
                ? "bg-[#F5F2FB] font-semibold text-plum"
                : "font-medium text-[#8A80A8] hover:bg-[#F7F5FA]"
            }`}
          >
            {t.label}
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                isActive ? "bg-plum text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
              }`}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
