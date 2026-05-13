"use client";

/**
 * ModalFooter — fixed bottom strip with summary text + Cancel / Create.
 *
 *   Left:  "{N} conditions · {count} {source}" muted summary line
 *   Right: Cancel (secondary) + Create list (primary, bookmark icon)
 */
import { Bookmark, Loader2 } from "lucide-react";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";

interface ModalFooterProps {
  leafCount: number;
  matchCount: number | null;
  source: SavedListSource;
  submitDisabled: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function ModalFooter({
  leafCount,
  matchCount,
  source,
  submitDisabled,
  submitting,
  onCancel,
  onSubmit,
}: ModalFooterProps) {
  return (
    <div className="px-6 py-3.5 border-t border-[#E2DEEC] bg-white flex items-center justify-between gap-3 flex-shrink-0">
      <div className="text-xs text-[#8A80A8] min-w-0 truncate">
        <span className="tabular-nums text-[#544A78] font-semibold">
          {leafCount}
        </span>{" "}
        conditions ·{" "}
        <span className="tabular-nums text-[#544A78] font-semibold">
          {matchCount == null ? "—" : matchCount.toLocaleString()}
        </span>{" "}
        {source}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 text-sm font-medium text-[#403770] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] hover:border-[#403770] transition-colors duration-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled || submitting}
          className={[
            "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors duration-100",
            submitDisabled || submitting
              ? "bg-[#403770]/50 text-white cursor-not-allowed"
              : "bg-[#403770] text-white hover:bg-[#322a5a]",
          ].join(" ")}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Bookmark className="w-3.5 h-3.5" aria-hidden />
          )}
          <span className="whitespace-nowrap">Create list</span>
        </button>
      </div>
    </div>
  );
}
