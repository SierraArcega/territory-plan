"use client";
import { useState, useRef, useEffect } from "react";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";

export type TargetField = "renewalTarget" | "expansionTarget" | "winbackTarget" | "newBusinessTarget";

interface Props {
  planId: string;
  leaid: string;
  field: TargetField;
  value: number | null;
  siblingValues: {
    renewalTarget:     number | null;
    expansionTarget:   number | null;
    winbackTarget:     number | null;
    newBusinessTarget: number | null;
  };
}

function formatDisplay(v: number | null): string {
  if (v == null || v === 0) return "—";
  if (v >= 1_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

function parseInput(raw: string): number | null {
  const stripped = raw.replace(/[^0-9.]/g, "");
  if (!stripped) return null;
  const n = parseFloat(stripped);
  return Number.isFinite(n) ? n : null;
}

export function TargetSubCell({ planId, leaid, field, value, siblingValues }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateDistrictTargets();

  function enterEdit() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    const parsed = parseInput(draft);
    mutation.mutate({
      planId,
      leaid,
      ...siblingValues,
      [field]: parsed,
    });
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  // Auto-focus + select-all when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center justify-end">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          role="textbox"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full rounded border-b border-[#7C5CDB] bg-[#EDE8FF] px-1.5 py-0.5 text-right text-[12px] font-semibold text-[#1A1228] outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      className={[
        "w-full rounded px-1.5 py-0.5 text-right text-[12px] font-semibold transition-colors",
        value != null && value !== 0
          ? "text-[#5B3FC8] hover:bg-[#EDE8FF]"
          : "text-[#C4B5D0] font-normal hover:bg-[#EDE8FF] hover:text-[#5B3FC8]",
      ].join(" ")}
    >
      {formatDisplay(value)}
    </button>
  );
}
