"use client";

import type { FilterDef, FilterOp } from "../lib/types";

const OP_LABELS: Record<FilterOp, string> = {
  eq: "=",
  neq: "!=",
  in: "in",
  contains: "contains",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  between: "between",
  is_true: "is true",
  is_false: "is false",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

interface FilterPillProps {
  filter: FilterDef;
  columnLabel: string;
  onRemove: () => void;
}

export default function FilterPill({
  filter,
  columnLabel,
  onRemove,
}: FilterPillProps) {
  const opLabel = OP_LABELS[filter.op] ?? filter.op;

  // Format the value for display
  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) {
      if (value.length <= 3) return value.join(", ");
      return `${value.slice(0, 2).join(", ")} +${value.length - 2}`;
    }
    return String(value);
  };

  const hasValue = !["is_true", "is_false", "is_empty", "is_not_empty"].includes(
    filter.op
  );

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F7F5FA] border border-[#D4CFE2] rounded-full text-xs font-medium text-[#544A78]">
      <span className="text-[#403770] font-semibold">{columnLabel}</span>
      <span className="text-[#8A80A8]">{opLabel}</span>
      {hasValue && (
        <span className="text-[#403770]">{formatValue(filter.value)}</span>
      )}
      <button
        onClick={onRemove}
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-[#D4CFE2] transition-colors text-[#8A80A8] hover:text-[#403770] ml-0.5"
        aria-label="Remove filter"
      >
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}
