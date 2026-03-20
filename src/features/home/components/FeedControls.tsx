"use client";

// ============================================================================
// FeedControls — completed toggle + page size dropdown
// ============================================================================

interface FeedControlsProps {
  showCompleted: boolean;
  onToggleCompleted: () => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export default function FeedControls({
  showCompleted,
  onToggleCompleted,
  pageSize,
  onPageSizeChange,
}: FeedControlsProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Left: completed toggle */}
      <button
        onClick={onToggleCompleted}
        className="flex items-center gap-2 group"
        type="button"
      >
        {/* Toggle track */}
        <span
          className={`relative w-8 h-[18px] rounded-full transition-colors ${
            showCompleted ? "bg-[#403770]" : "bg-[#C2BBD4]"
          }`}
        >
          {/* Toggle thumb */}
          <span
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              showCompleted ? "left-[16px]" : "left-[2px]"
            }`}
          />
        </span>
        <span className="text-xs font-medium text-[#6E6390]">
          Show Completed
        </span>
      </button>

      {/* Right: page size dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#6E6390]">Showing:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390] bg-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#403770]"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
