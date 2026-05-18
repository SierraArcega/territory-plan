"use client";
import { useEffect, useRef, useState } from "react";
import { useUpdatePlanDistrict } from "../../../lib/queries";

interface Props {
  value: string | null;
  planId: string | null;
  leaid: string;
  disabled: boolean;
}

const DEBOUNCE_MS = 600;

export function PlanNotesCell({ value, planId, leaid, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutation = useUpdatePlanDistrict(planId ?? "", leaid);

  // Keep draft in sync if value changes from upstream while not editing.
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  // Cleanup any in-flight debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const scheduleSave = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      mutation.mutate({ notes: next === "" ? null : next });
    }, DEBOUNCE_MS);
  };

  const commitNow = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next !== (value ?? "")) {
      mutation.mutate({ notes: next === "" ? null : next });
    }
    setEditing(false);
  };

  const cancel = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraft(value ?? "");
    setEditing(false);
  };

  if (disabled || planId == null) {
    if (!value) return <span className="text-[#A69DC0]">—</span>;
    return (
      <span className="block max-w-[260px] truncate whitespace-nowrap text-sm text-[#1A1430]" title={value}>
        {value}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full max-w-[260px] cursor-text truncate text-left focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {value ? (
          <span className="whitespace-nowrap text-sm text-[#1A1430]" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-[#A69DC0]">—</span>
        )}
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      role="textbox"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        scheduleSave(e.target.value);
      }}
      onBlur={() => commitNow(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commitNow(draft);
        }
      }}
      rows={Math.min(6, Math.max(1, draft.split("\n").length))}
      className="w-full min-w-[200px] max-w-[400px] rounded border border-[#6B4D9C] bg-white px-2 py-1 text-sm text-[#1A1430] focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
    />
  );
}
