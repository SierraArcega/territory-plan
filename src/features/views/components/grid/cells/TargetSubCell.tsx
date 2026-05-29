"use client";
import { useState, useRef, useEffect } from "react";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

export type TargetField = "renewalTarget" | "expansionTarget" | "winbackTarget" | "newBusinessTarget";

interface Props {
  planId: string;
  leaid: string;
  field: TargetField;
  value: number | null;
}

function parseInput(raw: string): number | null {
  const stripped = raw.replace(/[^0-9.]/g, "");
  if (!stripped) return null;
  const n = parseFloat(stripped);
  return Number.isFinite(n) ? n : null;
}

export function TargetSubCell({ planId, leaid, field, value }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref mirrors `editing` state so the value-sync effect can read it without
  // depending on it — if `editing` were in the dep array, setEditing(false)
  // inside commit() would immediately trigger the effect and overwrite the
  // just-set optimistic value with the still-stale `value` prop.
  const editingRef = useRef(false);
  const mutation = useUpdateDistrictTargets();

  // Optimistic display: reflects the saved value immediately while the
  // mutation + refetch completes in the background.
  const [optimisticValue, setOptimisticValue] = useState<number | null>(value);

  function enterEdit() {
    editingRef.current = true;
    // Use optimisticValue so a re-open after a save shows the new number,
    // not the stale prop (which hasn't refetched yet).
    setDraft(optimisticValue != null ? String(optimisticValue) : "");
    setEditing(true);
  }

  function commit() {
    const parsed = parseInput(draft);
    editingRef.current = false;
    setOptimisticValue(parsed); // instant feedback before network round-trip
    // Send only this field — the API ignores undefined fields, so sibling
    // values are left untouched. This avoids overwriting a concurrent edit
    // on another sub-cell with a stale sibling value.
    mutation.mutate({ planId, leaid, [field]: parsed });
    setEditing(false);
  }

  function cancel() {
    editingRef.current = false;
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

  // Sync from parent prop — only fires when `value` changes (i.e. after a
  // background refetch). Intentionally does NOT depend on `editing` so that
  // setEditing(false) in commit() cannot trigger this and clobber the
  // optimistic value before the network round-trip completes.
  useEffect(() => {
    if (!editingRef.current) setOptimisticValue(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <div className="flex items-center justify-end">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full rounded border-b border-[#7C5CDB] bg-[#EDE8FF] px-1.5 py-0.5 text-right text-[12px] font-semibold text-[#1A1228] outline-none"
        />
      </div>
    );
  }

  const isEmpty = optimisticValue == null || optimisticValue === 0;
  return (
    <button
      type="button"
      onClick={enterEdit}
      className={[
        "w-full rounded px-1.5 py-0.5 text-right text-[12px] font-semibold transition-all",
        isEmpty
          ? "text-[#C4B5D0] font-normal hover:bg-[#EDE8FF] hover:text-[#5B3FC8]"
          : "text-[#5B3FC8] hover:bg-[#EDE8FF]",
        mutation.isPending ? "opacity-50 italic" : "",
      ].join(" ")}
    >
      {isEmpty ? "—" : formatCurrency(optimisticValue, true)}
    </button>
  );
}
