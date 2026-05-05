"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateActivity } from "@/features/activities/lib/queries";

interface EditableDateCellProps {
  activityId: string;
  startDate: string | null;
}

// Click-to-edit start date. Renders the localized date inline; clicking
// opens a single date input. We commit on blur or Enter, so the row's
// drawer click never fires.
export default function EditableDateCell({ activityId, startDate }: EditableDateCellProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateActivity();

  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setEditing(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing]);

  function commit(value: string) {
    if (!value) {
      // Clear date.
      update.mutate({ activityId, startDate: null });
    } else {
      const iso = new Date(`${value}T12:00:00`).toISOString();
      update.mutate({ activityId, startDate: iso });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div ref={ref} onClick={(e) => e.stopPropagation()} className="inline-block">
        <input
          autoFocus
          type="date"
          defaultValue={startDate ? startDate.slice(0, 10) : ""}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e.currentTarget.value);
          }}
          className="px-1 py-0.5 text-xs text-[#403770] border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#F37167]"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="text-left px-1.5 py-0.5 rounded text-xs text-[#403770] hover:bg-[#EFEDF5]"
    >
      {startDate
        ? new Date(startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : <span className="text-[#A69DC0]">Unscheduled</span>}
    </button>
  );
}
