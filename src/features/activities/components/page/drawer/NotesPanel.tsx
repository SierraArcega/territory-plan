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
}: {
  activityId: string;
  readOnly: boolean;
}) {
  const { data: notes = [], isLoading } = useActivityNotes(activityId);
  const create = useCreateActivityNote();
  const remove = useDeleteActivityNote();
  const { data: profile } = useProfile();
  const [draft, setDraft] = useState("");
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
        {isLoading ? (
          <div className="text-xs text-[#A69DC0]">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-[#A69DC0]">No notes yet — add the first one below.</div>
        ) : (
          notes.map((n) => {
            const mine = profile?.id === n.author.id;
            return (
              <article key={n.id} className="flex items-start gap-2.5 group">
                <div
                  aria-hidden
                  className="mt-0.5 w-5.5 h-5.5 rounded-full bg-[#403770] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22 }}
                >
                  {(n.author.fullName || n.author.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-[#8A80A8]">
                    <span className="font-semibold text-[#403770]">
                      {n.author.fullName || n.author.email}
                    </span>
                    <span>· {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                    {mine && !readOnly && (
                      <button
                        type="button"
                        aria-label="Delete note"
                        onClick={() =>
                          remove.mutate({ activityId, noteId: n.id })
                        }
                        className="ml-auto opacity-0 group-hover:opacity-100 text-[#A69DC0] hover:text-[#F37167] transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <pre className="mt-0.5 text-sm text-[#403770] whitespace-pre-wrap font-sans">
                    {n.body}
                  </pre>
                </div>
              </article>
            );
          })
        )}
      </div>

      {!readOnly && (
        <div className="border-t border-[#E2DEEC] bg-[#FFFCFA] px-5 py-3 space-y-2">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Add a note… (⌘↵ to send)"
            rows={2}
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft("")}
              className="px-2.5 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || create.isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50"
            >
              {create.isPending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      )}

      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
