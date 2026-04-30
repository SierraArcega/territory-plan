"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import RangeFilter from "./controls/RangeFilter";


interface AcademicsDropdownProps {
  onClose: () => void;
}

export default function AcademicsDropdown({ onClose }: AcademicsDropdownProps) {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const updateSearchFilter = useMapV2Store((s) => s.updateSearchFilter);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleApply = (column: string, min: number, max: number) => {
    const existing = searchFilters.find((f) => f.column === column && f.op === "between");
    if (existing) {
      updateSearchFilter(existing.id, { value: [min, max] });
    } else {
      addSearchFilter({ id: crypto.randomUUID(), column, op: "between", value: [min, max] });
    }
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] max-h-[calc(100vh-140px)] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Academics</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <RangeFilter label="Graduation Rate %" column="graduationRate" min={0} max={100} step={1} suffix="%" onApply={handleApply} />
        <RangeFilter label="Math Proficiency %" column="mathProficiency" min={0} max={100} step={1} suffix="%" onApply={handleApply} />
        <RangeFilter label="Reading Proficiency %" column="readProficiency" min={0} max={100} step={1} suffix="%" onApply={handleApply} />
        <RangeFilter label="Chronic Absenteeism %" column="chronicAbsenteeismRate" min={0} max={100} step={1} suffix="%" onApply={handleApply} />
        <RangeFilter label="Student-Teacher Ratio" column="studentTeacherRatio" min={0} max={50} step={0.5} onApply={handleApply} />
        <RangeFilter label="Teacher FTE" column="teachersFte" min={0} max={10000} step={10} onApply={handleApply} />
        <RangeFilter label="SPED Expenditure / Student" column="spedExpenditurePerStudent" min={0} max={50000} step={500} prefix="$" onApply={handleApply} />
      </div>
    </div>
  );
}
