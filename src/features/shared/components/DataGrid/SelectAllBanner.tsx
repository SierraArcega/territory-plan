// src/features/shared/components/DataGrid/SelectAllBanner.tsx
"use client";

interface SelectAllBannerProps {
  pageRowCount: number;
  totalMatching: number;
  selectAllMatchingFilters: boolean;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
}

export function SelectAllBanner({
  pageRowCount,
  totalMatching,
  selectAllMatchingFilters,
  onSelectAllMatching,
  onClearSelection,
}: SelectAllBannerProps) {
  if (selectAllMatchingFilters) {
    return (
      <div className="bg-[#C4E7E6]/20 text-xs text-[#403770] text-center py-2 border-b border-[#E2DEEC]">
        All {totalMatching.toLocaleString()} results selected.{" "}
        <button
          onClick={onClearSelection}
          className="font-semibold underline cursor-pointer"
        >
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#C4E7E6]/20 text-xs text-[#403770] text-center py-2 border-b border-[#E2DEEC]">
      All {pageRowCount} rows on this page are selected.{" "}
      <button
        onClick={onSelectAllMatching}
        className="font-semibold underline cursor-pointer"
      >
        Select all {totalMatching.toLocaleString()} matching results
      </button>
    </div>
  );
}
