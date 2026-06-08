"use client";
import { X, Plus } from "lucide-react";
import { newRowId } from "@/features/document-generation/lib/ids";
import type { OrderAdjustment, AdjustmentType, AdjustmentMode } from "@/features/document-generation/lib/payload-types";

interface Props {
  adjustments: OrderAdjustment[];
  onChange: (next: OrderAdjustment[]) => void;
}

export default function AdjustmentsSection({ adjustments, onChange }: Props) {
  const update = (id: string, patch: Partial<OrderAdjustment>) =>
    onChange(adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(adjustments.filter((a) => a.id !== id));
  const add = () =>
    onChange([...adjustments, { id: newRowId("adj"), label: "", type: "discount", mode: "percent", value: 0 }]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6E6390] whitespace-nowrap">
        Discounts &amp; adjustments
      </p>
      {adjustments.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Adjustment label"
            placeholder="e.g. Early Signing Discount"
            value={a.label}
            onChange={(e) => update(a.id, { label: e.target.value })}
            className="flex-1 min-w-[140px] h-8 rounded border border-[#C2BBD4] px-2 text-sm text-[#403770]"
          />
          <select
            aria-label="Adjustment type"
            value={a.type}
            onChange={(e) => update(a.id, { type: e.target.value as AdjustmentType })}
            className="h-8 rounded border border-[#C2BBD4] px-1 text-sm text-[#403770]"
          >
            <option value="discount">Discount</option>
            <option value="fee">Fee</option>
            <option value="tax">Tax</option>
          </select>
          <select
            aria-label="Adjustment mode"
            value={a.mode}
            onChange={(e) => update(a.id, { mode: e.target.value as AdjustmentMode })}
            className="h-8 rounded border border-[#C2BBD4] px-1 text-sm text-[#403770]"
          >
            <option value="percent">%</option>
            <option value="amount">$</option>
          </select>
          <input
            aria-label="Adjustment value"
            type="number"
            min="0"
            step="0.01"
            value={a.value}
            onChange={(e) => update(a.id, { value: e.target.value === "" ? 0 : Number(e.target.value) })}
            className="h-8 w-20 rounded border border-[#C2BBD4] px-2 text-sm text-[#403770]"
          />
          <button
            type="button"
            aria-label="Remove adjustment"
            onClick={() => remove(a.id)}
            className="text-[#6E6390] hover:text-[#F37167]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 rounded-lg bg-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap"
      >
        <Plus size={14} /> + Add adjustment
      </button>
    </div>
  );
}
