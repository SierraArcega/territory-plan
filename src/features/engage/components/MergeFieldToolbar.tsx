"use client";

import { SYSTEM_MERGE_FIELDS, type SystemMergeFieldKey } from "../types";

interface MergeFieldToolbarProps {
  onInsert: (fieldKey: string) => void;
}

const FINANCIAL_KEYS = new Set([
  "district.pipeline",
  "district.bookings",
  "district.invoicing",
  "district.sessions_revenue",
]);

const CATEGORY_ORDER = ["Contact", "District", "Financial", "Sender", "Date"] as const;

type Category = (typeof CATEGORY_ORDER)[number];

function getCategoryLabel(key: string): Category {
  if (FINANCIAL_KEYS.has(key)) return "Financial";
  const source = SYSTEM_MERGE_FIELDS[key as SystemMergeFieldKey].source;
  switch (source) {
    case "contact":
      return "Contact";
    case "district":
      return "District";
    case "sender":
      return "Sender";
    case "date":
      return "Date";
    default:
      return "Contact";
  }
}

function groupFields() {
  const groups: Record<Category, { key: string; label: string }[]> = {
    Contact: [],
    District: [],
    Financial: [],
    Sender: [],
    Date: [],
  };

  for (const [key, meta] of Object.entries(SYSTEM_MERGE_FIELDS)) {
    const category = getCategoryLabel(key);
    groups[category].push({ key, label: meta.label });
  }

  return groups;
}

const GROUPED_FIELDS = groupFields();

export default function MergeFieldToolbar({ onInsert }: MergeFieldToolbarProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
        Merge Fields
      </p>
      {CATEGORY_ORDER.map((category) => {
        const fields = GROUPED_FIELDS[category];
        if (fields.length === 0) return null;
        return (
          <div key={category}>
            <p className="text-[10px] font-medium text-[#A69DC0] uppercase tracking-wider mb-1.5">
              {category}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fields.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onInsert(key)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-[#544A78] bg-[#F7F5FA] border border-[#E2DEEC] rounded-full hover:bg-[#EFEDF5] hover:border-[#D4CFE2] transition-colors cursor-pointer"
                >
                  {`{{${label}}}`}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
