"use client";

import { Check, ChevronDown, Edit3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SavePopover, type SaveMode } from "./SavePopover";

export type SessionMode = "fresh" | "loaded-unmodified" | "loaded-refined";

interface Props {
  sessionMode: SessionMode;
  initialTitle: string;
  initialDescription: string;
  busy?: boolean;
  onSaveNew: (title: string, description: string) => void;
  onUpdateSavedReport?: () => void;
  onEditDetails?: (title: string, description: string) => void;
  onDelete?: () => void;
  /** Set by parent on save/update success — surfaces inline confirmation in
   *  the open popover (or as a brief inline ✓ on the split-button when no
   *  popover is open). Auto-clears in the parent. */
  confirmation?: string | null;
}

export function SaveButton({
  sessionMode,
  initialTitle,
  initialDescription,
  busy = false,
  onSaveNew,
  onUpdateSavedReport,
  onEditDetails,
  onDelete,
  confirmation = null,
}: Props) {
  const [popover, setPopover] = useState<SaveMode | null>(null);

  // When a confirmation arrives while a popover is open, leave it visible for
  // a beat then auto-close. (When no popover is open, the inline split-button
  // shows its own brief "Updated" badge — no popover involved.)
  useEffect(() => {
    if (!confirmation || popover == null) return;
    const t = window.setTimeout(() => setPopover(null), 1500);
    return () => window.clearTimeout(t);
  }, [confirmation, popover]);

  if (sessionMode === "loaded-unmodified") {
    return (
      <div className="relative inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPopover("edit-details")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#403770] transition-colors hover:bg-[#F7F5FA]"
        >
          <Edit3 size={13} />
          <span className="whitespace-nowrap">Edit details</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete?.()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#f58d85] bg-white px-2.5 py-1.5 text-xs font-medium text-[#c25a52] transition-colors hover:bg-[#fef1f0]"
        >
          <Trash2 size={13} />
          <span className="whitespace-nowrap">Delete</span>
        </button>
        {popover === "edit-details" && (
          <SavePopover
            mode="edit-details"
            initialTitle={initialTitle}
            initialDescription={initialDescription}
            busy={busy}
            confirmation={confirmation}
            onClose={() => setPopover(null)}
            onSaveNew={() => {}}
            onEditDetails={(t, d) => onEditDetails?.(t, d)}
          />
        )}
      </div>
    );
  }

  if (sessionMode === "loaded-refined") {
    // When the inline "Update" button was clicked (no popover), show a brief
    // "Updated" badge on the button itself so the user gets feedback.
    const inlineConfirmed = confirmation != null && popover == null;
    return (
      <div className="relative inline-flex items-center">
        <div className="inline-flex overflow-hidden rounded-lg" style={{ boxShadow: "0 0 0 1px #403770" }}>
          <button
            type="button"
            onClick={() => onUpdateSavedReport?.()}
            disabled={busy || inlineConfirmed}
            className="inline-flex items-center gap-1.5 border-0 bg-[#403770] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
            style={{ borderRight: "1px solid rgba(255,255,255,0.18)" }}
          >
            {inlineConfirmed ? <Check size={12} /> : <RefreshCw size={12} />}
            <span className="whitespace-nowrap">{inlineConfirmed ? "Updated" : "Update"}</span>
          </button>
          <button
            type="button"
            onClick={() => setPopover("update-or-save-new")}
            disabled={busy}
            title="Save as new"
            aria-label="Save as new"
            className="inline-flex items-center border-0 bg-[#403770] px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
          >
            <ChevronDown size={12} />
          </button>
        </div>
        {popover === "update-or-save-new" && (
          <SavePopover
            mode="update-or-save-new"
            initialTitle={initialTitle}
            initialDescription={initialDescription}
            busy={busy}
            confirmation={confirmation}
            onClose={() => setPopover(null)}
            onSaveNew={(t, d) => onSaveNew(t, d)}
            onUpdate={() => onUpdateSavedReport?.()}
          />
        )}
      </div>
    );
  }

  // Fresh session
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setPopover("save-new")}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border-0 bg-[#403770] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
      >
        <Plus size={12} />
        <span className="whitespace-nowrap">Save report</span>
      </button>
      {popover === "save-new" && (
        <SavePopover
          mode="save-new"
          initialTitle={initialTitle}
          initialDescription={initialDescription}
          busy={busy}
          confirmation={confirmation}
          onClose={() => setPopover(null)}
          onSaveNew={(t, d) => onSaveNew(t, d)}
        />
      )}
    </div>
  );
}
