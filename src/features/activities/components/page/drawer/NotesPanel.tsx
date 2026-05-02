"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  useActivityNotes,
  useCreateActivityNote,
  useDeleteActivityNote,
} from "@/features/activities/lib/queries";
import { useProfile } from "@/lib/api";

export default function NotesPanel({
  activityId,
  readOnly,
  onSaved,
}: {
  activityId: string;
  readOnly: boolean;
  onSaved?: () => void;
}) {
  const { data: notes = [], isLoading } = useActivityNotes(activityId);
  const create = useCreateActivityNote();
  const remove = useDeleteActivityNote();
  const { data: profile } = useProfile();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    create.mutate(
      { activityId, body },
      {
        onSuccess: () => {
          setDraft("");
          if (liveRef.current) liveRef.current.textContent = "Note saved";
          taRef.current?.focus();
          onSaved?.();
        },
      }
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [draft]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
        {/* Composer (above notes) */}
        {!readOnly && (
          <div
            className={`rounded-[10px] bg-white overflow-hidden transition-colors border ${
              focused ? "border-[#403770]" : "border-[#D4CFE2]"
            }`}
          >
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown}
              placeholder="Log a note… what was discussed, key takeaways, blockers."
              rows={focused || draft ? 4 : 2}
              className="w-full px-3 py-2.5 text-sm leading-relaxed text-[#403770] placeholder:text-[#A69DC0] resize-y bg-transparent focus:outline-none"
            />
            <div className="flex items-center justify-between px-2.5 py-2 border-t border-[#E2DEEC] bg-[#FFFCFA]">
              <span className="text-[10px] text-[#A69DC0] font-medium">
                ⌘↵ to save · markdown supported
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraft("")}
                  disabled={!draft}
                  className="px-2.5 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!draft.trim() || create.isPending}
                  className="px-3 py-1 text-xs font-semibold text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50"
                >
                  {create.isPending ? "Saving…" : "Add note"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes list */}
        {isLoading ? (
          <div className="text-xs text-[#A69DC0]">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-[#A69DC0] italic">
            No notes yet — add the first one above.
          </div>
        ) : (
          notes.map((n) => {
            const mine = profile?.id === n.author.id;
            return (
              <article
                key={n.id}
                className="p-3 rounded-[10px] border border-[#E2DEEC] bg-[#FFFCFA] group"
              >
                <div className="flex items-center gap-2 text-[11px] text-[#8A80A8] mb-1.5">
                  <div
                    aria-hidden
                    className="w-[22px] h-[22px] rounded-full bg-[#403770] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  >
                    {(n.author.fullName || n.author.email).slice(0, 1).toUpperCase()}
                  </div>
                  <span className="font-semibold text-[#403770]">
                    {n.author.fullName || n.author.email}
                  </span>
                  <span>· {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                  {mine && !readOnly && (
                    <button
                      type="button"
                      aria-label="Delete note"
                      onClick={() =>
                        remove.mutate(
                          { activityId, noteId: n.id },
                          { onSuccess: () => onSaved?.() }
                        )
                      }
                      className="ml-auto opacity-0 group-hover:opacity-100 text-[#A69DC0] hover:text-[#F37167] transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <pre className="text-sm text-[#544A78] whitespace-pre-wrap font-sans leading-relaxed">
                  {n.body}
                </pre>
              </article>
            );
          })
        )}
      </div>

      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
