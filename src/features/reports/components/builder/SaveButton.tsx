"use client";

import { ChevronDown, Edit3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
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
}: Props) {
  const [popover, setPopover] = useState<SaveMode | null>(null);

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
            onClose={() => setPopover(null)}
            onSaveNew={() => {}}
            onEditDetails={(t, d) => {
              onEditDetails?.(t, d);
              setPopover(null);
            }}
          />
        )}
      </div>
    );
  }

  if (sessionMode === "loaded-refined") {
    return (
      <div className="relative inline-flex items-center">
        <div className="inline-flex overflow-hidden rounded-lg" style={{ boxShadow: "0 0 0 1px #403770" }}>
          <button
            type="button"
            onClick={() => onUpdateSavedReport?.()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border-0 bg-[#403770] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#322a5a] disabled:cursor-not-allowed disabled:bg-[#A69DC0]"
            style={{ borderRight: "1px solid rgba(255,255,255,0.18)" }}
          >
            <RefreshCw size={12} />
            <span className="whitespace-nowrap">Update</span>
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
            onClose={() => setPopover(null)}
            onSaveNew={(t, d) => {
              onSaveNew(t, d);
              setPopover(null);
            }}
            onUpdate={() => {
              onUpdateSavedReport?.();
              setPopover(null);
            }}
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
          onClose={() => setPopover(null)}
          onSaveNew={(t, d) => {
            onSaveNew(t, d);
            setPopover(null);
          }}
        />
      )}
    </div>
  );
}
