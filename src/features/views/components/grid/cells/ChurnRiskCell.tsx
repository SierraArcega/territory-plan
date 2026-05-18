"use client";
import { useState } from "react";
import { useUpdatePlanDistrict } from "../../../lib/queries";

const OPTIONS = ["low", "medium", "high", "churned"] as const;
type Option = (typeof OPTIONS)[number];

const LABEL: Record<Option, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  churned: "Churned",
};

const PILL: Record<Option, string> = {
  // Plum-derived neutrals + status palette per tokens.md. No Tailwind grays.
  low: "bg-[#E5F5EC] text-[#1F7A3F]",
  medium: "bg-[#FFF1D6] text-[#8A5C00]",
  high: "bg-[#FFE0DC] text-[#A8281C]",
  churned: "bg-[#EFEDF5] text-[#4B3A6B]",
};

interface Props {
  value: string | null;
  planId: string | null;
  leaid: string;
  disabled: boolean;
}

export function ChurnRiskCell({ value, planId, leaid, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const mutation = useUpdatePlanDistrict(planId ?? "", leaid);

  const current = isOption(value) ? value : null;

  if (disabled || planId == null) {
    if (current == null) return <span className="text-[#A69DC0]">—</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[current]}`}>
        {LABEL[current]}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-pointer rounded text-left focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {current == null ? (
          <span className="text-[#A69DC0]">—</span>
        ) : (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PILL[current]}`}>
            {LABEL[current]}
          </span>
        )}
      </button>
    );
  }

  return (
    <select
      autoFocus
      value={current ?? ""}
      onChange={(e) => {
        const next = e.target.value === "" ? null : (e.target.value as Option);
        mutation.mutate({ churnRisk: next });
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      className="rounded border border-[#D3CCE0] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
    >
      <option value="">— (unset)</option>
      {OPTIONS.map((o) => (
        <option key={o} value={o}>{LABEL[o]}</option>
      ))}
    </select>
  );
}

function isOption(v: unknown): v is Option {
  return typeof v === "string" && (OPTIONS as readonly string[]).includes(v);
}
