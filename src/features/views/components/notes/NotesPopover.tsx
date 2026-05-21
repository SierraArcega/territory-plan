"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useProfile } from "@/lib/api";
import {
  useDistrictNotes,
  useCreateDistrictNote,
  useDeleteDistrictNote,
} from "../../lib/queries";
import { NoteComposer, type NoteDraft } from "./NoteComposer";
import { NoteEntry } from "./NoteEntry";

interface Props {
  leaid: string;
  districtName: string;
  onClose: () => void;
}

export function NotesPopover({ leaid, districtName, onClose }: Props) {
  const { data: profile } = useProfile();
  const { data: notes = [], isLoading } = useDistrictNotes(leaid);
  const create = useCreateDistrictNote();
  const remove = useDeleteDistrictNote();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function submit(draft: NoteDraft) {
    create.mutate({ leaid, bodyJson: draft.bodyJson, bodyText: draft.bodyText });
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Notes for ${districtName}`}
      className="w-[480px] max-w-[92vw] rounded-[14px] border border-[#D4CFE2] bg-white shadow-[0_16px_40px_rgba(64,55,112,0.22)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E2DEEC]">
        <span className="text-[12px] font-bold text-[#403770] uppercase tracking-[0.04em] whitespace-nowrap truncate">
          {districtName} · Notes {notes.length > 0 ? `(${notes.length})` : ""}
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="text-[#A69DC0] hover:text-[#403770]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5">
        <NoteComposer onSubmit={submit} pending={create.isPending} />
      </div>

      <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 max-h-[300px] overflow-auto" style={{ touchAction: "pan-y" }}>
        {isLoading ? (
          <div className="text-xs text-[#A69DC0]">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-[#A69DC0] italic">No notes yet — add the first one above.</div>
        ) : (
          notes.map((n) => (
            <NoteEntry
              key={n.id}
              note={n}
              currentUserId={profile?.id ?? null}
              onDelete={(noteId) => remove.mutate({ leaid, noteId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
