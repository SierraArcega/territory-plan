"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NOTE_TYPES, noteTypeMeta } from "../../lib/note-types";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function NoteTypePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = noteTypeMeta(value);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.pill}`}
      >
        {meta.label}
        <ChevronDown className="w-3 h-3" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-[#E2DEEC] bg-white p-1 shadow-md">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="menuitem"
              onClick={() => { onChange(t.value); setOpen(false); }}
              className="flex w-full items-center px-2 py-1 text-left hover:bg-[#F7F5FA] rounded"
            >
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.pill}`}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
