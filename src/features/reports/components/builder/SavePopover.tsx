"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SaveMode = "save-new" | "update-or-save-new" | "edit-details";

interface Props {
  mode: SaveMode;
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  /** "Save report" or "Save as new" submit (creates a new SavedReport row). */
  onSaveNew: (title: string, description: string) => void;
  /** "Update saved report" submit — overwrites SQL/summary/question. */
  onUpdate?: () => void;
  /** "Save" submit in edit-details mode — patches title/description only. */
  onEditDetails?: (title: string, description: string) => void;
  busy?: boolean;
  /** When set, the popover swaps form for a green inline confirmation
   *  (e.g. "Report updated"). The parent (SaveButton) is responsible for
   *  auto-closing the popover after a beat. */
  confirmation?: string | null;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;

export function SavePopover({
  mode,
  initialTitle,
  initialDescription,
  onClose,
  onSaveNew,
  onUpdate,
  onEditDetails,
  busy = false,
  confirmation = null,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus the title input on mount.
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  // Close on outside click + Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer to next tick so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const trimmed = title.trim();
  const titleValid = trimmed.length > 0 && trimmed.length <= TITLE_MAX;
  const desc = description.slice(0, DESCRIPTION_MAX);

  const heading =
    mode === "edit-details"
      ? "Edit details"
      : mode === "update-or-save-new"
        ? "Save changes"
        : "Save report";

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={heading}
      className="absolute right-0 z-50 w-[340px] rounded-xl border border-[#D4CFE2] bg-white p-3.5"
      style={{
        top: "calc(100% + 8px)",
        boxShadow:
          "0 10px 25px -5px rgba(64,55,112,0.18), 0 6px 10px -6px rgba(64,55,112,0.10)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[#403770]">{heading}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex border-0 bg-transparent p-0.5 text-[#8A80A8] hover:text-[#403770]"
        >
          <X size={14} />
        </button>
      </div>

      {confirmation ? (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-md border border-[#8AC670] bg-[#F7FFF2] px-3 py-2.5"
        >
          <Check size={14} className="shrink-0 text-[#69B34A]" />
          <span className="text-[12.5px] font-medium text-[#403770]">{confirmation}</span>
        </div>
      ) : null}

      <div className={confirmation ? "pointer-events-none mt-2.5 opacity-50" : "mt-2.5"}>
        <label className="mb-1 block text-[11px] font-medium text-[#8A80A8]">Title</label>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          className="w-full rounded-md border border-[#C2BBD4] bg-white px-2.5 py-1.5 text-[12.5px] text-[#403770] outline-none focus:border-[#403770]"
        />
      </div>
      <div className="mt-2">
        <label className="mb-1 block text-[11px] font-medium text-[#8A80A8]">
          Description{" "}
          <span className="font-normal text-[#A69DC0]">· optional</span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          rows={2}
          placeholder="What is this report for?"
          className="w-full resize-none rounded-md border border-[#C2BBD4] bg-white px-2.5 py-1.5 text-[12.5px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]"
        />
      </div>

      {mode === "update-or-save-new" ? (
        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => titleValid && onSaveNew(trimmed, desc)}
            disabled={!titleValid || busy}
            className="flex-1 rounded-md border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#403770] transition-colors hover:bg-[#F7F5FA] disabled:cursor-not-allowed disabled:text-[#A69DC0]"
          >
            <span className="whitespace-nowrap">Save as new</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdate?.()}
            disabled={busy || !onUpdate}
            className="flex-[1.3] rounded-md border-0 bg-[#403770] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
          >
            <span className="whitespace-nowrap">Update saved report</span>
          </button>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border-0 bg-transparent px-3 py-1.5 text-xs font-medium text-[#6E6390] hover:text-[#403770]"
          >
            <span className="whitespace-nowrap">Cancel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!titleValid) return;
              if (mode === "edit-details") onEditDetails?.(trimmed, desc);
              else onSaveNew(trimmed, desc);
            }}
            disabled={!titleValid || busy}
            className="rounded-md border-0 bg-[#403770] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
          >
            <span className="whitespace-nowrap">
              {mode === "edit-details" ? "Save" : "Save report"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
