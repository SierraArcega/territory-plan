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
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={showCompleted}
          onClick={onToggleCompleted}
          className={`relative inline-flex items-center w-8 h-[18px] rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1 ${
            showCompleted ? "bg-[#403770]" : "bg-[#C2BBD4]"
          }`}
        >
          <span
            className={`absolute left-[2px] top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
              showCompleted ? "translate-x-[14px]" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm font-medium text-[#8A80A8]">
          Show Completed
        </span>
      </div>

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
