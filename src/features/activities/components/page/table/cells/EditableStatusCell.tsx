"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateActivity } from "@/features/activities/lib/queries";
import {
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityStatus,
} from "@/features/activities/types";
import { ChevronDown } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

interface EditableStatusCellProps {
  activityId: string;
  status: ActivityStatus;
}

// Inline status pill. Click opens a small dropdown of all valid statuses;
// picking one fires useUpdateActivity (which optimistically patches the
// cache) and closes.
export default function EditableStatusCell({ activityId, status }: EditableStatusCellProps) {
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

  const cfg = ACTIVITY_STATUS_CONFIG[status];

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer hover:ring-1 hover:ring-[#D4CFE2] transition"
        style={cfg ? { backgroundColor: cfg.bgColor, color: cfg.color } : undefined}
      >
        {cfg && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden />
        )}
        {cfg?.label ?? status}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full mt-1 z-30 w-44 bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1"
        >
          {VALID_ACTIVITY_STATUSES.map((s) => {
            const c = ACTIVITY_STATUS_CONFIG[s];
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  update.mutate({ activityId, status: s });
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                  active ? "bg-[#F7F5FA] font-semibold text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
