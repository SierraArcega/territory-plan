"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateActivity } from "@/features/activities/lib/queries";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  CATEGORY_LABELS,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { ChevronDown } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

interface EditableTypeCellProps {
  activityId: string;
  type: ActivityType;
}

export default function EditableTypeCell({ activityId, type }: EditableTypeCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateActivity();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-[#544A78] hover:bg-[#EFEDF5]"
      >
        {ACTIVITY_TYPE_LABELS[type] ?? type}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full mt-1 z-30 w-60 max-h-72 overflow-y-auto bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1"
        >
          {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => {
            const childTypes = ACTIVITY_CATEGORIES[c] as readonly ActivityType[];
            return (
              <div key={c} className="mb-0.5">
                <div className="px-2 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8A80A8]">
                  {CATEGORY_LABELS[c]}
                </div>
                {childTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      update.mutate({ activityId, type: t });
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                      t === type ? "bg-[#F7F5FA] font-semibold text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
                    )}
                  >
                    {ACTIVITY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
