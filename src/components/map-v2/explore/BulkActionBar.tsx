"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUsers, useTags, useBatchEditDistricts, useBatchTagDistricts } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  selectedCount: number;
  selectedIds: string[];
  selectAllMatchingFilters: boolean;
  totalMatching: number;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
}

type ActivePopover = "owner" | "tag" | null;

// Store action parameters, NOT closures, in state
type PendingAction =
  | { type: "owner"; ownerName: string; label: string }
  | { type: "addTag"; tagId: number; label: string }
  | { type: "removeTag"; tagId: number; label: string };

export default function BulkActionBar({
  selectedCount,
  selectedIds,
  selectAllMatchingFilters,
  totalMatching,
  onSelectAllMatching,
  onClearSelection,
}: Props) {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: users } = useUsers();
  const { data: tags } = useTags();
  const batchEdit = useBatchEditDistricts();
  const batchTag = useBatchTagDistricts();

  const count = selectAllMatchingFilters ? totalMatching : selectedCount;
  const isProcessing = batchEdit.isPending || batchTag.isPending;

  // Close popover on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
      setActivePopover(null);
    }
  }, []);

  useEffect(() => {
    if (activePopover) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePopover, handleOutsideClick]);

  const handleAssignOwner = (ownerName: string) => {
    setActivePopover(null);
    setPendingAction({
      type: "owner",
      ownerName,
      label: `Assign "${ownerName || "Unassigned"}" as owner to ${count.toLocaleString()} district${count !== 1 ? "s" : ""}?`,
    });
  };

  const handleTag = (tagId: number, tagName: string, action: "add" | "remove") => {
    setActivePopover(null);
    const verb = action === "add" ? "Add" : "Remove";
    setPendingAction({
      type: action === "add" ? "addTag" : "removeTag",
      tagId,
      label: `${verb} tag "${tagName}" ${action === "add" ? "to" : "from"} ${count.toLocaleString()} district${count !== 1 ? "s" : ""}?`,
    });
  };

  // Execute the pending action using CURRENT render's references
  const handleConfirm = () => {
    if (!pendingAction) return;

    const onDone = () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      onClearSelection();
      setPendingAction(null);
    };

    if (pendingAction.type === "owner") {
      batchEdit.mutate(
        { leaids: selectedIds, owner: pendingAction.ownerName },
        { onSuccess: onDone }
      );
    } else {
      const action = pendingAction.type === "addTag" ? "add" : "remove";
      batchTag.mutate(
        { leaids: selectedIds, action, tagId: pendingAction.tagId },
        { onSuccess: onDone }
      );
    }
  };

  if (selectedCount === 0 && !selectAllMatchingFilters) return null;

  return (
    <>
      {/* Confirmation overlay — portaled to body to escape transform containing block */}
      {pendingAction && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md mx-4">
            <p className="text-sm text-gray-700 mb-4">{pendingAction.label}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setPendingAction(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#352d60] disabled:opacity-60 transition-colors"
              >
                {isProcessing ? "Applying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Action bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
        <div
          ref={popoverRef}
          className="flex items-center gap-3 px-4 py-2.5 bg-[#403770] text-white rounded-xl shadow-lg shadow-[#403770]/20 border border-[#403770]"
        >
          {/* Count */}
          <span className="text-sm font-medium tabular-nums">
            {count.toLocaleString()} selected
          </span>

          {/* Select all matching banner */}
          {!selectAllMatchingFilters && totalMatching > selectedCount && (
            <button
              onClick={onSelectAllMatching}
              className="text-xs text-white/70 hover:text-white underline underline-offset-2 transition-colors"
            >
              Select all {totalMatching.toLocaleString()}
            </button>
          )}

          <div className="w-px h-5 bg-white/20" />

          {/* Assign Owner */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === "owner" ? null : "owner")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13" />
              </svg>
              Assign Owner
            </button>

            {activePopover === "owner" && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto py-1">
                  <button
                    onClick={() => handleAssignOwner("")}
                    className="w-full text-left px-3 py-2 text-sm text-gray-400 italic hover:bg-gray-50"
                  >
                    Unassigned
                  </button>
                  {(users || []).map((u: { id: string; fullName: string | null; email: string }) => (
                    <button
                      key={u.id}
                      onClick={() => handleAssignOwner(u.fullName || u.email)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {u.fullName || u.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tag */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === "tag" ? null : "tag")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8.5V3C2 2.4 2.4 2 3 2H8.5L14 7.5L8.5 13L2 8.5Z" />
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
              </svg>
              Tag
            </button>

            {activePopover === "tag" && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {/* Add tag section */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Add tag
                  </div>
                  {(tags || []).map((tag: { id: number; name: string; color: string }) => (
                    <button
                      key={`add-${tag.id}`}
                      onClick={() => handleTag(tag.id, tag.name, "add")}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}

                  {/* Divider */}
                  <div className="border-t border-gray-100 my-1" />

                  {/* Remove tag section */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Remove tag
                  </div>
                  {(tags || []).map((tag: { id: number; name: string; color: string }) => (
                    <button
                      key={`rm-${tag.id}`}
                      onClick={() => handleTag(tag.id, tag.name, "remove")}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 opacity-60"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}

                  {(!tags || tags.length === 0) && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">
                      No tags created yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            className="p-1 text-white/60 hover:text-white transition-colors"
            title="Clear selection"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
