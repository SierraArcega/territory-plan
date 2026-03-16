"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import RangeFilter from "./controls/RangeFilter";
import ToggleChips from "./controls/ToggleChips";
import FilterSelect from "./controls/FilterSelect";
import FilterMultiSelect from "./controls/FilterMultiSelect";


interface FullmindDropdownProps {
  onClose: () => void;
}

export default function FullmindDropdown({ onClose }: FullmindDropdownProps) {
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const ref = useRef<HTMLDivElement>(null);

  const [owners, setOwners] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/sales-executives")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOwners(data.map?.((d: any) => d.name || d) || []))
      .catch(() => {});
    fetch("/api/territory-plans")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const addFilter = (column: string, op: string, value: any) => {
    addSearchFilter({ id: crypto.randomUUID(), column, op: op as any, value });
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Fullmind</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <ToggleChips
          label="Customer Status"
          options={[
            { label: "Customer", column: "isCustomer", op: "is_true", value: true },
            { label: "Prospect", column: "isCustomer", op: "is_false", value: false },
          ]}
          onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
        />

        <ToggleChips
          label="Has Open Pipeline"
          options={[
            { label: "Yes", column: "hasOpenPipeline", op: "is_true", value: true },
            { label: "No", column: "hasOpenPipeline", op: "is_false", value: false },
          ]}
          onSelect={(opt) => addFilter(opt.column, opt.op, opt.value)}
        />

        {owners.length > 0 && (
          <FilterMultiSelect
            label="Sales Executive"
            column="salesExecutive"
            options={owners.map((o) => ({ value: o, label: o }))}
            onApply={(col, vals) => addFilter(col, "in", vals)}
          />
        )}

        <RangeFilter label="FY26 Pipeline Value" column="fy26_open_pipeline_value" step={1000} onApply={(col, min, max) => addFilter(col, "between", [min, max])} />
        <RangeFilter label="FY26 Bookings" column="fy26_closed_won_net_booking" step={1000} onApply={(col, min, max) => addFilter(col, "between", [min, max])} />
        <RangeFilter label="FY26 Invoicing" column="fy26_net_invoicing" step={1000} onApply={(col, min, max) => addFilter(col, "between", [min, max])} />

        {plans.length > 0 && (
          <FilterMultiSelect
            label="Plan Membership"
            column="planNames"
            options={plans.map((p) => ({ value: p.name, label: p.name }))}
            onApply={(col, vals) => addFilter(col, "eq", vals)}
          />
        )}

        {tags.length > 0 && (
          <FilterMultiSelect
            label="Tags"
            column="tags"
            options={tags.map((t) => ({ value: t.name, label: t.name }))}
            onApply={(col, vals) => addFilter(col, "eq", vals)}
          />
        )}
      </div>
    </div>
  );
}
