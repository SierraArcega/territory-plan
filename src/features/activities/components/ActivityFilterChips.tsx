"use client";

const FILTER_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Email", value: "gmail_sync" },
  { label: "Calendar", value: "calendar_sync" },
  { label: "Slack", value: "slack_sync" },
  { label: "Manual", value: "manual" },
];

interface ActivityFilterChipsProps {
  activeFilter: string | null; // null = "All"
  onFilterChange: (source: string | null) => void;
}

export default function ActivityFilterChips({
  activeFilter,
  onFilterChange,
}: ActivityFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTER_OPTIONS.map((opt) => {
        const isActive = activeFilter === opt.value;
        return (
          <button
            key={opt.label}
            onClick={() => onFilterChange(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? "bg-[#403770] text-white"
                : "border border-gray-200 text-gray-600 hover:border-[#403770]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
