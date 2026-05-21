"use client";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { NoteBody } from "./NoteBody";
import type { DistrictNoteEntry } from "../../../lib/queries";

interface Props {
  note: DistrictNoteEntry;
  currentUserId: string | null;
  onDelete: (noteId: string) => void;
}

export function NoteEntry({ note, currentUserId, onDelete }: Props) {
  const mine = currentUserId != null && note.author.id === currentUserId;
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;
  const initial = (note.author.fullName || note.author.email).slice(0, 1).toUpperCase();

  return (
    <article className="p-3 rounded-[10px] border border-[#E2DEEC] bg-[#FFFCFA] group">
      <div className="flex items-center gap-2 text-[11px] text-[#8A80A8] mb-1.5">
        <span aria-hidden className="w-[22px] h-[22px] rounded-full bg-[#403770] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </span>
        <span className="font-semibold text-[#403770] whitespace-nowrap">{note.author.fullName || note.author.email}</span>
        <span className="whitespace-nowrap">· {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
        {edited && <span className="whitespace-nowrap italic">· edited</span>}
        {mine && (
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => onDelete(note.id)}
            className="ml-auto opacity-0 group-hover:opacity-100 text-[#A69DC0] hover:text-[#F37167] transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <NoteBody doc={note.bodyJson} />
    </article>
  );
}
